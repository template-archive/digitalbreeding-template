import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { FeedbackOverlay } from '@/features/feedback/FeedbackOverlay'
import { hasTemplate, loadTemplate, type TemplateEntry } from './registry'

class TemplateErrorBoundary extends Component<{ slug: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[template:${this.props.slug}]`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (error) return <TemplateError slug={this.props.slug} title="템플릿 렌더 중 오류가 발생했습니다." message={error.message} />
    return this.props.children
  }
}

function TemplateError({ slug, title, message }: { slug: string; title: string; message: string }) {
  return (
    <div data-template-error={slug} role="alert" className="rounded-lg border border-negative/40 bg-negative/5 p-4 text-sm text-text">
      <p className="font-semibold text-negative">{title}</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted">{message}</pre>
    </div>
  )
}

type LoadState = { key: string; entry: TemplateEntry; error: null } | { key: string; entry: null; error: Error } | null

/** 템플릿 모듈 하나만 지연 로드한다. 로드 결과는 `${category}/${slug}` 키와 함께 저장해 경로가 바뀌면 이전 결과를 쓰지 않는다. */
function useLoadedTemplate(category: string, slug: string, enabled: boolean) {
  const key = `${category}/${slug}`
  const [state, setState] = useState<LoadState>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadTemplate(category, slug).then(
      entry => alive && setState({ key, entry, error: null }),
      (error: Error) => {
        if (!alive) return
        console.error(`[template:${slug}] ${error.message}`)
        setState({ key, entry: null, error })
      },
    )
    return () => {
      alive = false
    }
  }, [category, slug, key, enabled])
  return state && state.key === key ? state : null
}

/**
 * 템플릿 하나를 렌더한다. 계약:
 * - 로딩 중: data-template-loading 요소(루트·missing 없음)
 * - 성공: data-template-root="{slug}" 요소 안에 템플릿
 * - 오류(모듈 로드 실패·렌더 오류): data-template-root 안의 data-template-error="{slug}" 요소에 메시지
 * - 없음: data-template-missing 요소(glob 키로 동기 판단)
 */
export function TemplateView({ category, slug }: { category: string; slug: string }) {
  const exists = hasTemplate(category, slug)
  const loaded = useLoadedTemplate(category, slug, exists)

  if (!exists) {
    return (
      <div data-template-missing={`${category}/${slug}`} role="alert" className="rounded-lg border border-border bg-surface p-6 text-sm">
        <h1 className="text-base font-semibold text-text">템플릿을 찾을 수 없습니다.</h1>
        <p className="mt-1 text-muted">
          <code>
            {category}/{slug}
          </code>
          에 해당하는 템플릿 폴더가 없습니다.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div data-template-loading={`${category}/${slug}`} role="status" aria-live="polite" className="py-10 text-center text-sm text-muted">
        템플릿을 불러오는 중…
      </div>
    )
  }

  if (loaded.error) {
    return (
      <div data-template-root={slug} data-print-flat="" className="min-w-0">
        <TemplateError slug={slug} title="템플릿 모듈을 불러오지 못했습니다." message={loaded.error.message} />
      </div>
    )
  }

  const { Component: Tpl } = loaded.entry
  return (
    <div data-template-root={slug} data-print-flat="" className="min-w-0">
      <FeedbackOverlay key={`${category}/${slug}`} templateKey={`${category}/${slug}`} templateTitle={loaded.entry.meta.title}>
        <TemplateErrorBoundary key={`${category}/${slug}`} slug={slug}>
          <Tpl />
        </TemplateErrorBoundary>
      </FeedbackOverlay>
    </div>
  )
}
