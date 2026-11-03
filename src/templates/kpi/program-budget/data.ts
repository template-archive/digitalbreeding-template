// 육종 프로그램 예산·효율 — 목업 데이터
// 명세: docs/specs/program-budget.md
// 시드 20261023은 기록용이다. 난수를 쓰지 않고 아래 확정 상수에서 모든 값을 계산한다.
// 실제 데이터로 바꿀 때는 「확정 상수」 블록(예산·월별 실적·플레이트 수)만 교체하면 된다.

// ───────────────────────── 확정 상수 ─────────────────────────
export const AS_OF = '2026-10-23'
export const SEED = 20261023 // 난수 미사용(기록용)
export const FY = 2026
export const NEXT_FY = 2027
export const OCT_DAY = 23
export const OCT_FRAC = OCT_DAY / 31

// 출처: program-overview (baseline)
export const MU = 560
export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const I: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
export const R: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
export const SIGMA_A: Record<Year, number> = { 2019: 30.0, 2020: 29.7, 2021: 29.6, 2022: 29.3, 2023: 29.0, 2024: 28.8, 2025: 28.5, 2026: 28.2 }
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
/** ①후보 ②GS1차 ③PYT ④AYT ⑤MET 완료 세트 ⑥출원 후보 (program-overview) */
export const PIPELINE: Record<Year, readonly number[]> = {
  2019: [1500, 300, 90, 30, 15, 2],
  2020: [1500, 320, 90, 30, 16, 2],
  2021: [1600, 330, 95, 32, 17, 1],
  2022: [1800, 480, 100, 34, 18, 2],
  2023: [1900, 540, 110, 36, 20, 3],
  2024: [2000, 580, 115, 38, 22, 2],
  2025: [2000, 600, 120, 40, 21, 3],
  2026: [2000, 600, 120, 40, 18, 3],
}
export const PIPELINE_2027_PLAN = [2000, 600, 120, 40, 20] as const // 추정(MET 20 = 2026 1년차 세트)
export const MET_Y1 = { 2026: 20, 2027: 18 } as const // 1년차 세트(baseline, advancement-decision 목표)
export const GS_START = 2022
/** 2027 계획 ΔG: 2026 목표 구성(r 0.58, L 2.1, σA 28.2 유지) */
export const PLAN_2027 = { i: 1.755, r: 0.58, sigmaA: 28.2, L: 2.1 } as const
// 출처: genetic-gain-tracker (baseline, 원 실행값)
export const REALIZED = { conventional: 3.439753, gs: 9.097399 } as const
export const REALIZED_PERIOD = { conventional: '2019~2021', gs: '2021~2026' } as const
// 출처: conventional-vs-digital COST (baseline)
export const USD_KRW = 1390
export const FX_SCENARIO = 1450
export const PLOT_COST = 8
export const CHECKS = 2
export const REPS = { pyt: 2, ayt: 3, met: 3 } as const
export const MET_SITES = 8

/** 계통당 선발 평가비 구성(만 원/계통). 2019·2026 = baseline, 나머지 추정 */
export type PerLineKey = 'advance' | 'phenoEval' | 'speedAdvance' | 'genotyping' | 'prediction'
export const PER_LINE: Record<Year | 2027, Partial<Record<PerLineKey, number>>> = {
  2019: { advance: 2.0, phenoEval: 3.0 },
  2020: { advance: 2.0, phenoEval: 3.0 },
  2021: { advance: 2.0, phenoEval: 3.0 },
  2022: { speedAdvance: 2.5, genotyping: 3.2, prediction: 1.4 },
  2023: { speedAdvance: 2.5, genotyping: 2.9, prediction: 1.2 },
  2024: { speedAdvance: 2.5, genotyping: 2.7, prediction: 1.1 },
  2025: { speedAdvance: 2.5, genotyping: 2.6, prediction: 1.0 },
  2026: { speedAdvance: 2.5, genotyping: 2.5, prediction: 1.0 },
  2027: { speedAdvance: 2.5, genotyping: 2.4, prediction: 1.0 },
}
export const PER_LINE_KEYS: { key: PerLineKey; label: string; era: 'conv' | 'gs' }[] = [
  { key: 'advance', label: '세대 진전', era: 'conv' },
  { key: 'phenoEval', label: '관찰 포장 평가', era: 'conv' },
  { key: 'speedAdvance', label: '속성세대진전', era: 'gs' },
  { key: 'genotyping', label: '유전형 분석', era: 'gs' },
  { key: 'prediction', label: '예측', era: 'gs' },
]

