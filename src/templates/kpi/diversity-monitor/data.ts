/**
 * 유전 다양성 모니터 — 목업 데이터(가상).
 * 명세: docs/specs/diversity-monitor.md
 * Ne·ΔF·f̄·He·시나리오는 상수에서 계산하고, 난수(시드 20261023)는 마커 드리프트 모의에만 쓴다.
 * 실제 API로 바꿀 때는 YEARS·L·NE·F_BAR_2026·GROUP_F·KIN_2026·마커 집계(MARKERS)만 교체하면 된다.
 */
import { createRng } from '@/lib/rng'
import { selectionIntensity } from '@/lib/genomics'

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const GS_START = 2022
export const MU = 560 // 쌀 수량 평균(kg/10a), program-baseline
export const AS_OF = '2026-10-23'
export const LAST: Year = 2026

/** 세대 간격(년) — program-overview `L`과 같은 값 */
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
/** 실현 유효 집단 크기 Ne(추정) */
export const NE: Record<Year, number> = { 2019: 96, 2020: 92, 2021: 88, 2022: 64, 2023: 60, 2024: 57, 2025: 54, 2026: 52 }
/** 95% 구간 배율(마커 부트스트랩 흉내, 추정) */
export const NE_CI = [0.85, 1.18] as const
/** 훈련 집단 평균 2pq — kinship-heatmap H_E(추정) */
export const H_REF = 0.4
/** 2026 부모 후보 평균 공조계수 — kinship-heatmap 평균 비대각 G 0.16777 / 2 = 0.08389 (2026-10-26 정리 회차 1·2 후에도 0.0839 유지) */
export const F_BAR_2026 = 0.0839
/** kinship-heatmap 평균 비대각 G */
export const G_MEAN_2026 = 0.1678
/** 부모 계통 근교계수 F(GRM 대각 − 1) — kinship-heatmap */
export const F_LINE_MEAN_2026 = 0.97
export const F_LINE_RANGE_2026 = [0.943, 0.985] as const
/** 그룹 내 평균 f = kinship-heatmap 그룹 내 평균 G / 2 */
export const GROUPS = [
  { key: 'A', label: 'A 중만생 다수성', f: 0.29802 / 2 }, // kinship-heatmap 그룹 평균 G AA(2026-10-26 정리 회차 2)
  { key: 'B', label: 'B 조생 고품질', f: 0.31305 / 2 }, // BB
  { key: 'C', label: 'C 저항성 공여', f: 0.10756 / 2 },
] as const
export type GroupKey = (typeof GROUPS)[number]['key']
/** 근연 요약 — kinship-heatmap(2026-10-22 GRM) */
export const KIN_2026 = { warn: 49, caution: 29, clusters: 13, lines: 60 }
/** 6K SNP 칩 QC 후 SNP 수 */
export const M = 4820
/** 경보 기준(프로그램 내부 기준, 추정) */
export const TH = { neMin: 50, neCaution: 60, dFyrMax: 0.0042, dFyrCaution: 0.0038, heMin: 0.35, fixedShare: 0.03 }
/** 세대당 상한 = Ne 50 */
export const DFGEN_MAX = 1 / (2 * TH.neMin)

// 시나리오 상수
export const I_TRUNC = 1.755 // 상위 10%, program-overview
export const R_ACC = 0.57
export const SIGMA_A = 28.2
export const L_SC = 2.2
export const DG0 = (I_TRUNC * R_ACC * SIGMA_A) / L_SC // 12.8227, program-overview ΔG 2026
export const OCS_K = 1.04
export const OCS_B = 0.2

// ---------------- 연도별 계산 ----------------

export const dFgen = (y: Year) => 1 / (2 * NE[y])
export const dFyr = (y: Year) => 1 - Math.pow(1 - dFgen(y), 1 / L[y])
export const neCi = (y: Year): [number, number] => [Math.round(NE[y] * NE_CI[0]), Math.round(NE[y] * NE_CI[1])]

/** f̄: 2026에서 거꾸로. 1 − f̄t = (1 − f̄t−1)(1 − ΔF연,t) */
export const FBAR = (() => {
  const f = {} as Record<Year, number>
  f[2026] = F_BAR_2026
  for (let i = YEARS.length - 1; i > 0; i--) {
    const y = YEARS[i]!
    f[YEARS[i - 1]!] = 1 - (1 - f[y]) / (1 - dFyr(y))
  }
  return f
})()
export const he = (y: Year) => H_REF * (1 - FBAR[y])
export const heGroup = (f: number) => H_REF * (1 - f)

// ---------------- 마커 드리프트 모의(난수 소비 순서 고정) ----------------

export interface MarkerCount {
  fixed: number
  rare: number
}

