/**
 * 유전체 분석실 운영 현황 — 목업 데이터.
 * 명세 `docs/specs/genotyping-lab-ops.md`의 「월별 확정 데이터」「6K 플레이트별 확정 데이터」
 * 「6K 콜레이트 분포 확정 빈도」를 상수로 옮기고, 나머지는 시드 RNG 하나로 정해진 순서대로 만든다.
 * 순서가 바뀌면 화면이 바뀐다. KPI 숫자는 하드코딩하지 않고 모두 이 파일에서 계산한다.
 * 실제 API로 바꿀 때는 PLATES·FAILS·CALL_RATES_6K만 교체하면 나머지 집계가 따라온다.
 */
import { createRng } from '@/lib/rng'

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const YEAR = 2026
export const AS_OF_DAY = 23
export const ANNUAL_TARGET = 12000
export const MONTHLY_TARGET = 1000
/** 10월 진도 목표 = 1,000 × 23/31 = 741.9 */
export const OCT_PROGRESS_TARGET = (MONTHLY_TARGET * AS_OF_DAY) / 31
/** 진도 목표(10/23) = 9,000 + 741.9 = 9,741.9 → 표시 9,742 */
export const PROGRESS_TARGET = 9 * MONTHLY_TARGET + OCT_PROGRESS_TARGET
export const CALL_RATE_THRESHOLD = 95
export const HET_THRESHOLD = 10
export const NONPARENT_THRESHOLD = 2
export const PLATE_ALERT_PCT = 10
/** 지표 카탈로그 범위(%): KPI 범위 미터와 QC 패널이 같은 값을 쓴다 */
export const CATALOG_RANGE = {
  callRate: { min: 97, max: 100, lo: 98, hi: 99.5 },
  qcPass: { min: 90, max: 100, lo: 92, hi: 98 },
} as const
/** F6 잔여 이형접합 기대값 (1/2)^5 */
export const F6_EXPECTED_HET = 100 / 32

export type PlatformKey = '6K' | 'KASP' | 'GBS'
export const PLATFORM_KEYS: PlatformKey[] = ['6K', 'KASP', 'GBS']
export const TAT_TARGET: Record<PlatformKey, number> = { '6K': 14, KASP: 7, GBS: 21 }

export interface PlatformInfo {
  key: PlatformKey
  name: string
  /** 용어 첫 등장 표기 */
  fullName: string
  purpose: string
  markers: number
  markersLabel: string
  markersUsed?: number
  /** 차트 색 인덱스(palettes.categorical) */
  colorIndex: number
}

export const PLATFORMS: Record<PlatformKey, PlatformInfo> = {
  '6K': {
    key: '6K',
    name: '6K SNP 칩',
    fullName: '6K 단일 염기 다형성(SNP) 칩',
    purpose: '유전체 선발(GS) 후보 F6 계통',
    markers: 6000,
    markersLabel: '6,000(사용 4,820)',
    markersUsed: 4820,
    colorIndex: 0,
  },
  KASP: {
    key: 'KASP',
    name: 'KASP 패널',
    fullName: 'KASP(경쟁적 대립유전자 특이 PCR) 패널',
    purpose: '마커 보조 선발(MAS) F2 개체',
    markers: 16,
    markersLabel: '16',
    colorIndex: 1,
  },
  GBS: {
    key: 'GBS',
    name: 'GBS',
    fullName: '유전체 축소 표현 시퀀싱(GBS)',
    purpose: '교배 부모·훈련 집단 고밀도 보강',
    markers: 50000,
    markersLabel: '약 50,000',
    colorIndex: 2,
  },
}

/** 2025-01-01~10-23 동기(추정) */
export const PREV_YEAR = { total: 9612, callRate6K: 98.7, qcPass6K: 95.9, tat6K: 16 }

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type Month = (typeof MONTHS)[number]
/** 2026년 월별 일수, 10월은 기준일까지 23일 */
const DAYS: Record<Month, number> = { 1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: AS_OF_DAY }
export const CURRENT_MONTH: Month = 10

