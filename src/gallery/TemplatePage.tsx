/**
 * 템플릿 상세 화면(갤러리 모드): 도구 줄 → 템플릿(또는 폭 미리보기 iframe) → 이전·다음.
 * - 셸은 h1을 추가하지 않는다. 템플릿 자신의 h1이 화면 제목이다.
 * - 도구 줄·이전/다음은 sticky가 아니고 인쇄에서 숨는다(data-print-hide).
 * - 폭 미리보기 상태는 URL에 넣지 않고 sessionStorage(실패하면 메모리)에 둔다.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, FileText } from 'lucide-react'
import { Button, Segmented, useElementWidth, useMediaQuery } from '@/design-system'
import { DataImport } from '@/features/template-data/DataImport'
import type { ProgramDataset } from '@/features/template-data/contract'
import { setThemeOverride, useThemeMode, type ThemeMode } from '@/design-system/themeMode'
import { hasTemplate, type TemplateEntry, type TemplateListState } from './registry'
import { categoryLabel, orderedTemplates } from './order'
import { ReadmeDialog, hasReadme } from './Readme'
import { libraryHref, templateHref } from './router'
import { TemplateView } from './TemplateView'
import { TemplateResources } from './TemplateResources'
import type { TemplateMeta } from './types'
import './template-page.css'

const STATUS_LABEL: Record<TemplateMeta['status'], string> = { draft: '초안', review: '검토 중', stable: '안정' }
const ProgramDataPreview = lazy(() => import('@/features/template-data/ProgramDataPreview').then(module => ({ default: module.ProgramDataPreview })))

type PreviewWidth = 'full' | '768' | '390'
const PREVIEW_KEY = 'db-gallery-preview-width'
let previewMemory: PreviewWidth | null = null

function readPreview(): PreviewWidth {
  if (previewMemory) return previewMemory
  try {
    const v = window.sessionStorage.getItem(PREVIEW_KEY)
    if (v === 'full' || v === '768' || v === '390') return v
  } catch {
    /* 저장소를 못 쓰면 메모리만 */
  }
  return 'full'
}

function usePreviewWidth(): [PreviewWidth, (v: PreviewWidth) => void] {
  const [w, setW] = useState<PreviewWidth>(readPreview)
  const set = (v: PreviewWidth) => {
    previewMemory = v
    setW(v)
    try {
      window.sessionStorage.setItem(PREVIEW_KEY, v)
    } catch {
      /* 무시 */
    }
  }
  return [w, set]
}

/** 같은 앱의 임베드 주소(셸 없이 템플릿만) */
function embedHref(category: string, slug: string, mode: ThemeMode) {
  return `${window.location.pathname}?embed=1&theme=${mode}#/t/${category}/${slug}`
}

const SEG_OPTION = 'inline-flex h-[30px] items-center'
/** 보조 버튼 모양의 링크(Button secondary와 같은 규격) */
const LINK_BUTTON =
  'touch-hit relative inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-surface-2'

