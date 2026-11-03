import { formatFixed, formatNumber, formatSigned } from '@/lib/format'
import type { ChartTheme } from '@/charts'
import type { StageKey, TargetStatus } from '../data'

/** 고정 자릿수(천 단위 쉼표) */
export const n = (v: number, d = 0) => formatNumber(v, { digits: d })
/** 면적 ha(정수) */
export const ha = (v: number) => formatNumber(v, { digits: 0 })
/** 백분율 값(이미 %) → '3.73%' */
export const pc = (v: number, d = 1) => `${formatNumber(v, { digits: d })}%`
/** 부호 표기(U+2212) */
export const sg = formatSigned
export const fx = formatFixed

/** 단계별 생산량 표기: 원원종 t 3자리, 원종·보급종 t 1자리, 기본식물 kg 1자리, 농가 ha 정수 */
export function stageAmount(key: StageKey, amount: number) {
  if (key === 'breeder') return `${n(amount, 1)} kg`
  if (key === 'prebasic') return `${n(amount, 3)} t`
  if (key === 'farm') return `${ha(amount)} ha`
  return `${n(amount, 1)} t`
}

/** 단계 색: 순서가 있는 단계라 순차 팔레트(토큰). 농가 재배는 positive */
export const STAGE_VAR: Record<StageKey, string> = {
  breeder: 'var(--viz-seq-3)',
  prebasic: 'var(--viz-seq-4)',
  basic: 'var(--viz-seq-5)',
  certified: 'var(--viz-seq-7)',
  farm: 'var(--color-positive)',
}

/** 품종 시리즈 색(보급 5품종 = 범주 0~4, 신규 묶음 = 회청 7) */
export function seriesColor(theme: ChartTheme, idx: number, isNew: boolean) {
  return isNew ? theme.categorical[7]! : theme.categorical[idx]!
}

export const TARGET_LABEL: Record<TargetStatus, string> = { ok: '달성', warning: '주의', critical: '경보' }
export const targetColorVar = (s: TargetStatus) => (s === 'ok' ? 'var(--color-positive)' : s === 'warning' ? 'var(--color-warning)' : 'var(--color-negative)')
