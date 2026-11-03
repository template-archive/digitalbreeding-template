/**
 * 육종 파이프라인 계통 흐름 — 목업 데이터.
 * 명세: docs/specs/breeding-pipeline-flow.md · 기준일 2026-10-23 · 시드 20261023
 * 공유 숫자(파이프라인·별하랑·2026 MET·출원)는 program-baseline과 program-overview·met-gxe-stability·variety-profile을 따른다.
 * 실제 API로 바꿀 때는 이 파일의 상수·함수만 교체한다.
 */
import { createRng } from '@/lib/rng'
import { formatFixed, formatNumber } from '@/lib/format'

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const CURRENT_YEAR = 2026

// ---------------- 연간 파이프라인(program-overview에서 복제) ----------------

/** 연도별 단계 계통 수. 순서 = ① 세대 진전 후보, ② GS 1차, ③ PYT, ④ AYT, ⑤ MET(그해 완료 세트, program-baseline 「MET 세트 정의」), ⑥ 출원 후보 (출처: program-overview PIPELINE) */
export const PIPELINE: Record<number, number[]> = {
  2019: [1500, 300, 90, 30, 15, 2],
  2020: [1500, 320, 90, 30, 16, 2],
  2021: [1600, 330, 95, 32, 17, 1],
  2022: [1800, 480, 100, 34, 18, 2],
  2023: [1900, 540, 110, 36, 20, 3],
  2024: [2000, 580, 115, 38, 22, 2],
  2025: [2000, 600, 120, 40, 21, 3],
  2026: [2000, 600, 120, 40, 18, 3],
}
/** 2026 단계 목표(출처: program-overview PIPELINE_TARGET_2026) */
export const PIPELINE_TARGET_2026 = [2000, 600, 120, 40, 25, 3]
export const PRE_GS_YEAR = 2019
export const GS_START = 2022
export const COHORTS = [2022, 2023, 2024, 2025, 2026] as const
export type Cohort = (typeof COHORTS)[number]
export const DEFAULT_COHORT: Cohort = 2022
/** 2024 코호트 MET 1년차 세트(2026~2027) 계통 수. 2026 포장 계통 = 완료 세트 PIPELINE[2026][4] + 이 값 = 38 (program-baseline 「MET 세트 정의」) */
export const MET_Y1_2024 = 20
/** 2026 품종 출원(baseline): 별하랑 06-09 출원 1건, 12월 YR19-0118 예정, 목표 3건 */
export const APPS_2026 = { filed: 1, target: 3, planned: { line: 'YR19-0118', month: 12 } }
/** 2026 AYT → 2027 MET 진급 심사회의(출처: advancement-decision REVIEW_MEETING, program-baseline 「진급 심의 일정」) */
export const REVIEW_2027_MET = '2026-11-06'
/** 2027 MET 진급 목표 계통 수(출처: advancement-decision) */
export const MET_2027_TARGET = 18
export const FILED_2026 = { name: '별하랑', line: 'YR19-0083', date: '2026-06-09' }
export const CHECK_VARIETY = '가람솔'

export const MET_INDEX = 4

export interface AnnualStage {
  no: string
  name: string
  short: string
}
/** 연간 단계(C·K·J 참고 행) */
export const ANNUAL_STAGES: AnnualStage[] = [
  { no: '①', name: '세대 진전 후보 계통', short: '세대 진전 후보' },
  { no: '②', name: '계통 선발(GS 1차)', short: 'GS 1차' },
  { no: '③', name: '예비 생산력 검정(PYT)', short: 'PYT' },
  { no: '④', name: '생산력 검정(AYT)', short: 'AYT' },
  { no: '⑤', name: '지역 적응 시험(MET)', short: 'MET' },
  { no: '⑥', name: '품종 출원 후보', short: '출원 후보' },
]

