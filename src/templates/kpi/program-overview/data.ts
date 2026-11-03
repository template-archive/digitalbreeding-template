/**
 * 육종 프로그램 KPI 개요 — 목업 데이터
 * 명세: docs/specs/program-overview.md
 *
 * - 연도별 구성 요소·목표·파이프라인·출원은 명세 표의 상수를 그대로 옮겼다.
 * - ΔG, ΔG 목표, 달성률, 같은 해 단계 수 비·코호트 진급률, 범위 평균은 상수에서 계산한다(하드코딩 금지).
 * - 난수는 형질별 교차 검증 반복값에만 쓴다(시드 20261023).
 * 실제 API로 바꿀 때는 아래 상수와 export 함수의 형태만 유지하면 된다.
 */
import { createRng } from '@/lib/rng'

export const SEED = 20261023
export const AS_OF = '2026-10-23'
/** 진행 중(잠정) 연도 */
export const PROVISIONAL_YEAR = 2026
/** 유전체 선발(GS)·속성세대진전 도입 연도 */
export const GS_START = 2022

// ───────── 출처: kpi/genetic-gain-tracker periodStats(쌀 수량, 2019~2026) — 실현 유전적 추세 기울기 ─────────
// 원 실행값(2026-10-26 정리 회차 2 재실행, REALIZATION_BIAS 0.90). 전통 = 2019~2021 코호트, GS = 2021~2026 코호트
export const REALIZED = { conventional: 3.439753, gs: 9.097399 } as const // kg/10a/년 → "3.4", "9.1"
/** 실현 배율 2.644783 → "2.6배". 예측 배율과 함께 보인다(사용자 결정 2026-10-26) */
export const REALIZED_RATIO = REALIZED.gs / REALIZED.conventional
/** 실현 배율은 실현 추세 기간(GS 코호트 ~2026)의 끝 연도에만 병기한다. 2024 예측 배율도 2.6배라 다른 연도에 붙이면 혼동된다 */
export const REALIZED_END_YEAR = 2026
/** 기준 평균 μ(2019 코호트 평균, kg/10a) */
export const MU = 560
/** 수량 계통평균 h² = 0.36 → √h² */
export const SQRT_H2_LINE_MEAN = 0.6
/** 초기 세대 단반복 수량 h²: 표현형 선발 정확도 √h² = 0.45의 근거 */
export const H2_SINGLE_REP = 0.2

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]

// ---------------- 연도별 확정 데이터 ----------------

/** 부모 선발(재순환 선발) 비율 p */
export const P: Record<Year, number> = { 2019: 0.2, 2020: 0.2, 2021: 0.2, 2022: 0.1, 2023: 0.1, 2024: 0.1, 2025: 0.1, 2026: 0.1 }
/** 선발 강도 i */
export const I: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
/** 선발 정확도(~2021, √h²) / GS 예측 정확도(2022~) */
export const R: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
/** 상가적 유전 표준편차 σA (kg/10a) */
export const SIGMA_A: Record<Year, number> = { 2019: 30.0, 2020: 29.7, 2021: 29.6, 2022: 29.3, 2023: 29.0, 2024: 28.8, 2025: 28.5, 2026: 28.2 }
/** 세대 간격 L (년) */
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
/** 훈련 집단 크기(계통). GS 도입 전에는 없음 */
export const TRAIN_N: Record<Year, number | null> = { 2019: null, 2020: null, 2021: null, 2022: 620, 2023: 950, 2024: 1280, 2025: 1560, 2026: 1850 }

// ---------------- 연도별 목표 ----------------

export const I_T: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
export const R_T: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.45, 2023: 0.5, 2024: 0.52, 2025: 0.55, 2026: 0.58 }
export const L_T: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.5, 2022: 3.0, 2023: 2.8, 2024: 2.5, 2025: 2.2, 2026: 2.1 }

// ---------------- 파이프라인 ----------------