// 유전형 분석 플랫폼 (genotyping-lab-ops·baseline 샘플 수)
export const PLATE = 94
export type PlatformKey = '6K' | 'KASP' | 'GBS'
export const UNIT: Record<PlatformKey, number> = { '6K': 2.5, KASP: 0.45, GBS: 5.0 } // 만 원/샘플, DNA 추출 포함
export const MARKERS: Record<PlatformKey, number> = { '6K': 4820, KASP: 16, GBS: 50000 } // 6K = QC 후 사용 마커
export const SIXK_DESIGN_MARKERS = 6000
export const SIXK_PLAN_SAMPLES = [0, 0, 0, 400, 800, 600, 200, 0, 0, 0, 0, 0]
export const SIXK_ACT_SAMPLES = [0, 0, 0, 376, 752, 658, 214, 0, 0, 0] // 합 2,000
export const KASP_PLAN_PLATES = [9, 9, 10, 10, 9, 8, 8, 8, 8, 8, 7, 6] // 합 100
export const KASP_ACT_PLATES = [10, 9, 12, 11, 9, 8, 7, 8, 9, 6] // 합 89
export const KASP_FORECAST_REMAIN = { inProgress: 4, nov: 7, dec: 5 } as const
export const KASP_IN_PROGRESS_IDS = 'KSP-2610-07~10'
export const GBS_PLAN_MONTHS = [3, 5, 7, 9, 11, 12]
export const GBS_ACT_MONTHS = [3, 5, 7, 9]
export const GBS_NEXT = { id: 'GBS-2611-01', date: '11/06' } as const

// 월별 계획 가중(합 1)
export const W = {
  rga: [0.1, 0.1, 0.09, 0.08, 0.07, 0.07, 0.08, 0.08, 0.07, 0.08, 0.09, 0.09],
  pred: [0.06, 0.2, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.08, 0.08, 0.09],
  field: [0.01, 0.01, 0.03, 0.12, 0.16, 0.12, 0.1, 0.1, 0.12, 0.13, 0.06, 0.04],
  cross: [0, 0, 0, 0, 0.05, 0.2, 0.35, 0.3, 0.1, 0, 0, 0],
  flat: Array<number>(12).fill(1 / 12),
} as const
export type WeightKey = keyof typeof W
export const PERSONNEL = 46800 // 연구 인력 5명 33,000 + 현장 인력 4명 13,800 (추정)
export const PERSONNEL_DETAIL = { research: { n: 5, cost: 33000 }, field: { n: 4, cost: 13800 } } as const
export const DEPRECIATION = 7200 // 온실 2동·저온 저장고 2동·분석 장비 (추정)
/** 감가상각 집계 방식 — 현금 지출이 아닌 월할 배부액 */
export const NONCASH_NOTE = '월할 배부(비현금)'
/** 분석실 연간 처리 목표(샘플) — genotyping-lab-ops ANNUAL_TARGET과 같음. 예산 계획 샘플과 별개 */
export const LAB_ANNUAL_TARGET = 12000
export const INDIRECT_RATE = 0.1 // (직접비(소모성 경비) + 인건비) 기준, 추정
export const SEED_OPS_ACT_FACTOR = 0.8 // 실적 = 계획의 80%(국외 출장 취소·회의 온라인 전환)
export const CROSS_BUDGET = 600
export const SEED_OPS_BUDGET = 900
export const BUDGET_2027 = { personnelRaise: 1.03, chipUnit: 2.4, kaspPlates: 110, gbsPlates: 6, cross: 650, seedOps: 900, depreciation: 7200 } as const
/** 비목 경보 규칙: 전망 > 예산 100% → 경보, 전망 < 90% → 주의(불용) */
export const ALERT_OVER = 100
export const ALERT_UNDER = 90

// ───────────────────────── 공통 계산 ─────────────────────────
const sum = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0)
const r2 = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
/** 부동소수 잡음 제거(만 원 금액, 소수 6자리) — 표시 반올림이 아니다 */
const q = (v: number) => Math.round(v * 1e6) / 1e6

export const perLineTotal = (y: Year | 2027) => q(sum(Object.values(PER_LINE[y]) as number[]))

export interface Plots {
  pyt: number
  ayt: number
  met: number
  total: number
}
/** 단계별 1세트 × 1년 시험구 수 = (PYT+2)·2 + (AYT+2)·3 + (MET완료+2)·3·8 */
export function setPlots(pyt: number, ayt: number, met: number): Plots {
  const p = (pyt + CHECKS) * REPS.pyt
  const a = (ayt + CHECKS) * REPS.ayt
  const m = (met + CHECKS) * REPS.met * MET_SITES
  return { pyt: p, ayt: a, met: m, total: p + a + m }
}
/** MET 1년차 세트 시험구(세트마다 대비 2개) */
export const metY1Plots = (sets: number) => (sets + CHECKS) * REPS.met * MET_SITES

export const dGOf = (y: Year) => (I[y] * R[y] * SIGMA_A[y]) / L[y]
export const DG_2027 = (PLAN_2027.i * PLAN_2027.r * PLAN_2027.sigmaA) / PLAN_2027.L

// ───────────────────────── 연도별 추이 ─────────────────────────
export interface TrendRow {
  year: number
  label: string // '2019' … '2027안'
  plan: boolean
  perLine: number
  comps: Partial<Record<PerLineKey, number>>
  candidates: number
  plots: Plots
  lineCost: number
  plotCost: number
  annual: number // 비교 기준 직접비(만 원)
  dG: number // kg/10a/년
  cpg: number // 개량 1 kg/10a당 연간 직접비(만 원)
}