// ---- 확정 상수(명세 「월별 확정 데이터」) ----
const KASP_PLATES = [10, 9, 12, 11, 9, 8, 7, 8, 9, 6]
// 1월 66(6.6일)·2월 63(7.0일): 목표 7일 초과는 6K 캠페인과 겹친 4·5·6월만. 합 607 유지(QA r0 수정)
const KASP_TAT_SUM = [66, 63, 82, 87, 75, 57, 42, 45, 53, 37]
const GBS_PLATES = [
  { month: 3, tat: 19, fail: 2 },
  { month: 5, tat: 20, fail: 3 },
  { month: 7, tat: 18, fail: 2 },
  { month: 9, tat: 22, fail: 4 },
] as const
const G6K: Partial<Record<Month, { tat: number[]; fail: number[]; size?: number[] }>> = {
  4: { tat: [16, 15, 15, 14], fail: [2, 3, 1, 2] },
  5: { tat: [15, 14, 14, 13, 14, 13, 14, 15], fail: [3, 2, 17, 1, 2, 3, 2, 1] },
  6: { tat: [13, 13, 14, 12, 14, 13, 14], fail: [2, 4, 1, 3, 2, 2, 3] },
  7: { tat: [15, 14, 14], fail: [7, 5, 2], size: [94, 94, 26] },
}
/** 6K 콜레이트 1차 분석 확정 빈도: [구간 하한(%), 샘플 수] */
const CALL_RATE_BINS: [number, number][] = [
  [86.0, 2], [88.0, 3], [90.0, 4], [91.0, 4], [92.0, 5], [93.0, 7], [93.5, 8], [94.0, 7], [94.5, 8],
  [95.0, 10], [95.5, 12], [96.0, 15], [96.5, 20], [97.0, 28], [97.5, 45], [98.0, 90], [98.5, 260], [99.0, 1193], [99.5, 279],
]
export const ALERT_PLATE_KASP = 'KSP-2610-02'
export const LOW_PLATE_6K = 'G6K-2605-03'

// ---- 날짜 ----
const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const ymd = (m: number, d: number) => `${YEAR}-${pad(m)}-${pad(d)}`
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// ---- 웰 ----
/** 시료 웰 94개(A01~H10, 행 우선). H11 양성 대조, H12 음성 대조(NTC)는 제외 */
const SAMPLE_WELLS: string[] = 'ABCDEFGH'.split('').flatMap(r => Array.from({ length: 12 }, (_, i) => `${r}${pad(i + 1)}`)).slice(0, 94)

// ---- 타입 ----
export interface Plate {
  id: string
  platform: PlatformKey
  month: Month
  received: string
  resulted: string
  samples: number
  tat: number
  /** 6K·GBS 샘플 번호 시작(1부터) */
  firstSampleNo: number
}

export type ReStatus = '재분석 통과' | '폐기·대체 개체 사용' | '진행 중' | '대기' | '재채취 요청' | '재시퀀싱 대기'
export const UNRESOLVED_STATUSES: ReStatus[] = ['대기', '진행 중', '재채취 요청', '재시퀀싱 대기']
export const isUnresolved = (s: ReStatus) => UNRESOLVED_STATUSES.includes(s)

export type FailKind = 'CR' | 'HET' | 'ID' | 'KASP_DNA' | 'KASP_CLUSTER' | 'KASP_PI9' | 'GBS_READS' | 'GBS_MISSING'
export const FAIL_KIND_LABEL: Record<FailKind, string> = {
  CR: '콜레이트 미달',
  HET: '이형접합도 과다',
  ID: '계통 동일성 불일치',
  KASP_DNA: '미호출 마커 2개 이상(DNA 품질)',
  KASP_CLUSTER: '형광 군집 불명확',
  KASP_PI9: 'Pi9 마커 군집 분리 불량 · 프라이머 믹스 lot 문제',
  GBS_READS: '리드 수 부족(< 1M reads)',
  GBS_MISSING: '결측률 > 20%',
}

export interface FailSample {
  id: string
  plateId: string
  platform: PlatformKey
  well: string
  kind: FailKind
  cause: string
  /** 1차 분석 콜레이트(%). KASP는 호출 마커/16, GBS는 1 − 결측률 */
  callRate: number
  /** KASP 호출 마커 수 */
  called?: number
  /** 6K 이형접합도(%) */
  het?: number
  /** 6K 비부모 대립유전자 비율(%) */
  nonParent?: number
  action: string
  status: ReStatus
  /** 완료일(완료 상태) 또는 예정일(미해결) */
  date: string | null
  reCallRate?: number
  reCalled?: number
}