export function TemplatePage({ category, slug, list }: { category: string; slug: string; list: TemplateListState }) {
  const exists = hasTemplate(category, slug)
  const supportsData = category === 'kpi' && slug === 'program-overview'
  const [ownData, setOwnData] = useState<ProgramDataset | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const focusResult = useCallback(() => {
    previewRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    resultRef.current?.focus({ preventScroll: true })
  }, [])
  const key = `${category}/${slug}`
  const entry = list.templates.find(t => `${t.path.category}/${t.path.slug}` === key) ?? null
  const ordered = useMemo(() => orderedTemplates(list.visible), [list.visible])
  const idx = ordered.findIndex(t => `${t.path.category}/${t.path.slug}` === key)
  const prev = idx > 0 ? ordered[idx - 1]! : null
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]! : null

  const mode = useThemeMode()
  const wide = useMediaQuery('(min-width: 1024px)')
  const { ref: canvasRef, width: canvasW } = useElementWidth()
  const [pref, setPref] = usePreviewWidth()
  // 캔버스보다 넓은 폭(테두리 2px 포함)은 고를 수 없다. 1024 미만에서는 컨트롤 자체를 숨기고 전체 폭으로 본다.
  const widthOptions = (['full', '768', '390'] as const).filter(w => w === 'full' || canvasW >= Number(w) + 2)
  const showWidth = exists && wide && canvasW > 0 && ownData === null
  const effWidth: PreviewWidth = showWidth && widthOptions.includes(pref as never) ? pref : 'full'

  const [readmeOpen, setReadmeOpen] = useState(false)
  const readmeBtn = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !readmeOpen) readmeBtn.current?.focus()
    wasOpen.current = readmeOpen
  }, [readmeOpen])
  // 다른 템플릿으로 가면 README를 닫는다
  useEffect(() => { setReadmeOpen(false); setOwnData(null) }, [key])

  const title = entry?.meta.title ?? slug
  const readme = exists && hasReadme(category, slug)

  return (
    <main id="main-content" tabIndex={-1} data-print-flat="" className="min-w-0 flex-1 px-4 pb-12 pt-4 md:px-6 lg:px-8 lg:pt-6">
      <div data-print-flat="" className="mx-auto w-full max-w-[1600px]">
        <header className="template-page-tools" data-print-hide="">
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <a href={libraryHref(category)} className="touch-hit relative inline-flex min-h-9 items-center gap-1 rounded-sm text-[13px] text-muted transition-colors duration-150 hover:text-text">
              <ArrowLeft size={14} aria-hidden="true" /> 라이브러리
            </a>
            {exists && <div className="flex flex-wrap items-center gap-2">
              {readme && <Button ref={readmeBtn} icon={<FileText size={14} aria-hidden="true" />} aria-haspopup="dialog" aria-expanded={readmeOpen} onClick={() => setReadmeOpen(o => !o)}>템플릿 설명</Button>}
              {!slug.startsWith('_') && <TemplateResources key={key} category={category} slug={slug} title={title} />}
            </div>}
          </div>
          <div className="mt-2 text-xs text-muted">
            {exists && entry ? <MetaLine category={category} meta={entry.meta} /> : <p>{categoryLabel(category)}</p>}
          </div>
        </header>

        {exists && supportsData && <DataImport key={key} onApply={setOwnData} />}

        <section ref={previewRef} aria-label={`${title} 미리보기`} data-template-preview-frame="" data-print-flat="" className="template-preview-frame mt-5 scroll-mt-4 rounded-lg border border-border bg-bg">
          <header className="template-preview-chrome flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-t-lg border-b border-border bg-surface px-3 py-3 sm:px-4" data-print-hide="">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-semibold text-text">{ownData ? '내 데이터 미리보기' : '템플릿 미리보기'}</span>
              <span className="text-muted">{ownData ? '업로드한 데이터' : '샘플 데이터'}</span>
            </p>
            {exists && <div role="group" aria-label="미리보기 설정" className="flex flex-wrap items-center gap-2">
              {showWidth && <Segmented<PreviewWidth> ariaLabel="미리보기 폭" options={widthOptions.map(w => ({ value: w, label: w === 'full' ? '전체' : w }))} value={effWidth} onChange={setPref} optionClassName={SEG_OPTION} />}
              <div className="hidden md:block">
                <Segmented<ThemeMode> ariaLabel="미리보기 테마" options={[{ value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }]} value={mode} onChange={setThemeOverride} optionClassName={SEG_OPTION} />
              </div>
              <a href={embedHref(category, slug, mode)} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
                <ExternalLink size={14} aria-hidden="true" />{ownData ? '목업 임베드로 열기' : '임베드로 열기'}<span className="sr-only">(새 탭)</span>
              </a>
            </div>}
          </header>
          <div className="template-preview-stage p-2 sm:p-4 lg:p-6" data-print-flat="">
            <div ref={canvasRef} className="min-w-0" data-print-flat="">
              <div ref={resultRef} tabIndex={ownData ? -1 : undefined} role={ownData ? 'region' : undefined} aria-label={ownData ? '사용자 데이터 미리보기 결과' : undefined} data-template-preview-content="" data-print-flat="" className="scroll-mt-4 outline-none">
                {supportsData && ownData ? <Suspense fallback={<p role="status" className="text-sm text-muted">데이터 미리보기를 준비하는 중…</p>}><ProgramDataPreview data={ownData} onReady={focusResult} /></Suspense> : effWidth === 'full' ? (
                  <TemplateView category={category} slug={slug} />
                ) : (
                  <WidthPreview key={`${key}:${effWidth}`} category={category} slug={slug} width={Number(effWidth)} mode={mode} title={title} />
                )}
              </div>
            </div>
          </div>
          <footer className="template-preview-chrome rounded-b-lg border-t border-border bg-surface px-4 py-2.5 text-xs text-muted" data-print-hide="">미리보기 끝</footer>
        </section>

        {(prev || next) && <PrevNext prev={prev} next={next} />}
      </div>
      {readme && <ReadmeDialog open={readmeOpen} onClose={() => setReadmeOpen(false)} category={category} slug={slug} wide={wide} />}
    </main>
  )
}