export const MARKERS: Record<Year, MarkerCount> = (() => {
  const rng = createRng(20261023)
  const p = new Array<number>(M)
  for (let k = 0; k < M; k++) {
    const rare = rng.next() < 0.06
    let q = rare ? rng.beta(0.35, 5) : rng.beta(1.6, 1.6)
    if (rng.next() < 0.5) q = 1 - q
    p[k] = q
  }
  const lo0 = 0.5 / 60
  for (let k = 0; k < M; k++) {
    if (p[k]! < lo0) p[k] = 0
    else if (p[k]! > 1 - lo0) p[k] = 1
  }
  const out = {} as Record<Year, MarkerCount>
  const count = (y: Year) => {
    let fixed = 0
    let rare = 0
    for (let k = 0; k < M; k++) {
      const maf = Math.min(p[k]!, 1 - p[k]!)
      if (maf === 0) fixed++
      else if (maf < 0.05) rare++
    }
    out[y] = { fixed, rare }
  }
  count(2019)
  for (const y of YEARS.slice(1)) {
    const n = 1 / dFyr(y)
    for (let k = 0; k < M; k++) {
      const q = p[k]!
      if (q === 0 || q === 1) continue
      let q2 = q + Math.sqrt((q * (1 - q)) / n) * rng.normal()
      if (q2 <= 0.5 / n) q2 = 0
      else if (q2 >= 1 - 0.5 / n) q2 = 1
      p[k] = q2
    }
    count(y)
  }
  return out
})()

/** 고정 주의 기준 SNP 수(3%) */
export const FIXED_CAUTION_N = TH.fixedShare * M // 144.6

// ---------------- 상태 판정 ----------------

export type Status = 'ok' | 'warning' | 'critical'
const RANK: Record<Status, number> = { ok: 0, warning: 1, critical: 2 }
export const worst = (...s: Status[]): Status => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok' as Status)

export const neStatus = (y: Year): Status => (NE[y] < TH.neMin ? 'critical' : NE[y] < TH.neCaution ? 'warning' : 'ok')
export const dfyStatus = (y: Year): Status => (dFyr(y) > TH.dFyrMax ? 'critical' : dFyr(y) > TH.dFyrCaution ? 'warning' : 'ok')
export const fixStatus = (y: Year): Status => (MARKERS[y].fixed / M >= TH.fixedShare ? 'warning' : 'ok')
/** 고정 주의 기준을 넘는 최소 SNP 수(정수) */
export const FIXED_CAUTION_COUNT = Math.ceil(FIXED_CAUTION_N)
/** Ne가 주의 구간 이하인 연도 */
export const NE_WATCH_YEARS = YEARS.filter(y => neStatus(y) !== 'ok')
/** 고정 주의 기준을 넘은 첫 연도 */
export const FIXED_WATCH_START = YEARS.find(y => fixStatus(y) !== 'ok') ?? LAST
/** 2026 훈련 집단 크기(기준 빈도) */
export const N_TRAIN_2026 = 1850
/** 표시 축 범위(문구와 차트가 같은 값을 쓴다) */
export const FBAR_AXIS = [0.06, 0.09] as const
export const HE_AXIS = [0.3, 0.42] as const
/** 시나리오 표의 He 전망 기간(년) */
export const HE_HORIZON_YEARS = 10
export const heGroupStatus = (): Status => (GROUPS.some(g => heGroup(g.f) < TH.heMin) ? 'warning' : 'ok')
export const yearStatus = (y: Year): Status => worst(neStatus(y), dfyStatus(y), fixStatus(y), y === LAST ? heGroupStatus() : 'ok')

export interface YearRow {
  year: Year
  L: number
  ne: number
  ci: [number, number]
  dFgen: number
  dFyr: number
  fbar: number
  he: number
  fixed: number
  rare: number
  status: Status
  /** 주의·경보 항목 이름 */
  flags: { label: string; status: Status }[]
}

export const YEAR_ROWS: YearRow[] = YEARS.map(y => {
  const flags: { label: string; status: Status }[] = []
  if (dfyStatus(y) !== 'ok') flags.push({ label: 'ΔF연', status: dfyStatus(y) })
  if (neStatus(y) !== 'ok') flags.push({ label: 'Ne', status: neStatus(y) })
  if (fixStatus(y) !== 'ok') flags.push({ label: '고정', status: fixStatus(y) })
  if (y === LAST && heGroupStatus() !== 'ok') flags.push({ label: '그룹 He', status: heGroupStatus() })
  return {
    year: y,
    L: L[y],
    ne: NE[y],
    ci: neCi(y),
    dFgen: dFgen(y),
    dFyr: dFyr(y),
    fbar: FBAR[y],
    he: he(y),
    fixed: MARKERS[y].fixed,
    rare: MARKERS[y].rare,
    status: yearStatus(y),
    flags,
  }
})

