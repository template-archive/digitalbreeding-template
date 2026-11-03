// 품종 보급 현황 — 목업 데이터. 명세: docs/specs/variety-adoption.md
// 시드 20261023(명세 기준). 이 템플릿은 난수를 쓰지 않는다: 아래 상수만 하드코딩하고 나머지는 계산한다.
// 실제 API로 바꿀 때는 VARIETIES(품종별 보급종 생산·시범 면적·도 배분), NATIONAL·PROV_2025(국내·도 면적),
// DEMAND_2027, SURVEY, OLD_MAIN_CENTRAL만 바꾸면 화면 전체가 따라간다.

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export const CUR = 2026
export const PREV = 2025
export const PLAN_YEAR = 2027
/** 재배 면적·실적 확정 시점 */
export const AREA_CONFIRM = '2027-02'

// 국내 벼 재배 면적(ha). 2022~2025 통계청(2025 잠정), 2026 추정(약 67만 ha 보도, −7,500), 2019~2021 추정
export const NATIONAL: Record<number, number> = {
  2019: 729814,
  2020: 726432,
  2021: 732477,
  2022: 727054,
  2023: 708012,
  2024: 697713,
  2025: 677597,
  2026: 670100,
}
/** 2027 전망 점유율은 국내 면적 2026 유지 가정 */
export const nationalOf = (y: number) => NATIONAL[y] ?? NATIONAL[CUR]!

export type Prov = '경기' | '충남' | '충북' | '전북' | '전남' | '경북' | '경남' | '강원'
export type ProvKey = Prov | '기타'
// 도별 2025(ha). 전남·충남·전북·경북·경기 통계청 잠정, 경남·충북·강원 추정, 기타 = 나머지
export const PROV_2025: Record<Prov, number> = { 경기: 72289, 충남: 125276, 충북: 33800, 전북: 100719, 전남: 142443, 경북: 86662, 경남: 61000, 강원: 28400 }
export const PROVS = Object.keys(PROV_2025) as Prov[]
export const OTHER_2025 = NATIONAL[PREV]! - PROVS.reduce((s, p) => s + PROV_2025[p], 0) // 27,008
export const OTHER_LABEL = '기타(특·광역시·세종·제주)'
/** 중부 평야지(프로그램 지역) */
export const CENTRAL: readonly Prov[] = ['경기', '충남', '충북'] as const

export const SEED_RATE_T_PER_HA = 0.04 // 4 kg/10a
export const SUPPLY_RATE = 0.95 // 보급종 생산 → 다음 해 공급
export const CARRY = [1.0, 0.6, 0.3] as const // 공급 해, +1년, +2년(자가채종)
export const MULT = { found: 30, basic: 20, breeder: 20 } as const // 보급종/원종, 원종/원원종, 원원종/기본식물(실현 배율)
export const SEED_YIELD_T_PER_HA = { certified: 5.0, basic: 4.5, prebasic: 4.0 } as const // 채종 면적 환산(툴팁)
/** 표준 일정: 등록 연도 Y → 첫 농가 재배 Y+3 */
export const STD_LAG = 3

export interface Variety {
  id: string
  name: string
  line: string
  trait: string
  reg: number | null
  regMonth?: string
  filedAt?: string
  regPlan?: number
  preMultiplication?: boolean
  P3: Record<number, number>
  pilot: Record<number, number>
  target2026?: number
  share: Partial<Record<Prov, number>>
}