/** 라이브러리 도구 영역에만 표시하는 상태·작물·태그 */
function MetaLine({ meta, category }: { meta: TemplateMeta | null; category: string }) {
  if (!meta) return null
  const tags = meta.tags.filter(t => t !== meta.organism)
  const parts: ReactNode[] = [<span key="category" className="font-medium">{categoryLabel(category)}</span>, STATUS_LABEL[meta.status] ?? meta.status]
  if (meta.organism) parts.push(meta.organism)
  if (tags.length) parts.push(`태그: ${tags.join(', ')}`)
  return (
    <p className="break-keep leading-relaxed">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {i > 0 && <span className="sr-only">, </span>}
          {p}
        </span>
      ))}
    </p>
  )
}

/**
 * 폭 미리보기: 같은 앱의 임베드 화면을 그 폭의 iframe으로 캔버스 가운데에 둔다(1px 테두리, 반경 8).
 *
 * 높이: 같은 출처라서 iframe 안 템플릿 높이(contentH)를 ResizeObserver로 따라가고, 바깥 상자를 그 높이로 둔다.
 * 페이지는 iframe이 내용 높이만큼 긴 것처럼 한 번에 스크롤된다(이중 스크롤 없음).
 * 다만 iframe 자체는 화면 높이(viewH)를 넘지 않는 sticky 창이고, 페이지 스크롤 위치를 iframe 안 스크롤로 옮겨 준다.
 * 그래서 템플릿 안의 fixed 요소(BottomSheet·Toast·좁은 화면 SaveBar)와 vh 단위가 실제 기기처럼 보이는 창 기준으로 그려진다.
 * (iframe을 내용 높이 그대로 두면 행을 눌러 연 시트·저장 토스트가 내용 맨 끝, 화면 수천 px 아래에 나타났다 — 2026-11-02 구현 중 확인.)
 * iframe 안에서 스스로 스크롤하면(scrollIntoView·포커스 이동) 반대로 페이지 스크롤을 맞춘다.
 * iframe 문서에 접근하지 못하면 900px 고정 + 안쪽 스크롤.
 */