// ======================================================================
// 생성 — 단일 RNG, 명세 순서 그대로
// ======================================================================
const rng = createRng(SEED)

// 1. 플레이트 목록 -------------------------------------------------------
const resultDay = (month: Month, k: number, n: number) => Math.ceil(((k + 1) * DAYS[month]) / n)

function buildPlates(): Plate[] {
  const out: Plate[] = []
  // 6K
  let no6k = 1
  for (const m of MONTHS) {
    const g = G6K[m]
    if (!g) continue
    g.tat.forEach((tat, k) => {
      const resulted = ymd(m, resultDay(m, k, g.tat.length))
      const samples = g.size?.[k] ?? 94
      out.push({ id: `G6K-26${pad(m)}-${pad(k + 1)}`, platform: '6K', month: m, received: addDays(resulted, -tat), resulted, samples, tat, firstSampleNo: no6k })
      no6k += samples
    })
  }
  // KASP — 월마다 셔플 1회로 base+1 받을 플레이트를 고른다
  MONTHS.forEach((m, mi) => {
    const n = KASP_PLATES[mi]
    const S = KASP_TAT_SUM[mi]
    const base = Math.floor(S / n)
    const extra = S - base * n
    const order = rng.shuffle(Array.from({ length: n }, (_, i) => i))
    const plus = new Set(order.slice(0, extra))
    for (let k = 0; k < n; k++) {
      const tat = plus.has(k) ? base + 1 : base
      const resulted = ymd(m, resultDay(m, k, n))
      out.push({ id: `KSP-26${pad(m)}-${pad(k + 1)}`, platform: 'KASP', month: m, received: addDays(resulted, -tat), resulted, samples: 94, tat, firstSampleNo: 0 })
    }
  })
  // GBS
  let noGbs = 1
  for (const g of GBS_PLATES) {
    const m = g.month as Month
    const resulted = ymd(m, resultDay(m, 0, 1))
    out.push({ id: `GBS-26${pad(m)}-01`, platform: 'GBS', month: m, received: addDays(resulted, -g.tat), resulted, samples: 94, tat: g.tat, firstSampleNo: noGbs })
    noGbs += 94
  }
  return out
}

export const PLATES: Plate[] = buildPlates()
const plateById = new Map(PLATES.map(p => [p.id, p]))
export const getPlate = (id: string) => plateById.get(id) as Plate

// 2. 6K 콜레이트(2,000샘플) ---------------------------------------------
const round2 = (v: number) => Math.round(v * 100) / 100
const raw6k: number[] = []
for (const [lo, count] of CALL_RATE_BINS) {
  const mid = lo + 0.25
  for (let i = 0; i < count; i++) raw6k.push(round2(mid + (rng.next() - 0.5) * 0.4))
}
/** 1차 분석 6K 샘플 콜레이트(셔플됨). 히스토그램 C의 원자료 */
export const CALL_RATES_6K: number[] = rng.shuffle(raw6k)

// 3·4. 6K 실패 배정·재분석 -------------------------------------------------
const plates6k = PLATES.filter(p => p.platform === '6K')
const fail6kCounts = new Map<string, number>()
for (const m of MONTHS) G6K[m]?.fail.forEach((f, k) => fail6kCounts.set(`G6K-26${pad(m)}-${pad(k + 1)}`, f))

const lowSorted = CALL_RATES_6K.filter(v => v < CALL_RATE_THRESHOLD).sort((a, b) => a - b)
const lowForPlate = lowSorted.slice(0, 17)
const lowRest = lowSorted.slice(17)
const highQueue = CALL_RATES_6K.filter(v => v >= CALL_RATE_THRESHOLD)
let highPtr = 0
let lowPtr = 0