export interface PipelineStage {
  key: string
  no: string
  name: string
  short: string
}

export const STAGES: PipelineStage[] = [
  { key: 'adv', no: '①', name: '세대 진전 후보 계통(F4~F6, 유전형 분석)', short: '세대 진전 후보' },
  { key: 'gs1', no: '②', name: '계통 선발(GS 1차)', short: '계통 선발(GS 1차)' },
  { key: 'pyt', no: '③', name: '예비 생산력 검정(PYT)', short: '예비 생산력 검정(PYT)' },
  { key: 'ayt', no: '④', name: '생산력 검정(AYT)', short: '생산력 검정(AYT)' },
  { key: 'met', no: '⑤', name: '지역 적응 시험(MET)', short: '지역 적응 시험(MET)' },
  { key: 'cand', no: '⑥', name: '품종 출원 후보', short: '품종 출원 후보' },
]

/** 단계별 계통 수(종료 연도 스냅샷). STAGES 순서와 같다 */
export const PIPELINE: Record<Year, number[]> = {
  2019: [1500, 300, 90, 30, 15, 2],
  2020: [1500, 320, 90, 30, 16, 2],
  2021: [1600, 330, 95, 32, 17, 1],
  2022: [1800, 480, 100, 34, 18, 2],
  2023: [1900, 540, 110, 36, 20, 3],
  2024: [2000, 580, 115, 38, 22, 2],
  2025: [2000, 600, 120, 40, 21, 3],
  2026: [2000, 600, 120, 40, 18, 3],
}
/** 2026 단계별 목표(다른 연도는 MET 목표만 있음) */
export const PIPELINE_TARGET_2026 = [2000, 600, 120, 40, 25, 3]
export const MET_INDEX = 4
export const AYT_INDEX = 3
export const MET_TARGET: Record<Year, number> = { 2019: 15, 2020: 15, 2021: 15, 2022: 18, 2023: 20, 2024: 22, 2025: 25, 2026: 25 }
/**
 * MET 1년차 세트(그해 시작한 2년제 세트, program-baseline 「MET 세트 정의」).
 * PIPELINE의 MET 값은 그해 완료 세트이고, 포장 계통 = 완료 세트 + 1년차 세트.
 * 출처: 2025 = PIPELINE[2026][4], 2026 = breeding-pipeline-flow MET_Y1_2024
 */
export const MET_FIRST_YEAR_SET: Partial<Record<Year, number>> = { 2025: 18, 2026: 20 }
/** 2년제 MET 세트가 처음 완료된 연도. 이전 연도는 전통 MET 3년 세트가 섞여 코호트 진급률을 계산하지 않는다 */
export const MET_TWO_YEAR_FROM = 2025

// ---------------- 신품종 출원·등록 ----------------

export const APP_TARGET: Record<Year, number> = { 2019: 2, 2020: 2, 2021: 2, 2022: 3, 2023: 3, 2024: 3, 2025: 3, 2026: 3 }
/** 연간 등록 건수(2019년 이전 출원분 포함) */
export const REGS: Record<Year, number> = { 2019: 1, 2020: 2, 2021: 1, 2022: 2, 2023: 1, 2024: 2, 2025: 2, 2026: 1 }

export type AppStatus = '등록' | '재배심사 중' | '서류심사 중' | '출원'

export interface Application {
  id: string
  filedAt: string
  name: string
  line: string
  trait: string
  crossYear: number
  devYears: number
  status: AppStatus
  regYear: number | null
}

