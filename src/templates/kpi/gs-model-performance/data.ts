/**
 * 유전체 선발 모델 성능 — 목업 데이터
 * 명세: docs/specs/gs-model-performance.md
 *
 * - 연도별 r·목표·훈련 집단, 형질별 GBLUP 평균·SD는 program-overview·program-baseline과 같은 값이다.
 * - 난수는 교차 검증 반복값(형질 × 모델 × 50회)에만 쓴다. GBLUP 점수는 program-overview와 같은 소비 순서라
 *   쌀 수량 GBLUP 반복값 범위(0.50~0.69)가 program-overview 툴팁과 같다.
 * - 요약(평균·SD·쌍체 차이·권장·학습 곡선·회귀)은 모두 아래 상수에서 계산한다(하드코딩 금지).
 * 실제 API로 바꿀 때는 export 이름과 형태만 유지하면 된다.
 */
import { createRng } from '@/lib/rng'
import { linearFit } from '@/lib/stats'
import { formatFixed, formatSigned } from '@/lib/format'

export const SEED = 20261023
export const AS_OF = '2026-10-23'
/** 벤치마크 실행일(추정) */
export const BENCH_DATE = '2026-10-15'
export const CROP = '벼'
export const PROGRAM = '중부 평야지 벼 육종 프로그램'

export const FOLDS = 5
export const REPEATS = 10
/** 5-fold × 10회 반복 = 분할 50개(정확도 추정값 수, t 자유도 49) */
export const CV_REPS = FOLDS * REPEATS
export const N_TRAIN = 1850
export const PLAN_YEAR = 2027
export const N_PLAN_2027 = 2150
export const MARKERS = 4820
/** 유효 독립 분절 수(경험적 적합값) */
export const ME = 250
/** 같은 분할에서 대안 모델과 GBLUP 반복값의 상관 */
export const RHO = 0.85
/** 모델 교체 실용 기준 Δr */
export const PRACTICAL_DELTA = 0.02
/** t(0.975, 49) */
export const T975_DF49 = 2.0096
export const RETRAIN_NEXT = '2027-02'
export const FORWARD_NEXT = '2027-01'