const slotKinds = rng.shuffle<FailKind>([...Array<FailKind>(31).fill('CR'), ...Array<FailKind>(14).fill('HET'), ...Array<FailKind>(8).fill('ID')])
let slotPtr = 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const fails6k: FailSample[] = []
for (const p of plates6k) {
  const n = fail6kCounts.get(p.id) ?? 0
  if (n === 0) continue
  const wells = rng.shuffle(SAMPLE_WELLS.slice(0, p.samples))
  for (let i = 0; i < n; i++) {
    const well = wells[i]
    const no = p.firstSampleNo + SAMPLE_WELLS.indexOf(well)
    const base = { id: `YR24-${pad(no, 4)}`, plateId: p.id, platform: '6K' as const, well, status: '재분석 통과' as ReStatus, date: null }
    if (p.id === LOW_PLATE_6K) {
      fails6k.push({ ...base, kind: 'CR', cause: '콜레이트 미달 · DNA 농도 부족', callRate: lowForPlate[i], het: round2(clamp(rng.normal(3.1, 1.2), 0.3, 8.5)), action: '' })
      continue
    }
    const kind = slotKinds[slotPtr++]
    if (kind === 'CR') {
      fails6k.push({ ...base, kind, cause: FAIL_KIND_LABEL.CR, callRate: lowRest[lowPtr++], het: round2(clamp(rng.normal(3.1, 1.2), 0.3, 8.5)), action: '' })
    } else if (kind === 'HET') {
      fails6k.push({ ...base, kind, cause: FAIL_KIND_LABEL.HET, callRate: highQueue[highPtr++], het: round2(12 + rng.next() * 16), action: '' })
    } else {
      const nonParent = round2(3 + rng.next() * 6)
      fails6k.push({ ...base, kind, cause: FAIL_KIND_LABEL.ID, callRate: highQueue[highPtr++], nonParent, het: round2(clamp(rng.normal(3.1, 1.2), 0.3, 8.5)), action: '' })
    }
  }
}
for (const f of fails6k) {
  const resulted = getPlate(f.plateId).resulted
  const reextract = f.kind === 'CR'
  f.action = reextract ? 'DNA 재추출 후 재분석' : '잎 재채취 후 재분석'
  f.date = addDays(resulted, reextract ? 7 : 21)
  f.reCallRate = round2(97.5 + rng.next() * 2.1)
}

// 5·6. KASP 실패·재분석 상태 ------------------------------------------------
const platesKasp = PLATES.filter(p => p.platform === 'KASP')
const otherKasp = platesKasp.filter(p => p.id !== ALERT_PLATE_KASP)
const kaspAssign = new Map<string, FailKind[]>(platesKasp.map(p => [p.id, []]))
kaspAssign.set(ALERT_PLATE_KASP, Array<FailKind>(14).fill('KASP_PI9'))
for (let i = 0; i < 187; i++) {
  const p = otherKasp[rng.int(0, otherKasp.length - 1)]
  kaspAssign.get(p.id)!.push(rng.next() < 0.8 ? 'KASP_DNA' : 'KASP_CLUSTER')
}
const failsKasp: FailSample[] = []
for (const p of platesKasp) {
  const kinds = kaspAssign.get(p.id)!
  if (kinds.length === 0) continue
  const wells = rng.shuffle(SAMPLE_WELLS)
  kinds.forEach((kind, i) => {
    const comb = rng.int(1, 400)
    const indiv = rng.int(1, 200)
    // RNG 소비 순서를 유지하려고 항상 뽑는다. Pi9 단일 마커 실패는 15/16 호출(MAS 대상 유전자 마커 미호출 = 1개라도 실패)
    const drawn = rng.int(9, 14)
    const called = kind === 'KASP_PI9' ? 15 : drawn
    failsKasp.push({
      id: `YR25-F2-${pad(comb, 4)}-${pad(indiv, 3)}`,
      plateId: p.id,
      platform: 'KASP',
      well: wells[i],
      kind,
      cause: FAIL_KIND_LABEL[kind],
      callRate: (called / 16) * 100,
      called,
      action: '',
      status: '대기',
      date: null,
    })
  })
}
const OCT_RULES: Record<string, ReStatus | 'rule'> = {
  'KSP-2610-01': 'rule',
  'KSP-2610-02': '진행 중',
  'KSP-2610-03': '진행 중',
  'KSP-2610-04': '대기',
  'KSP-2610-05': '대기',
  'KSP-2610-06': '대기',
}
/** 다음 재분석 배치일(가정) */
export const NEXT_RERUN_BATCH = '2026-10-30'
export const KASP_RERUN_DUE = '2026-10-27'
for (const f of failsKasp) {
  const p = getPlate(f.plateId)
  const rule = p.resulted <= '2026-09-30' ? 'rule' : OCT_RULES[p.id]
  if (rule === 'rule') {
    if (rng.next() < 0.55) {
      f.status = '재분석 통과'
      f.action = 'DNA 재추출 후 재분석'
      f.date = addDays(p.resulted, 7)
    } else {
      f.status = '폐기·대체 개체 사용'
      f.action = '형제 개체로 대체'
      f.date = addDays(p.resulted, 3)
    }
  } else if (rule === '진행 중') {
    f.status = '진행 중'
    f.action = p.id === ALERT_PLATE_KASP ? '프라이머 믹스 lot 교체 후 재분석' : 'DNA 재추출 후 재분석'
    f.date = KASP_RERUN_DUE
  } else {
    f.status = '대기'
    f.action = '재분석 대기열 등록'
    f.date = NEXT_RERUN_BATCH
  }
}

