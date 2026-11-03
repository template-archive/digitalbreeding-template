import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'
import { useMediaQuery } from '../hooks/useMediaQuery'

export type SummaryCalloutTone = 'neutral' | 'info' | 'warning' | 'negative'

export interface SummaryCalloutProps {
  /** 결론 문장(인라인 내용: 글, <b>, 숫자). 블록 요소를 넣지 않는다(줄 수 제한이 인라인 흐름 기준) */
  children: ReactNode
  /**
   * 왼쪽 4px 표시 색(톤은 왼쪽 표시·아이콘에만, 바탕은 늘 중립). neutral(기본) = 결론·요약(회색), warning = 주의가 결론일 때,
   * negative = 경보가 결론일 때, info = 안내·참고(닫을 수 있는 안내 띠). 결론 문장 안의 좋고 나쁨은 문장과 굵은 글자로 말한다
   */
  tone?: SummaryCalloutTone
  /** 앞 아이콘(info 안내 띠 등). lucide 아이콘이면 size 15·aria-hidden으로 넘긴다 */
  icon?: ReactNode
  /** true면 오른쪽에 닫기 버튼이 생기고 누르면 스스로 숨는다(onDismiss가 있으면 그것도 부른다) */
  dismissible?: boolean
  /** 닫기 버튼을 눌렀을 때. dismissible 없이 이것만 주면 닫기 버튼은 보이지만 숨김은 부모가 정한다(렌더하지 않으면 됨) */
  onDismiss?: () => void
  /** 닫기 버튼 접근 이름. 기본 '안내 닫기' */
  dismissLabel?: string
  /** 좁은 화면(< 640px)에서 접어 보일 최대 줄 수. 넘치면 「더 보기」로 펼친다. 0이면 제한 없음. 기본 3 */
  mobileLines?: number
  /** 선택·필터에 따라 문장이 바뀌면 true(aria-live="polite") */
  live?: boolean
  className?: string
}

// Tailwind가 정적으로 찾을 수 있게 클래스 문자열을 풀어 쓴다
const TONE: Record<SummaryCalloutTone, string> = {
  neutral: 'border-l-muted',
  warning: 'border-l-warning',
  negative: 'border-l-negative',
  info: 'border-l-info',
}
const CLAMP: Record<number, string> = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4', 5: 'line-clamp-5', 6: 'line-clamp-6' }

/**
 * 결론 띠 = 화면의 「결론 한 문장」(앱 화면 규칙): 본문 잉크색 14px, 중립 바탕(surface-2 한 단계, 색 틴트 없음), 톤은 왼쪽 4px 표시·아이콘에만.
 * 위치는 KPI 줄 바로 아래 한 곳(KPI·viz), 업무 화면은 필요할 때만. 좁은 화면에서는 mobileLines(기본 3)줄까지만 보이고 넘치면 「더 보기」.
 * 규격 출처: kpi/program-overview 결론 한 줄, 닫기 = workflow/advancement-decision 안내 띠. 2026-10-30 신설.
 */
export function SummaryCallout({ children, tone = 'neutral', icon, dismissible, onDismiss, dismissLabel = '안내 닫기', mobileLines = 3, live, className }: SummaryCalloutProps) {
  const [hidden, setHidden] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const textRef = useRef<HTMLParagraphElement>(null)
  const lines = Math.min(6, Math.max(0, Math.round(mobileLines)))
  const clampOn = narrow && lines > 0 && !expanded

  // 접힌 상태에서 실제로 잘렸는지(넘칠 때만 「더 보기」)
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || !clampOn) {
      if (!clampOn && !expanded) setClipped(false)
      return
    }
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [clampOn, expanded, children])

  if (hidden) return null
  const canDismiss = dismissible || onDismiss !== undefined
  return (
    <div
      data-summary-callout=""
      className={cn('flex items-start gap-2 rounded-md border-l-4 bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-text', TONE[tone], className)}
    >
      {icon != null && <span className="mt-1 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p ref={textRef} aria-live={live ? 'polite' : undefined} className={cn('break-keep wrap-break-word tabular-nums', clampOn && CLAMP[lines])}>
          {children}
        </p>
        {narrow && lines > 0 && (clipped || expanded) && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(e => !e)}
            className="touch-hit-y mt-0.5 rounded-sm text-xs font-semibold text-muted underline underline-offset-2 hover:text-text"
          >
            {expanded ? '접기' : '더 보기'}
          </button>
        )}
      </div>
      {canDismiss && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={() => {
            onDismiss?.()
            if (dismissible) setHidden(true)
          }}
          className="touch-hit shrink-0 rounded-sm p-0.5 text-muted hover:text-text"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