export const YEARS = [2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const CUR_YEAR: Year = 2026

/** 쌀 수량 GBLUP 예측 정확도(program-overview R) */
export const R: Record<Year, number> = { 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
/** 목표(program-overview R_T) */
export const R_T: Record<Year, number> = { 2022: 0.45, 2023: 0.5, 2024: 0.52, 2025: 0.55, 2026: 0.58 }
/** 훈련 집단(계통) */
export const TRAIN_N: Record<Year, number> = { 2022: 620, 2023: 950, 2024: 1280, 2025: 1560, 2026: 1850 }
/** 전진 검증 정확도(그해 2월 모델 → 그해 신규 PYT 계통). 2026은 미산출 */
export const FORWARD: Partial<Record<Year, number>> = { 2022: 0.4, 2023: 0.43, 2024: 0.47, 2025: 0.48 }
export const RETRAIN_LABEL: Record<Year, string> = {
  2022: '2022-02 최초 구축',
  2023: '2023-02',
  2024: '2024-02',
  2025: '2025-02',
  2026: '2026-02',
}

// ---------------- 형질·모델 ----------------

export type TraitKey = 'yield' | 'heading' | 'height' | 'tgw' | 'blast' | 'taste'
export interface TraitDef {
  key: TraitKey
  name: string
  short: string
  /** GBLUP 평균 r(2026) */
  mean: number
  /** GBLUP 교차 검증 SD */
  sd: number
  /** 훈련 집단 계통평균 협의 유전력(2026 REML) */
  h2: number
  /** 유전 구조 설명(근거 문장 앞머리, 숫자 없음) */
  arch?: string
}

export const TRAITS: TraitDef[] = [
  { key: 'yield', name: '쌀 수량', short: '수량', mean: R[2026], sd: 0.04, h2: 0.36, arch: '다유전자 형질' },
  { key: 'heading', name: '출수기', short: '출수기', mean: 0.68, sd: 0.03, h2: 0.72, arch: 'Hd1(Chr06)·Ghd7(Chr07) 주효 QTL' },
  { key: 'height', name: '간장', short: '간장', mean: 0.65, sd: 0.03, h2: 0.62 },
  { key: 'tgw', name: '천립중', short: '천립중', mean: 0.61, sd: 0.04, h2: 0.55 },
  { key: 'blast', name: '도열병 저항성', short: '도열병', mean: 0.47, sd: 0.05, h2: 0.3, arch: 'Pi9(Chr06)·Pi-ta(Chr12) 주동 저항성 유전자' },
  { key: 'taste', name: '밥맛(식미치)', short: '밥맛', mean: 0.38, sd: 0.06, h2: 0.18 },
]
export const TRAIT_BY_KEY = Object.fromEntries(TRAITS.map(t => [t.key, t])) as Record<TraitKey, TraitDef>

export type ModelKey = 'GBLUP' | 'BayesB' | 'BayesCπ' | 'RKHS'
export const MODELS: ModelKey[] = ['GBLUP', 'BayesB', 'BayesCπ', 'RKHS']
export const ALT_MODELS: ModelKey[] = ['BayesB', 'BayesCπ', 'RKHS']
export const OPERATING_MODEL: ModelKey = 'GBLUP'
export const SD_ADD: Record<ModelKey, number> = { GBLUP: 0, BayesB: 0.005, BayesCπ: 0.005, RKHS: 0 }
/** 1회 적합 시간(분), 1,850계통 × 4,820 SNP, 형질 1개 */
export const FIT_MIN: Record<ModelKey, number> = { GBLUP: 0.4, BayesB: 38, BayesCπ: 35, RKHS: 1.2 }
export const MODEL_NOTE: Record<ModelKey, string> = {
  GBLUP: '유전체 관계 행렬, 모든 마커 같은 분산',
  BayesB: 'MCMC 30,000회(burn-in 5,000), 큰 효과 마커 덜 수축',
  BayesCπ: 'MCMC, 효과 0 비율 π 추정',
  RKHS: '가우스 커널, 비상가 효과 일부 포착',
}

/** GBLUP 대비 차이(N = 1,850) */
export const DELTA: Record<TraitKey, Record<Exclude<ModelKey, 'GBLUP'>, number>> = {
  yield: { BayesB: -0.01, BayesCπ: 0, RKHS: 0.01 },
  heading: { BayesB: 0.03, BayesCπ: 0.02, RKHS: 0 },
  height: { BayesB: 0.01, BayesCπ: 0.01, RKHS: 0 },
  tgw: { BayesB: 0.01, BayesCπ: 0.01, RKHS: 0 },
  blast: { BayesB: 0.04, BayesCπ: 0.03, RKHS: -0.01 },
  taste: { BayesB: -0.01, BayesCπ: 0, RKHS: 0.01 },
}
const delta = (t: TraitKey, m: ModelKey) => (m === 'GBLUP' ? 0 : DELTA[t][m])

// ---------------- 통계 보조 ----------------

export const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
export const sampleSd = (xs: readonly number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
const standardize = (xs: number[]) => {
  const m = mean(xs)
  const s = sampleSd(xs)
  return xs.map(x => (x - m) / s)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---------------- 교차 검증 반복값 ----------------

const rng = createRng(SEED)
// 1) GBLUP — program-overview data.ts의 Z와 같은 소비 순서
const Z: Record<ModelKey, Record<TraitKey, number[]>> = { GBLUP: {}, BayesB: {}, BayesCπ: {}, RKHS: {} } as Record<ModelKey, Record<TraitKey, number[]>>
for (const t of TRAITS) Z.GBLUP[t.key] = standardize(Array.from({ length: CV_REPS }, () => rng.normal(0, 1)))
// 2) 대안 모델 — 모델 순서 × 형질 순서, GBLUP과 상관 RHO인 쌍체 반복
for (const m of ALT_MODELS) {
  for (const t of TRAITS) {
    const e = standardize(Array.from({ length: CV_REPS }, () => rng.normal(0, 1)))
    const g = Z.GBLUP[t.key]
    Z[m][t.key] = standardize(g.map((z, k) => RHO * z + Math.sqrt(1 - RHO * RHO) * e[k]!))
  }
}

export interface CellStat {
  trait: TraitKey
  model: ModelKey
  /** 평균 예측 정확도 r */
  mean: number
  sd: number
  folds: number[]
  min: number
  max: number
  /** 예측 능력 = r · √h² */
  predAbility: number
  /** 신뢰도 r² */
  reliability: number
}

/** CELLS[trait][model] */
export const CELLS = Object.fromEntries(
  TRAITS.map(t => [
    t.key,
    Object.fromEntries(
      MODELS.map(m => {
        const mu = t.mean + delta(t.key, m)
        const sd = t.sd + SD_ADD[m]
        const folds = Z[m][t.key].map(z => clamp(mu + sd * z, 0, 1))
        const cell: CellStat = {
          trait: t.key,
          model: m,
          mean: mean(folds),
          sd: sampleSd(folds),
          folds,
          min: Math.min(...folds),
          max: Math.max(...folds),
          predAbility: mu * Math.sqrt(t.h2),
          reliability: mu * mu,
        }
        return [m, cell]
      }),
    ),
  ]),
) as Record<TraitKey, Record<ModelKey, CellStat>>

// ---------------- 쌍체 차이와 권장 ----------------

export interface PairedDiff {
  model: ModelKey
  delta: number
  sdDiff: number
  lo: number
  hi: number
  /** Δ ≥ 실용 기준 그리고 CI 하한 > 0 */
  ok: boolean
}

export interface Recommendation {
  trait: TraitKey
  /** 최대 Δr 대안(모델 순서상 처음 나온 최댓값) */
  best: PairedDiff
  /** 최대 Δr과 동률인 다른 대안 */
  tie: PairedDiff | null
  diffs: PairedDiff[]
  rec: ModelKey
  switch: boolean
  /** 근거 문장 */
  reason: string
}

export const fmt3 = (v: number) => formatFixed(v, 3)
export const fmtSigned3 = (v: number) => formatSigned(v, 3)
export const fmtCi = (d: PairedDiff) => `[${fmt3(d.lo)}, ${fmt3(d.hi)}]`

function pairedDiffs(t: TraitKey): PairedDiff[] {
  const base = CELLS[t].GBLUP.folds
  return ALT_MODELS.map(m => {
    const d = CELLS[t][m].folds.map((v, k) => v - base[k]!)
    const md = mean(d)
    const sdd = sampleSd(d)
    const half = (T975_DF49 * sdd) / Math.sqrt(CV_REPS)
    return { model: m, delta: md, sdDiff: sdd, lo: md - half, hi: md + half, ok: md >= PRACTICAL_DELTA - 1e-9 && md - half > 0 }
  })
}

const pd = PRACTICAL_DELTA.toFixed(2)

export const RECS: Recommendation[] = TRAITS.map(t => {
  const diffs = pairedDiffs(t.key)
  let best = diffs[0]!
  for (const d of diffs) if (d.delta > best.delta + 1e-9) best = d
  const tie = diffs.find(d => d !== best && Math.abs(d.delta - best.delta) < 1e-9) ?? null
  const oks = diffs.filter(d => d.ok)
  let recDiff: PairedDiff | null = null
  for (const d of oks) if (!recDiff || d.delta > recDiff.delta + 1e-9) recDiff = d
  const rec: ModelKey = recDiff ? recDiff.model : OPERATING_MODEL

  let reason: string
  if (recDiff) {
    const others = oks.filter(d => d !== recDiff)
    reason = `${t.arch ? `${t.arch} — ` : ''}큰 효과 마커를 덜 수축하는 ${recDiff.model}가 유리.`
    if (others.length)
      reason += ` ${others.map(o => `${o.model}도 ${fmtSigned3(o.delta)} ${fmtCi(o)}으로 기준 충족`).join(', ')}하나 ${recDiff.model}가 더 높음`
  } else {
    const significant = best.lo > 0
    const parts: string[] = []
    if (t.arch) parts.push(`${t.arch}.`)
    if (significant && t.arch) parts.push(`${best.model} 우위는 통계적으로 유의하지만 실용 기준 ${pd} 미달`)
    else {
      const extra: string[] = []
      if (tie) extra.push(`${tie.model} 동률 ${fmtSigned3(tie.delta)}`)
      if (significant && best.lo < 0.001) extra.push('CI 하한이 0에 근접')
      parts.push(`실용 기준 ${pd} 미달${extra.length ? `(${extra.join(', ')})` : ''}`)
    }
    reason = parts.join(' ')
  }
  return { trait: t.key, best, tie, diffs, rec, switch: rec !== OPERATING_MODEL, reason }
})
export const REC_BY_TRAIT = Object.fromEntries(RECS.map(r => [r.trait, r])) as Record<TraitKey, Recommendation>
export const SWITCHES = RECS.filter(r => r.switch)

/** 모델별 6형질 평균 r */
export const modelMean = (m: ModelKey) => mean(TRAITS.map(t => CELLS[t.key][m].mean))
export const RECOMMENDED_MEAN = mean(TRAITS.map(t => CELLS[t.key][REC_BY_TRAIT[t.key].rec].mean))

// ---------------- 학습 곡선 ----------------

const g = (n: number, h2: number) => Math.sqrt((n * h2) / (n * h2 + ME))
/** 상한 계수 a_t */
export const upperA = (t: TraitDef) => t.mean / g(N_TRAIN, t.h2)
export function curve(t: TraitDef, m: ModelKey, n: number) {
  return upperA(t) * g(n, t.h2) + delta(t.key, m) * Math.sqrt(n / N_TRAIN)
}
export function curveSd(t: TraitDef, m: ModelKey, n: number) {
  return (t.sd + SD_ADD[m]) * (N_TRAIN / n) ** 0.25
}
export const GRID = [300, 600, 900, 1200, 1500, 1850] as const
export const EXTRA = [2150, 2500] as const
export const N_MIN = 300
export const N_MAX = 2500

const YIELD = TRAIT_BY_KEY.yield
/** 수량 GBLUP이 목표 r에 닿는 훈련 집단 N* (이분법) */
function solveNStar(target: number) {
  let lo = N_TRAIN
  let hi = 100000
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2
    if (curve(YIELD, 'GBLUP', mid) < target) lo = mid
    else hi = mid
  }
  return hi
}
export const R_TARGET = R_T[CUR_YEAR]
export const N_STAR = solveNStar(R_TARGET)
export const N_STAR_ROUND = Math.round(N_STAR)
export const N_STAR_ADD = N_STAR_ROUND - N_TRAIN
export const R_PLAN_2027 = curve(YIELD, 'GBLUP', N_PLAN_2027)
export const YEAR_RESIDUALS = YEARS.map(y => ({ year: y, n: TRAIN_N[y], r: R[y], fit: curve(YIELD, 'GBLUP', TRAIN_N[y]) }))

// ---------------- h²–r 회귀(GBLUP 6점 OLS) ----------------

export const REGRESSION = (() => {
  const xs = TRAITS.map(t => t.h2)
  const ys = TRAITS.map(t => CELLS[t.key].GBLUP.mean)
  const { slope, intercept } = linearFit(xs, ys)
  const my = mean(ys)
  const sst = ys.reduce((s, y) => s + (y - my) ** 2, 0)
  const sse = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i]!)) ** 2, 0)
  const points = TRAITS.map((t, i) => {
    const fit = intercept + slope * xs[i]!
    return { trait: t.key, h2: t.h2, r: ys[i]!, fit, resid: ys[i]! - fit, predAbility: CELLS[t.key].GBLUP.predAbility }
  })
  return { slope, intercept, r2: 1 - sse / sst, points }
})()
export const REG_X: [number, number] = [0.15, 0.75]