// 7. GBS 실패 -------------------------------------------------------------
export const GBS_RESEQ_DUE = '2026-11-06'
const failsGbs: FailSample[] = []
for (const g of GBS_PLATES) {
  const p = getPlate(`GBS-26${pad(g.month)}-01`)
  const wells = rng.shuffle(SAMPLE_WELLS)
  const pending = g.month === 9
  for (let i = 0; i < g.fail; i++) {
    const kind: FailKind = rng.next() < 0.5 ? 'GBS_READS' : 'GBS_MISSING'
    const no = p.firstSampleNo + SAMPLE_WELLS.indexOf(wells[i])
    failsGbs.push({
      id: `P-${pad(no, 3)}`,
      plateId: p.id,
      platform: 'GBS',
      well: wells[i],
      kind,
      cause: FAIL_KIND_LABEL[kind],
      callRate: 0,
      action: '라이브러리 재제작 후 재시퀀싱',
      status: pending ? '재시퀀싱 대기' : '재분석 통과',
      date: pending ? GBS_RESEQ_DUE : addDays(p.resulted, 21),
    })
  }
}

// 9. 표시용 보조 값(명세 외 추가, 위 순서 뒤에서만 RNG 사용) ---------------------
for (const f of failsKasp) {
  if (f.status === '재분석 통과') {
    f.reCalled = rng.int(15, 16)
    f.reCallRate = (f.reCalled / 16) * 100
  }
}
for (const f of failsGbs) {
  const missing = f.kind === 'GBS_MISSING' ? 20.5 + rng.next() * 12 : 12 + rng.next() * 18
  f.callRate = round2(100 - missing)
  if (f.status === '재분석 통과') f.reCallRate = round2(100 - (2 + rng.next() * 6))
}

export const FAILS: FailSample[] = [...fails6k, ...failsKasp, ...failsGbs]

// ======================================================================
// 8. 계산값
// ======================================================================
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const round1 = (v: number) => Math.round(v * 10) / 10

export const SAMPLES: Record<PlatformKey, number> = { '6K': 0, KASP: 0, GBS: 0 }
export const PLATE_COUNT: Record<PlatformKey, number> = { '6K': 0, KASP: 0, GBS: 0 }
for (const p of PLATES) {
  SAMPLES[p.platform] += p.samples
  PLATE_COUNT[p.platform] += 1
}
export const FAIL_COUNT: Record<PlatformKey, number> = { '6K': 0, KASP: 0, GBS: 0 }
for (const f of FAILS) FAIL_COUNT[f.platform] += 1
export const QC_PASS: Record<PlatformKey, number> = {
  '6K': SAMPLES['6K'] - FAIL_COUNT['6K'],
  KASP: SAMPLES.KASP - FAIL_COUNT.KASP,
  GBS: SAMPLES.GBS - FAIL_COUNT.GBS,
}
export const TOTAL_SAMPLES = sum(PLATFORM_KEYS.map(k => SAMPLES[k]))
export const TOTAL_PASS = sum(PLATFORM_KEYS.map(k => QC_PASS[k]))
export const qcPassPct = (k: PlatformKey | 'all') => (k === 'all' ? (TOTAL_PASS / TOTAL_SAMPLES) * 100 : (QC_PASS[k] / SAMPLES[k]) * 100)
export const sharePct = (k: PlatformKey) => (SAMPLES[k] / TOTAL_SAMPLES) * 100