/** 출원 목록(품종명은 모두 가칭) */
export const APPLICATIONS: Application[] = [
  { id: 'R1', filedAt: '2019-03-14', name: '가람솔', line: 'YR07-0231', trait: '중만생 다수성', crossYear: 2007, devYears: 12, status: '등록', regYear: 2020 },
  { id: 'R2', filedAt: '2019-09-02', name: '다올미', line: 'YR08-0517', trait: '고품질 밥맛', crossYear: 2008, devYears: 11, status: '등록', regYear: 2021 },
  { id: 'R3', filedAt: '2020-04-20', name: '청여울', line: 'YR08-1042', trait: '도열병 저항성', crossYear: 2008, devYears: 12, status: '등록', regYear: 2022 },
  { id: 'R4', filedAt: '2021-02-25', name: '윤슬찬', line: 'YR09-0388', trait: '내도복·중생', crossYear: 2009, devYears: 12, status: '등록', regYear: 2022 },
  { id: 'R5', filedAt: '2021-10-11', name: '새벽별미', line: 'YR10-0756', trait: '조생·밥맛', crossYear: 2010, devYears: 11, status: '등록', regYear: 2023 },
  { id: 'R6', filedAt: '2022-05-17', name: '솔빛나래', line: 'YR10-1193', trait: '흰잎마름병 저항성', crossYear: 2010, devYears: 12, status: '등록', regYear: 2024 },
  { id: 'R7', filedAt: '2023-03-08', name: '하늬결', line: 'YR12-0264', trait: '내냉성', crossYear: 2012, devYears: 11, status: '등록', regYear: 2024 },
  { id: 'R8', filedAt: '2023-06-21', name: '온새미로', line: 'YR13-0819', trait: '중만생 다수성', crossYear: 2013, devYears: 10, status: '등록', regYear: 2025 },
  { id: 'R9', filedAt: '2023-11-03', name: '단비누리', line: 'YR12-1307', trait: '찰벼', crossYear: 2012, devYears: 11, status: '등록', regYear: 2025 },
  { id: 'R10', filedAt: '2024-04-15', name: '늘솔찬', line: 'YR14-0472', trait: '도열병·흰잎마름병 복합 저항성', crossYear: 2014, devYears: 10, status: '등록', regYear: 2026 },
  { id: 'R11', filedAt: '2024-09-26', name: '여울빛', line: 'YR14-0935', trait: '고품질 밥맛', crossYear: 2014, devYears: 10, status: '재배심사 중', regYear: null },
  { id: 'R12', filedAt: '2025-02-19', name: '해솔가온', line: 'YR16-0158', trait: '중생 다수성', crossYear: 2016, devYears: 9, status: '재배심사 중', regYear: null },
  { id: 'R13', filedAt: '2025-05-30', name: '은가람', line: 'YR16-0644', trait: '내도복', crossYear: 2016, devYears: 9, status: '재배심사 중', regYear: null },
  { id: 'R14', filedAt: '2025-10-14', name: '미온결', line: 'YR17-0221', trait: '조생·내냉성', crossYear: 2017, devYears: 8, status: '서류심사 중', regYear: null },
  { id: 'R15', filedAt: '2026-06-09', name: '별하랑', line: 'YR19-0083', trait: '다수성(GS 선발 계통)', crossYear: 2019, devYears: 7, status: '출원', regYear: null },
]

/** 목록에는 넣지 않고 경보 문구에만 쓰는 출원 예정 건 */
export const PLANNED_APPLICATION = { line: 'YR19-0118', month: 12, year: 2026 as Year }

export const filedYear = (a: Application) => Number(a.filedAt.slice(0, 4))

/** 연도별 출원 건수 — 출원 목록에서 센다(차트와 표가 항상 일치) */
export const APPS: Record<Year, number> = Object.fromEntries(
  YEARS.map(y => [y, APPLICATIONS.filter(a => filedYear(a) === y).length]),
) as Record<Year, number>

// ---------------- 계산 ----------------

/** 연간 유전적 개량량 ΔG = i · r · σA / L (kg/10a/년) */
export const dG = (y: Year) => (I[y] * R[y] * SIGMA_A[y]) / L[y]
/** ΔG %/년 = ΔG / μ × 100 */
export const dGpct = (y: Year) => (dG(y) / MU) * 100
/** ΔG 목표 = i목표 · r목표 · σA실적 / L목표 */
export const dGTarget = (y: Year) => (I_T[y] * R_T[y] * SIGMA_A[y]) / L_T[y]
export const dGTargetPct = (y: Year) => (dGTarget(y) / MU) * 100

