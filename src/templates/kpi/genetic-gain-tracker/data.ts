/**
 * 유전적 개량량 추적 — 목업 데이터
 * 명세: docs/specs/genetic-gain-tracker.md
 *
 * - 연도별 구성 요소 i, r, σA, L은 program-overview `data.ts`와 같은 값이다(템플릿 간 import 금지라 옮겨 적음).
 * - ΔG, 상관 반응, 회귀 기울기, LMDI 분해, 지수는 모두 상수에서 계산한다(하드코딩 금지).
 * - 난수는 유전적 추세 증분 잡음과 표현형 환경 효과에만 쓴다(시드 20261023, 소비 순서 고정).
 * 실제 API로 바꿀 때는 TREND(코호트 평균 GEBV·표현형 편차)와 구성 요소 상수만 교체하면 된다.
 */
import { createRng } from '@/lib/rng'
import { linearFit } from '@/lib/stats'

export const SEED = 20261023
export const AS_OF = '2026-10-23'
/** 진행 중(잠정) 연도 */
export const PROVISIONAL_YEAR = 2026
/** 유전체 선발(GS)·속성세대진전 도입 연도 */
export const GS_START = 2022
/** 기준 평균 μ(2019 코호트 평균 쌀 수량, kg/10a) — %/년 환산에만 쓴다 */
export const MU = 560

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const FIRST_YEAR: Year = 2019
export const LAST_YEAR: Year = 2026
/** 기간 최소 길이(종료 − 시작). 코호트 3개 이상 */
export const MIN_SPAN = 2
/** 실현 증분의 체계적 편향(예측 ΔG 대비 실현 비율, 추정). 2026-10-26 정리 회차 */
export const REALIZATION_BIAS = 0.9

// ---------------- 연도별 구성 요소(program-overview와 같은 값) ----------------

/** 선발 강도 i (2019~2021 p=20%, 2022~ p=10%) — program-overview와 같은 값 */
export const I: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
/** 선발 정확도(~2021, √h²) / GS 예측 정확도(2022~) — program-overview와 같은 값 */
export const R: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
/** 상가적 유전 표준편차 σA (쌀 수량, kg/10a) — program-overview와 같은 값 */
export const SIGMA_A: Record<Year, number> = { 2019: 30.0, 2020: 29.7, 2021: 29.6, 2022: 29.3, 2023: 29.0, 2024: 28.8, 2025: 28.5, 2026: 28.2 }
/** 세대 간격 L (년) — program-overview와 같은 값 */
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
/** 코호트 계통 수. 2019~2021은 보관 DNA 소급 유전형 분석(추정), 2022~는 program-overview PIPELINE[y][0] */
export const N_COHORT: Record<Year, number> = { 2019: 410, 2020: 455, 2021: 520, 2022: 1800, 2023: 1900, 2024: 2000, 2025: 2000, 2026: 2000 }

// ---------------- 형질 ----------------

export type TraitKey = 'yield' | 'culm' | 'blast' | 'taste'

export interface Trait {
  key: TraitKey
  label: string
  /** 주격 조사를 붙인 이름(결론 문장용) */
  subject: string
  unit: string
  /** 바람직한 방향 */
  better: 'up' | 'down'
  betterLabel: string
  /** 수량과의 유전 상관 근사(gebv-selection RHO_WITH_YIELD, 추정). 수량은 1 */
  rg: number
  /** 상가적 유전 표준편차(형질 단위, 전 기간 고정·추정). 수량은 null(연도별 SIGMA_A) */
  sigmaA: number | null
  /** 유전적 추세 증분 잡음 SD */
  noise: number
  /** 표현형 연차 환경 효과 SD */
  env: number
  /** 값·기울기 표시 자릿수 */
  digits: number
  /** 2019 코호트(대비 품종 가람솔) 수준 — 툴팁 설명에만 쓴다 */
  base: number
}

export const TRAITS: Trait[] = [
  { key: 'yield', label: '쌀 수량', subject: '쌀 수량이', unit: 'kg/10a', better: 'up', betterLabel: '높을수록', rg: 1, sigmaA: null, noise: 0.6, env: 10, digits: 1, base: 560 },
  { key: 'culm', label: '간장', subject: '간장이', unit: 'cm', better: 'down', betterLabel: '낮을수록(도복)', rg: 0.3, sigmaA: 4.8, noise: 0.03, env: 1.5, digits: 2, base: 80 },
  { key: 'blast', label: '잎도열병 발병 지수', subject: '잎도열병 발병 지수가', unit: '점', better: 'down', betterLabel: '낮을수록', rg: 0.1, sigmaA: 1.1, noise: 0.0025, env: 0.4, digits: 3, base: 5 },
  { key: 'taste', label: '식미치', subject: '식미치가', unit: '점', better: 'up', betterLabel: '높을수록', rg: -0.2, sigmaA: 2.6, noise: 0.012, env: 0.6, digits: 2, base: 71 },
]
export const TRAIT_BY_KEY = Object.fromEntries(TRAITS.map(t => [t.key, t])) as Record<TraitKey, Trait>