// 품종·계통·형질·등록 연도는 kpi/program-overview APPLICATIONS(R1~R10, R15)와 같다(템플릿 간 결합을 피하려고 복제).
// P3의 2027~2029는 계획(화면은 2027까지만 그리고 "계획" 표시). 2028~2029 값은 원종·원원종·기본식물 역산에만 쓴다.
export const VARIETIES: Variety[] = [
  { id: 'R1', name: '가람솔', line: 'YR07-0231', trait: '중만생 다수성', reg: 2020,
    P3: { 2022: 85, 2023: 190, 2024: 295, 2025: 360, 2026: 380, 2027: 380, 2028: 360, 2029: 360 }, pilot: { 2022: 30 }, target2026: 15200,
    share: { 경기: 0.3, 충남: 0.38, 충북: 0.13, 전북: 0.11, 전남: 0.03, 경북: 0.03, 경남: 0.02 } },
  { id: 'R2', name: '다올미', line: 'YR08-0517', trait: '고품질 밥맛', reg: 2021,
    P3: { 2023: 50, 2024: 110, 2025: 150, 2026: 165, 2027: 170, 2028: 170, 2029: 170 }, pilot: { 2023: 25 }, target2026: 5200,
    share: { 경기: 0.35, 충남: 0.25, 충북: 0.1, 전북: 0.12, 전남: 0.06, 경북: 0.07, 경남: 0.03, 강원: 0.02 } },
  { id: 'R3', name: '청여울', line: 'YR08-1042', trait: '도열병 저항성', reg: 2022,
    P3: { 2024: 40, 2025: 85, 2026: 110, 2027: 120, 2028: 120, 2029: 120 }, pilot: { 2024: 20 }, target2026: 3000,
    share: { 경북: 0.25, 강원: 0.15, 충북: 0.2, 경기: 0.15, 충남: 0.1, 전북: 0.05, 경남: 0.1 } },
  { id: 'R4', name: '윤슬찬', line: 'YR09-0388', trait: '내도복·중생', reg: 2022,
    P3: { 2024: 30, 2025: 60, 2026: 75, 2027: 80, 2028: 80, 2029: 80 }, pilot: { 2024: 20 }, target2026: 2000,
    share: { 전북: 0.3, 전남: 0.3, 충남: 0.15, 경남: 0.15, 경북: 0.1 } },
  { id: 'R5', name: '새벽별미', line: 'YR10-0756', trait: '조생·밥맛', reg: 2023,
    P3: { 2025: 35, 2026: 70, 2027: 90, 2028: 100, 2029: 100 }, pilot: { 2025: 15 }, target2026: 1000,
    share: { 강원: 0.3, 경기: 0.3, 충북: 0.15, 경북: 0.15, 충남: 0.1 } },
  { id: 'R6', name: '솔빛나래', line: 'YR10-1193', trait: '흰잎마름병 저항성', reg: 2024,
    P3: { 2026: 45, 2027: 80, 2028: 100, 2029: 100 }, pilot: { 2026: 60 }, share: { 전북: 1 } },
  { id: 'R7', name: '하늬결', line: 'YR12-0264', trait: '내냉성', reg: 2024,
    P3: { 2026: 30, 2027: 50, 2028: 60, 2029: 60 }, pilot: { 2026: 40 }, share: { 강원: 1 } },
  { id: 'R8', name: '온새미로', line: 'YR13-0819', trait: '중만생 다수성', reg: 2025,
    P3: { 2027: 60, 2028: 150, 2029: 150 }, pilot: { 2027: 50 }, share: { 충남: 1 } },
  { id: 'R9', name: '단비누리', line: 'YR12-1307', trait: '찰벼', reg: 2025,
    P3: { 2027: 15, 2028: 30, 2029: 30 }, pilot: { 2027: 20 }, share: { 경기: 1 } },
  { id: 'R10', name: '늘솔찬', line: 'YR14-0472', trait: '도열병·흰잎마름병 복합 저항성', reg: 2026, regMonth: '2026-03',
    P3: { 2028: 60, 2029: 80 }, pilot: { 2028: 40 }, share: {} },
  { id: 'R15', name: '별하랑', line: 'YR19-0083', trait: '다수성(GS 선발 계통)', reg: null, filedAt: '2026-06-09', regPlan: 2029,
    preMultiplication: true, P3: { 2029: 40 }, pilot: {}, share: {} },
]
export const BYEOLHARANG = VARIETIES.find(v => v.preMultiplication)!
export const GARAMSOL = VARIETIES[0]!
export const NEULSOLCHAN = VARIETIES.find(v => v.regMonth)!
/** 별하랑 재배심사(variety-profile과 같음) */
export const REVIEW_YEARS = [2027, 2028] as const
/** 심사 중 4품종(R11~R14), 증식 계획 없음 */
export const UNDER_REVIEW = ['여울빛', '해솔가온', '은가람', '미온결']
/** 대비 품종 정보(variety-profile·program-baseline) */
export const GARAMSOL_MET_YIELD = 560 // kg/10a, MET 2년 평균(쌀 수량)
export const BYEOLHARANG_VS_GARAMSOL = 108.0 // %

