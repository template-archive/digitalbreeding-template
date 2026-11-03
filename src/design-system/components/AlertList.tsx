import { Children, isValidElement, type ComponentType, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Info, type LucideIcon } from 'lucide-react'
import { cn } from './cn'
import { SEV_BORDER, SEV_ICON, SEV_ICON_COLOR, SEV_ITEM_BORDER, SEV_LABEL, type KpiSeverity } from './severity'

/** critical = 경보, warning = 주의, info = 정보(참고 사항, KpiTile에는 없는 단계) */
export type AlertSeverity = Exclude<KpiSeverity, 'ok'> | 'info'

// 심각도 → 클래스·아이콘·문자 태그. 경보·주의는 KpiTile과 같은 severity.ts 규칙, 정보는 info 토큰
const STYLE: Record<AlertSeverity, { border: string; item: string; iconColor: string; label: string; icon: LucideIcon }> = {
  critical: { border: SEV_BORDER.critical, item: SEV_ITEM_BORDER.critical, iconColor: SEV_ICON_COLOR.critical, label: SEV_LABEL.critical, icon: SEV_ICON.critical },
  warning: { border: SEV_BORDER.warning, item: SEV_ITEM_BORDER.warning, iconColor: SEV_ICON_COLOR.warning, label: SEV_LABEL.warning, icon: SEV_ICON.warning },
  info: { border: 'border-info/60', item: 'border-l-info', iconColor: 'text-info', label: '정보', icon: Info },
}