// ---------------- 육종가 방정식 ----------------

/** 쌀 수량 연간 유전적 개량량 ΔG = i · r · σA / L (kg/10a/년) */
export const dG = (y: Year) => (I[y] * R[y] * SIGMA_A[y]) / L[y]
/** ΔG %/년 = ΔG / μ × 100 */
export const dGpct = (y: Year) => (dG(y) / MU) * 100
/** 형질별 σA(수량은 연도별) */
export const traitSigmaA = (t: Trait, y: Year) => t.sigmaA ?? SIGMA_A[y]
/** 수량은 ΔG, 다른 형질은 상관 반응 CR = i · r수량 · rg · σA,형질 / L */
export const dGTrait = (t: Trait, y: Year) => (t.key === 'yield' ? dG(y) : (I[y] * R[y] * t.rg * traitSigmaA(t, y)) / L[y])
/** 변화 방향이 바람직한가(0이면 바람직으로 본다) */
export const isDesirable = (t: Trait, v: number) => (t.better === 'up' ? v >= 0 : v <= 0)

// ---------------- 유전적 추세·표현형 추세(시드 RNG) ----------------

export interface TraitTrend {
  /** 코호트 평균 GEBV, 2019 코호트 = 0 */
  G: Record<Year, number>
  /** 생산력 검정 평균의 2019 대비 편차(환경 효과 포함) */
  P: Record<Year, number>
}

function buildTrend(): Record<TraitKey, TraitTrend> {
  const rng = createRng(SEED)
  const out = {} as Record<TraitKey, TraitTrend>
  // 소비 순서: yield → culm → blast → taste, 형질마다 증분 잡음 2020~2026(7) → 환경 효과 2019~2026(8)
  for (const t of TRAITS) {
    const G = { 2019: 0 } as Record<Year, number>
    for (const y of YEARS.slice(1)) G[y] = G[(y - 1) as Year] + REALIZATION_BIAS * dGTrait(t, y) + rng.normal(0, t.noise)
    const E = {} as Record<Year, number>
    for (const y of YEARS) E[y] = rng.normal(0, t.env)
    const P = {} as Record<Year, number>
    for (const y of YEARS) P[y] = G[y] + E[y] - E[2019]
    out[t.key] = { G, P }
  }
  return out
}

export const TREND: Record<TraitKey, TraitTrend> = buildTrend()

// ---------------- 통계 보조 ----------------

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** OLS 회귀 y = a + b·x(@/lib/stats linearFit) */
export function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const { slope, intercept } = linearFit(xs, ys)
  return { a: intercept, b: slope }
}

export const yearsIn = (start: Year, end: Year) => YEARS.filter(y => y >= start && y <= end)

// ---------------- 기간 통계 ----------------

export interface Segment {
  kind: 'trad' | 'gs'
  /** 회귀에 쓰는 코호트(전통 = ~2021, GS = 2021~종료) */
  cohorts: Year[]
  /** 예측 ΔG를 평균하는 연도(전통 = ~2021, GS = 2022~) */
  predYears: Year[]
  slope: number
  intercept: number
  /** 기간 평균 예측 ΔG(수량) 또는 상관 반응(다른 형질) */
  predMean: number
  /** 실현율(%) = slope / predMean × 100 */
  realization: number
  /** 예측 연도 구성 요소 평균 */
  comp: { i: number; r: number; sigmaA: number; L: number }
}

function segment(t: Trait, kind: 'trad' | 'gs', cohorts: Year[], predYears: Year[]): Segment | null {
  if (cohorts.length < 2 || predYears.length < 1) return null
  const { a, b } = ols(cohorts, cohorts.map(y => TREND[t.key].G[y]))
  const predMean = mean(predYears.map(y => dGTrait(t, y)))
  return {
    kind,
    cohorts,
    predYears,
    slope: b,
    intercept: a,
    predMean,
    realization: (b / predMean) * 100,
    comp: {
      i: mean(predYears.map(y => I[y])),
      r: mean(predYears.map(y => R[y])),
      sigmaA: mean(predYears.map(y => traitSigmaA(t, y))),
      L: mean(predYears.map(y => L[y])),
    },
  }
}