function trendRow(y: Year | 2027): TrendRow {
  const plan = y === 2027
  const pipe = plan ? PIPELINE_2027_PLAN : PIPELINE[y as Year]
  const plots = setPlots(pipe[2]!, pipe[3]!, pipe[4]!)
  const perLine = perLineTotal(y)
  const candidates = pipe[0]!
  const lineCost = q(candidates * perLine)
  const plotCost = plots.total * PLOT_COST
  const annual = q(lineCost + plotCost)
  const dG = plan ? DG_2027 : dGOf(y as Year)
  return { year: y, label: plan ? `${y}안` : String(y), plan, perLine, comps: PER_LINE[y], candidates, plots, lineCost, plotCost, annual, dG, cpg: annual / dG }
}

export const TREND: TrendRow[] = [...YEARS, 2027 as const].map(trendRow)
export const T2019 = TREND[0]!
export const T2026 = TREND.find(t => t.year === FY)!
export const T2027 = TREND.find(t => t.year === NEXT_FY)!
export const T_PEAK = TREND.filter(t => !t.plan).reduce((a, b) => (b.perLine > a.perLine ? b : a))

export const CPG_REALIZED = {
  2019: T2019.annual / REALIZED.conventional,
  2026: T2026.annual / REALIZED.gs,
} as const
export const CPG_PRED_CHANGE = (T2026.cpg / T2019.cpg - 1) * 100 // −52.6
export const CPG_REAL_CHANGE = (CPG_REALIZED[2026] / CPG_REALIZED[2019] - 1) * 100 // −45.3
export const ANNUAL_RATIO = T2026.annual / T2019.annual // 1.45
export const DG_RATIO_PRED = T2026.dG / T2019.dG // 3.1
export const DG_RATIO_REAL = REALIZED.gs / REALIZED.conventional // 2.6
export const CPG_2027_CHANGE = (T2027.cpg / T2026.cpg - 1) * 100

// ───────────────────────── 2026 비목 ─────────────────────────
export type GroupKey = 'A' | 'B' | 'C' | 'D'
export const GROUPS: { key: GroupKey; label: string; note?: string }[] = [
  { key: 'A', label: '직접비 · 비교 기준 항목', note: '단계별 1세트 × 1년, 「전통 육종 vs 디지털육종」 화면과 같은 정의' },
  { key: 'B', label: '직접비 · 비교 기준 외' },
  { key: 'C', label: '직접비 정의 밖(별도 집계)', note: '인건비·시설 감가상각' },
  { key: 'D', label: '간접비' },
]
export const GROUP_BY_KEY = Object.fromEntries(GROUPS.map(g => [g.key, g])) as Record<GroupKey, (typeof GROUPS)[number]>

export type ItemId = 'rga' | 'chip' | 'pred' | 'fieldSet' | 'fieldY1' | 'kasp' | 'gbs' | 'cross' | 'seedOps' | 'personnel' | 'deprec' | 'indirect'
export type Status = 'critical' | 'warning' | 'ok'

export interface BudgetItem {
  id: ItemId
  group: GroupKey
  name: string
  basis: string // 예산 산식(화면 보조 문구)
  budget: number
  monthlyPlan: number[] // 12개월
  monthlyAct: number[] // 1~10월(10월은 23일까지)
  planToDate: number
  actToDate: number
  forecast: number
  execPct: number
  fcPct: number
  vsPlan: number
  status: Status
  done: boolean // 연간 집행 완료
  costNote?: string // 비현금 배부 등 집계 방식 보조 문구
}

export const statusOf = (fcPct: number): Status => (fcPct > ALERT_OVER ? 'critical' : fcPct < ALERT_UNDER ? 'warning' : 'ok')

const n0 = (v: number) => v.toLocaleString('ko-KR')
const P26 = PIPELINE[2026]
const CAND26 = P26[0]!
const fieldY1Plots26 = metY1Plots(MET_Y1[2026])

interface ItemSpec {
  id: ItemId
  group: GroupKey
  name: string
  basis: string
  budget: number
  w?: WeightKey
  plan?: number[]
  act?: number[]
  forecast?: number
  actFactor?: number
  costNote?: string
}

const kaspForecastPlates = sum(KASP_ACT_PLATES) + KASP_FORECAST_REMAIN.inProgress + KASP_FORECAST_REMAIN.nov + KASP_FORECAST_REMAIN.dec
const gbsPlate = (months: number[], len: number) => Array.from({ length: len }, (_, i) => (months.includes(i + 1) ? PLATE * UNIT.GBS : 0))