// ---------------- 기간 비교 ----------------

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const TRAD_YEARS = YEARS.filter(y => y < GS_START)
const GS_YEARS = YEARS.filter(y => y >= GS_START)
export const PERIOD = {
  dFyrTrad: mean(TRAD_YEARS.map(dFyr)),
  dFyrGs: mean(GS_YEARS.map(dFyr)),
  dFgenTrad: mean(TRAD_YEARS.map(dFgen)),
  dFgenGs: mean(GS_YEARS.map(dFgen)),
}
/** 2019 → 2026 분해: 연간 배율 ≈ 세대당 배율 × 세대 간격 단축 배율 */
export const RATIO = {
  yr: dFyr(2026) / dFyr(2019),
  gen: dFgen(2026) / dFgen(2019),
  L: L[2019] / L[2026],
}
/** 2021 → 2026 고정 마커 증가(GS 이후) */
export const FIXED_SINCE_GS = MARKERS[2026].fixed - MARKERS[2021].fixed

// ---------------- 관리 조치 시나리오 ----------------

export const yrOf = (g: number) => 1 - Math.pow(1 - g, 1 / L_SC)
export const DF0 = dFgen(2026) // 0.009615
export const ocsGain = (g: number) => OCS_K * DG0 * Math.pow(g / DF0, OCS_B)
export const I_EXPAND = selectionIntensity(0.15) // 1.55439
/** 연간 상한 0.42%/년의 L 2.2년 세대당 환산 = 0.922% */
export const DFGEN_YR_LIMIT = 1 - Math.pow(1 - TH.dFyrMax, L_SC)
/** 연간 주의 0.38%/년의 L 2.2년 세대당 환산 = 0.834% (경계 차트 충족/주의 경계) */
export const DFGEN_YR_CAUTION = 1 - Math.pow(1 - TH.dFyrCaution, L_SC)
export const OCS_RANGE = { min: 0.4, max: 1.0, step: 0.05, def: 0.75 }

export type LimitBadge = '충족' | '주의' | '초과'
export const limitBadge = (dfYr: number): LimitBadge => (dfYr > TH.dFyrMax ? '초과' : dfYr > TH.dFyrCaution ? '주의' : '충족')

export interface Scenario {
  key: 'trunc' | 'expand' | 'ocs'
  label: string
  detail: string
  dF: number
  ne: number
  dFyr: number
  dG: number
  dGpct: number
  dGchange: number | null
  he2036: number
  heLoss: number
  badge: LimitBadge
}

function makeScenario(key: Scenario['key'], label: string, detail: string, dF: number, dG: number): Scenario {
  const y = yrOf(dF)
  const h0 = he(2026)
  const h10 = h0 * Math.pow(1 - y, 10)
  return {
    key,
    label,
    detail,
    dF,
    ne: 1 / (2 * dF),
    dFyr: y,
    dG,
    dGpct: (dG / MU) * 100,
    dGchange: key === 'trunc' ? null : dG / DG0 - 1,
    he2036: h10,
    heLoss: 1 - h10 / h0,
    badge: limitBadge(y),
  }
}

export function scenarios(ocsPct: number): Scenario[] {
  const g = ocsPct / 100
  return [
    makeScenario('trunc', '현행 절단 선발', `상위 10%, i ${I_TRUNC.toFixed(3)}`, DF0, DG0),
    makeScenario('expand', '부모 수 확대', `상위 15%, i ${I_EXPAND.toFixed(3)}`, 1 / (2 * 52 * 1.5), (I_EXPAND * R_ACC * SIGMA_A) / L_SC),
    makeScenario('ocs', '최적 기여 선발(OCS)', `목표 ${ocsPct.toFixed(2)}%/세대`, g, ocsGain(g)),
  ]
}

/** OCS 이득-다양성 경계 곡선(0.40~1.00%) */
export const OCS_FRONTIER: [number, number][] = Array.from({ length: 61 }, (_, i) => {
  const pct = 0.4 + i * 0.01
  return [pct, ocsGain(pct / 100)]
})

