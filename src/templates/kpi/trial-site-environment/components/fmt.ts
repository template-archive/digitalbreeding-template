import { metZoneColor, type ChartTheme } from '@/charts'
import { formatFixed, formatNumber, formatSigned } from '@/lib/format'
import { INDEX_ABS_MAX, type ZoneKey } from '../data'

/** 정수 반올림 + 천 단위 쉼표 */
export const n0 = (v: number) => formatNumber(v, { digits: 0 })
/** 고정 소수(음수만 U+2212) */
export const f1 = (v: number) => formatFixed(v, 1)
export const f2 = (v: number) => formatFixed(v, 2)
/** 부호 표기 */
export const s0 = (v: number) => formatSigned(v, 0)
export const s1 = (v: number) => formatSigned(v, 1)
/** 백분율(정수) */
export const pct0 = (v: number) => `${formatNumber(v, { digits: 0 })}%`

/** 권역 색: met-gxe-stability 메가 환경 색과 같다(중부 cat[0], 남부 cat[1], 중북부 cat[2]) — @/charts metZoneColor */
export const zoneColor = (theme: Pick<ChartTheme, 'categorical'>, zone: ZoneKey): string => metZoneColor(theme, zone)

/** 환경 지수 → 발산형 7색(0 = 중간색) */
export function indexColor(theme: Pick<ChartTheme, 'diverging'>, v: number): string {
  const d = theme.diverging
  const mid = (d.length - 1) / 2
  const i = Math.round(mid + (Math.max(-1, Math.min(1, v / INDEX_ABS_MAX)) * mid))
  return d[i] ?? d[Math.floor(mid)]!
}
