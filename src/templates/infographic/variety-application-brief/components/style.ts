/** 출원 계통(YR19-0118) = 강조색. 비교 대상은 항상 문자 라벨과 함께 쓴다(흑백 인쇄 대비). */
export const V_COLOR = 'var(--color-accent)'

/** 판정 톤 → 글자 색 클래스. 기호는 `ToneMark`(색만으로 판정을 알리지 않는다) */
export const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  info: 'text-info',
  muted: 'text-muted',
} as const

/** 겹치는 선 위에서도 SVG 글자가 읽히게 배경색 테두리 */
export const HALO = { stroke: 'var(--color-bg)', strokeWidth: 4, paintOrder: 'stroke' } as const

/** KASP에서 출원 계통과 다른 셀: 색 외 표식(사선)으로도 구분 */
export const DIFF_CELL_BG =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 30%, transparent) 0 2px, transparent 2px 6px), color-mix(in oklab, var(--color-warning) 8%, var(--color-surface))'