const g = (o: Record<number, number>, k: number) => o[k] ?? 0
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** 원종 생산량 P2(t) */
export const P2 = (v: Variety, y: number) => g(v.P3, y + 1) / MULT.found + g(v.pilot, y + 1) * SEED_RATE_T_PER_HA
/** 원원종 생산량 P1(t) */
export const P1 = (v: Variety, y: number) => P2(v, y + 1) / MULT.basic
/** 기본식물(kg) */
export const breederKg = (v: Variety, y: number) => (P1(v, y + 1) / MULT.breeder) * 1000
/** 보급종 생산량 P3(t) */
export const P3 = (v: Variety, y: number) => g(v.P3, y)
/** 보급종 공급량 S(t), 그해 봄 */
export const supplyT = (v: Variety, y: number) => g(v.P3, y - 1) * SUPPLY_RATE
/** 공급 면적(ha) */
export const supplyHa = (v: Variety, y: number) => supplyT(v, y) / SEED_RATE_T_PER_HA
export const pilotHa = (v: Variety, y: number) => g(v.pilot, y)
/** 재배 면적(ha) = 공급 면적 + 0.6·전년 + 0.3·전전년 + 시범 */
export const area = (v: Variety, y: number) =>
  CARRY[0] * supplyHa(v, y) + CARRY[1] * supplyHa(v, y - 1) + CARRY[2] * supplyHa(v, y - 2) + pilotHa(v, y)
/** 시범을 뺀 농가 재배 면적 */
export const farmArea = (v: Variety, y: number) => area(v, y) - pilotHa(v, y)
export const totalArea = (y: number) => sum(VARIETIES.map(v => area(v, y)))
/** 국내 점유율(%). 2027 전망은 국내 2026 면적 사용 */
export const share = (y: number) => (totalArea(y) / nationalOf(y)) * 100
export const varietyShare = (v: Variety, y: number) => (area(v, y) / nationalOf(y)) * 100

// ---------------- 증식 단계 ----------------

export type StageKey = 'breeder' | 'prebasic' | 'basic' | 'certified' | 'farm'
export const STAGES: { key: StageKey; label: string; short: string; en: string }[] = [
  { key: 'breeder', label: '기본식물', short: '기', en: 'Breeder seed' },
  { key: 'prebasic', label: '원원종', short: '원원', en: 'Pre-basic seed' },
  { key: 'basic', label: '원종', short: '원', en: 'Basic seed' },
  { key: 'certified', label: '보급종 생산', short: '보', en: 'Certified seed' },
  { key: 'farm', label: '농가 재배', short: '농', en: 'Farm' },
]
/** 계획 보급종(P3)이 있는 마지막 해. 상위 단계는 여기서 역산하므로 그 뒤 칸은 빈다 */
export const LAST_P3_YEAR = Math.max(...VARIETIES.flatMap(v => Object.keys(v.P3).map(Number)))
/** 단계별 빈 칸 시작 연도: 기본식물 = 마지막 P3 − 3 + 1, 원원종 − 2 + 1, 원종 − 1 + 1 */
export const EMPTY_FROM = { breeder: LAST_P3_YEAR - 2, prebasic: LAST_P3_YEAR - 1, basic: LAST_P3_YEAR } as const
export const TIMELINE_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030] as const

export interface StageCell {
  key: StageKey
  /** 생산량(t, 기본식물은 kg) 또는 재배 면적(ha) */
  amount: number
  unit: 't' | 'kg' | 'ha'
  /** 채종 면적(ha) = 생산량 / 채종 수량. 기본식물·농가 재배는 없음 */
  seedHa: number | null
  /** 기준 연도 뒤(계획) */
  planned: boolean
  /** 등록 전 사전 증식(별하랑) */
  pre: boolean
}