/** 횡단 통과율 100·N_Y[k]/N_Y[k−1] (같은 해 단계 수 비). 첫 단계는 null */
export const passRates = (y: number): (number | null)[] => PIPELINE[y].map((n, i) => (i === 0 ? null : (n / PIPELINE[y][i - 1]) * 100))
/** 시험 계통 = PYT + AYT + MET */
export const trialLines = (y: number) => PIPELINE[y][2] + PIPELINE[y][3] + PIPELINE[y][4]
/** 후보 대비 출원 후보(%) */
export const candidateShare = (y: number) => (PIPELINE[y][5] / PIPELINE[y][0]) * 100
export const metAchievement = () => (PIPELINE[CURRENT_YEAR][MET_INDEX] / PIPELINE_TARGET_2026[MET_INDEX]) * 100
export const appsAchievement = () => (APPS_2026.filed / APPS_2026.target) * 100

export type Severity = 'critical' | 'warning' | 'ok'
/** 일반 등급 규칙(program-overview와 같음): < 90% 경보, 90~100% 주의 */
export const severity = (a: number): Severity => (a < 90 ? 'critical' : a < 100 ? 'warning' : 'ok')
export const SEVERITY_LABEL: Record<Severity, string> = { critical: '경보', warning: '주의', ok: '달성' }
/**
 * 연중 누계형 KPI의 연말 전망 달성률(%) = (실적 + 그해 안 확정 예정) / 목표 × 100.
 * program-baseline 「연중 연도 KPI 판정」: 등급만 이 값으로 정하고 표시 달성률은 실적. program-overview와 같은 식이다.
 */
export const forecastAchievement = (actual: number, pending: number, target: number) => ((actual + pending) / target) * 100
/** 2026 안에 확정될 출원 예정 건수(planned가 있을 때만 1) */
export const appsPending = () => (APPS_2026.planned ? 1 : 0)
/** 2026 출원 연말 전망 달성률(%) */
export const appsForecast = () => forecastAchievement(APPS_2026.filed, appsPending(), APPS_2026.target)
/** "연말 전망 2/3건" */
export const appsForecastLabel = () => `연말 전망 ${APPS_2026.filed + appsPending()}/${APPS_2026.target}건`

// ---------------- 코호트(GS 1차 연도 G) ----------------

export interface CohortStage {
  /** 0..6 */
  k: number
  no: string
  /** 짧은 이름(생키 라벨) */
  short: string
  /** 긴 이름(툴팁·카드) */
  name: string
  /** 연도 표기: "2022", "2024~25" */
  yearLabel: string
}

const STAGE_NO = ['①', '②', '③', '④', '⑤', '⑥', '⑦']

/** 코호트 G의 단계 정의(디지털 공정 연차: GS 1차·PYT = G, AYT = G+1, MET = G+2~G+3, 출원 후보 = G+3 말, 출원 = G+4) */
export function cohortStages(G: number): CohortStage[] {
  const yy = (y: number) => String(y).slice(2)
  const metYear = `${G + 2}~${yy(G + 3)}` // 2024 코호트(1년차 진행 중)도 닫힌 범위 2026~27
  return [
    { k: 0, no: STAGE_NO[0], short: '후보', name: '세대 진전 후보 계통', yearLabel: String(G) },
    { k: 1, no: STAGE_NO[1], short: 'GS 1차', name: '계통 선발(GS 1차)', yearLabel: String(G) },
    { k: 2, no: STAGE_NO[2], short: 'PYT', name: '예비 생산력 검정(PYT)', yearLabel: String(G) },
    { k: 3, no: STAGE_NO[3], short: 'AYT', name: '생산력 검정(AYT)', yearLabel: String(G + 1) },
    { k: 4, no: STAGE_NO[4], short: G === 2024 ? 'MET 1년차' : 'MET', name: G === 2024 ? '지역 적응 시험(MET) 1년차' : '지역 적응 시험(MET, 2년)', yearLabel: metYear },
    { k: 5, no: STAGE_NO[5], short: '출원 후보', name: '품종 출원 후보', yearLabel: String(G + 3) },
    { k: 6, no: STAGE_NO[6], short: G === 2023 ? '출원 예정' : '출원', name: G === 2023 ? '품종 출원 예정' : '품종 출원', yearLabel: String(G + 4) },
  ]
}