/** 높을수록 좋은 지표의 달성률(%) */
export const achHigher = (actual: number, target: number) => (actual / target) * 100
/** 낮을수록 좋은 지표의 달성률(%) */
export const achLower = (actual: number, target: number) => (target / actual) * 100

export type Severity = 'critical' | 'warning' | 'ok'
export const severity = (a: number): Severity => (a < 90 ? 'critical' : a < 100 ? 'warning' : 'ok')

/**
 * 연중 누계형 KPI의 연말 전망 달성률(%) = (실적 + 그해 안 확정 예정) / 목표 × 100.
 * program-baseline 「연중 연도 KPI 판정」: 진행 중 연도의 누계형 KPI(출원)는 등급만 이 값으로 정하고,
 * 표시 달성률·정렬은 실적 기준으로 둔다. breeding-pipeline-flow와 같은 식이다.
 */
export const forecastAchievement = (actual: number, pending: number, target: number) => ((actual + pending) / target) * 100
/** 그해 안에 확정될 출원 예정 건수(진행 중 연도만) */
export const appsPending = (y: Year) => (y === PROVISIONAL_YEAR && PLANNED_APPLICATION.year === y ? 1 : 0)
/** 신품종 출원 연말 전망 달성률(%). 확정 연도는 실적 달성률과 같다 */
export const appsForecastAch = (y: Year) => forecastAchievement(APPS[y], appsPending(y), APP_TARGET[y])

/** MET 코호트 진급률(완료 세트(Y) / AYT(Y−2)). 2년제 세트(완료 2025~)만, 아니면 null */
export function metCohortPass(y: Year): { aytYear: Year; ayt: number; pct: number; targetPct: number } | null {
  if (y < MET_TWO_YEAR_FROM) return null
  const aytYear = (y - 2) as Year
  const ayt = PIPELINE[aytYear][AYT_INDEX]
  return { aytYear, ayt, pct: (PIPELINE[y][MET_INDEX] / ayt) * 100, targetPct: (MET_TARGET[y] / ayt) * 100 }
}

/** 같은 해 단계 수 비(%) = 해당 단계 / 이전 단계 — 첫 단계는 null. 코호트 진급률이 아니다(MET = 그해 완료 세트) */
export const passRates = (y: Year): (number | null)[] => PIPELINE[y].map((n, i) => (i === 0 ? null : (n / PIPELINE[y][i - 1]) * 100))

/** 단계별 목표(2026만 전 단계, 그 외 연도는 MET만) */
export const stageTargets = (y: Year): (number | null)[] =>
  y === 2026 ? PIPELINE_TARGET_2026.slice() : STAGES.map((_, i) => (i === MET_INDEX ? MET_TARGET[y] : null))

export const yearsInRange = (start: Year, end: Year): Year[] => YEARS.filter(y => y >= start && y <= end)

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const sd = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 범위 평균 ΔG(%/년) */
export const rangeMeanPct = (start: Year, end: Year) => mean(yearsInRange(start, end).map(dGpct))

export const accuracyLabel = (y: Year) => (y >= GS_START ? '예측 정확도' : '선발 정확도')

// ---------------- 형질별 GS 예측 정확도 ----------------

export interface TraitDef {
  key: string
  name: string
  /** null이면 연도별 r(R 표)을 쓴다 */
  mean: number | null
  sd: number
  note?: string
}

export const TRAITS: TraitDef[] = [
  { key: 'yield', name: '쌀 수량', mean: null, sd: 0.04, note: 'ΔG의 r과 같은 값' },
  { key: 'heading', name: '출수기', mean: 0.68, sd: 0.03, note: 'h² 높음' },
  { key: 'height', name: '간장', mean: 0.65, sd: 0.03 },
  { key: 'tgw', name: '천립중', mean: 0.61, sd: 0.04 },
  { key: 'blast', name: '도열병 저항성', mean: 0.47, sd: 0.05 },
  { key: 'taste', name: '밥맛(식미치)', mean: 0.38, sd: 0.06, note: 'h² 낮음' },
]