// ---------------- DEV 검산(명세 수용 기준) ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) < tol
  const arr = <T,>(f: (y: Year) => T) => YEARS.map(f)
  const eqArr = (a: number[], b: number[], tol: number) => a.length === b.length && a.every((v, i) => near(v, b[i]!, tol))
  for (let i = 1; i < YEARS.length; i++) {
    const y = YEARS[i]!
    const p = YEARS[i - 1]!
    const inv = (FBAR[y] - FBAR[p]) / (1 - FBAR[p])
    console.assert(near(inv, dFyr(y), 1e-12), `[검산] ${y} f̄ 역산 ${inv} ≠ ΔF연 ${dFyr(y)}`)
    console.assert(near(he(y), H_REF * (1 - FBAR[y]), 1e-12), `[검산] ${y} He ≠ 0.40 × (1 − f̄)`)
  }
  console.assert(eqArr(arr(dFgen).map(v => v * 100), [0.521, 0.543, 0.568, 0.781, 0.833, 0.877, 0.926, 0.962], 6e-4), `[검산] ΔF세대 ${arr(dFgen)}`)
  console.assert(eqArr(arr(dFyr).map(v => v * 100), [0.116, 0.121, 0.1294, 0.2448, 0.2984, 0.3518, 0.4036, 0.4382], 1e-4), `[검산] ΔF연 ${arr(dFyr)}`)
  console.assert(eqArr(arr(y => FBAR[y]), [0.0655, 0.0666, 0.0678, 0.0701, 0.0729, 0.0761, 0.0799, 0.0839], 6e-5), `[검산] f̄ ${arr(y => FBAR[y])}`)
  console.assert(eqArr(arr(he), [0.3738, 0.3734, 0.3729, 0.372, 0.3708, 0.3695, 0.3681, 0.3664], 6e-5), `[검산] He ${arr(he)}`)
  console.assert(
    eqArr(arr(y => MARKERS[y].fixed), [122, 122, 123, 127, 130, 140, 152, 161], 0.5) && eqArr(arr(y => MARKERS[y].rare), [200, 208, 215, 207, 221, 227, 239, 228], 0.5),
    `[검산] 마커 고정 ${arr(y => MARKERS[y].fixed)} / 희소 ${arr(y => MARKERS[y].rare)} (기대 122…161 / 200…228)`,
  )
  console.assert(
    JSON.stringify(arr(y => neCi(y)[0])) === '[82,78,75,54,51,48,46,44]' && JSON.stringify(arr(y => neCi(y)[1])) === '[113,109,104,76,71,67,64,61]',
    `[검산] Ne 95% 구간 ${JSON.stringify(YEARS.map(neCi))}`,
  )
  console.assert(near(RATIO.yr, 3.778, 1e-3) && near(RATIO.gen, 1.846, 1e-3) && near(RATIO.L, 2.045, 1e-3), `[검산] 분해 배율 ${JSON.stringify(RATIO)} (기대 3.778 / 1.846 / 2.045)`)
  console.assert(
    JSON.stringify(arr(yearStatus)) === '["ok","ok","ok","ok","ok","warning","warning","critical"]',
    `[검산] 연도 상태 ${JSON.stringify(arr(yearStatus))}`,
  )
  console.assert(near(DG0, 12.8227, 1e-4) && near(I_EXPAND, 1.55439, 1e-4), `[검산] ΔG0 ${DG0} / i(0.15) ${I_EXPAND} (기대 12.8227 / 1.55439)`)
  console.assert(near(DFGEN_YR_LIMIT * 100, 0.922, 1e-3), `[검산] 연간 상한 세대당 환산 ${DFGEN_YR_LIMIT * 100} (기대 0.922)`)
  console.assert(near(DFGEN_YR_CAUTION * 100, 0.834, 1e-3), `[검산] 연간 주의 세대당 환산 ${DFGEN_YR_CAUTION * 100} (기대 0.834)`)
  const sc = scenarios(0.75)
  const [t, e, o] = sc as [Scenario, Scenario, Scenario]
  console.assert(near(t.he2036, 0.3507, 1e-4) && t.badge === '초과', `[검산] 현행 He2036 ${t.he2036} ${t.badge} (기대 0.3507 초과)`)
  console.assert(near(e.dF * 100, 0.641, 1e-3) && near(e.dG, 11.357, 1e-3) && near(e.he2036, 0.3559, 1e-4) && e.badge === '충족', `[검산] 부모 확대 ${JSON.stringify(e)}`)
  console.assert(near(o.dG, 12.689, 1e-3) && near(o.dFyr * 100, 0.3416, 1e-4) && near(o.he2036, 0.3541, 1e-4) && o.badge === '충족', `[검산] OCS 0.75 ${JSON.stringify(o)}`)
  console.assert(limitBadge(scenarios(0.95)[2]!.dFyr) === '초과' && limitBadge(scenarios(0.9)[2]!.dFyr) === '주의', `[검산] 슬라이더 0.90 주의 / 0.95 초과`)
  console.assert(near(ocsGain(e.dF), 12.297, 1e-3), `[검산] 같은 ΔF 0.641%에서 OCS ΔG ${ocsGain(e.dF)} (기대 12.297)`)
  console.assert(eqArr(GROUPS.map(g => heGroup(g.f)), [0.3404, 0.33739, 0.37849], 6e-5), `[검산] 그룹 He ${GROUPS.map(g => heGroup(g.f))} (기대 0.34040 / 0.33739 / 0.37849)`)
}
