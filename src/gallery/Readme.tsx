/**
 * 템플릿 README 보기. README는 지연 로드한다(`?raw`, 템플릿마다 작은 청크).
 * 넓은 화면(lg 이상): 오른쪽 패널(떠 있는 요소라 그림자 허용, 모달 아님 — 템플릿을 보며 읽는다). 좁은 화면: 공통 BottomSheet.
 * 둘 다 role=dialog, 열리면 「닫기」로 포커스, Esc로 닫힘. 닫힌 뒤 포커스 복귀는 여는 버튼 쪽(TemplatePage)이 맡는다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { BottomSheet, Button } from '@/design-system'
import { Markdown } from './markdown'

const loaders = import.meta.glob<string>('../templates/*/*/README.md', { query: '?raw', import: 'default' })
const cache = new Map<string, string>()

const keyOf = (category: string, slug: string) => `../templates/${category}/${slug}/README.md`

export function hasReadme(category: string, slug: string): boolean {
  return keyOf(category, slug) in loaders
}

export function readmePath(category: string, slug: string): string {
  return `src/templates/${category}/${slug}/README.md`
}

type State = { key: string; text: string; error: null } | { key: string; text: null; error: string } | null

function useReadme(category: string, slug: string, enabled: boolean) {
  const key = keyOf(category, slug)
  const [state, setState] = useState<State>(() => (cache.has(key) ? { key, text: cache.get(key)!, error: null } : null))
  useEffect(() => {
    if (!enabled) return
    const cached = cache.get(key)
    if (cached != null) {
      setState({ key, text: cached, error: null })
      return
    }
    const load = loaders[key]
    if (!load) {
      setState({ key, text: null, error: 'README 파일이 없습니다.' })
      return
    }
    let alive = true
    load().then(
      text => {
        cache.set(key, text)
        if (alive) setState({ key, text, error: null })
      },
      (e: unknown) => alive && setState({ key, text: null, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      alive = false
    }
  }, [key, enabled])
  return state && state.key === key ? state : null
}

function ReadmeBody({ category, slug, open }: { category: string; slug: string; open: boolean }) {
  const state = useReadme(category, slug, open)
  if (!state)
    return (
      <p role="status" className="text-sm text-muted">
        README를 불러오는 중…
      </p>
    )
  if (state.error != null)
    return (
      <p role="alert" className="text-sm text-text">
        README를 불러오지 못했습니다: {state.error}
      </p>
    )
  return <Markdown source={state.text} />
}

export function ReadmeDialog({ open, onClose, category, slug, wide }: { open: boolean; onClose: () => void; category: string; slug: string; wide: boolean }) {
  const titleId = useId()
  const closeBtn = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // 넓은 화면 패널: Esc로 닫고, 열리면 「닫기」로 포커스(좁은 화면 BottomSheet는 자체 처리)
  useEffect(() => {
    if (!open || !wide) return
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, wide])

  if (!open) return null
  const path = readmePath(category, slug)

  if (!wide) {
    return (
      <BottomSheet open onClose={onClose} labelledBy={titleId} backdropLabel="README 닫기" maxHeight="88vh">
        <div data-print-hide="">
          <h2 id={titleId} className="text-base font-semibold text-text">
            README
          </h2>
          <p className="mt-0.5 break-all text-[13px] text-muted">
            <code className="font-mono">{path}</code>
          </p>
          <div className="mt-5">
            <ReadmeBody category={category} slug={slug} open={open} />
          </div>
        </div>
      </BottomSheet>
    )
  }

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      data-print-hide=""
      className="gallery-panel-in fixed inset-y-0 right-0 z-40 flex w-[min(560px,100vw)] flex-col border-l border-border bg-surface shadow-2"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-text">
            README
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            <code className="font-mono">{path}</code>
          </p>
        </div>
        <Button ref={closeBtn} variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={onClose} className="-mr-2 shrink-0">
          닫기
        </Button>
      </div>
      <div tabIndex={0} role="region" aria-label="README 내용" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <ReadmeBody category={category} slug={slug} open={open} />
      </div>
    </div>
  )
}