const ITEM_SPECS: ItemSpec[] = [
  { id: 'rga', group: 'A', name: '온실 세대 진전(속성세대진전)', basis: `${n0(CAND26)}계통 × ${PER_LINE[2026].speedAdvance!.toFixed(1)}`, budget: CAND26 * PER_LINE[2026].speedAdvance!, w: 'rga' },
  {
    id: 'chip',
    group: 'A',
    name: '유전형 분석 — 6K SNP 칩',
    basis: `${n0(CAND26)} × ${UNIT['6K'].toFixed(1)}`,
    budget: CAND26 * UNIT['6K'],
    plan: SIXK_PLAN_SAMPLES.map(v => v * UNIT['6K']),
    act: SIXK_ACT_SAMPLES.map(v => v * UNIT['6K']),
    forecast: sum(SIXK_ACT_SAMPLES) * UNIT['6K'],
  },
  { id: 'pred', group: 'A', name: '예측·데이터 관리', basis: `${n0(CAND26)} × ${PER_LINE[2026].prediction!.toFixed(1)}`, budget: CAND26 * PER_LINE[2026].prediction!, w: 'pred' },
  {
    id: 'fieldSet',
    group: 'A',
    name: '시험 포장 — 단계별 완료 세트',
    basis: `${n0(T2026.plots.total)}구 × ${PLOT_COST} (PYT ${T2026.plots.pyt} · AYT ${T2026.plots.ayt} · MET ${T2026.plots.met}구)`,
    budget: T2026.plots.total * PLOT_COST,
    w: 'field',
  },
  {
    id: 'fieldY1',
    group: 'B',
    name: '시험 포장 — MET 1년차 세트',
    basis: `(${MET_Y1[2026]} + ${CHECKS}) × ${REPS.met} × ${MET_SITES} = ${fieldY1Plots26}구 × ${PLOT_COST}`,
    budget: fieldY1Plots26 * PLOT_COST,
    w: 'field',
  },
  {
    id: 'kasp',
    group: 'B',
    name: '유전형 분석 — KASP 패널(MAS)',
    basis: `${sum(KASP_PLAN_PLATES)}장 × ${PLATE} × ${UNIT.KASP}`,
    budget: sum(KASP_PLAN_PLATES) * PLATE * UNIT.KASP,
    plan: KASP_PLAN_PLATES.map(p => p * PLATE * UNIT.KASP),
    act: KASP_ACT_PLATES.map(p => p * PLATE * UNIT.KASP),
    forecast: kaspForecastPlates * PLATE * UNIT.KASP,
  },
  {
    id: 'gbs',
    group: 'B',
    name: '유전형 분석 — GBS',
    basis: `${GBS_PLAN_MONTHS.length}장 × ${PLATE} × ${UNIT.GBS.toFixed(1)}`,
    budget: GBS_PLAN_MONTHS.length * PLATE * UNIT.GBS,
    plan: gbsPlate(GBS_PLAN_MONTHS, 12),
    act: gbsPlate(GBS_ACT_MONTHS, 10),
    forecast: GBS_PLAN_MONTHS.length * PLATE * UNIT.GBS,
  },
  { id: 'cross', group: 'B', name: '교배·F1 작업비', basis: '추정', budget: CROSS_BUDGET, w: 'cross' },
  { id: 'seedOps', group: 'B', name: '종자 관리·연구 활동비', basis: '추정', budget: SEED_OPS_BUDGET, w: 'flat', actFactor: SEED_OPS_ACT_FACTOR },
  { id: 'personnel', group: 'C', name: '인건비', basis: `연구 인력 ${PERSONNEL_DETAIL.research.n}명 + 현장 인력 ${PERSONNEL_DETAIL.field.n}명(추정)`, budget: PERSONNEL, w: 'flat' },
  { id: 'deprec', group: 'C', name: '시설·장비 감가상각', basis: '온실·저온 저장고·분석 장비(추정)', budget: DEPRECIATION, w: 'flat', costNote: NONCASH_NOTE },
]

/** 직접비(소모성 경비) = A + B */
export const DIRECT_BUDGET = q(sum(ITEM_SPECS.filter(s => s.group === 'A' || s.group === 'B').map(s => q(s.budget))))
export const INDIRECT_BUDGET = Math.round(INDIRECT_RATE * (DIRECT_BUDGET + PERSONNEL)) // 반올림 한 번
ITEM_SPECS.forEach(s => (s.budget = q(s.budget)))
ITEM_SPECS.push({
  id: 'indirect',
  group: 'D',
  name: '간접비(기관 공통 경비)',
  basis: `(직접비(소모성 경비) + 인건비) × ${Math.round(INDIRECT_RATE * 100)}%`,
  budget: INDIRECT_BUDGET,
  w: 'flat',
})

function buildItem(s: ItemSpec): BudgetItem {
  const monthlyPlan = s.plan ?? W[s.w!].map(x => x * s.budget)
  const f = s.actFactor ?? 1
  const monthlyAct = s.act ?? monthlyPlan.slice(0, 10).map((v, i) => (i === 9 ? v * OCT_FRAC * f : v * f))
  const planToDate = sum(monthlyPlan.slice(0, 9)) + monthlyPlan[9]! * OCT_FRAC
  const actToDate = sum(monthlyAct)
  const forecast = s.forecast ?? actToDate + (s.budget - planToDate)
  const execPct = (actToDate / s.budget) * 100
  const fcPct = (forecast / s.budget) * 100
  return {
    id: s.id,
    group: s.group,
    name: s.name,
    basis: s.basis,
    budget: s.budget,
    monthlyPlan,
    monthlyAct,
    planToDate,
    actToDate,
    forecast,
    execPct,
    fcPct,
    vsPlan: (actToDate / planToDate) * 100,
    status: statusOf(fcPct),
    done: Math.abs(actToDate - s.budget) < 1e-6,
    costNote: s.costNote,
  }
}