// ---------------- KPI ----------------

export type Severity = 'critical' | 'warning' | 'ok'
export const severity = (a: number): Severity => (a < 90 ? 'critical' : a < 100 ? 'warning' : 'ok')

const gblupMeans = TRAITS.map(t => CELLS[t.key].GBLUP.mean)
const maxTrait = TRAITS[gblupMeans.indexOf(Math.max(...gblupMeans))]!
const minTrait = TRAITS[gblupMeans.indexOf(Math.min(...gblupMeans))]!
const fwd2025 = FORWARD[2025]!

export const KPI = {
  r: R[CUR_YEAR],
  rTarget: R_T[CUR_YEAR],
  achievement: (R[CUR_YEAR] / R_T[CUR_YEAR]) * 100,
  rDelta: R[CUR_YEAR] - R[2025],
  trainN: TRAIN_N[CUR_YEAR],
  trainDelta: TRAIN_N[CUR_YEAR] - TRAIN_N[2025],
  traitMean: mean(gblupMeans),
  traitMax: { trait: maxTrait, r: Math.max(...gblupMeans) },
  traitMin: { trait: minTrait, r: Math.min(...gblupMeans) },
  switchCount: SWITCHES.length,
  forwardYear: 2025 as Year,
  forward: fwd2025,
  forwardCv: R[2025],
  forwardGap: fwd2025 - R[2025],
  forwardRatio: fwd2025 / R[2025],
}

