import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { ChevronRight, Home, Library, Menu, Moon, Sprout, Sun, X } from 'lucide-react'
import { cn, useMediaQuery } from '@/design-system'
import { setThemeOverride, useThemeMode } from '@/design-system/themeMode'
import { templatePaths, type TemplateListState } from './registry'
import { countByCategory, groupTemplates } from './order'
import { libraryHref, templateHref } from './router'

export interface ShellNavProps {
  list: TemplateListState
  /** 현재 템플릿 `${category}/${slug}`(상세 화면), 그 밖에는 null */
  activeKey: string | null
  /** 목록 화면이면 「전체 템플릿」이 활성 */
  listActive: boolean
  homeActive: boolean
  category: string
}

/** 기본 로고. 사이드바와 메뉴 시트에서는 보조 문구를 포함한 두 줄 워드마크를 쓴다. */
export function Logo({ onClick, stacked = false }: { onClick?: () => void; stacked?: boolean }) {
  return (
    <a href="#/" onClick={onClick} className={cn('flex min-w-0 items-center rounded-md font-semibold text-text', stacked ? 'gap-3' : 'gap-2')}>
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-md bg-accent text-accent-contrast', stacked ? 'size-9' : 'size-7')}>
        <Sprout size={stacked ? 20 : 16} aria-hidden="true" />
      </span>
      {stacked ? (
        <span className="min-w-0 leading-snug">
          <span className="block text-[15px] tracking-tight">디지털육종</span>
          <span className="mt-0.5 block text-xs font-normal text-muted">템플릿 라이브러리</span>
        </span>
      ) : <span className="truncate text-[15px]">디지털육종 템플릿</span>}
    </a>
  )
}

const ROW = 'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-text transition-colors duration-150 touch:min-h-11'
const ROW_HOVER = 'hover:bg-surface-2'

/** 테마 전환(전역 override). 상세 도구 줄의 테마 Segmented와 같은 상태를 읽고 쓴다 */
export function ThemeToggle() {
  const mode = useThemeMode()
  const next = mode === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setThemeOverride(next)}
      aria-label={next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      className={cn(ROW, ROW_HOVER, 'w-full bg-bg text-[13px]')}
    >
      {mode === 'dark' ? <Sun size={16} aria-hidden="true" className="text-muted" /> : <Moon size={16} aria-hidden="true" className="text-muted" />}
      {next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
    </button>
  )
}

// 목록을 모으는 동안 보일 자리 표시 칸 수(폴더 기준, 숨김 제외). 모듈을 로드하지 않고 glob 키로 센다.
const PATH_COUNTS = countByCategory(templatePaths().filter(p => !p.hidden).map(p => p.path))
const BAR_WIDTHS = ['72%', '58%', '80%', '64%', '50%', '76%']

