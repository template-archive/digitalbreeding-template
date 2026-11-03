import { formatNumber, formatSigned } from '@/lib/format'
import { MU, PROVISIONAL_YEAR, type Trait, type Year } from '../data'

export const n = (v: number, d: number) => formatNumber(v, { digits: d })
export const sg = (v: number, d: number) => formatSigned(v, d)
/** 수량 kg/10a → μ 대비 % */
export const pctOfMu = (v: number) => (v / MU) * 100
/** 형질 값(수량은 부호 없이, 다른 형질은 부호 표기) */
export const tv = (t: Trait, v: number, d = t.digits) => (t.key === 'yield' && v >= 0 ? n(v, d) : sg(v, d))
export const yearLabel = (y: Year) => (y === PROVISIONAL_YEAR ? `${y}(잠정)` : String(y))
export const axisYear = (y: Year) => (y === PROVISIONAL_YEAR ? `${y}\n(잠정)` : String(y))
export const span = (ys: readonly Year[]) => (ys.length ? `${ys[0]}~${ys[ys.length - 1]}` : '—')
/** KPI 기간 칸용 짧은 표기: 2021~26 */
export const spanShort = (ys: readonly Year[]) => (ys.length ? `${ys[0]}~${String(ys[ys.length - 1]).slice(2)}` : '—')