/** 값 글자 폭 어림(13px bold): 한글·CJK 1em, 공백 0.3em, 그 밖 0.6em. 문자열이 아닌 노드는 안쪽 글자를 모은다 */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return Children.toArray(node.props.children).map(textOf).join('')
  return ''
}
function valueWidthPx(value: ReactNode): number {
  const t = textOf(value)
  if (!t) return 64
  let em = 0
  for (const ch of t) em += /[ᄀ-ᇿ㄰-㆏가-힣⺀-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6
  return em * 13
}
/**
 * 값을 제목 아래로 내리는 항목 폭(rem). 값 옆 제목 칸이 약 130px(한글 10자) 이상 남을 때만 값이 제목 옆에 있다.
 * 기준 = 고정 폭(테두리·여백·아이콘·태그·간격 약 95px, 화살표가 있으면 +24px) + 값 폭 + 130px를 아래 단계로 올림.
 * 18rem이면 'Ne 52'·'87%' 같은 짧은 값, 22~24rem이면 'He 0.337~0.340' 같은 긴 값(390px 카드 약 300px에서 제목이 4줄로 감기던 문제, 2026-10-30).
 */
const BELOW_STEPS = [18, 20, 22, 24, 26, 28, 30] as const
// Tailwind가 정적으로 찾을 수 있게 단계마다 클래스를 풀어 쓴다(@container = 항목 li 폭)
const VALUE_BELOW: Record<(typeof BELOW_STEPS)[number], string> = {
  18: '@max-[18rem]:col-start-2 @max-[18rem]:justify-self-start @max-[18rem]:whitespace-normal @max-[18rem]:text-left',
  20: '@max-[20rem]:col-start-2 @max-[20rem]:justify-self-start @max-[20rem]:whitespace-normal @max-[20rem]:text-left',
  22: '@max-[22rem]:col-start-2 @max-[22rem]:justify-self-start @max-[22rem]:whitespace-normal @max-[22rem]:text-left',
  24: '@max-[24rem]:col-start-2 @max-[24rem]:justify-self-start @max-[24rem]:whitespace-normal @max-[24rem]:text-left',
  26: '@max-[26rem]:col-start-2 @max-[26rem]:justify-self-start @max-[26rem]:whitespace-normal @max-[26rem]:text-left',
  28: '@max-[28rem]:col-start-2 @max-[28rem]:justify-self-start @max-[28rem]:whitespace-normal @max-[28rem]:text-left',
  30: '@max-[30rem]:col-start-2 @max-[30rem]:justify-self-start @max-[30rem]:whitespace-normal @max-[30rem]:text-left',
}
function valueBelowClass(value: ReactNode, chevron: boolean): string {
  const need = (95 + (chevron ? 24 : 0) + valueWidthPx(value) + 130) / 16
  return VALUE_BELOW[BELOW_STEPS.find(s => s >= need) ?? 30]
}

export interface AlertListItem {
  /** React key */
  id: string
  /** critical = 경보(negative), warning = 주의(warning) — KpiTile severity와 같은 토큰·문자 태그. info = 정보(info 토큰·Info 아이콘·'정보') */
  severity: AlertSeverity
  title: ReactNode
  /** 제목 아래 보조 설명(12px muted) */
  description?: ReactNode
  /** 제목 줄 오른쪽 끝 값(예: 달성률) */
  value?: ReactNode
  /** 아이콘을 바꿀 때(예: 지연 = Clock). 기본은 심각도 아이콘(경보 AlertOctagon, 주의 AlertTriangle) */
  icon?: ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  /** 있으면 항목 전체가 버튼이 된다 */
  onClick?: () => void
  /** 버튼 항목의 스크린리더 보조 문구. 기본은 목록의 actionLabel */
  actionLabel?: string
}

export interface AlertListProps {
  items: AlertListItem[]
  /** ul 접근성 이름(예: '2026년 목표 미달 지표 3건') */
  ariaLabel?: string
  /** 항목이 없을 때 positive 상자에 보여 줄 문구. 없으면 빈 목록 */
  emptyText?: ReactNode
  /** default: 제목·설명 사이 4px, compact: 2px(문장형 제목이 긴 목록) */
  density?: 'default' | 'compact'
  /** 버튼 항목 오른쪽 화살표. 기본 true */
  chevron?: boolean
  /** 버튼 항목의 스크린리더 보조 문구 기본값 */
  actionLabel?: string
  className?: string
}

/**
 * 경보·주의(·정보) 목록. 심각도는 아이콘 + 문자 태그(경보/주의/정보)가 말하고, 항목 상자는 옅은 1px 테두리 + 왼쪽 2px 심각도 띠다
 * (4px 띠·심각도색 테두리는 화면을 상자 격자로 만든다 — tasteskill heavy-borders, 2026-10-30).
 * onClick이 있는 항목은 버튼(hover 시 surface-2), 없는 항목은 정적 상자다.
 * 항목 상자가 relative라 목록을 max-h + overflow-y-auto로 감싸도 안쪽 sr-only(absolute)가 문서 높이를 늘리지 않는다.
 */
export function AlertList({ items, ariaLabel, emptyText, density = 'default', chevron = true, actionLabel = '— 자세히 보기', className }: AlertListProps) {
  if (items.length === 0 && emptyText !== undefined) {
    return (
      <div className={cn('flex items-center gap-2 rounded-md border border-positive/40 px-3 py-4 text-sm font-medium text-text', className)}>
        <CheckCircle2 size={18} aria-hidden="true" className="text-positive" />
        {emptyText}
      </div>
    )
  }
  const compact = density === 'compact'
  return (
    <ul className={cn('flex flex-col gap-2', className)} aria-label={ariaLabel}>
      {items.map(it => {
        const st = STYLE[it.severity]
        const Icon = it.icon ?? st.icon
        const hasChevron = !!it.onClick && chevron
        const inner = (
          <>
            <Icon size={16} aria-hidden="true" className={cn('mt-0.5 shrink-0', st.iconColor)} />
            <span className={cn('flex min-w-0 flex-1 flex-col', compact ? 'gap-0.5' : 'gap-1')}>
              {/*
                태그 | 제목 | 값 3칸 격자: 제목이 길면 가운데 칸 안에서 줄이 바뀌고 값은 제목 옆(오른쪽 위)에 남는다.
                항목 폭이 값 길이로 정한 기준(18~30rem, valueBelowClass)보다 좁으면 값을 제목 아래 왼쪽으로 내린다.
              */}
              <span
                className={cn(
                  'grid items-start',
                  it.value !== undefined ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[auto_minmax(0,1fr)]',
                  compact ? 'gap-x-1.5 gap-y-0.5' : 'gap-x-2 gap-y-1',
                )}
              >
                <span className={cn('mt-px inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-bold leading-none text-text', st.border)}>
                  {st.label}
                </span>
                <span className="min-w-0 break-keep wrap-break-word text-[13px] font-semibold text-text tabular-nums">{it.title}</span>
                {it.value !== undefined && (
                  <span className={cn('justify-self-end whitespace-nowrap text-right text-[13px] font-bold tabular-nums text-text', valueBelowClass(it.value, hasChevron))}>
                    {it.value}
                  </span>
                )}
              </span>
              {it.description !== undefined && <span className="break-keep wrap-break-word text-xs leading-relaxed text-muted tabular-nums">{it.description}</span>}
            </span>
          </>
        )
        // relative: 안쪽 sr-only(absolute)의 기준을 항목 안에 둔다. 테두리: 옅은 1px(border 토큰) + 왼쪽 2px 심각도 띠
        const box = cn('relative flex w-full items-start gap-2.5 rounded-md border border-l-2 border-border bg-surface px-3 py-2.5 text-left', st.item)
        return (
          // @container: 값 위치를 항목 폭으로 정한다(격자로 여러 열에 놓여도 항목마다 맞음)
          <li key={it.id} className="@container">
            {it.onClick ? (
              <button type="button" onClick={it.onClick} className={cn('group transition-colors hover:bg-surface-2', box)}>
                {inner}
                {hasChevron && <ChevronRight size={14} aria-hidden="true" className="mt-1 shrink-0 text-muted opacity-50 group-hover:opacity-100" />}
                <span className="sr-only">{it.actionLabel ?? actionLabel}</span>
              </button>
            ) : (
              <div className={box}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