/** 코호트 단계 수(명세 의사코드 그대로) */
export function cohortCounts(G: number): number[] {
  const c = [PIPELINE[G][0], PIPELINE[G][1], PIPELINE[G][2]] // ① 후보 G, ② GS 1차 G, ③ PYT G
  if (PIPELINE[G + 1]) c.push(PIPELINE[G + 1][3]) // ④ AYT G+1
  if (G === 2024) c.push(MET_Y1_2024) // ⑤ MET 1년차(진행 중)
  else if (PIPELINE[G + 3]) c.push(PIPELINE[G + 3][4], PIPELINE[G + 3][5]) // ⑤ MET G+2~G+3, ⑥ 출원 후보 G+3
  if (G === 2022) c.push(1) // ⑦ 출원: 별하랑 2026-06-09
  if (G === 2023) c.push(1) // ⑦ 출원 예정: YR19-0118 2026-12 (나머지 2 = 검토 중, 탈락 아님)
  return c
}

/** 끝난 전환 수(T1..Tn). 2023은 T6가 끝나지 않음 */
export const DONE_TRANSITIONS: Record<Cohort, number> = { 2022: 6, 2023: 5, 2024: 4, 2025: 3, 2026: 2 }

export type PendingKind = 'pending' | 'info'
export interface PendingNode {
  kind: PendingKind
  value: number
  label: string
  /** 툴팁 보조(예정 일자) */
  detail: string
}

/** 마지막으로 확정된 단계 뒤의 대기·진행 노드(생키 마지막 열) */
export const PENDING: Record<Cohort, PendingNode[]> = {
  2022: [],
  2023: [
    { kind: 'info', value: 1, label: `출원 예정 1 · ${APPS_2026.planned.line}(${CURRENT_YEAR}-${APPS_2026.planned.month})`, detail: `${APPS_2026.planned.line} 품종보호 출원 예정 ${CURRENT_YEAR}년 ${APPS_2026.planned.month}월` },
    { kind: 'pending', value: 2, label: '2027 출원 검토 2', detail: 'YR20-0342(남부 메가 환경)·YR20-0527(철원 메가 환경) — 2027 출원 검토, 탈락 아님' },
  ],
  2024: [{ kind: 'pending', value: MET_Y1_2024, label: `진행 중 · 2027 종료 · ${MET_Y1_2024}`, detail: 'MET 1년차(2026~2027) 진행 중, 2027년 가을 2년차 종료 후 출원 후보 선정' }],
  2025: [{ kind: 'pending', value: PIPELINE[2026][3], label: `진급 심의 대기(${REVIEW_2027_MET.slice(5)}) · ${PIPELINE[2026][3]}`, detail: `AYT ${CURRENT_YEAR} 성적으로 ${REVIEW_2027_MET} 진급 심사회의 예정(${CURRENT_YEAR + 1} MET 목표 ${MET_2027_TARGET}계통)` }],
  2026: [{ kind: 'pending', value: PIPELINE[2026][2], label: `진급 심의 대기(12월) · ${PIPELINE[2026][2]}`, detail: `PYT ${CURRENT_YEAR} 성적으로 ${CURRENT_YEAR}년 12월 진급 심의 예정` }],
}

/** 코호트 상태 문구(D 버튼 옆, J 현재 단계) */
export const COHORT_STATUS: Record<Cohort, string> = {
  2022: '출원 완료',
  2023: '출원 후보 선정',
  2024: 'MET 1년차',
  2025: 'AYT 완료·심의 대기',
  2026: 'PYT 완료·심의 대기',
}

/** 마지막으로 확정된 단계 인덱스(생키에 그리는 마지막 단계 노드) */
export const lastStageIndex = (G: Cohort) => (G === 2023 ? 5 : cohortCounts(G).length - 1)

// ---------------- 전환과 탈락 사유 ----------------