export const CV_FOLDS = 5
export const CV_ROUNDS = 10
export const CV_REPS = CV_FOLDS * CV_ROUNDS
export const GS_MODEL = 'GBLUP'

// 형질마다 50개의 표준화 점수를 모듈 최상위에서 한 번 만든다.
const rng = createRng(SEED)
const Z: Record<string, number[]> = Object.fromEntries(
  TRAITS.map(t => {
    const raw = Array.from({ length: CV_REPS }, () => rng.normal(0, 1))
    const m = mean(raw)
    const s = sd(raw)
    return [t.key, raw.map(z => (z - m) / s)]
  }),
)

export interface TraitAccuracy {
  key: string
  name: string
  mean: number
  sd: number
  folds: number[]
  min: number
  max: number
  isYield: boolean
}

/** 종료 연도의 형질별 예측 정확도. GS 도입 전 연도는 빈 배열 */
export function traitAccuracy(y: Year): TraitAccuracy[] {
  if (y < GS_START) return []
  return TRAITS.map(t => {
    const m = t.mean ?? R[y]
    const folds = Z[t.key].map(z => clamp(m + t.sd * z, 0, 1))
    return { key: t.key, name: t.name, mean: m, sd: t.sd, folds, min: Math.min(...folds), max: Math.max(...folds), isYield: t.mean === null }
  })
}

// ---------------- KPI·경보 ----------------

export type KpiKey = 'dg' | 'r' | 'l' | 'apps' | 'met'

export interface AlertItem {
  key: KpiKey
  label: string
  achievement: number
  severity: Exclude<Severity, 'ok'>
  cause: string
  /** 등급 판정에 쓴 달성률(연중 출원은 연말 전망). 없으면 achievement */
  gradeBasis?: number
}

/** 종료 연도의 5개 지표 달성률 */
export function achievements(y: Year): Record<KpiKey, number> {
  return {
    dg: achHigher(dG(y), dGTarget(y)),
    r: achHigher(R[y], R_T[y]),
    l: achLower(L[y], L_T[y]),
    apps: achHigher(APPS[y], APP_TARGET[y]),
    met: achHigher(PIPELINE[y][MET_INDEX], MET_TARGET[y]),
  }
}

const f = (v: number, d: number) => v.toFixed(d)