const fyears = YEARS.filter(y => FORWARD[y] !== undefined)
export const FORWARD_MEAN_RATIO = mean(fyears.map(y => FORWARD[y]! / R[y]))
export const FORWARD_MEAN_GAP = mean(fyears.map(y => R[y] - FORWARD[y]!))

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol
  console.assert(near(CELLS.yield.GBLUP.mean, R[2026]), '[검산] 수량 GBLUP 평균 r이 R[2026]과 다름', CELLS.yield.GBLUP.mean)
  console.assert(
    TRAITS.every(t => MODELS.every(m => CELLS[t.key][m].folds.every(v => v > 0 && v < 1))),
    '[검산] 교차 검증 반복값이 [0, 1] 밖(clamp 발동)',
  )
  const expectRec: Record<TraitKey, ModelKey> = { yield: 'GBLUP', heading: 'BayesB', height: 'GBLUP', tgw: 'GBLUP', blast: 'BayesB', taste: 'GBLUP' }
  console.assert(
    RECS.every(r => r.rec === expectRec[r.trait]),
    '[검산] 모델 권장 결과가 명세(출수기·도열병 BayesB, 나머지 GBLUP)와 다름',
    RECS.map(r => `${r.trait}:${r.rec}`).join(' '),
  )
  console.assert(N_STAR >= 2100 && N_STAR <= 2130, '[검산] 목표 도달 훈련 집단 N*가 2,100~2,130 밖', N_STAR)
  console.assert(
    YEAR_RESIDUALS.every(p => Math.abs(p.r - p.fit) <= 0.01),
    '[검산] 연도별 운영 모델 r이 학습 곡선에서 0.01 넘게 벗어남',
    YEAR_RESIDUALS.map(p => (p.r - p.fit).toFixed(4)).join(' '),
  )
  console.assert(
    TRAITS.every(t => MODELS.every(m => CELLS[t.key][m].predAbility <= Math.sqrt(t.h2) + 1e-12)),
    '[검산] 예측 능력이 √h²를 넘음',
  )
  console.assert(near(CELLS.yield.GBLUP.min, 0.49628, 5e-6) && near(CELLS.yield.GBLUP.max, 0.68901, 5e-6), '[검산] 수량 GBLUP 반복값 범위가 0.49628~0.68901과 다름', CELLS.yield.GBLUP.min, CELLS.yield.GBLUP.max)
  console.assert(near(REGRESSION.slope, 0.5294, 5e-5) && near(REGRESSION.intercept, 0.31912, 5e-5) && near(REGRESSION.r2, 0.91918, 5e-5), '[검산] h²–r 회귀 계수가 명세와 다름', REGRESSION)
}