export const REASONS = ['yield', 'blast', 'heading', 'quality', 'lodging', 'stability', 'other'] as const
export type Reason = (typeof REASONS)[number]
export const REASON_LABEL: Record<Reason, string> = {
  yield: '수량 미달',
  blast: '도열병',
  heading: '출수기 부적합',
  quality: '품질(밥맛·외관)',
  lodging: '도복·간장',
  stability: '지역 안정성 부족',
  other: '기타(종자량·포장 사고)',
}
/** 좁은 화면·상위 사유 텍스트용 짧은 라벨 */
export const REASON_SHORT: Record<Reason, string> = {
  yield: '수량 미달',
  blast: '도열병',
  heading: '출수기',
  quality: '품질',
  lodging: '도복',
  stability: '안정성',
  other: '기타',
}
export const REASON_DESC: Record<Reason, string> = {
  yield: 'GS 단계: 수량 GEBV 하위 / 포장: 대비 품종 대비 쌀 수량 열세 / MET: 지수 < 103.0%',
  blast: '저항성 유전자(Pi-ta·Pib·Pi9 등) 미보유 또는 포장 발병 지수 높음',
  heading: '중부 평야지 적정 출수(파종 후 110~122일) 밖',
  quality: '밥맛(식미치) GEBV 하위 또는 관능·외관 미달',
  lodging: '간장 과다·도복',
  stability: 'MET 전용: Wricke 생태가 W > 5.0%이고 메가 환경 승자가 아님(다환경 시험 GxE·안정성 화면 규칙)',
  other: '종자량 부족, 시험구 사고',
}

export type TKey = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6'
export interface TransitionDef {
  key: TKey
  /** 이전 단계 인덱스(0..5) */
  from: number
  label: string
  /** 판정 근거 */
  basis: string
}
export const TRANSITIONS: TransitionDef[] = [
  { key: 'T1', from: 0, label: '① → ② GS 1차 선발', basis: 'GEBV·마커(6K 칩)' },
  { key: 'T2', from: 1, label: '② → ③ PYT 편성', basis: 'GEBV·마커·종자량' },
  { key: 'T3', from: 2, label: '③ → ④ PYT → AYT', basis: 'PYT 포장' },
  { key: 'T4', from: 3, label: '④ → ⑤ AYT → MET', basis: 'AYT 포장' },
  { key: 'T5', from: 4, label: '⑤ → ⑥ MET → 출원 후보', basis: 'MET 규칙' },
  { key: 'T6', from: 5, label: '⑥ → 출원', basis: '품종 선정 심의' },
]

export type Alloc = Partial<Record<Reason, number>>

const BASE: Record<'T1' | 'T2' | 'T3' | 'T4', Record<Reason, number>> = {
  T1: { yield: 0.56, blast: 0.12, heading: 0.14, quality: 0.12, lodging: 0.06, stability: 0, other: 0 }, // GEBV·마커(6K 칩) 근거
  T2: { yield: 0.38, blast: 0.18, heading: 0.16, quality: 0.14, lodging: 0.06, stability: 0, other: 0.08 }, // GEBV·마커·종자량
  T3: { yield: 0.46, blast: 0.16, heading: 0.12, quality: 0.12, lodging: 0.09, stability: 0, other: 0.05 }, // PYT 포장
  T4: { yield: 0.44, blast: 0.14, heading: 0.08, quality: 0.22, lodging: 0.08, stability: 0, other: 0.04 }, // AYT 포장
}

/** T5·T6 고정값(met-gxe 판정 규칙·품종 선정 심의 결과) */
const FIXED: Partial<Record<Cohort, Partial<Record<TKey, Alloc>>>> = {
  2022: { T5: { yield: 14, stability: 2, quality: 1, blast: 1 }, T6: { quality: 1, blast: 1 } },
  2023: { T5: { yield: 14, stability: 1 } },
}

/** 최대 나머지법: q_r = total·w_r/Σw, floor 후 남은 수를 나머지 큰 순(같으면 REASONS 순서)으로 1씩 */
function hamilton(total: number, w: Alloc): Alloc {
  const keys = REASONS.filter(r => (w[r] ?? 0) > 0)
  const sum = keys.reduce((s, k) => s + (w[k] as number), 0)
  const raw = keys.map(k => ({ k, q: (total * (w[k] as number)) / sum }))
  const out: Alloc = {}
  let used = 0
  for (const r of raw) {
    out[r.k] = Math.floor(r.q)
    used += Math.floor(r.q)
  }
  raw
    .map(r => ({ ...r, rem: r.q - Math.floor(r.q) }))
    .sort((a, b) => b.rem - a.rem || keys.indexOf(a.k) - keys.indexOf(b.k))
    .slice(0, total - used)
    .forEach(r => {
      out[r.k] = (out[r.k] as number) + 1
    })
  return out
}

const rng = createRng(SEED)
const GS_DONE: Record<Cohort, number> = { 2022: 4, 2023: 4, 2024: 4, 2025: 3, 2026: 2 } // T1~T4 중 끝난 수

