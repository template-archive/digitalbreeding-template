import { formatFixed, formatNumber } from '@/lib/format'

/** 표시값은 원값에서 한 번만 반올림한다 */
export const f1 = (v: number) => formatFixed(v, 1)
export const f2 = (v: number) => formatFixed(v, 2)
export const int = (v: number) => formatNumber(Math.round(v), { digits: 0 })
/** 선발 강도: 소수 2자리로 표현되면 2자리(1.40), 아니면 원값 그대로(1.755) */
export const fmtI = (v: number) => (Math.abs(Number(v.toFixed(2)) - v) < 1e-12 ? f2(v) : String(v))

/** 전통 막대·견본: 옅은 회색 빗금(흑백 인쇄에서도 디지털 단색과 구분) */
export const CONV_FILL =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-text-muted) 62%, transparent) 0 2.5px, color-mix(in oklab, var(--color-text-muted) 22%, transparent) 2.5px 6px)'
/** 디지털 막대·견본: 강조 단색 */
export const DIGI_FILL = 'var(--color-accent)'
/** 폭포 차트 양의 기여 구간: 강조색 옅은 판 */
export const CONTRIB_FILL = 'color-mix(in oklab, var(--color-accent) 50%, var(--color-surface))'