function WidthPreview({ category, slug, width, mode, title }: { category: string; slug: string; width: number; mode: ThemeMode; title: string }) {
  const src = embedHref(category, slug, mode)
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [contentH, setContentH] = useState(900)
  const [viewH, setViewH] = useState(() => window.innerHeight)
  const [fixed, setFixed] = useState(false)
  const frameH = fixed ? 900 : Math.min(contentH, viewH)
  const dims = useRef({ contentH, frameH })
  dims.current = { contentH, frameH }
  const syncRef = useRef<(() => void) | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    const preview = frame.current
    return () => {
      try { preview?.contentWindow?.dispatchEvent(new Event('db-template-dispose')) } catch { /* Cross-origin fallback has no parent portal. */ }
      cleanup.current?.()
    }
  }, [])

  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight)
    const onScroll = () => syncRef.current?.()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  // 높이가 바뀌면 스크롤 위치를 다시 맞춘다
  useEffect(() => syncRef.current?.(), [contentH, frameH])

  const onLoad = () => {
    cleanup.current?.()
    cleanup.current = null
    syncRef.current = null
    const el = frame.current
    try {
      const win = el?.contentWindow as (Window & typeof globalThis) | null | undefined
      const doc = el?.contentDocument
      if (!win || !doc) throw new Error('no document')
      let raf = 0
      const measure = () => {
        const main = doc.querySelector('main')
        let bottom = 0
        if (main) {
          for (const k of Array.from(main.children)) bottom = Math.max(bottom, k.getBoundingClientRect().bottom)
          bottom += parseFloat(win.getComputedStyle(main).paddingBottom) || 0
        } else bottom = doc.documentElement.scrollHeight
        const h = Math.max(240, Math.ceil(bottom + win.scrollY))
        setContentH(prev => (Math.abs(prev - h) > 1 ? h : prev))
      }
      const ro = new win.ResizeObserver(() => measure())
      const observe = () => {
        ro.disconnect()
        const main = doc.querySelector('main')
        if (main) for (const k of Array.from(main.children)) ro.observe(k)
        ro.observe(doc.body)
      }
      // 로딩 → 템플릿처럼 main의 자식이 바뀌면 다시 관찰한다(프레임당 한 번)
      const mo = new win.MutationObserver(() => {
        if (raf) return
        raf = win.requestAnimationFrame(() => {
          raf = 0
          observe()
          measure()
        })
      })
      mo.observe(doc.body, { childList: true, subtree: true })

      // 스크롤 동기화. 관계: iframe 안 스크롤 s = clamp(페이지 스크롤 − 상자 위치, 0, contentH − frameH)
      const boxTop = () => (box.current ? box.current.getBoundingClientRect().top + window.scrollY : 0)
      const maxInner = () => Math.max(0, dims.current.contentH - dims.current.frameH)
      const pageToFrame = () => {
        const y = Math.min(maxInner(), Math.max(0, window.scrollY - boxTop()))
        if (Math.abs(win.scrollY - y) >= 1) win.scrollTo(0, y)
      }
      const frameToPage = () => {
        const s = win.scrollY
        const top0 = boxTop()
        const max = maxInner()
        const p = window.scrollY
        const consistent = s < 1 ? p <= top0 + 1 : s > max - 1 ? p >= top0 + max - 1 : Math.abs(p - (top0 + s)) < 1
        if (!consistent) window.scrollTo(0, top0 + s)
      }
      win.addEventListener('scroll', frameToPage, { passive: true })
      syncRef.current = pageToFrame
      // scrolling="no" 창에서는 PageDown·End와 달리 Space가 바깥 페이지로 넘어가지 않아 스크롤이 멈춘다(2026-11-02 메인 확인).
      // 템플릿이 Space를 쓰지 않았을 때(defaultPrevented 아님, 입력·버튼류 밖)만 바깥 페이지를 한 화면 넘긴다.
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== ' ' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
        const t = e.target as HTMLElement | null
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(t.tagName) || t.closest('[role]:not([role=region]):not([role=main]):not([role=figure]):not([role=img])'))) return
        e.preventDefault()
        window.scrollBy(0, (e.shiftKey ? -1 : 1) * Math.round(window.innerHeight * 0.875))
      }
      win.addEventListener('keydown', onKey)

      observe()
      measure()
      pageToFrame()
      setFixed(false)
      cleanup.current = () => {
        ro.disconnect()
        mo.disconnect()
        win.removeEventListener('scroll', frameToPage)
        win.removeEventListener('keydown', onKey)
        if (raf) win.cancelAnimationFrame(raf)
        syncRef.current = null
      }
    } catch {
      setFixed(true)
    }
  }

  return (
    <div className="gallery-fade mx-auto" style={{ width: width + 2, maxWidth: '100%' }}>
      <p className="mb-2 text-[13px] tabular-nums text-muted">
        {width}px · {mode === 'dark' ? '다크' : '라이트'}
      </p>
      {/* 바깥 상자 = 내용 높이(페이지 스크롤 길이). overflow를 두지 않는다(sticky가 페이지 기준으로 붙게) */}
      <div ref={box} style={{ height: (fixed ? 900 : contentH) + 2 }}>
        <iframe
          data-template-preview=""
          ref={frame}
          src={src}
          title={`${title} ${width}px 미리보기`}
          onLoad={onLoad}
          scrolling={fixed ? 'auto' : 'no'}
          className="sticky top-0 block rounded-md border border-border bg-bg"
          style={{ width: width + 2, height: frameH + 2 }}
        />
      </div>
    </div>
  )
}

/** Library navigation stays outside the bounded template preview. */
function PrevNext({ prev, next }: { prev: TemplateEntry | null; next: TemplateEntry | null }) {
  const link = 'group flex min-h-16 min-w-0 items-center gap-3 rounded-md p-3 text-text transition-colors duration-150 hover:bg-surface-2'
  return (
    <nav aria-label="다른 템플릿으로 이동" data-template-navigation="" data-print-hide="" className="mt-7 border-t border-border pb-6 pt-4">
      <div className="mb-2 flex items-center justify-between gap-4 px-3">
        <p className="text-xs font-medium text-muted">다른 템플릿</p>
        <a href={libraryHref()} className="touch-hit relative rounded-sm text-xs text-muted hover:text-text">전체 목록</a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">{prev && <a href={templateHref(prev.path.category, prev.path.slug)} className={link}>
          <ArrowLeft size={17} aria-hidden="true" className="shrink-0" />
          <div className="min-w-0"><p className="text-xs text-muted">이전 템플릿</p><p className="mt-1 break-keep text-[13px] font-semibold">{prev.meta.title}</p></div>
        </a>}</div>
        <div className="min-w-0">{next && <a href={templateHref(next.path.category, next.path.slug)} className={link + ' justify-end text-right'}>
          <div className="min-w-0"><p className="text-xs text-muted">다음 템플릿</p><p className="mt-1 break-keep text-[13px] font-semibold">{next.meta.title}</p></div>
          <ArrowRight size={17} aria-hidden="true" className="shrink-0" />
        </a>}</div>
      </div>
    </nav>
  )
}