export const ITEMS: BudgetItem[] = ITEM_SPECS.map(buildItem)
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i])) as Record<ItemId, BudgetItem>

const totalOf = (items: BudgetItem[], k: 'budget' | 'planToDate' | 'actToDate' | 'forecast') => sum(items.map(i => i[k]))

export interface Summary {
  budget: number
  planToDate: number
  actToDate: number
  forecast: number
  execPct: number
  planPct: number
  vsPlan: number
  fcPct: number
  remain: number
  over: number // 연말 전망 − 예산
  status: Status
}
function summarize(items: BudgetItem[]): Summary {
  const budget = totalOf(items, 'budget')
  const planToDate = totalOf(items, 'planToDate')
  const actToDate = totalOf(items, 'actToDate')
  const forecast = totalOf(items, 'forecast')
  const fcPct = (forecast / budget) * 100
  return {
    budget,
    planToDate,
    actToDate,
    forecast,
    execPct: (actToDate / budget) * 100,
    planPct: (planToDate / budget) * 100,
    vsPlan: (actToDate / planToDate) * 100,
    fcPct,
    remain: budget - actToDate,
    over: forecast - budget,
    status: statusOf(fcPct),
  }
}

export const TOTAL = summarize(ITEMS)
export const GROUP_SUM = Object.fromEntries(GROUPS.map(g => [g.key, summarize(ITEMS.filter(i => i.group === g.key))])) as Record<GroupKey, Summary>
export const GROUP_SHARE = Object.fromEntries(GROUPS.map(g => [g.key, (GROUP_SUM[g.key].budget / TOTAL.budget) * 100])) as Record<GroupKey, number>
export const DIRECT = summarize(ITEMS.filter(i => i.group === 'A' || i.group === 'B'))
export const DIRECT_SHARE = (DIRECT.budget / TOTAL.budget) * 100
export const FIELD_TOTAL = { budget: ITEM_BY_ID.fieldSet.budget + ITEM_BY_ID.fieldY1.budget, plots: T2026.plots.total + fieldY1Plots26 }

export const ALERT_ITEMS = ITEMS.filter(i => i.status !== 'ok')

// ───────────────────────── 월별 누계 ─────────────────────────
export interface MonthPoint {
  x: number // 월말 = m, 기준일 = 9 + 23/31
  label: string
  plan: number
  act: number | null
}
const cumPlan: number[] = []
const cumAct: number[] = []
{
  let cp = 0
  let ca = 0
  for (let m = 0; m < 12; m++) {
    cp += sum(ITEMS.map(i => i.monthlyPlan[m]!))
    cumPlan.push(cp)
    if (m < 9) {
      ca += sum(ITEMS.map(i => i.monthlyAct[m]!))
      cumAct.push(ca)
    }
  }
}
export const AS_OF_X = 9 + OCT_FRAC
export const AS_OF_LABEL = `10/${OCT_DAY}`
export const MONTHLY: MonthPoint[] = [
  ...cumPlan.slice(0, 9).map((p, i) => ({ x: i + 1, label: `${i + 1}월말`, plan: p, act: cumAct[i]! })),
  { x: AS_OF_X, label: `${AS_OF_LABEL}(기준일)`, plan: TOTAL.planToDate, act: TOTAL.actToDate },
  ...cumPlan.slice(9).map((p, i) => ({ x: i + 10, label: `${i + 10}월말`, plan: p, act: null })),
]
export const SEP_ACT = MONTHLY[8]!
/** 결론 패널 추세: 월말 누계(예산 대비 %). 1~9월은 실적, 10~12월은 기준일 실적과 연말 전망을 잇는 직선 위 값(월별 차트의 전망 파선과 같은 선). 간격을 고르게 그리려고 월말로 맞춘다 */
export const CUM_PCT_TREND = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1
  const v = m <= 9 ? cumAct[i]! : TOTAL.actToDate + ((TOTAL.forecast - TOTAL.actToDate) * (m - AS_OF_X)) / (12 - AS_OF_X)
  return { month: m, pct: (v / TOTAL.budget) * 100 }
})