export interface PeriodStats {
  trait: Trait
  start: Year
  end: Year
  years: Year[]
  trad: Segment | null
  gs: Segment | null
  /** 기간 전체 코호트 유전적 추세 기울기 */
  geneticSlope: number
  /** 기간 전체 코호트 표현형 추세 기울기(환경 효과 포함) */
  phenoSlope: number
  /** 누적 유전적 개량 = G(종료) − G(시작) */
  cumulative: number
}

export function periodStats(t: Trait, start: Year, end: Year): PeriodStats {
  const years = yearsIn(start, end)
  const tradCohorts = YEARS.filter(y => y >= start && y <= Math.min(end, GS_START - 1))
  const gsCohorts = end >= GS_START ? YEARS.filter(y => y >= Math.max(start, GS_START - 1) && y <= end) : []
  const tradPred = years.filter(y => y < GS_START)
  const gsPred = years.filter(y => y >= GS_START)
  const G = TREND[t.key].G
  const P = TREND[t.key].P
  return {
    trait: t,
    start,
    end,
    years,
    trad: segment(t, 'trad', tradCohorts, tradPred),
    gs: segment(t, 'gs', gsCohorts, gsPred),
    geneticSlope: ols(years, years.map(y => G[y])).b,
    phenoSlope: ols(years, years.map(y => P[y])).b,
    cumulative: G[end] - G[start],
  }
}

// ---------------- LMDI 분해(쌀 수량) ----------------

export type Factor = 'i' | 'r' | 'sigmaA' | 'L'
export const FACTORS: Factor[] = ['i', 'r', 'sigmaA', 'L']
export const FACTOR_LABEL: Record<Factor, string> = { i: 'i', r: 'r', sigmaA: 'σA', L: 'L' }
export const FACTOR_NAME: Record<Factor, string> = { i: '선발 강도(i)', r: '선발·예측 정확도(r)', sigmaA: '상가적 유전 표준편차(σA)', L: '세대 간격(L)' }
/** 결론 문장의 원인 표현 */
export const FACTOR_CAUSE: Record<Factor, string> = { i: '선발 강도(i) 상승', r: '선발·예측 정확도(r) 향상', sigmaA: '상가적 유전 표준편차(σA) 변화', L: '세대 간격(L) 단축' }
export type Contribution = Record<Factor, number>
/** 기간 변화가 이보다 작으면 비중을 표시하지 않는다(kg/10a/년) */
export const SHARE_MIN_DELTA = 0.5

/** 연도 y−1 → y ΔG 변화의 로그 평균 디비지아 지수 분해. 네 기여의 합 = dG(y) − dG(y−1) */
export function lmdi(y: Year): Contribution {
  const p = (y - 1) as Year
  const g0 = dG(p)
  const g1 = dG(y)
  const w = Math.abs(g1 - g0) < 1e-12 ? g1 : (g1 - g0) / (Math.log(g1) - Math.log(g0))
  return {
    i: w * Math.log(I[y] / I[p]),
    r: w * Math.log(R[y] / R[p]),
    sigmaA: w * Math.log(SIGMA_A[y] / SIGMA_A[p]),
    L: w * Math.log(L[p] / L[y]),
  }
}

export const sumContribution = (c: Contribution) => c.i + c.r + c.sigmaA + c.L

/** 기간 분해 = Σ_{y=start+1..end} lmdi(y) */
export function lmdiRange(start: Year, end: Year): Contribution {
  const acc: Contribution = { i: 0, r: 0, sigmaA: 0, L: 0 }
  for (const y of YEARS) {
    if (y <= start || y > end) continue
    const c = lmdi(y)
    for (const f of FACTORS) acc[f] += c[f]
  }
  return acc
}

// ---------------- 구성 요소 지수 ----------------

export type IndexKey = 'i' | 'r' | 'sigmaA' | 'invL' | 'dG'
/** 시작 연도 = 100. L은 시작값/값(1/L 지수, 높을수록 ΔG에 유리) */
export function componentIndex(start: Year, y: Year): Record<IndexKey, number> {
  return {
    i: (I[y] / I[start]) * 100,
    r: (R[y] / R[start]) * 100,
    sigmaA: (SIGMA_A[y] / SIGMA_A[start]) * 100,
    invL: (L[start] / L[y]) * 100,
    dG: (dG(y) / dG(start)) * 100,
  }
}