/** 코호트별 끝난 전환의 탈락 사유 배분 */
export const DROPS: Record<Cohort, Partial<Record<TKey, Alloc>>> = (() => {
  const out = {} as Record<Cohort, Partial<Record<TKey, Alloc>>>
  for (const G of COHORTS) {
    const c = cohortCounts(G)
    out[G] = {}
    for (let t = 1; t <= GS_DONE[G]; t++) {
      const key = `T${t}` as 'T1' | 'T2' | 'T3' | 'T4'
      const D = c[t - 1] - c[t]
      const w: Alloc = {}
      for (const r of REASONS) {
        const b = BASE[key][r]
        if (b > 0) w[r] = b * Math.exp(0.2 * rng.normal()) // b = 0이면 난수를 뽑지 않음
      }
      out[G][key] = hamilton(D, w)
    }
    const fixed = FIXED[G]
    if (fixed) for (const [k, v] of Object.entries(fixed)) out[G][k as TKey] = v
  }
  return out
})()

export const allocTotal = (a: Alloc) => REASONS.reduce((s, r) => s + (a[r] ?? 0), 0)

/** 사유를 많은 순(같으면 REASONS 순)으로 */
export function sortedReasons(a: Alloc): { r: Reason; n: number }[] {
  return REASONS.filter(r => (a[r] ?? 0) > 0)
    .map(r => ({ r, n: a[r] as number }))
    .sort((x, y) => y.n - x.n || REASONS.indexOf(x.r) - REASONS.indexOf(y.r))
}

export interface CohortTransition extends TransitionDef {
  /** 전환 번호 1..6 */
  t: number
  prev: number
  /** 다음 단계 수(끝나지 않았으면 null) */
  next: number | null
  done: boolean
  /** 진행 중(2024 MET) vs 심의 대기 */
  pendingLabel: '진행 중' | '대기' | null
  drop: number | null
  alloc: Alloc | null
  rate: number | null
}

/** 코호트의 전환 T1..T6 상태 */
export function cohortTransitions(G: Cohort): CohortTransition[] {
  const c = cohortCounts(G)
  const done = DONE_TRANSITIONS[G]
  const last = lastStageIndex(G)
  return TRANSITIONS.map((d, i) => {
    const t = i + 1
    const isDone = t <= done
    const prev = c[d.from]
    const next = isDone ? c[d.from + 1] : null
    // 끝나지 않은 첫 전환만 상태가 있다(그 뒤 전환은 아직 시작 전)
    let pendingLabel: CohortTransition['pendingLabel'] = null
    if (!isDone && d.from === last) pendingLabel = G === 2024 ? '진행 중' : '대기'
    const alloc = isDone ? (DROPS[G][d.key] ?? null) : null
    return {
      ...d,
      t,
      prev: prev ?? 0,
      next,
      done: isDone,
      pendingLabel,
      drop: isDone && next !== null ? prev - next : null,
      alloc,
      rate: isDone && next !== null ? (next / prev) * 100 : null,
    }
  })
}

/** 누적 생존율(%) = C_G[k] / C_G[①] */
export const survival = (G: Cohort, k: number) => (cohortCounts(G)[k] / cohortCounts(G)[0]) * 100

// ---------------- 연차 띠(E) ----------------

export interface YearCell {
  year: number
  label: string
  future: boolean
  current: boolean
}
export function cohortYears(G: Cohort): YearCell[] {
  const labels = [
    'GS 1차·PYT',
    'AYT',
    'MET 1년차',
    'MET 2년차·출원 후보 선정',
    G === 2022 ? `출원(${FILED_2026.date.slice(5)})` : '출원',
  ]
  return labels.map((label, i) => ({ year: G + i, label, future: G + i > CURRENT_YEAR, current: G + i === CURRENT_YEAR }))
}

// ---------------- 출원 후보 표(I) ----------------

export interface CandidateRow {
  line: string
  name?: string
  /** MET 2년 평균 쌀 수량(kg/10a, 백미) */
  yieldKg: number | null
  /** 가람솔 대비 지수(%) */
  index: number | null
  result: string
  tone: 'positive' | 'info' | 'neutral' | 'warning'
  reference?: boolean
}