// ───────────────────────── 플랫폼 표 ─────────────────────────
export interface PlatformRow {
  key: PlatformKey
  itemId: ItemId
  name: string
  use: string
  markers: number
  markersLabel: string
  unit: number // 만 원/샘플
  usd: number
  wonPerMarker: number
  samplesAct: number
  samplesPlan: number
  samplesForecast: number
  costAct: number
  costBudget: number
  costForecast: number
  inBaseline: boolean
  status: Status
  done: boolean
}
const kaspSamplesFc = kaspForecastPlates * PLATE
export const PLATFORMS: PlatformRow[] = (
  [
    { key: '6K', itemId: 'chip', name: '6K SNP 칩', use: 'GS 후보 F6 계통', markersLabel: `${n0(SIXK_DESIGN_MARKERS)}(사용 ${n0(MARKERS['6K'])})`, samplesAct: sum(SIXK_ACT_SAMPLES), samplesPlan: sum(SIXK_PLAN_SAMPLES), samplesForecast: sum(SIXK_ACT_SAMPLES), inBaseline: true },
    { key: 'KASP', itemId: 'kasp', name: 'KASP 패널', use: 'MAS F2 개체', markersLabel: n0(MARKERS.KASP), samplesAct: sum(KASP_ACT_PLATES) * PLATE, samplesPlan: sum(KASP_PLAN_PLATES) * PLATE, samplesForecast: kaspSamplesFc, inBaseline: false },
    { key: 'GBS', itemId: 'gbs', name: 'GBS', use: '부모·훈련 집단 보강', markersLabel: `약 ${n0(MARKERS.GBS)}`, samplesAct: GBS_ACT_MONTHS.length * PLATE, samplesPlan: GBS_PLAN_MONTHS.length * PLATE, samplesForecast: GBS_PLAN_MONTHS.length * PLATE, inBaseline: false },
  ] as const
).map(p => {
  const it = ITEM_BY_ID[p.itemId]
  return {
    ...p,
    markers: MARKERS[p.key],
    unit: UNIT[p.key],
    usd: (UNIT[p.key] * 1e4) / USD_KRW,
    wonPerMarker: (UNIT[p.key] * 1e4) / MARKERS[p.key],
    costAct: it.actToDate,
    costBudget: it.budget,
    costForecast: it.forecast,
    status: it.status,
    done: it.done,
  }
})
export const PLATFORM_SAMPLES_TOTAL = sum(PLATFORMS.map(p => p.samplesAct))
/** 2026 예산 계획 샘플 합 · 전망 합(분석실 처리 목표와 별개) */
export const PLATFORM_SAMPLES_PLAN = sum(PLATFORMS.map(p => p.samplesPlan))
export const PLATFORM_SAMPLES_FORECAST = sum(PLATFORMS.map(p => p.samplesForecast))
/** 6K 칩 샘플당 비용 추이(2022~2027안) — 계통당 유전형 분석 단가와 같음 */
export const CHIP_UNIT_TREND = TREND.filter(t => t.year >= GS_START).map(t => ({ label: t.label, plan: t.plan, unit: t.comps.genotyping! }))

// ───────────────────────── 경보 값 ─────────────────────────
const KASP = ITEM_BY_ID.kasp
const SEED_OPS = ITEM_BY_ID.seedOps
export const KASP_ALERT = {
  fcPct: KASP.fcPct,
  over: KASP.forecast - KASP.budget, // 211.5
  inProgress: KASP_FORECAST_REMAIN.inProgress,
  later: KASP_FORECAST_REMAIN.nov + KASP_FORECAST_REMAIN.dec,
  fcPlates: kaspForecastPlates,
  fcSamples: kaspSamplesFc,
  planPlates: sum(KASP_PLAN_PLATES),
  planSamples: sum(KASP_PLAN_PLATES) * PLATE,
  planToDatePlates: sum(KASP_PLAN_PLATES.slice(0, 9)) + KASP_PLAN_PLATES[9]! * OCT_FRAC,
}
export const SEED_OPS_ALERT = {
  fcPct: SEED_OPS.fcPct,
  unused: SEED_OPS.budget - SEED_OPS.forecast, // 146
  remain: SEED_OPS.budget - SEED_OPS.actToDate, // 315
  actVsPlan: SEED_OPS.vsPlan, // 80.0
}

// ───────────────────────── 2027 예산안 ─────────────────────────
const P27 = PIPELINE_2027_PLAN
const fieldY1Plots27 = metY1Plots(MET_Y1[2027])
const b27Base: Record<Exclude<ItemId, 'indirect'>, number> = {
  rga: P27[0] * PER_LINE[2027].speedAdvance!,
  chip: P27[0] * BUDGET_2027.chipUnit,
  pred: P27[0] * PER_LINE[2027].prediction!,
  fieldSet: T2027.plots.total * PLOT_COST,
  fieldY1: fieldY1Plots27 * PLOT_COST,
  kasp: BUDGET_2027.kaspPlates * PLATE * UNIT.KASP,
  gbs: BUDGET_2027.gbsPlates * PLATE * UNIT.GBS,
  cross: BUDGET_2027.cross,
  seedOps: BUDGET_2027.seedOps,
  personnel: Math.round(PERSONNEL * BUDGET_2027.personnelRaise),
  deprec: BUDGET_2027.depreciation,
}
for (const k of Object.keys(b27Base) as (keyof typeof b27Base)[]) b27Base[k] = q(b27Base[k])
export const DIRECT_2027 = q(sum(ITEMS.filter(i => i.group === 'A' || i.group === 'B').map(i => b27Base[i.id as Exclude<ItemId, 'indirect'>])))
export const BUDGET27: Record<ItemId, number> = { ...b27Base, indirect: Math.round(INDIRECT_RATE * (DIRECT_2027 + b27Base.personnel)) }

