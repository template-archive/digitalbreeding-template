import type { ReactNode } from 'react'
import { cn } from './cn'

export interface FilterChipProps {
  /** 켜짐(aria-pressed). 단일·복수 선택 판정은 호출 측이 한다 */
  pressed: boolean
  onClick: () => void
  label: ReactNode
  /** 라벨 뒤 개수(꺼짐이면 muted). 생략하면 표시 안 함 */
  count?: number
  /** 버튼에 붙일 data-* 속성(QA 선택자 등). 예: { 'data-filter-rec': 'hold' } */
  data?: Record<`data-${string}`, string>
  /** 버튼 title */
  title?: string
  className?: string
}

/**
 * 표 위 필터 칩(토글 버튼, aria-pressed). 높이 28px·rounded-full·text-xs, 켜짐 = 회색 채움(--color-active) + 잉크 글자·테두리
 * (2026-10-30 강조색 채움에서 변경: 강조색은 데이터·선택 표시에만, 앱 화면 규칙).
 * 여러 칩은 호출 측이 `role="group"` + `aria-label` 컨테이너(`flex flex-wrap gap-1.5 touch:gap-2`)로 묶는다.
 * 좁은 화면·터치에서는 누르는 영역이 44px(touch-hit, 보이는 높이 28px는 같다).
 * 규격 출처: workflow/seed-inventory LotToolbar(2026-10-29 승격).
 */
export function FilterChip({ pressed, onClick, label, count, data, title, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      {...data}
      className={cn(
        'touch-hit inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
        pressed ? 'border-text/40 bg-active font-semibold text-text' : 'border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {label}
      {count !== undefined && <span className={cn('tabular-nums', !pressed && 'text-muted')}>{count}</span>}
    </button>
  )
}
