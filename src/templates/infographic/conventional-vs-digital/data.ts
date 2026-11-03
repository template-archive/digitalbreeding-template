/**
 * 전통 육종 vs 디지털육종 — 상수와 파생값.
 * 명세: docs/specs/conventional-vs-digital.md
 * 시드 20261023(프로그램 공통 기록용). 이 템플릿은 난수를 쓰지 않는다. 모든 표시값은 아래 상수에서 계산한다.
 * 다른 템플릿 상수는 복제했다(템플릿 간 import 금지). 출처는 각 블록 주석에 남긴다.
 */

export const AS_OF = '2026-10-23'
export const ORG = '○○연구원 벼 디지털육종 프로그램(가상)'

// ───────── 출처: kpi/program-overview/data.ts ─────────
export const MU = 560 // 기준 평균 쌀 수량(kg/10a, 백미)
export const BASIS = { conventional: 2019, digital: 2026 } as const
export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const I: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
export const P_PARENT = { 2019: 0.2, 2026: 0.1 } as const // 부모(재순환) 선발 비율
export const R: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
export const SIGMA_A: Record<Year, number> = { 2019: 30.0, 2020: 29.7, 2021: 29.6, 2022: 29.3, 2023: 29.0, 2024: 28.8, 2025: 28.5, 2026: 28.2 }
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
// ①후보 ②계통 선발 ③PYT ④AYT ⑤MET ⑥출원 후보
export const PIPELINE = {
  2019: [1500, 300, 90, 30, 15, 2],
  2026: [2000, 600, 120, 40, 18, 3],
} as const

// ───────── 출처: infographic/digital-breeding-process/data.ts ─────────
export const DEV_YEARS = { conventional: 11.0, digital: 6.7 } as const // TOTAL(디지털은 설계값)
export const SHORTEST_ACTUAL_YEARS = 7 // 실제 최단 출원(도입 과도기 계통)
export const TRIAL_YEARS = { conventional: 6.0, digital: 4.0 } as const // ⑥ 생산력·지역 적응 시험 기간

// ───────── 출처: kpi/genetic-gain-tracker periodStats(쌀 수량, 2019~2026) — 실현 유전적 추세 기울기 ─────────
// 원 실행값(2026-10-26 정리 회차 2 재실행, REALIZATION_BIAS 0.90). 전통 = 2019~2021 코호트, GS = 2021~2026 코호트
// (이전 상수 3.44 / 9.097은 반올림값이라 배율·실현 기준 비용의 마지막 자리가 달랐다)
export const REALIZED = { conventional: 3.439753, gs: 9.097399 } as const // kg/10a/년 → "3.4", "9.1"
/** 실현 배율 2.644783 → "2.6배". 예측 배율 GAIN_RATIO와 함께 보인다(사용자 결정 2026-10-26) */
export const REALIZED_RATIO = REALIZED.gs / REALIZED.conventional
export const GS_START_YEAR = 2022

// ───────── 비용 가정(추정, 이 템플릿 고유) ─────────
export const USD_KRW = 1390 // 칩 단가 환산용(추정)
export const COST = {
  perLine: {
    // 만 원/계통
    conventional: { advance: 2.0, phenoEval: 3.0 }, // 포장 1작 + 동계 온실 세대 진전, 관찰 포장 1작기 평가
    digital: { speedAdvance: 2.5, genotyping: 2.5, prediction: 1.0 }, // 단일 처리 온실 F2~F6, 6K 칩(약 18 USD) + DNA 추출, 예측·데이터 관리
  },
  plot: 8, // 만 원/시험구
  checks: 2, // 시험마다 대비 품종 수
  reps: { pyt: 2, ayt: 3, met: 3 },
  sites: { pyt: 1, ayt: 1, met: 8 },
} as const

export type K = 'conventional' | 'digital'
const yr = (k: K) => BASIS[k]

// ───────── ΔG ─────────
export const dG = (y: Year) => (I[y] * R[y] * SIGMA_A[y]) / L[y]
export const dGpct = (y: Year) => (dG(y) / MU) * 100
export const DG = { conventional: dG(BASIS.conventional), digital: dG(BASIS.digital) }
export const DG_PCT = { conventional: dGpct(BASIS.conventional), digital: dGpct(BASIS.digital) }
export const GAIN_RATIO = DG.digital / DG.conventional

// ───────── LMDI(genetic-gain-tracker와 같은 알고리즘: 연도별 분해를 합산) ─────────
export type Factor = 'i' | 'r' | 'sigmaA' | 'L'
export const FACTORS: Factor[] = ['i', 'r', 'sigmaA', 'L']