function NavTree({ list, activeKey, listActive, homeActive, category, onNavigate }: ShellNavProps & { onNavigate?: () => void }) {
  const baseId = useId()
  const loading = list.status === 'loading'
  const groups = groupTemplates(list.visible)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => category && category !== 'all' ? { [category]: true } : {})
  const libraryCurrent = listActive && (category === 'all' || !groups.some(group => group.category === category))

  useEffect(() => {
    if (!category || category === 'all') return
    setExpanded(previous => previous[category] ? previous : { ...previous, [category]: true })
  }, [category, activeKey])

  return (
    <ul className="space-y-1">
      <li>
        <a
          href="#/"
          onClick={onNavigate}
          aria-current={homeActive ? 'page' : undefined}
          className={cn(ROW, homeActive ? 'bg-active font-semibold' : 'text-muted hover:bg-surface-2 hover:text-text')}
        >
          <Home size={17} aria-hidden="true" className="shrink-0" />
          홈
        </a>
      </li>
      <li>
        <a
          href="#/library"
          onClick={onNavigate}
          aria-current={libraryCurrent ? 'page' : undefined}
          className={cn(ROW, 'font-semibold', libraryCurrent ? 'bg-surface-2' : ROW_HOVER)}
        >
          <Library size={17} aria-hidden="true" className="shrink-0 text-muted" />
          라이브러리
        </a>
        <ul aria-label="라이브러리 카테고리" className="ml-3 mt-4 space-y-2 pl-1">
          {groups.map(group => {
            const count = loading ? (PATH_COUNTS.get(group.category) ?? 0) : group.items.length
            if (!count) return null
            const labelId = `${baseId}-${group.category}`
            const panelId = `${labelId}-templates`
            const open = expanded[group.category] ?? false
            const current = listActive && category === group.category
            const ancestor = activeKey !== null && category === group.category

            return (
              <li key={group.category}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setExpanded(previous => ({ ...previous, [group.category]: !open }))}
                    className={cn(
                      'flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] leading-snug transition-colors duration-150 touch:min-h-11',
                      current || ancestor ? 'bg-surface-2 font-semibold text-text' : cn(ROW_HOVER, 'font-medium text-muted hover:text-text'),
                    )}
                  >
                    <span id={labelId} className="min-w-0 flex-1 break-keep">{group.label}</span>
                    <span className="shrink-0 text-xs font-normal tabular-nums text-muted">{count}<span className="sr-only">개 템플릿</span></span>
                    <ChevronRight size={14} aria-hidden="true" className={cn('shrink-0 text-muted', open && 'rotate-90')} />
                    <span className="sr-only">{open ? '접기' : '펼치기'}</span>
                  </button>
                <ul id={panelId} aria-labelledby={labelId} hidden={!open} className="mb-4 ml-3 mt-1 space-y-1 border-l border-border pl-2">
                  <li>
                    <a
                      href={libraryHref(group.category)}
                      onClick={onNavigate}
                      aria-label={`${group.label} 전체 보기`}
                      aria-current={current ? 'page' : undefined}
                      className={cn('flex min-h-9 items-center rounded-md px-3 py-2 text-[13px] leading-5 touch:min-h-11', current ? 'bg-active font-semibold text-text' : 'text-muted hover:bg-surface-2 hover:text-text')}
                    >
                      전체 보기
                    </a>
                  </li>
                  {loading ? (
                    Array.from({ length: count }, (_, index) => (
                      <li key={index} aria-hidden="true" className={ROW}>
                        <span className="h-3.5 rounded-sm bg-surface-2" style={{ width: BAR_WIDTHS[index % BAR_WIDTHS.length] }} />
                      </li>
                    ))
                  ) : group.items.map(template => {
                    const key = `${template.path.category}/${template.path.slug}`
                    const active = key === activeKey
                    return (
                      <li key={key}>
                        <a
                          href={templateHref(template.path.category, template.path.slug)}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          title={template.meta.title}
                          className={cn(
                            'flex min-h-9 items-center rounded-md px-3 py-2 text-[13px] leading-5 transition-colors duration-150 touch:min-h-11',
                            active ? 'bg-active font-semibold text-text' : 'text-text hover:bg-surface-2',
                          )}
                        >
                          <span className="line-clamp-2 min-w-0 break-keep">{template.meta.title}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </li>
    </ul>
  )
}

/** 활성 항목이 사이드바 스크롤 영역 밖이면 가운데로 옮긴다(창은 스크롤하지 않는다) */
function useKeepActiveVisible(scroller: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
      const nav = scroller.current
      const a = nav?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!nav || !a || !a.getClientRects().length) return
      const nr = nav.getBoundingClientRect()
      const ar = a.getBoundingClientRect()
      if (ar.top < nr.top || ar.bottom > nr.bottom) nav.scrollTop += ar.top - nr.top - nr.height / 2 + ar.height / 2
      })
    }
    const observer = new MutationObserver(schedule)
    if (scroller.current) observer.observe(scroller.current, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'aria-current'] })
    schedule()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, deps)
}

/** lg 이상 왼쪽 사이드바 */
export function Sidebar(props: ShellNavProps) {
  const navRef = useRef<HTMLElement>(null)
  useKeepActiveVisible(navRef, [props.activeKey, props.category, props.list.status])
  return (
    <aside data-print-hide="" className="sticky top-0 hidden h-dvh w-70 shrink-0 flex-col self-start border-r border-border bg-surface lg:flex">
      <div className="px-6 pb-7 pt-7">
        <Logo stacked />
      </div>
      <nav ref={navRef} aria-label="템플릿" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <NavTree {...props} />
      </nav>
      <div className="mx-4 border-t border-border py-4">
        <ThemeToggle />
      </div>
    </aside>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 1024 미만 전체 화면 메뉴 시트: 포커스 가두기, Esc·닫기 버튼, 링크를 누르거나 경로가 바뀌면 닫힘 */
function MenuSheet({ onClose, ...nav }: ShellNavProps & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useKeepActiveVisible(navRef, [])

  useEffect(() => {
    closeBtn.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]!
      const last = items[items.length - 1]!
      const inside = ref.current.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    const onHash = () => closeRef.current()
    document.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', onHash)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', onHash)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="템플릿 메뉴" data-print-hide="" className="gallery-sheet-in fixed inset-0 z-50 flex flex-col bg-surface lg:hidden">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-border pl-6 pr-3">
        <Logo onClick={onClose} stacked />
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          aria-label="메뉴 닫기"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text hover:bg-active/60"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <nav ref={navRef} aria-label="템플릿" className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <NavTree {...nav} onNavigate={onClose} />
      </nav>
      <div className="mx-4 border-t border-border py-4">
        <ThemeToggle />
      </div>
    </div>
  )
}

/** 1024 미만 48px 상단 바(스크롤과 함께 올라간다: 템플릿의 sticky 요소를 가리지 않게) */
export function MobileBar(props: ShellNavProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const wide = useMediaQuery('(min-width: 1024px)')
  // 화면이 넓어지면 닫힘 상태로 돌린다(사이드바가 같은 트리를 보인다)
  useEffect(() => {
    if (wide) setOpen(false)
  }, [wide])
  // 닫히면 메뉴 버튼으로 포커스를 돌린다
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) btnRef.current?.focus()
    wasOpen.current = open
  }, [open])
  return (
    <>
      <header data-print-hide="" className="flex h-12 items-center justify-between gap-3 border-b border-border pl-4 pr-1 lg:hidden">
        <Logo />
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="템플릿 메뉴 열기"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text hover:bg-active/60"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </header>
      {open && <MenuSheet {...props} onClose={() => setOpen(false)} />}
    </>
  )
}