const REASON: Record<ItemId, string> = {
  rga: `후보 ${n0(P27[0])}계통 유지`,
  chip: `칩 단가 ${UNIT['6K'].toFixed(1)} → ${BUDGET_2027.chipUnit.toFixed(1)}만 원/샘플(≈${Math.round((BUDGET_2027.chipUnit * 1e4) / USD_KRW)} USD)`,
  pred: '계통당 1.0만 원 유지',
  fieldSet: `MET 완료 세트 ${P26[4]} → ${P27[4]}(시험구 ${n0(T2026.plots.total)} → ${n0(T2027.plots.total)}구)`,
  fieldY1: `MET 1년차 세트 ${MET_Y1[2026]} → ${MET_Y1[2027]}(${fieldY1Plots26} → ${fieldY1Plots27}구)`,
  kasp: `${sum(KASP_PLAN_PLATES)} → ${BUDGET_2027.kaspPlates}장(MAS F2 개체 증가 반영)`,
  gbs: `${BUDGET_2027.gbsPlates}장 유지`,
  cross: '교배 조합 확대(추정)',
  seedOps: '2026 불용 예상분 유지 편성',
  personnel: `인건비 ${Math.round((BUDGET_2027.personnelRaise - 1) * 100)}% 인상(추정)`,
  deprec: '변동 없음',
  indirect: `(직접비(소모성 경비) + 인건비) × ${Math.round(INDIRECT_RATE * 100)}%`,
}

export interface PlanRow {
  id: string
  kind: 'item' | 'group' | 'total'
  group?: GroupKey
  name: string
  b26: number
  fc26: number
  b27: number
  delta: number
  deltaPct: number
  reason: string
}
export const PLAN_ITEMS: PlanRow[] = ITEMS.map(i => ({
  id: i.id,
  kind: 'item',
  group: i.group,
  name: i.name,
  b26: i.budget,
  fc26: i.forecast,
  b27: BUDGET27[i.id],
  delta: BUDGET27[i.id] - i.budget,
  deltaPct: (BUDGET27[i.id] / i.budget - 1) * 100,
  reason: REASON[i.id],
}))
const planSum = (rows: PlanRow[], id: string, kind: PlanRow['kind'], name: string, reason: string, group?: GroupKey): PlanRow => {
  const b26 = sum(rows.map(r => r.b26))
  const b27 = sum(rows.map(r => r.b27))
  return { id, kind, group, name, b26, fc26: sum(rows.map(r => r.fc26)), b27, delta: b27 - b26, deltaPct: (b27 / b26 - 1) * 100, reason }
}
export const PLAN_GROUPS: Record<GroupKey, PlanRow> = Object.fromEntries(
  GROUPS.map(g => [
    g.key,
    planSum(
      PLAN_ITEMS.filter(r => r.group === g.key),
      `group-${g.key}`,
      'group',
      `${g.key} ${g.label} 소계`,
      g.key === 'A' ? '= 비교 기준 직접비' : g.key === 'C' ? '두 직접비 정의에 포함하지 않음' : '',
      g.key,
    ),
  ]),
) as Record<GroupKey, PlanRow>
export const PLAN_TOTAL = planSum(PLAN_ITEMS, 'total', 'total', '합계', `직접비(소모성 경비) ${n0(DIRECT.budget)} → ${n0(DIRECT_2027)}`)
/** 기본 순서: 그룹 소계 → 비목 … → 합계 */
export const PLAN_ROWS_GROUPED: PlanRow[] = [...GROUPS.flatMap(g => [PLAN_GROUPS[g.key], ...PLAN_ITEMS.filter(r => r.group === g.key)]), PLAN_TOTAL]

/** 2027 6K 칩 단가 환율 민감도 */
export const FX = {
  base: b27Base.chip,
  scenario: (b27Base.chip * FX_SCENARIO) / USD_KRW,
  pct: (FX_SCENARIO / USD_KRW - 1) * 100,
  usd: (BUDGET_2027.chipUnit * 1e4) / USD_KRW,
}