const EPS = 1e-9
/** 그해 진행된 단계 목록(P1·P2·P3·농가 면적 > 0 기준). 시범 재배는 pilotHa로 따로 본다 */
export function stageOf(v: Variety, y: number): StageCell[] {
  const planned = y > CUR
  const pre = !!v.preMultiplication && v.regPlan !== undefined && y < v.regPlan
  const out: StageCell[] = []
  const f = breederKg(v, y)
  if (f > EPS) out.push({ key: 'breeder', amount: f, unit: 'kg', seedHa: null, planned, pre })
  const p1 = P1(v, y)
  if (p1 > EPS) out.push({ key: 'prebasic', amount: p1, unit: 't', seedHa: p1 / SEED_YIELD_T_PER_HA.prebasic, planned, pre })
  const p2 = P2(v, y)
  if (p2 > EPS) out.push({ key: 'basic', amount: p2, unit: 't', seedHa: p2 / SEED_YIELD_T_PER_HA.basic, planned, pre })
  const p3 = P3(v, y)
  if (p3 > EPS) out.push({ key: 'certified', amount: p3, unit: 't', seedHa: p3 / SEED_YIELD_T_PER_HA.certified, planned, pre: false })
  const fa = farmArea(v, y)
  if (fa > EPS) out.push({ key: 'farm', amount: fa, unit: 'ha', seedHa: null, planned, pre: false })
  return out
}

const RANGE = Array.from({ length: 16 }, (_, i) => 2017 + i)
const firstYear = (pred: (y: number) => boolean) => RANGE.find(pred) ?? null
/** 단계별 시작 연도 */
export const stageStart = (v: Variety, k: StageKey) => firstYear(y => stageOf(v, y).some(s => s.key === k))
export const firstFarmYear = (v: Variety) => stageStart(v, 'farm')
/** 등록(예정) 연도 */
export const regYearOf = (v: Variety) => v.reg ?? v.regPlan ?? null
/** 등록 → 첫 농가 재배(년) */
export const lagOf = (v: Variety) => {
  const r = regYearOf(v)
  const f = firstFarmYear(v)
  return r !== null && f !== null ? f - r : null
}
/** 별하랑 표준 일정이면 첫 농가 재배 연도 */
export const stdFarmYear = (v: Variety) => (regYearOf(v) ?? 0) + STD_LAG
/** 시범 재배만 있는 해 */
export const pilotOnly = (v: Variety, y: number) => pilotHa(v, y) > 0 && farmArea(v, y) <= EPS

// ---------------- B. 재배 면적 추이 ----------------

export const AREA_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027] as const
/** 누적 막대 시리즈: 보급 5품종 + 신규(솔빛나래·하늬결·온새미로·단비누리) */
export const MAIN5 = VARIETIES.filter(v => v.target2026 !== undefined)
export const NEW_GROUP = VARIETIES.filter(v => ['R6', 'R7', 'R8', 'R9'].includes(v.id))
export const AREA_SERIES: { key: string; label: string; members: Variety[] }[] = [
  ...MAIN5.map(v => ({ key: v.id, label: v.name, members: [v] })),
  { key: 'new', label: `신규(${NEW_GROUP.map(v => v.name).join('·')})`, members: NEW_GROUP },
]
export const seriesArea = (members: Variety[], y: number) => sum(members.map(v => area(v, y)))
export const pilotTotal = (y: number) => sum(VARIETIES.map(v => pilotHa(v, y)))
/** 보급 5품종(시범 제외) 2026 면적 */
export const main5FarmArea = (y: number) => sum(MAIN5.map(v => farmArea(v, y)))
export const supplyHaTotal = (y: number) => sum(VARIETIES.map(v => supplyHa(v, y)))

// ---------------- E. 도별 보급률 ----------------

export const NAT_RATIO = NATIONAL[CUR]! / NATIONAL[PREV]!
export interface ProvRow {
  key: ProvKey
  label: string
  central: boolean
  /** 도 벼 재배 면적 2026(추정) */
  provArea: number
  /** 도 안 프로그램 품종 면적 */
  progArea: number
  rate: number
  /** 품종(시리즈)별 도 안 면적 */
  bySeries: Record<string, number>
}
export const PROV_SERIES = [
  ...MAIN5.map(v => ({ key: v.id, label: v.name, members: [v] })),
  { key: 'new', label: '신규(시범)', members: VARIETIES.filter(v => !MAIN5.includes(v)) },
]
export const provProgArea = (p: Prov, y: number, vs: Variety[] = VARIETIES) => sum(vs.map(v => area(v, y) * (v.share[p] ?? 0)))
export const PROVINCE: ProvRow[] = [
  ...PROVS.map(p => {
    const provArea = PROV_2025[p] * NAT_RATIO
    const progArea = provProgArea(p, CUR)
    const bySeries = Object.fromEntries(PROV_SERIES.map(s => [s.key, provProgArea(p, CUR, s.members)]))
    return { key: p as ProvKey, label: p, central: CENTRAL.includes(p), provArea, progArea, rate: (progArea / provArea) * 100, bySeries }
  }),
  {
    key: '기타' as ProvKey,
    label: '기타',
    central: false,
    provArea: OTHER_2025 * NAT_RATIO,
    progArea: 0,
    rate: 0,
    bySeries: Object.fromEntries(PROV_SERIES.map(s => [s.key, 0])),
  },
].sort((a, b) => b.rate - a.rate)