export const progressPct = (TOTAL_SAMPLES / PROGRESS_TARGET) * 100
export const annualPct = (TOTAL_SAMPLES / ANNUAL_TARGET) * 100
export const prevYearDeltaPct = ((TOTAL_SAMPLES - PREV_YEAR.total) / PREV_YEAR.total) * 100

export const MEAN_CALL_RATE_6K = sum(CALL_RATES_6K) / CALL_RATES_6K.length
export const BELOW_THRESHOLD_6K = CALL_RATES_6K.filter(v => v < CALL_RATE_THRESHOLD).length
/** 재분석 후 확보 계통(재분석 통과 + 1차 통과) */
export const FINAL_6K = QC_PASS['6K'] + fails6k.filter(f => f.status === '재분석 통과').length

/** 6K 실패 원인 분해 */
export const CAUSES_6K: { kind: 'CR' | 'HET' | 'ID'; label: string; count: number }[] = (['CR', 'HET', 'ID'] as const).map(kind => ({
  kind,
  label: FAIL_KIND_LABEL[kind],
  count: fails6k.filter(f => f.kind === kind).length,
}))

// 월별 처리량
export interface MonthRow {
  month: Month
  samples: Record<PlatformKey, number>
  plates: Record<PlatformKey, number>
  total: number
  /** 그 달 목표(10월은 진도 목표) */
  target: number
  /** 플랫폼별 월 평균 TAT(샘플 가중), 처리 없으면 null */
  tat: Record<PlatformKey, number | null>
}
export const MONTHLY: MonthRow[] = MONTHS.map(m => {
  const ps = PLATES.filter(p => p.month === m)
  const samples = { '6K': 0, KASP: 0, GBS: 0 } as Record<PlatformKey, number>
  const plates = { '6K': 0, KASP: 0, GBS: 0 } as Record<PlatformKey, number>
  const tatW = { '6K': 0, KASP: 0, GBS: 0 } as Record<PlatformKey, number>
  for (const p of ps) {
    samples[p.platform] += p.samples
    plates[p.platform] += 1
    tatW[p.platform] += p.samples * p.tat
  }
  const tat = Object.fromEntries(PLATFORM_KEYS.map(k => [k, samples[k] ? tatW[k] / samples[k] : null])) as Record<PlatformKey, number | null>
  return { month: m, samples, plates, total: sum(PLATFORM_KEYS.map(k => samples[k])), target: m === CURRENT_MONTH ? OCT_PROGRESS_TARGET : MONTHLY_TARGET, tat }
})
export const octProgressPct = (MONTHLY[9].total / OCT_PROGRESS_TARGET) * 100

/** 기간 TAT(샘플 가중 평균) */
export const TAT_MEAN: Record<PlatformKey, number> = Object.fromEntries(
  PLATFORM_KEYS.map(k => {
    const ps = PLATES.filter(p => p.platform === k)
    return [k, sum(ps.map(p => p.samples * p.tat)) / sum(ps.map(p => p.samples))]
  }),
) as Record<PlatformKey, number>

// 플레이트 단위 요약(G 표)
export interface PlateSummary extends Plate {
  fails: number
  failRate: number
  alert: boolean
  mainCause: string
  unresolved: number
  /** 대표 상태 */
  status: ReStatus | '재분석 완료'
  statusDetail: string
  /** 미해결이면 예정일(가장 이른), 완료면 마지막 완료일 */
  date: string | null
  samplesFailed: FailSample[]
}

const failsByPlate = new Map<string, FailSample[]>()
for (const f of FAILS) {
  const arr = failsByPlate.get(f.plateId) ?? []
  arr.push(f)
  failsByPlate.set(f.plateId, arr)
}

