/*
 * 색 척도 — 토큰(--viz-seq-1..7, --viz-div-*)을 color-mix로 연속 보간한다.
 * CSS 변수를 그대로 쓰므로 라이트·다크 전환 시 다시 계산하지 않아도 색이 바뀐다.
 */

const SEQ = [1, 2, 3, 4, 5, 6, 7].map(i => `var(--viz-seq-${i})`)
const DIV = ['neg-3', 'neg-2', 'neg-1', '0', 'pos-1', 'pos-2', 'pos-3'].map(k => `var(--viz-div-${k})`)

function mix(stops: string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const lo = Math.min(stops.length - 2, Math.floor(x))
  const f = x - lo
  if (f < 0.001) return stops[lo]!
  return `color-mix(in oklab, ${stops[lo]} ${((1 - f) * 100).toFixed(1)}%, ${stops[lo + 1]})`
}

/** 순차형: t = 0(최소) ~ 1(최대) */
export const seqColor = (t: number) => mix(SEQ, t)
/** 진한 칸은 반전 글자색(라이트=흰색, 다크=어두운색 — accent-contrast 토큰이 정확히 그 짝) */
export const seqTextClass = (t: number) => (t >= 0.6 ? 'text-accent-contrast' : 'text-text')

/** 발산형: v = −1 ~ 1, 0이 중간색 */
export const divColor = (v: number) => mix(DIV, (v + 1) / 2)
export const divTextClass = (v: number) => (Math.abs(v) >= 0.72 ? 'text-accent-contrast' : 'text-text')

export const SEQ_GRADIENT = `linear-gradient(to right, ${SEQ.join(', ')})`
export const DIV_GRADIENT = `linear-gradient(to right, ${DIV.join(', ')})`

/** 대비 품종 빗금. 토큰색만 사용(결측 빗금은 @/design-system 의 HATCH_MISSING) */
export const HATCH_CHECK =
  'repeating-linear-gradient(45deg, color-mix(in oklab, var(--color-accent) 22%, transparent) 0 2px, transparent 2px 8px), var(--color-surface)'