// ---------------- F. 가람솔 대체율 ----------------

export const OLD_MAIN_CENTRAL: Record<number, number> = { 2022: 48000, 2023: 46500, 2024: 43000, 2025: 38500, 2026: 35000 } // 구 주력 중만생 품종(외부 육성, 가상), 중부 3도 ha
export const REPLACE_YEARS = [2022, 2023, 2024, 2025, 2026] as const
export const GARAMSOL_CENTRAL_SHARE = sum(CENTRAL.map(p => GARAMSOL.share[p] ?? 0)) // 0.81
export const garamsolCentral = (y: number) => area(GARAMSOL, y) * GARAMSOL_CENTRAL_SHARE
export const replaceRate = (y: number) => {
  const c = garamsolCentral(y)
  return (c / (c + OLD_MAIN_CENTRAL[y]!)) * 100
}

// ---------------- G. 보급 목표 ----------------

export interface TargetRow {
  v: Variety
  actual: number
  target: number
  rate: number
}
export const TARGET_2026: TargetRow[] = MAIN5.map(v => ({ v, actual: area(v, CUR), target: v.target2026!, rate: (area(v, CUR) / v.target2026!) * 100 }))
export const TARGET_SUM = sum(TARGET_2026.map(r => r.target))
/** 합계 달성률: 보급 5품종 면적(시범 제외) / 목표 합 */
export const TARGET_RATE = (main5FarmArea(CUR) / TARGET_SUM) * 100
export const TARGET_OK = 100
export const TARGET_CAUTION = 90
export type TargetStatus = 'ok' | 'warning' | 'critical'
export const targetStatus = (rate: number): TargetStatus => (rate >= TARGET_OK ? 'ok' : rate >= TARGET_CAUTION ? 'warning' : 'critical')

// ---------------- I. 2027 보급종 공급 계획 ----------------

export const DEMAND_2027: Record<string, number> = { 가람솔: 400, 다올미: 150, 청여울: 110, 윤슬찬: 65, 새벽별미: 75, 솔빛나래: 40, 하늬결: 25 } // t, 추정
export interface SupplyRow {
  id: string
  name: string
  prod2026: number
  supply: number
  supplyHa: number
  demand: number
  rate: number
  gap: number
  total?: boolean
}
export const SUPPLY_2027: SupplyRow[] = VARIETIES.filter(v => P3(v, CUR) > 0).map(v => {
  const supply = supplyT(v, PLAN_YEAR)
  const demand = DEMAND_2027[v.name]!
  return { id: v.id, name: v.name, prod2026: P3(v, CUR), supply, supplyHa: supplyHa(v, PLAN_YEAR), demand, rate: (supply / demand) * 100, gap: supply - demand }
})
export const SUPPLY_TOTAL: SupplyRow = (() => {
  const prod2026 = sum(SUPPLY_2027.map(r => r.prod2026))
  const supply = sum(SUPPLY_2027.map(r => r.supply))
  const demand = sum(SUPPLY_2027.map(r => r.demand))
  return { id: 'total', name: '합계', prod2026, supply, supplyHa: sum(SUPPLY_2027.map(r => r.supplyHa)), demand, rate: (supply / demand) * 100, gap: supply - demand, total: true }
})()
export const SUPPLY_SHORT = SUPPLY_2027.filter(r => r.rate < 100).sort((a, b) => a.rate - b.rate)
export const SUPPLY_CRITICAL = 90
/** 수급률 경보 단계: 100% 이상 정상, {SUPPLY_CRITICAL}~100% 주의, 미만 경보. KPI·경보 목록·I 표 배지가 모두 이 함수 하나를 쓴다 */
export const supplyStatus = (rate: number): TargetStatus => (rate >= 100 ? 'ok' : rate >= SUPPLY_CRITICAL ? 'warning' : 'critical')