function countBy<T extends string>(xs: T[]): [T, number][] {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export const PLATE_SUMMARIES: PlateSummary[] = PLATES.flatMap(p => {
  const fs = failsByPlate.get(p.id)
  if (!fs || fs.length === 0) return []
  const failRate = (fs.length / p.samples) * 100
  const unresolvedFs = fs.filter(f => isUnresolved(f.status))
  const statusCounts = countBy(fs.map(f => f.status))
  const causeTop = countBy(fs.map(f => f.cause))[0][0]
  let status: PlateSummary['status']
  let date: string | null
  if (unresolvedFs.length) {
    status = unresolvedFs[0].status
    date = unresolvedFs.map(f => f.date ?? '9999').sort()[0]
  } else {
    status = '재분석 완료'
    date = fs.map(f => f.date ?? '').sort().at(-1) ?? null
  }
  return [
    {
      ...p,
      fails: fs.length,
      failRate,
      alert: failRate > PLATE_ALERT_PCT,
      mainCause: causeTop,
      unresolved: unresolvedFs.length,
      status,
      statusDetail: statusCounts.map(([s, c]) => `${s} ${c}`).join(' · '),
      date,
      samplesFailed: fs,
    },
  ]
})

export const UNRESOLVED_SAMPLES = FAILS.filter(f => isUnresolved(f.status)).length
export const UNRESOLVED_PLATES = PLATE_SUMMARIES.filter(p => p.unresolved > 0).length
export const UNRESOLVED_ALERT_PLATES = PLATE_SUMMARIES.filter(p => p.unresolved > 0 && p.alert).length
/** 미해결 재분석 분해(플랫폼·상태별 샘플 수, 가장 이른 예정일). KPI 타일 하단 막대용 */
export const UNRESOLVED_BREAKDOWN: { platform: PlatformKey; status: ReStatus; count: number; due: string }[] = (() => {
  const m = new Map<string, { platform: PlatformKey; status: ReStatus; count: number; due: string }>()
  for (const f of FAILS) {
    if (!isUnresolved(f.status)) continue
    const key = `${f.platform}|${f.status}`
    const cur = m.get(key) ?? { platform: f.platform, status: f.status, count: 0, due: '9999-12-31' }
    cur.count += 1
    if (f.date && f.date < cur.due) cur.due = f.date
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => a.due.localeCompare(b.due))
})()
export const ALERT_PLATES = PLATE_SUMMARIES.filter(p => p.alert)

// 히스토그램(C) — 0.5%p 구간, 85~100%
export interface HistBin {
  lo: number
  hi: number
  count: number
  /** 이 구간까지 누적 비율(%) */
  cumPct: number
}
export const HIST_6K: HistBin[] = (() => {
  const bins: HistBin[] = Array.from({ length: 30 }, (_, i) => ({ lo: 85 + i * 0.5, hi: 85.5 + i * 0.5, count: 0, cumPct: 0 }))
  for (const v of CALL_RATES_6K) {
    const i = Math.min(29, Math.max(0, Math.floor((v - 85) / 0.5)))
    bins[i].count += 1
  }
  let acc = 0
  for (const b of bins) {
    acc += b.count
    b.cumPct = (acc / CALL_RATES_6K.length) * 100
  }
  return bins
})()

// ---- 개발 중 단언(시드·순서가 바뀌면 경고) ----
if (import.meta.env?.DEV) {
  const checks: [boolean, string][] = [
    [round1(MEAN_CALL_RATE_6K) === 98.9, `6K 평균 콜레이트 ${MEAN_CALL_RATE_6K}`],
    [BELOW_THRESHOLD_6K === 48, `6K 95% 미만 ${BELOW_THRESHOLD_6K}`],
    [FAIL_COUNT['6K'] === 70 && QC_PASS['6K'] === 1930, `6K 실패 ${FAIL_COUNT['6K']}`],
    [FAIL_COUNT.KASP === 201 && FAIL_COUNT.GBS === 11, `KASP·GBS 실패 ${FAIL_COUNT.KASP}·${FAIL_COUNT.GBS}`],
    [TOTAL_SAMPLES === 10742, `누계 ${TOTAL_SAMPLES}`],
    [round1(TAT_MEAN['6K']) === 14 && round1(TAT_MEAN.KASP) === 6.8 && round1(TAT_MEAN.GBS) === 19.8, 'TAT 평균'],
    [
      MONTHLY.filter(r => r.tat.KASP !== null && round1(r.tat.KASP) > TAT_TARGET.KASP).map(r => r.month).join(',') === '4,5,6',
      'KASP TAT 목표 초과 월은 4·5·6월',
    ],
    [ALERT_PLATES.length === 2 && ALERT_PLATES.every(p => p.id === LOW_PLATE_6K || p.id === ALERT_PLATE_KASP), `경보 플레이트 ${ALERT_PLATES.map(p => p.id).join(',')}`],
  ]
  for (const [ok, msg] of checks) if (!ok) console.warn(`[검산] [genotyping-lab-ops] 목업 단언 실패: ${msg}`)
}
