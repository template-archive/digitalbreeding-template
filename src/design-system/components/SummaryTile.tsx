import type { ReactNode } from 'react'
import { cn } from './cn'
import { SeverityTag } from './SeverityTag'
import type { KpiSeverity } from './severity'

export interface SummaryTileProps {
  /** 타일 이름. 대표 타일은 14px 잉크색, 나머지는 13px 회색 */
  label: ReactNode
  /** 라벨 옆 보조(ⓘ 설명 버튼 등) */
  info?: ReactNode
  /** 값(호출 측이 포맷한 문자열·숫자). 여러 숫자를 함께 보이는 타일은 생략하고 `children`에 그린다 */
  value?: ReactNode
  unit?: ReactNode
  /** 값 아래 보조 줄(12px 회색) */
  sub?: ReactNode
  /** 목표 없는 심각도. 머리 줄 태그 + 옅은 불투명 테두리, 값은 잉크색(KpiTile 막대 없는 severity와 같은 규격) */
  severity?: KpiSeverity
  /** 심각도 태그 뒤에 붙이는 처리할 일(예: '증식 필요' → '경보 · 증식 필요'). 생략하면 경보/주의 */
  tag?: string
  /** 대표 타일: 값 40px(나머지 28/30px). 배치(2칸 너비)는 `KpiRow hero`가 정한다 */
  hero?: boolean
  /** 주면 타일 전체가 버튼 */
  onClick?: () => void
  /** 버튼 동작 설명. `linkLabel`이 없으면 타일 아래 이동 문구로 보이고, 있으면 화면 낭독 전용 */
  actionLabel?: string
  /** 타일 아래 이동 문구(actionLabel보다 짧게 보일 때) */
  linkLabel?: string
  /** 값·보조 줄 아래(막대·와플 등 그 타일 고유의 표시). 맨 아래에 붙일 요소는 `mt-auto`를 준다 */
  children?: ReactNode
  className?: string
}

// KpiTile SEV_TILE과 같은 값(반투명 /15는 알파를 버리고 재는 검사가 heavy-borders로 센다)
const SEV_BORDER: Partial<Record<KpiSeverity, string>> = {
  warning: 'border-[color-mix(in_oklab,var(--color-warning)_15%,var(--color-surface))]',
  critical: 'border-[color-mix(in_oklab,var(--color-negative)_15%,var(--color-surface))]',
}

/**
 * 업무 화면 요약 타일. KpiTile로 표현하지 못하는 경우에 쓴다: 타일 전체가 이동 버튼이거나, 심각도 태그에 처리할 일을 붙이거나, 값 아래에 와플·다중 숫자처럼 고유한 표시가 필요할 때.
 * 표면·여백·글자 크기는 KpiTile과 같고 배치(열 수, 390px 2열, 홀수 마지막 전체 폭)는 `KpiRow`가 정한다. 대표는 값 크기로만 구분한다.
 * 규격 출처: workflow/seed-inventory. 2026-11-02 승격(sample-tracking·crossing-record 이전).
 */
export function SummaryTile({ label, info, value, unit, sub, severity, tag, hero, onClick, actionLabel, linkLabel, children, className }: SummaryTileProps) {
  const tagged = severity === 'warning' || severity === 'critical'
  const link = linkLabel ?? actionLabel
  const body = (
    <>
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={cn('flex min-w-0 items-center gap-1 break-keep font-medium leading-snug', hero ? 'text-sm text-text' : 'text-[13px] text-muted')}>
          {label}
          {info}
        </span>
        {/* 태그 문구 앞에 심각도 낱말을 붙인다: 아이콘은 aria-hidden이라 경보·주의 차이가 모양으로만 남지 않게 */}
        {tagged && <SeverityTag severity={severity} label={tag ? `${severity === 'critical' ? '경보' : '주의'} · ${tag}` : undefined} />}
      </span>
      {value != null && (
        <span className="flex items-baseline gap-1">
          <span className={cn('font-bold leading-none tracking-tight tabular-nums text-text', hero ? 'text-[40px]' : 'text-[28px] sm:text-[30px]')}>{value}</span>
          {unit != null && <span className="text-sm font-semibold text-muted">{unit}</span>}
        </span>
      )}
      {sub != null && <span className="text-xs leading-snug text-muted tabular-nums">{sub}</span>}
      {children}
      {onClick && link && <span className="mt-auto pt-0.5 text-xs font-medium text-muted group-hover:text-text">{link} →</span>}
    </>
  )
  const cls = cn('group flex min-w-0 flex-col gap-1.5 rounded-lg border bg-surface p-3 text-left sm:p-4', SEV_BORDER[severity ?? 'ok'] ?? 'border-border', className)
  return onClick ? (
    <button type="button" onClick={onClick} data-severity={severity} className={cn(cls, 'transition-colors hover:bg-surface-2')}>
      {body}
      {linkLabel && actionLabel && <span className="sr-only">— {actionLabel}</span>}
    </button>
  ) : (
    <div data-severity={severity} className={cls}>
      {body}
    </div>
  )
}
