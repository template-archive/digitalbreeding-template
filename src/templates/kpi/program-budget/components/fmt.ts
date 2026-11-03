import { formatNumber, formatSigned } from '@/lib/format'
import type { ChartTheme } from '@/charts'
import type { GroupKey, PerLineKey, Status } from '../data'

export type { Status }

/** 만 원 정수(반올림 한 번) */
export const man = (v: number) => formatNumber(Math.round(v), { digits: 0 })
/** 만 원 → 억 원(소수 2자리) */
export const eok = (v: number) => formatNumber(v / 1e4, { digits: 2 })
/** 고정 소수 */
export const n = (v: number, d = 1) => formatNumber(v, { digits: d })
/** 백분율 숫자 + % */
export const pc = (v: number, d = 1) => `${formatNumber(v, { digits: d })}%`
/** 부호 있는 백분율 */
export const spc = (v: number, d = 1) => `${formatSigned(v, d)}%`
export const sg = formatSigned

/** 그룹 색: A 파랑, B 파랑 + 빗금(같은 계열), C 회청, D 보라 */
export function groupColor(theme: Pick<ChartTheme, 'categorical'>, g: GroupKey): string {
  const c = theme.categorical
  return g === 'A' || g === 'B' ? c[0]! : g === 'C' ? c[7]! : c[3]!
}
export const groupStriped = (g: GroupKey) => g === 'B'

/** 계통당 구성 요소 색 */
export function perLineColor(theme: Pick<ChartTheme, 'categorical'>, k: PerLineKey): string {
  const c = theme.categorical
  return { advance: c[7]!, phenoEval: c[4]!, speedAdvance: c[0]!, genotyping: c[2]!, prediction: c[1]! }[k]
}

export const STATUS_LABEL: Record<Status, string> = { critical: '경보(초과)', warning: '주의(불용)', ok: '정상' }