// ───────────────────────── DEV 검산 ─────────────────────────
if (import.meta.env?.DEV) {
  const tag = '[검산] [program-budget]'
  const eq = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps
  const checks: [boolean, string][] = [
    [Object.values(W).every(w => eq(sum(w), 1, 1e-9)), '월별 가중 합 ≠ 1'],
    [TOTAL.budget === 93411, `연간 예산 ${TOTAL.budget} ≠ 93,411`],
    [GROUP_SUM.A.budget === 18800 && T2026.annual === 18800, `A 그룹 ${GROUP_SUM.A.budget} · 비교 기준 직접비 ${T2026.annual} ≠ 18,800`],
    [GROUP_SUM.B.budget === 12774 && GROUP_SUM.C.budget === 54000 && GROUP_SUM.D.budget === 7837, 'B·C·D 그룹 예산'],
    [DIRECT.budget === 31574 && r2(DIRECT_SHARE, 1) === 33.8, `직접비(소모성 경비) ${DIRECT.budget} · ${DIRECT_SHARE}`],
    [r2(TOTAL.execPct, 1) === 82.6 && r2(TOTAL.planPct, 1) === 82.6 && r2(TOTAL.vsPlan, 1) === 100.0, `집행률 ${TOTAL.execPct} · 계획 ${TOTAL.planPct} · 계획 대비 ${TOTAL.vsPlan}`],
    [eq(TOTAL.actToDate, 77197.468, 1e-3) && eq(TOTAL.planToDate, 77171.668, 1e-3), `실적·계획 누계 ${TOTAL.actToDate} · ${TOTAL.planToDate}`],
    [eq(TOTAL.forecast, 93476.371, 1e-3) && r2(TOTAL.fcPct, 1) === 100.1 && Math.round(TOTAL.over) === 65, `연말 전망 ${TOTAL.forecast} · ${TOTAL.fcPct}`],
    [r2(SEP_ACT.act! / TOTAL.budget * 100, 2) === 76.65, `9월말 실적 ${SEP_ACT.act}`],
    [ALERT_ITEMS.length === 2 && KASP.status === 'critical' && SEED_OPS.status === 'warning', `경보 비목 ${ALERT_ITEMS.map(i => i.id).join(',')}`],
    [r2(KASP.fcPct, 1) === 105.0 && eq(KASP_ALERT.over, 211.5) && r2(SEED_OPS.fcPct, 1) === 83.8, `KASP ${KASP.fcPct} · 종자 관리 ${SEED_OPS.fcPct}`],
    [Math.round(SEED_OPS_ALERT.unused) === 146 && Math.round(SEED_OPS_ALERT.remain) === 315, `불용 ${SEED_OPS_ALERT.unused} · 잔액 ${SEED_OPS_ALERT.remain}`],
    [ITEM_BY_ID.chip.execPct === 100 && ITEM_BY_ID.cross.execPct === 100, '6K·교배 집행률 100%'],
    [
      TREND.map(t => t.perLine.toFixed(1)).join(',') === '5.0,5.0,5.0,7.1,6.6,6.3,6.1,6.0,5.9',
      `계통당 ${TREND.map(t => t.perLine.toFixed(1)).join(',')}`,
    ],
    [
      TREND.map(t => Math.round(t.cpg)).join(',') === '3096,3174,3307,2586,2142,1870,1637,1466,1389',
      `개량 1 kg/10a당 ${TREND.map(t => Math.round(t.cpg)).join(',')}`,
    ],
    [TREND.map(t => t.annual).join(',') === '13004,13196,14016,19116,19468,20040,19576,18800,18984', `비교 기준 직접비 ${TREND.map(t => t.annual).join(',')}`],
    [Math.round(CPG_REALIZED[2019]) === 3781 && Math.round(CPG_REALIZED[2026]) === 2067, `실현 기준 ${CPG_REALIZED[2019]} · ${CPG_REALIZED[2026]}`],
    [r2(CPG_PRED_CHANGE, 1) === -52.6 && r2(CPG_REAL_CHANGE, 1) === -45.3 && r2(ANNUAL_RATIO, 2) === 1.45, `변화율 ${CPG_PRED_CHANGE} · ${CPG_REAL_CHANGE} · ${ANNUAL_RATIO}`],
    [r2(DG_RATIO_PRED, 1) === 3.1 && r2(DG_RATIO_REAL, 1) === 2.6, `ΔG 배율 ${DG_RATIO_PRED} · ${DG_RATIO_REAL}`],
    [PLATFORM_SAMPLES_TOTAL === 10742 && PLATFORMS.map(p => p.samplesAct).join(',') === '2000,8366,376', `플랫폼 샘플 ${PLATFORMS.map(p => p.samplesAct).join(',')}`],
    [PLATFORM_SAMPLES_PLAN === 11964 && PLATFORM_SAMPLES_FORECAST === 12434 && LAB_ANNUAL_TARGET === 12000, `플랫폼 계획·전망 샘플 ${PLATFORM_SAMPLES_PLAN} · ${PLATFORM_SAMPLES_FORECAST}`],
    [ITEM_BY_ID.deprec.costNote === NONCASH_NOTE, '감가상각 비현금 표기'],
    [PLATFORMS.map(p => p.wonPerMarker.toFixed(p.key === '6K' ? 2 : p.key === 'KASP' ? 0 : 1)).join(',') === '5.19,281,1.0', '마커당 비용'],
    [PLAN_TOTAL.b27 === 95256 && PLAN_TOTAL.delta === 1845 && r2(PLAN_TOTAL.deltaPct, 1) === 2.0, `2027 합계 ${PLAN_TOTAL.b27}`],
    [PLAN_GROUPS.A.b27 === 18984 && T2027.annual === 18984 && PLAN_GROUPS.B.b27 === 12863 && PLAN_GROUPS.C.b27 === 55404 && PLAN_GROUPS.D.b27 === 8005, '2027 그룹 소계'],
    [
      PLAN_ITEMS.find(r => r.id === 'kasp')!.delta === 423 && PLAN_ITEMS.find(r => r.id === 'chip')!.delta === -200 && PLAN_ITEMS.find(r => r.id === 'fieldY1')!.delta === -384 && PLAN_ITEMS.find(r => r.id === 'fieldSet')!.delta === 384,
      '2027 비목 증감',
    ],
    [Math.round(FX.scenario) === 5007 && r2(FX.pct, 1) === 4.3, `환율 민감도 ${FX.scenario} · ${FX.pct}`],
  ]
  for (const [ok, msg] of checks) console.assert(ok, `${tag} ${msg}`)
}