// ---------------- DEV 검산(명세 수용 기준) ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) < tol
  console.assert(near(dG(2026), 12.8227, 1e-3), `[검산] ΔG 2026 = ${dG(2026)} (기대 12.8227)`)
  console.assert(near(dGpct(2026) - dGpct(2025), 0.1539, 1e-3), `[검산] ΔG 전년 대비 %p = ${dGpct(2026) - dGpct(2025)} (기대 0.1539)`)
  const y = periodStats(TRAIT_BY_KEY.yield, 2019, 2026)
  console.assert(!!y.trad && near(y.trad.slope, 3.44, 5e-3) && near(y.trad.predMean, 4.199, 1e-3), `[검산] 전통 실현 기울기 ${y.trad?.slope} / 예측 ${y.trad?.predMean} (기대 3.440 / 4.199)`)
  console.assert(!!y.gs && near(y.gs.slope, 9.097, 1e-3) && near(y.gs.predMean, 10.396, 1e-3), `[검산] GS 실현 기울기 ${y.gs?.slope} / 예측 ${y.gs?.predMean} (기대 9.097 / 10.396)`)
  console.assert(!!y.trad && !!y.gs && near(y.trad.realization, 81.92, 0.05) && near(y.gs.realization, 87.51, 0.05), `[검산] 실현율 ${y.trad?.realization} / ${y.gs?.realization} (기대 81.9 / 87.5)`)
  console.assert(near(y.cumulative, 52.138, 1e-3), `[검산] 누적 유전적 개량 ${y.cumulative} (기대 52.138)`)
  console.assert(near(y.phenoSlope, 6.603, 1e-3) && near(y.geneticSlope, 7.52, 1e-3), `[검산] 표현형/유전 기울기 ${y.phenoSlope} / ${y.geneticSlope} (기대 6.603 / 7.520)`)
  const c = lmdiRange(2019, 2026)
  console.assert(near(sumContribution(c), dG(2026) - dG(2019), 1e-9), `[검산] LMDI 잔차 ${sumContribution(c) - (dG(2026) - dG(2019))} (기대 0)`)
  console.assert(near(c.i, 1.281, 1e-3) && near(c.r, 2.247, 1e-3) && near(c.sigmaA, -0.516, 1e-3) && near(c.L, 5.611, 1e-3), `[검산] LMDI 2019→2026 ${JSON.stringify(c)} (기대 i 1.281, r 2.247, σA −0.516, L 5.611)`)
  const c26 = lmdi(2026)
  console.assert(near(c26.r, 0.442, 1e-3) && near(c26.sigmaA, -0.131, 1e-3) && near(c26.L, 0.551, 1e-3), `[검산] LMDI 2025→2026 ${JSON.stringify(c26)}`)
  const idx = componentIndex(2019, 2026)
  console.assert(near(idx.i, 125.36, 0.05) && near(idx.r, 126.67, 0.05) && near(idx.sigmaA, 94.0, 0.05) && near(idx.invL, 204.55, 0.05) && near(idx.dG, 305.3, 0.05), `[검산] 구성 요소 지수 2026 ${JSON.stringify(idx)}`)
  const expGs: Record<Exclude<TraitKey, 'yield'>, [number, number, number]> = { culm: [0.4726, 0.5219, 90.56], blast: [0.0346, 0.0399, 86.75], taste: [-0.1639, -0.1885, 86.97] }
  for (const k of ['culm', 'blast', 'taste'] as const) {
    const s = periodStats(TRAIT_BY_KEY[k], 2019, 2026).gs!
    const [sl, pm, re] = expGs[k]
    console.assert(near(s.slope, sl, 1e-3) && near(s.predMean, pm, 1e-3) && near(s.realization, re, 0.05), `[검산] ${k} GS 실현 ${s.slope} / 예측 ${s.predMean} / 실현율 ${s.realization} (기대 ${sl} / ${pm} / ${re})`)
  }
  console.assert(near(dGTrait(TRAIT_BY_KEY.culm, 2026), 0.6548, 1e-3) && near(dGTrait(TRAIT_BY_KEY.taste, 2026), -0.2364, 1e-3), `[검산] 상관 반응 2026 간장 ${dGTrait(TRAIT_BY_KEY.culm, 2026)}, 식미치 ${dGTrait(TRAIT_BY_KEY.taste, 2026)}`)
  const late = periodStats(TRAIT_BY_KEY.yield, 2022, 2026)
  console.assert(!late.trad && !!late.gs && near(late.gs.slope, 9.626, 1e-3), `[검산] 기간 2022~2026 GS 기울기 ${late.gs?.slope} (기대 9.626, 전통 없음)`)
  console.assert(near(TREND.yield.G[2026], 52.14, 0.005) && near(TREND.yield.P[2026], 29.18, 0.005), `[검산] 수량 G/P 2026 ${TREND.yield.G[2026]} / ${TREND.yield.P[2026]} (기대 52.14 / 29.18)`)
}