export function lmdi(y: Year): Record<Factor, number> {
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

export const CONTRIB: Record<Factor, number> = (() => {
  const acc: Record<Factor, number> = { i: 0, r: 0, sigmaA: 0, L: 0 }
  for (const y of YEARS) {
    if (y <= BASIS.conventional || y > BASIS.digital) continue
    const c = lmdi(y)
    for (const f of FACTORS) acc[f] += c[f]
  }
  return acc
})()
export const DELTA_DG = DG.digital - DG.conventional
export const SHARE: Record<Factor, number> = {
  i: (CONTRIB.i / DELTA_DG) * 100,
  r: (CONTRIB.r / DELTA_DG) * 100,
  sigmaA: (CONTRIB.sigmaA / DELTA_DG) * 100,
  L: (CONTRIB.L / DELTA_DG) * 100,
}
/** 반올림 비중(소수 1자리)의 합 — 각주 "합이 100.1%" */
export const SHARE_ROUNDED_SUM = FACTORS.reduce((s, f) => s + Number(SHARE[f].toFixed(1)), 0)
const c = BASIS.conventional
const d = BASIS.digital
export const FACTOR_RATIO: Record<Factor, number> = {
  i: I[d] / I[c],
  r: R[d] / R[c],
  sigmaA: SIGMA_A[d] / SIGMA_A[c],
  L: L[c] / L[d], // 1/L 배율
}

// ───────── 시간·선발 ─────────
export const DEV_SAVED = DEV_YEARS.conventional - DEV_YEARS.digital // 4.3(r1 표시)
export const DEV_SAVED_PCT = (DEV_SAVED / DEV_YEARS.conventional) * 100
export const L_SAVED = L[c] - L[d]
export const L_SAVED_PCT = (L_SAVED / L[c]) * 100
export const CYCLE_SPEEDUP = L[c] / L[d]
export const R_DELTA = R[d] - R[c]
export const R_PCT = (R[d] / R[c] - 1) * 100
export const I_PCT = (I[d] / I[c] - 1) * 100
export const SIGMA_A_PCT = (SIGMA_A[d] / SIGMA_A[c] - 1) * 100

// ───────── 규모·비용 ─────────
export const perLine = (k: K) => Object.values(COST.perLine[k]).reduce((s, v) => s + v, 0)
export const plots = (k: K) => {
  const [, , pyt, ayt, met] = PIPELINE[yr(k)]
  return {
    pyt: (pyt + COST.checks) * COST.reps.pyt * COST.sites.pyt,
    ayt: (ayt + COST.checks) * COST.reps.ayt * COST.sites.ayt,
    met: (met + COST.checks) * COST.reps.met * COST.sites.met,
  }
}
const sumPlots = (k: K) => {
  const p = plots(k)
  return p.pyt + p.ayt + p.met
}
export const N_PLOTS = { conventional: sumPlots('conventional'), digital: sumPlots('digital') }
export const N_PLOTS_PCT = (N_PLOTS.digital / N_PLOTS.conventional - 1) * 100
const trialLines = (k: K) => PIPELINE[yr(k)][2] + PIPELINE[yr(k)][3] + PIPELINE[yr(k)][4]
export const TRIAL_LINES = { conventional: trialLines('conventional'), digital: trialLines('digital') }
export const EVAL_LINES = { conventional: PIPELINE[c][0], digital: PIPELINE[d][0] }
export const EVAL_LINES_PCT = (EVAL_LINES.digital / EVAL_LINES.conventional - 1) * 100
export const PER_LINE = { conventional: perLine('conventional'), digital: perLine('digital') }
const annualCost = (k: K) => EVAL_LINES[k] * PER_LINE[k] + N_PLOTS[k] * COST.plot // 만 원
export const ANNUAL_COST = { conventional: annualCost('conventional'), digital: annualCost('digital') } // 만 원
export const ANNUAL_COST_EOK = { conventional: ANNUAL_COST.conventional / 10000, digital: ANNUAL_COST.digital / 10000 } // 억 원
export const COST_RATIO = ANNUAL_COST.digital / ANNUAL_COST.conventional
export const COST_PCT = (COST_RATIO - 1) * 100
export const COST_PER_GAIN = { conventional: ANNUAL_COST.conventional / DG.conventional, digital: ANNUAL_COST.digital / DG.digital } // 만 원/(kg/10a)
export const COST_PER_GAIN_PCT = (COST_PER_GAIN.digital / COST_PER_GAIN.conventional - 1) * 100
/** 실현 추세 기준 개량 1 kg/10a당 직접비(정리 회차 2): 3,780.50 → 2,066.53 만 원 */
export const COST_PER_GAIN_REALIZED = { conventional: ANNUAL_COST.conventional / REALIZED.conventional, digital: ANNUAL_COST.digital / REALIZED.gs } // 만 원/(kg/10a)
export const COST_PER_GAIN_REALIZED_PCT = (COST_PER_GAIN_REALIZED.digital / COST_PER_GAIN_REALIZED.conventional - 1) * 100 // −45.3373
export const CHIP_USD = (COST.perLine.digital.genotyping * 10000) / USD_KRW

// ───────── 폭포 차트 단계(원값으로 쌓는다) ─────────
export interface WaterfallStep {
  key: 'start' | Factor | 'end'
  /** 막대 아래 이름(줄 단위) */
  name: string[]
  from: number
  to: number
}
export const WATERFALL: WaterfallStep[] = (() => {
  const steps: WaterfallStep[] = [{ key: 'start', name: ['전통 ΔG', `${c}`], from: 0, to: DG.conventional }]
  const names: Record<Factor, string[]> = {
    i: ['선발 강도', '(i)'],
    r: ['선발 정확도', '(r)'],
    sigmaA: ['상가적 유전', '표준편차(σA)'],
    L: ['세대 간격', '(L) 단축'],
  }
  let acc = DG.conventional
  for (const f of FACTORS) {
    steps.push({ key: f, name: names[f], from: acc, to: acc + CONTRIB[f] })
    acc += CONTRIB[f]
  }
  steps.push({ key: 'end', name: ['디지털 ΔG', `${d}`], from: 0, to: DG.digital })
  return steps
})()

// ───────── DEV 검산 ─────────
if (import.meta.env.DEV) {
  const T = '[검산] [conventional-vs-digital]'
  const r1 = (v: number) => v.toFixed(1)
  const r2 = (v: number) => v.toFixed(2)
  console.assert(r2(DG.conventional) === '4.20' && r2(DG.digital) === '12.82', `${T} ΔG 2019/2026 = ${r2(DG.conventional)}/${r2(DG.digital)}, 기대 4.20/12.82`)
  console.assert(r1(GAIN_RATIO) === '3.1', `${T} GAIN_RATIO = ${GAIN_RATIO}, 기대 3.1`)
  const sumC = FACTORS.reduce((s, f) => s + CONTRIB[f], 0)
  console.assert(Math.abs(sumC - DELTA_DG) < 1e-9, `${T} ΣCONTRIB − DELTA_DG 잔차 ${sumC - DELTA_DG}`)
  const cr = FACTORS.map(f => r2(CONTRIB[f])).join('/')
  console.assert(cr === '1.28/2.25/-0.52/5.61', `${T} CONTRIB = ${cr}, 기대 1.28/2.25/-0.52/5.61`)
  console.assert(r1(SHARE.L) === '65.1', `${T} SHARE.L = ${SHARE.L}, 기대 65.1`)
  console.assert(N_PLOTS.conventional === 688 && N_PLOTS.digital === 850, `${T} N_PLOTS = ${N_PLOTS.conventional}/${N_PLOTS.digital}, 기대 688/850`)
  console.assert(plots('digital').ayt === 126, `${T} 디지털 AYT 시험구 = ${plots('digital').ayt}, 기대 126`)
  console.assert(Math.round(ANNUAL_COST.conventional) === 13004 && Math.round(ANNUAL_COST.digital) === 18800, `${T} ANNUAL_COST = ${ANNUAL_COST.conventional}/${ANNUAL_COST.digital}, 기대 13004/18800`)
  console.assert(
    Math.round(COST_PER_GAIN.conventional) === 3096 && Math.round(COST_PER_GAIN.digital) === 1466,
    `${T} COST_PER_GAIN = ${COST_PER_GAIN.conventional}/${COST_PER_GAIN.digital}, 기대 3096/1466`,
  )
  // 정리 회차 2: 실현 배율·실현 기준 비용 효율
  console.assert(r1(REALIZED_RATIO) === '2.6', `${T} REALIZED_RATIO = ${REALIZED_RATIO}, 기대 2.6`)
  console.assert(
    Math.round(COST_PER_GAIN_REALIZED.conventional) === 3781 && Math.round(COST_PER_GAIN_REALIZED.digital) === 2067,
    `${T} COST_PER_GAIN_REALIZED = ${COST_PER_GAIN_REALIZED.conventional}/${COST_PER_GAIN_REALIZED.digital}, 기대 3781/2067`,
  )
  console.assert(r1(COST_PER_GAIN_REALIZED_PCT) === '-45.3', `${T} COST_PER_GAIN_REALIZED_PCT = ${COST_PER_GAIN_REALIZED_PCT}, 기대 -45.3`)
  console.assert(r1(DEV_SAVED) === '4.3', `${T} DEV_SAVED = ${DEV_SAVED}, 기대 4.3`)
  // 반올림 라벨 연쇄 합 = 끝 막대 라벨
  const chain = Number(r2(DG.conventional)) + FACTORS.reduce((s, f) => s + Number(r2(CONTRIB[f])), 0)
  console.assert(chain.toFixed(2) === r2(DG.digital), `${T} 반올림 라벨 연쇄 합 ${chain.toFixed(2)} ≠ 끝 막대 ${r2(DG.digital)}`)
  console.assert(r1(SHARE_ROUNDED_SUM) === '100.1', `${T} 반올림 비중 합 = ${SHARE_ROUNDED_SUM}, 기대 100.1`)
}