// 별하랑·가람솔 MET 2024·2025(variety-profile)
const BYEOLHARANG_MET = [598, 612]
const GARAMSOL_MET = [552, 568]
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
export const BYEOLHARANG_YIELD = mean(BYEOLHARANG_MET)
export const GARAMSOL_YIELD = mean(GARAMSOL_MET)
export const BYEOLHARANG_INDEX = (BYEOLHARANG_YIELD / GARAMSOL_YIELD) * 100
/** met-gxe-stability 원 실행값 */
export const YR20_0815_W = 11.7048

export const CANDIDATES: Partial<Record<Cohort, CandidateRow[]>> = {
  2022: [
    { line: FILED_2026.line, name: FILED_2026.name, yieldKg: BYEOLHARANG_YIELD, index: BYEOLHARANG_INDEX, result: `출원 ${FILED_2026.date}`, tone: 'positive' },
    { line: 'YR18-0742', yieldKg: null, index: null, result: '선정 제외 · 품질(밥맛)', tone: 'warning' },
    { line: 'YR19-0611', yieldKg: null, index: null, result: `선정 제외 · ${REASON_LABEL.blast}(MET 발병)`, tone: 'warning' },
  ],
  2023: [
    { line: 'YR19-0118', yieldKg: 596.7563, index: 106.564, result: `출원 예정 ${CURRENT_YEAR}-${APPS_2026.planned.month}`, tone: 'info' },
    { line: 'YR20-0342', yieldKg: 587.0188, index: 104.8252, result: '2027 출원 검토(남부 메가 환경)', tone: 'neutral' },
    { line: 'YR20-0527', yieldKg: 579.7, index: 103.5182, result: '2027 출원 검토(철원 메가 환경)', tone: 'neutral' },
    { line: 'YR20-0815', yieldKg: 578.9833, index: 103.3903, result: `비선발 · 지역 안정성(W ${formatFixed(YR20_0815_W, 1)}%)`, tone: 'warning', reference: true },
  ],
}

// ---------------- 공통 표기 ----------------

export const int = (v: number) => formatNumber(v, { digits: 0 })
export const pct1 = (v: number) => `${formatFixed(v, 1)}%`
/** 누적 생존율 표기: 1% 미만은 3자리, 그 외 2자리 */
export const pctSurv = (v: number) => `${formatFixed(v, v < 1 ? 3 : 2)}%`

/** 생키 aria 문장: "2022 GS 1차 코호트: 후보 1,800 → GS 1차 480 → … → 출원 1(별하랑)" */
export function flowSentence(G: Cohort): string {
  const st = cohortStages(G)
  const c = cohortCounts(G)
  const last = lastStageIndex(G)
  const parts = c.slice(0, last + 1).map((n, k) => `${st[k].short} ${int(n)}${G === 2022 && k === 6 ? `(${FILED_2026.name})` : ''}`)
  const pend = PENDING[G].map(p => p.label).join(', ')
  return `${G} GS 1차 코호트: ${parts.join(' → ')}${pend ? `. 진행·대기: ${pend}` : ''}.`
}