// ---------------- H. 농가·RPC 평가 ----------------

export const RPC_MIN_N = 10 // 미만이면 "참고" 배지, CI 미표시
export const ci95 = (sd: number, n: number) => (1.96 * sd) / Math.sqrt(n)
export const ci95p = (p: number, n: number) => 1.96 * Math.sqrt(((p / 100) * (1 - p / 100)) / n) * 100
export interface SurveyRow {
  name: string
  n: number
  yieldSat: [number, number]
  qualitySat: [number, number]
  rpc: { mean: number; n: number }
  replant: number
}
export const SURVEY: { meta: { crop: number; surveyedAt: string; nextSurvey: string; pending: string }; rows: SurveyRow[] } = {
  // 2025년산, 2026-02 조사, 5점 척도(추정)
  meta: { crop: 2025, surveyedAt: '2026-02', nextSurvey: '2027-02', pending: '새벽별미' },
  rows: [
    { name: '가람솔', n: 180, yieldSat: [4.3, 0.7], qualitySat: [3.6, 0.8], rpc: { mean: 3.7, n: 12 }, replant: 78 },
    { name: '다올미', n: 120, yieldSat: [3.5, 0.8], qualitySat: [4.4, 0.6], rpc: { mean: 4.3, n: 9 }, replant: 84 },
    { name: '청여울', n: 60, yieldSat: [3.8, 0.8], qualitySat: [3.7, 0.8], rpc: { mean: 3.6, n: 5 }, replant: 71 },
    { name: '윤슬찬', n: 50, yieldSat: [3.9, 0.7], qualitySat: [3.5, 0.9], rpc: { mean: 3.4, n: 4 }, replant: 66 },
  ],
}
export const SURVEY_N = sum(SURVEY.rows.map(r => r.n))
export const REPLANT_W = sum(SURVEY.rows.map(r => r.replant * r.n)) / SURVEY_N

// ---------------- KPI 요약 ----------------