/** 달성률 100% 미만 지표만, 달성률 오름차순 */
export function buildAlerts(y: Year): AlertItem[] {
  const a = achievements(y)
  const provisional = y === PROVISIONAL_YEAR
  // 등급은 마지막 map에서 gradeBasis(없으면 achievement)로 한 번만 정한다
  const items: Omit<AlertItem, 'severity'>[] = []

  // 신품종 출원
  {
    let cause = `${APPS[y]}/${APP_TARGET[y]}건${provisional ? '(연중)' : ''}.`
    const pending = appsPending(y)
    if (pending > 0) {
      cause += ` 연말 전망 ${APPS[y] + pending}/${APP_TARGET[y]}건(${f(appsForecastAch(y), 1)}%, ${PLANNED_APPLICATION.month}월 ${PLANNED_APPLICATION.line} 출원 예정 포함)`
    }
    // 등급은 연말 전망(확정 연도는 실적과 같음), 표시 달성률·정렬은 실적
    items.push({ key: 'apps', label: '신품종 출원', achievement: a.apps, cause, gradeBasis: appsForecastAch(y) })
  }
  // MET 완료(그해 완료 세트)
  {
    const met = PIPELINE[y][MET_INDEX]
    const cp = metCohortPass(y)
    const cause = cp
      ? `${met}/${MET_TARGET[y]}계통(그해 완료 세트). ${cp.aytYear} 생산력 검정(AYT) ${cp.ayt}계통 중 ${f(cp.pct, 1)}%(목표 ${f(cp.targetPct, 1)}%)`
      : `${met}/${MET_TARGET[y]}계통(그해 완료 세트)`
    items.push({ key: 'met', label: '지역 적응 시험 완료', achievement: a.met, cause })
  }
  // ΔG
  {
    const causes: string[] = []
    if (a.r < 100) causes.push(accuracyLabel(y))
    if (achHigher(I[y], I_T[y]) < 100) causes.push('선발 강도')
    if (a.l < 100) causes.push('세대 간격')
    const tail = causes.length ? ` 원인: ${causes.join('·')} 목표 미달` : ''
    items.push({ key: 'dg', label: '연간 유전적 개량량', achievement: a.dg, cause: `${f(dGpct(y), 2)}/${f(dGTargetPct(y), 2)}%/년.${tail}` })
  }
  items.push({ key: 'l', label: '세대 간격', achievement: a.l, cause: `${f(L[y], 1)}년(목표 ${f(L_T[y], 1)}년)` })
  items.push({ key: 'r', label: accuracyLabel(y), achievement: a.r, cause: `${f(R[y], 2)}(목표 ${f(R_T[y], 2)})` })

  return items
    .map(it => ({ ...it, severity: severity(it.gradeBasis ?? it.achievement) }))
    .filter((it): it is AlertItem => it.severity !== 'ok')
    .sort((p, q) => p.achievement - q.achievement)
}

// ───────── DEV 검산(정리 회차 2: 실현 배율 표기) ─────────
if (import.meta.env.DEV) {
  console.assert(REALIZED_RATIO.toFixed(1) === '2.6', `[검산] [program-overview] 실현 배율 ${REALIZED_RATIO.toFixed(3)} ≠ 2.6`)

  // 정리 회차 4(A2 MET 세트 정의, B1 연중 KPI 판정)
  const a26 = buildAlerts(2026)
  const a25 = buildAlerts(2025)
  const met26 = a26.find(a => a.key === 'met')
  const met25 = a25.find(a => a.key === 'met')
  const apps26 = a26.find(a => a.key === 'apps')
  console.assert(!!met26?.cause.includes('47.4%(목표 65.8%)'), `[검산] [program-overview] 2026 MET 경보 원인 "${met26?.cause}"에 47.4%(목표 65.8%) 없음`)
  console.assert(!!met25?.cause.includes('58.3%(목표 69.4%)'), `[검산] [program-overview] 2025 MET 경보 원인 "${met25?.cause}"에 58.3%(목표 69.4%) 없음`)
  console.assert(a26.map(a => a.key).join() === 'apps,met,dg,l,r', `[검산] [program-overview] 2026 경보 순서 ${a26.map(a => a.key).join()} ≠ apps,met,dg,l,r`)
  console.assert(a26.map(a => a.severity).join() === 'critical,critical,warning,warning,warning', `[검산] [program-overview] 2026 경보 등급 ${a26.map(a => a.severity).join()}`)
  console.assert(appsForecastAch(2026).toFixed(1) === '66.7', `[검산] [program-overview] 2026 출원 연말 전망 ${appsForecastAch(2026).toFixed(3)} ≠ 66.7`)
  console.assert(apps26?.severity === 'critical' && Math.abs((apps26?.achievement ?? 0) - 33.33) < 0.01, `[검산] [program-overview] 2026 출원 경보 ${apps26?.severity} ${apps26?.achievement}`)
  console.assert(!a25.some(a => a.key === 'apps'), '[검산] [program-overview] 2025 경보에 출원이 있음')
  console.assert(PIPELINE[2026][MET_INDEX] + (MET_FIRST_YEAR_SET[2026] ?? 0) === 38, '[검산] [program-overview] 2026 MET 포장 계통 ≠ 38')
}