/** K 결론 문장(상수에서 생성) */
export function gsConclusion(): string {
  const a = passRates(PRE_GS_YEAR)
  const b = passRates(CURRENT_YEAR)
  return (
    `GS 도입 후 계통 선발에서 더 남기고(${formatFixed(a[1] as number, 1)} → ${formatFixed(b[1] as number, 1)}%) ` +
    `PYT 편성에서 더 거릅니다(${formatFixed(a[2] as number, 1)} → ${formatFixed(b[2] as number, 1)}%). ` +
    `후보 대비 출원 후보 ${formatFixed(candidateShare(PRE_GS_YEAR), 3)}% → ${formatFixed(candidateShare(CURRENT_YEAR), 3)}%, ` +
    `시험 계통 ${trialLines(PRE_GS_YEAR)} → ${trialLines(CURRENT_YEAR)}.`
  )
}

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  for (const G of COHORTS) {
    for (const tr of cohortTransitions(G)) {
      if (tr.done && tr.alloc) console.assert(allocTotal(tr.alloc) === tr.drop, `[검산] ${G} ${tr.key} 사유 합 ${allocTotal(tr.alloc)} ≠ 탈락 ${tr.drop}`)
    }
  }
  console.assert(cohortCounts(2026).slice(0, 3).join() === PIPELINE[2026].slice(0, 3).join(), '[검산] cohortCounts(2026) 앞 3개 ≠ PIPELINE[2026]')
  console.assert(cohortCounts(2022).join() === '1800,480,100,36,21,3,1', `[검산] 2022 코호트 단계 수 ${cohortCounts(2022).join()}`)
  console.assert(cohortCounts(2023)[4] === 18, '[검산] 2023 ⑤ MET ≠ 18(met-gxe 시험 계통 수)')
  const t1 = DROPS[2022].T1 ?? {}
  console.assert([t1.yield, t1.blast, t1.heading, t1.quality, t1.lodging].join() === '816,102,186,152,64', `[검산] 2022 T1 사유 ${JSON.stringify(t1)}`)
  const d22 = cohortTransitions(2022).map(t => t.drop).join()
  console.assert(d22 === '1320,380,64,15,18,2', `[검산] 2022 탈락 수 ${d22}`)
  const r22 = cohortTransitions(2022).map(t => formatFixed(t.rate ?? 0, 1)).join('·')
  console.assert(r22 === '26.7·20.8·36.0·58.3·14.3·33.3', `[검산] 2022 진급률 ${r22}`)
  const pr26 = passRates(2026).slice(1).map(v => formatFixed(v as number, 1)).join('·')
  console.assert(pr26 === '30.0·20.0·33.3·45.0·16.7', `[검산] 2026 횡단 통과율 ${pr26}`)
  const pr19 = passRates(2019).slice(1).map(v => formatFixed(v as number, 1)).join('·')
  console.assert(pr19 === '20.0·30.0·33.3·50.0·13.3', `[검산] 2019 횡단 통과율 ${pr19}`)
  console.assert(formatFixed(metAchievement(), 1) === '72.0', '[검산] MET 달성률 ≠ 72.0')
  console.assert(trialLines(2026) === 178 && trialLines(2025) === 181 && trialLines(2019) === 135, '[검산] 시험 계통 178/181/135')
  console.assert(formatFixed(BYEOLHARANG_INDEX, 1) === '108.0' && BYEOLHARANG_YIELD === 605, '[검산] 별하랑 605 kg/10a · 108.0%')
  console.assert(formatFixed(candidateShare(2019), 3) === '0.133' && formatFixed(candidateShare(2026), 3) === '0.150', '[검산] 후보 대비 출원 후보')
  const r23 = cohortTransitions(2023)[3].rate ?? 0
  console.assert(formatFixed(r23, 1) === '47.4', `[검산] 2023 AYT→MET 진급률 ${r23}`)
  const t6 = DROPS[2022].T6 ?? {}
  console.assert(t6.quality === 1 && t6.blast === 1 && !t6.heading, `[검산] 2022 T6 선정 제외 = 품질 1 · 도열병 1 (${JSON.stringify(t6)})`)
  const met24 = cohortStages(2024)[4]
  console.assert(`${met24.no} ${met24.short} ${met24.yearLabel} · ${MET_Y1_2024}` === '⑤ MET 1년차 2026~27 · 20', `[검산] 2024 MET 라벨 ${met24.yearLabel}`)

  // 정리 회차 4(A2 MET 세트 정의, A3 진급 심의 날짜, B1 연중 KPI 판정)
  console.assert(PIPELINE[2026][MET_INDEX] + MET_Y1_2024 === 38, `[검산] 2026 MET 포장 계통 ${PIPELINE[2026][MET_INDEX] + MET_Y1_2024} ≠ 38`)
  console.assert(PENDING[2025][0].label === '진급 심의 대기(11-06) · 40', `[검산] 2025 대기 노드 "${PENDING[2025][0].label}"`)
  console.assert(PENDING[2026][0].label === '진급 심의 대기(12월) · 120', `[검산] 2026 대기 노드 "${PENDING[2026][0].label}"`)
  console.assert(formatFixed(appsForecast(), 1) === '66.7', `[검산] 2026 출원 연말 전망 ${appsForecast()} ≠ 66.7`)
  console.assert(severity(appsForecast()) === 'critical', `[검산] 2026 출원 등급 ${severity(appsForecast())} ≠ critical`)
}