export const KPI = {
  area: totalArea(CUR),
  areaPrev: totalArea(PREV),
  areaDelta: totalArea(CUR) - totalArea(PREV),
  areaDeltaPct: ((totalArea(CUR) - totalArea(PREV)) / totalArea(PREV)) * 100,
  pilot: pilotTotal(CUR),
  share: share(CUR),
  sharePrev: share(PREV),
  shareDelta: share(CUR) - share(PREV),
  replace: replaceRate(CUR),
  replaceDelta: replaceRate(CUR) - replaceRate(PREV),
}

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol
  for (const v of VARIETIES) {
    const hasArea = [...YEARS, PLAN_YEAR].some(y => area(v, y) > 0)
    if (hasArea) {
      const s = Object.values(v.share).reduce((a, b) => a + (b ?? 0), 0)
      console.assert(near(s, 1), `[검산] ${v.name} 도 배분 비율 합 ${s} ≠ 1`)
    }
    const r = regYearOf(v)
    const lag = lagOf(v)
    if (v.preMultiplication) {
      console.assert(lag === 1, `[검산] ${v.name} 등록 예정 → 농가 ${lag}년(기대 1)`)
      console.assert(firstFarmYear(v) === 2030, `[검산] ${v.name} 첫 농가 재배 ${firstFarmYear(v)}(기대 2030)`)
    } else {
      console.assert(lag === STD_LAG, `[검산] ${v.name} 등록 → 농가 ${lag}년(기대 ${STD_LAG})`)
      if (r !== null) {
        for (const y of RANGE.filter(y => y < r)) {
          const st = stageOf(v, y).filter(s => s.key !== 'breeder')
          console.assert(st.length === 0, `[검산] ${v.name} 등록(${r}) 전 ${y}에 원원종 이상 단계 ${st.map(s => s.key).join(',')}`)
        }
        for (const y of RANGE.filter(y => y <= r)) console.assert(area(v, y) === 0, `[검산] ${v.name} 등록 연도 이전·당해 ${y} 재배 면적 ${area(v, y)} ≠ 0`)
      }
    }
  }
  for (const y of [2026, 2027]) console.assert(area(BYEOLHARANG, y) === 0, `[검산] 별하랑 ${y} 재배 면적 ≠ 0`)
  console.assert(near(totalArea(CUR), 24966.25), `[검산] 2026 재배 면적 ${totalArea(CUR)} ≠ 24,966.25`)
  console.assert(share(CUR).toFixed(2) === '3.73', `[검산] 2026 점유율 ${share(CUR)} ≠ 3.73`)
  console.assert(share(PREV).toFixed(2) === '2.26', `[검산] 2025 점유율 ${share(PREV)} ≠ 2.26`)
  console.assert(KPI.shareDelta.toFixed(2) === '1.46', `[검산] 점유율 증감 ${KPI.shareDelta} ≠ 1.46`)
  console.assert(near(SUPPLY_TOTAL.supply, 831.25), `[검산] 2027 공급 합 ${SUPPLY_TOTAL.supply} ≠ 831.25`)
  console.assert(SUPPLY_TOTAL.rate.toFixed(1) === '96.1', `[검산] 수급률 ${SUPPLY_TOTAL.rate} ≠ 96.1`)
  {
    const st = (name: string) => supplyStatus(SUPPLY_2027.find(r => r.name === name)!.rate)
    const got = `${st('새벽별미')}·${st('가람솔')}·${st('청여울')}·${supplyStatus(SUPPLY_TOTAL.rate)}`
    console.assert(got === 'critical·warning·warning·warning', `[검산] 수급 단계 새벽별미·가람솔·청여울·합계 ${got} ≠ critical·warning·warning·warning`)
  }
  console.assert(TARGET_RATE.toFixed(1) === '94.2', `[검산] 목표 달성률 ${TARGET_RATE} ≠ 94.2`)
  console.assert(KPI.replace.toFixed(1) === '24.6', `[검산] 대체율 ${KPI.replace} ≠ 24.6`)
  console.assert(REPLANT_W.toFixed(1) === '77.3', `[검산] 재재배 의향 가중 평균 ${REPLANT_W} ≠ 77.3`)
  const provSum = PROVINCE.reduce((s, r) => s + r.progArea, 0)
  console.assert(near(provSum, totalArea(CUR), 1e-6), `[검산] 도별 프로그램 면적 합 ${provSum} ≠ 총면적 ${totalArea(CUR)}`)
  const provAreaSum = PROVINCE.reduce((s, r) => s + r.provArea, 0)
  console.assert(near(provAreaSum, NATIONAL[CUR]!, 1e-6), `[검산] 도 면적 합 ${provAreaSum} ≠ ${NATIONAL[CUR]}`)
  for (const r of PROVINCE) console.assert(r.rate < 100, `[검산] ${r.label} 보급률 ${r.rate} ≥ 100`)
  for (const y of [...YEARS, PLAN_YEAR]) console.assert(totalArea(y) < nationalOf(y), `[검산] ${y} 재배 면적이 국내 면적 이상`)
  console.assert(near(P1(NEULSOLCHAN, 2026), 0.18), `[검산] 늘솔찬 2026 원원종 ${P1(NEULSOLCHAN, 2026)} ≠ 0.180`)
  console.assert(LAST_P3_YEAR === 2029 && EMPTY_FROM.breeder === 2027 && EMPTY_FROM.prebasic === 2028 && EMPTY_FROM.basic === 2029, `[검산] 타임라인 빈 칸 시작 연도 ${JSON.stringify(EMPTY_FROM)}(기대 기본식물 2027·원원종 2028·원종 2029)`)
  for (const k of ['breeder', 'prebasic', 'basic'] as const) {
    for (const v of VARIETIES) {
      const late = TIMELINE_YEARS.filter(y => y >= EMPTY_FROM[k] && stageOf(v, y).some(s => s.key === k))
      console.assert(late.length === 0, `[검산] ${v.name} ${k} 단계가 빈 칸 시작(${EMPTY_FROM[k]}) 이후 ${late.join(',')}에 있음`)
    }
  }
  console.assert(near(breederKg(BYEOLHARANG, 2026), 10 / 3, 1e-6), `[검산] 별하랑 2026 기본식물 ${breederKg(BYEOLHARANG, 2026)} ≠ 3.3 kg`)
}
