/**
 * 샘플 추적 — 목업 데이터와 순수 계산 함수.
 * 명세: docs/specs/sample-tracking.md (기준일 2026-10-23, 시드 20261023)
 *
 * 실제 API로 바꿀 때: PLATES(플레이트 메타·단계 일자)와 INITIAL_SAMPLES(웰 단위 판독·상태)를
 * 서버 응답으로 채우고, 아래 집계 함수(buildBoard·buildSummary·plateStats…)는 그대로 쓴다.
 * 화면의 모든 숫자는 TrackState에서 계산하므로 하드코딩된 집계값이 없다.
 */
import { createRng } from '@/lib/rng'

// ---------------------------------------------------------------- 상수

export const SEED = 20261023
export const AS_OF = '2026-10-23'

export type Platform = '6K' | 'KASP' | 'GBS'
export const PLATFORMS: Platform[] = ['KASP', 'GBS', '6K']
export const PLATFORM_LABEL: Record<Platform, string> = { '6K': '6K SNP 칩', KASP: 'KASP 패널', GBS: 'GBS' }

export const STAGES = ['접수', 'DNA 추출', '분석', 'QC', '결과'] as const
export type StageIdx = 0 | 1 | 2 | 3 | 4

export const TAT_TARGET: Record<Platform, number> = { '6K': 14, KASP: 7, GBS: 21 }
/** 접수일부터 각 단계(접수·추출·분석·QC)를 끝내야 하는 누적 날수. QC 마감 = TAT 목표 */
export const DEADLINE: Record<Platform, [number, number, number, number]> = {
  KASP: [1, 2, 5, 7],
  GBS: [1, 3, 18, 21],
  '6K': [1, 3, 11, 14],
}
export const PLATE_ALERT_PCT = 10
export const NEXT_RERUN_BATCH = '2026-10-30'
export const KASP_RERUN_DUE = '2026-10-27'
export const GBS_RESEQ_DUE = '2026-11-06'
/** 진행 중 재분석 시작일(추정) */
export const RERUN_START = '2026-10-22'
/** 폐기·대체 개체 사용 완료일 */
export const SUBSTITUTE_DATE = '2026-10-07'
export const KASP_MARKERS = 16

/** 시료 웰: 행 우선 A01~H10(94개). H11 양성 대조, H12 음성 대조(NTC) */
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
const pad = (n: number, w = 2) => String(n).padStart(w, '0')
export const ALL_WELLS = ROWS.flatMap(r => Array.from({ length: 12 }, (_, i) => `${r}${pad(i + 1)}`))
export const WELLS = ALL_WELLS.slice(0, 94)
export const CONTROL_WELLS: Record<string, string> = { H11: '양성 대조', H12: '음성 대조(NTC)' }

// ---------------------------------------------------------------- 날짜

export function addDays(d: string, n: number): string {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, dd + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
/** a − b (UTC 자정 기준 일수) */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
}
/** 목록 표기 MM-DD */
export const md = (d: string) => d.slice(5)

// ---------------------------------------------------------------- 플레이트(고정 상수 PLATES)

export interface PlateDef {
  id: string
  platform: Platform
  /** [접수, DNA 추출, 분석, QC, 결과] — 아직 들어가지 않은 단계는 null */
  dates: (string | null)[]
  reqNo: string
  requester: string
  purpose: string
  /** 비고(지연 사유 등) */
  note?: { date: string; text: string; current?: boolean }
  /** GBS 시료 번호 시작(P-283 …) */
  firstNo?: number
}

const kasp = (rec: string, res: string) => [rec, addDays(rec, 1), addDays(rec, 2), addDays(rec, 5), res]

/** 화면 표시 순서(접수일 순) */
export const PLATES: PlateDef[] = [
  { id: 'GBS-2609-01', platform: 'GBS', dates: ['2026-09-08', '2026-09-09', '2026-09-11', '2026-09-27', '2026-09-30'], reqNo: 'REQ-26-090', requester: '유전체팀 정민호', purpose: '훈련 집단 고밀도 보강 · 시료 P-283~P-376', firstNo: 283 },
  { id: 'KSP-2610-01', platform: 'KASP', dates: kasp('2026-09-28', '2026-10-04'), reqNo: 'REQ-26-095', requester: '육종1팀 한지수', purpose: '도열병 저항성(Pi9·Pita·Pib) F2 개체 선발' },
  { id: 'KSP-2610-02', platform: 'KASP', dates: kasp('2026-10-02', '2026-10-08'), reqNo: 'REQ-26-096', requester: '육종1팀 한지수', purpose: '도열병 저항성(Pi9·Pita·Pib) F2 개체 선발' },
  { id: 'KSP-2610-03', platform: 'KASP', dates: kasp('2026-10-06', '2026-10-12'), reqNo: 'REQ-26-097', requester: '육종2팀 오세린', purpose: '흰잎마름병(Xa21·xa5)·벼멸구(Bph18) F2 개체 선발' },
  { id: 'KSP-2610-04', platform: 'KASP', dates: kasp('2026-10-10', '2026-10-16'), reqNo: 'REQ-26-098', requester: '품질팀 윤다온', purpose: '저아밀로스(Wx) F2 개체 선발' },
  { id: 'KSP-2610-05', platform: 'KASP', dates: kasp('2026-10-13', '2026-10-20'), reqNo: 'REQ-26-099', requester: '육종1팀 한지수', purpose: '도열병 저항성 F2 개체 선발' },
  { id: 'GBS-2611-01', platform: 'GBS', dates: ['2026-10-16', '2026-10-17', '2026-10-19', null, null], reqNo: 'REQ-26-100', requester: '유전체팀 정민호', purpose: '2027 교배 부모 후보 60 + 훈련 집단 34 · 시료 P-377~P-470', firstNo: 377 },
  { id: 'KSP-2610-06', platform: 'KASP', dates: kasp('2026-10-17', '2026-10-23'), reqNo: 'REQ-26-101', requester: '육종2팀 오세린', purpose: '흰잎마름병·벼멸구 F2 개체 선발' },
  { id: 'KSP-2610-07', platform: 'KASP', dates: ['2026-10-17', '2026-10-18', '2026-10-19', null, null], reqNo: 'REQ-26-102', requester: '육종1팀 한지수', purpose: '도열병 저항성 F2 개체 선발', note: { date: '2026-10-21', text: 'PCR 재실시(열순환기 오류)' } },
  { id: 'KSP-2610-08', platform: 'KASP', dates: ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-23', null], reqNo: 'REQ-26-103', requester: '육종2팀 오세린', purpose: '흰잎마름병·벼멸구 F2 개체 선발' },
  { id: 'KSP-2610-09', platform: 'KASP', dates: ['2026-10-21', '2026-10-22', null, null, null], reqNo: 'REQ-26-104', requester: '품질팀 윤다온', purpose: '저아밀로스(Wx) F2 개체 선발' },
  { id: 'KSP-2610-10', platform: 'KASP', dates: ['2026-10-21', null, null, null, null], reqNo: 'REQ-26-105', requester: '육종1팀 한지수', purpose: '도열병 저항성 F2 개체 선발', note: { date: AS_OF, text: '잎 시료 동결건조 대기(동결건조기 용량 초과)', current: true } },
]
export const PLATE_BY_ID = new Map(PLATES.map(p => [p.id, p]))

/** 목업 생성 순서(RNG 소비 순서). 화면 표시 순서와 다르다 */
const PLATES_GEN_ORDER = ['GBS-2609-01', 'KSP-2610-01', 'KSP-2610-02', 'KSP-2610-03', 'KSP-2610-04', 'KSP-2610-05', 'KSP-2610-06', 'KSP-2610-07', 'KSP-2610-08', 'KSP-2610-09', 'KSP-2610-10', 'GBS-2611-01']

// ---------------------------------------------------------------- 실패 원인·상태

export type FailKind = 'GBS_READS' | 'GBS_MISSING' | 'KASP_DNA' | 'KASP_PI9' | 'KASP_CLUSTER' | 'REQUEST'
export const FAIL_LABEL: Record<FailKind, string> = {
  GBS_READS: '리드 수 부족(< 1M reads)',
  GBS_MISSING: '결측률 > 20%',
  KASP_DNA: '미호출 마커 2개 이상(DNA 품질)',
  KASP_PI9: 'Pi9 마커 군집 분리 불량 · 프라이머 믹스 lot 문제',
  KASP_CLUSTER: '형광 군집 불명확',
  REQUEST: '재분석 요청',
}

export type SampleStatus =
  | '통과'
  | '진행 중'
  | '대기'
  | '재채취 요청'
  | '재시퀀싱 대기'
  | '폐기·대체 개체 사용'
  | 'QC 실패 예상'
  | 'QC 판정 대기'
  | '판독 전'
/** 미해결 재분석 상태 */
export const UNRESOLVED: SampleStatus[] = ['대기', '진행 중', '재채취 요청', '재시퀀싱 대기']
export const isUnresolved = (s: Sample) => UNRESOLVED.includes(s.status)

export const RERUN_REASONS = ['유전형 의심', '의뢰자 요청', '대조 이상'] as const
export type RerunReason = (typeof RERUN_REASONS)[number]

// ---------------------------------------------------------------- 고정 상수 1 — genotyping-lab-ops 실패 32건

interface FixedFail {
  plate: string
  id: string
  well: string
  kind: FailKind
  /** KASP = 호출 마커 수, GBS = 콜레이트(%) */
  v: number
  status: SampleStatus
  date: string
  action: string
}
const F = (plate: string, id: string, well: string, kind: FailKind, v: number, status: SampleStatus, date: string, action: string): FixedFail => ({ plate, id, well, kind, v, status, date, action })
const RESEQ = '라이브러리 재제작 후 재시퀀싱'
const QUEUE = '재분석 대기열 등록'

export const FIXED_FAILS: FixedFail[] = [
  F('GBS-2609-01', 'P-330', 'D12', 'GBS_READS', 77.41, '재시퀀싱 대기', GBS_RESEQ_DUE, RESEQ),
  F('GBS-2609-01', 'P-288', 'A06', 'GBS_MISSING', 68.78, '재시퀀싱 대기', GBS_RESEQ_DUE, RESEQ),
  F('GBS-2609-01', 'P-349', 'F07', 'GBS_MISSING', 76.17, '재시퀀싱 대기', GBS_RESEQ_DUE, RESEQ),
  F('GBS-2609-01', 'P-292', 'A10', 'GBS_READS', 76.38, '재시퀀싱 대기', GBS_RESEQ_DUE, RESEQ),
  F('KSP-2610-01', 'YR25-F2-0183-011', 'B12', 'KASP_DNA', 11, '폐기·대체 개체 사용', SUBSTITUTE_DATE, '형제 개체로 대체'),
  ...(
    [
      ['YR25-F2-0102-014', 'E05'], ['YR25-F2-0148-048', 'G02'], ['YR25-F2-0181-069', 'G03'], ['YR25-F2-0015-130', 'D06'],
      ['YR25-F2-0008-188', 'H06'], ['YR25-F2-0217-158', 'D10'], ['YR25-F2-0184-053', 'C09'], ['YR25-F2-0009-174', 'G08'],
      ['YR25-F2-0268-146', 'E12'], ['YR25-F2-0052-109', 'A08'], ['YR25-F2-0366-082', 'H03'], ['YR25-F2-0366-038', 'F08'],
      ['YR25-F2-0064-035', 'A01'], ['YR25-F2-0012-154', 'C02'],
    ] as const
  ).map(([id, w]) => F('KSP-2610-02', id, w, 'KASP_PI9', 15, '진행 중', KASP_RERUN_DUE, '프라이머 믹스 lot 교체 후 재분석')),
  F('KSP-2610-03', 'YR25-F2-0165-028', 'A04', 'KASP_DNA', 11, '진행 중', KASP_RERUN_DUE, 'DNA 재추출 후 재분석'),
  F('KSP-2610-03', 'YR25-F2-0022-130', 'A05', 'KASP_DNA', 12, '진행 중', KASP_RERUN_DUE, 'DNA 재추출 후 재분석'),
  ...(
    [
      ['KSP-2610-04', 'YR25-F2-0312-112', 'F04', 'KASP_DNA', 14], ['KSP-2610-04', 'YR25-F2-0382-061', 'E03', 'KASP_DNA', 9],
      ['KSP-2610-04', 'YR25-F2-0220-052', 'B06', 'KASP_DNA', 12], ['KSP-2610-04', 'YR25-F2-0293-126', 'D11', 'KASP_CLUSTER', 11],
      ['KSP-2610-04', 'YR25-F2-0095-003', 'A09', 'KASP_DNA', 10],
      ['KSP-2610-05', 'YR25-F2-0173-062', 'D11', 'KASP_DNA', 10], ['KSP-2610-05', 'YR25-F2-0228-110', 'A10', 'KASP_DNA', 12],
      ['KSP-2610-05', 'YR25-F2-0374-113', 'G08', 'KASP_DNA', 9], ['KSP-2610-05', 'YR25-F2-0096-112', 'G05', 'KASP_DNA', 13],
      ['KSP-2610-05', 'YR25-F2-0312-133', 'C03', 'KASP_CLUSTER', 14],
      ['KSP-2610-06', 'YR25-F2-0078-083', 'G10', 'KASP_DNA', 14],
    ] as const
  ).map(([p, id, w, k, c]) => F(p, id, w, k, c, '대기', NEXT_RERUN_BATCH, QUEUE)),
]

// ---------------------------------------------------------------- 고정 상수 2 — 2027 교배 부모 후보 60계통

export const PARENT_CANDIDATES = [
  'YR22-0412', 'YR22-0415', 'YR21-0877', 'YR23-0136', 'YR22-0263', 'YR21-0594', 'YR20-1108', 'YR19-0731', 'YR23-6127', 'YR20-8715',
  'YR23-9089', 'YR21-6913', 'YR23-1849', 'YR20-9960', 'YR21-1679', 'YR20-2163', 'YR23-6302', 'YR23-9707', 'YR22-7411', 'YR19-7937',
  'YR22-2589', 'YR22-8678', 'YR21-3638', 'YR22-4728', 'YR22-3861', 'YR23-6269', 'YR21-5157', 'YR21-8380', 'YR21-8692', 'YR21-4266',
  'YR22-0536', 'YR21-7243', 'YR20-5737', 'YR20-0301', 'YR20-5543', 'YR20-2388', 'YR22-7628', 'YR19-7011', 'YR20-0962', 'YR19-5010',
  'YR21-2005', 'YR22-6348', 'YR21-8806', 'YR22-6163', 'YR21-1575', 'YR21-3833', 'YR19-7090', 'YR21-7615', 'YR21-1017', 'YR20-6987',
  'YR21-5004', 'YR19-6821', 'YR23-5617', 'YR23-2191', 'YR20-0174', 'YR23-2035', 'YR19-0003', 'YR20-0315', 'YR22-7121', 'YR21-2709',
]

// ---------------------------------------------------------------- 샘플 생성

export interface Sample {
  plate: string
  platform: Platform
  well: string
  /** 웰 인덱스 0~93 */
  idx: number
  /** `${plate}-${well}` */
  barcode: string
  /** KASP: YR25-F2-cccc-iii, GBS: P-nnn */
  id: string
  /** KASP 교배 조합 CR25-ccc */
  cross?: string
  /** KASP F2 개체 번호(마지막 3자리) */
  indiv?: string
  /** GBS 계통명 */
  line?: string
  /** GBS 구분 */
  group?: '부모 후보' | '훈련 집단'
  /** KASP 호출 마커 수 */
  called?: number
  /** 콜레이트(%) */
  call?: number
  /** GBS 리드 수(백만) */
  reads?: number
  status: SampleStatus
  fail?: FailKind
  /** 재분석 요청 사유(REQUEST) */
  reason?: RerunReason
  /** 실패(재분석 요청) 일자 */
  failDate?: string
  /** 재분석 시작일 */
  rerunStart?: string
  /** 예정·완료일 */
  due?: string
  action?: string
}

const stageOf = (dates: (string | null)[]): StageIdx => {
  let s = 0
  dates.forEach((d, i) => {
    if (d !== null) s = i
  })
  return s as StageIdx
}

function generateSamples(): Sample[] {
  const rng = createRng(SEED)
  const usedIds = new Set(FIXED_FAILS.map(f => f.id))
  const usedLines = new Set(PARENT_CANDIDATES)
  const fixed = new Map(FIXED_FAILS.map(f => [`${f.plate}|${f.well}`, f]))
  const out: Sample[] = []
  for (const pid of PLATES_GEN_ORDER) {
    const p = PLATE_BY_ID.get(pid)!
    const st = stageOf(p.dates)
    WELLS.forEach((well, idx) => {
      const fx = fixed.get(`${p.id}|${well}`)
      const s: Sample = { plate: p.id, platform: p.platform, well, idx, barcode: `${p.id}-${well}`, id: '', status: '판독 전' }
      // 1) 샘플 ID·계통
      if (p.platform === 'KASP') {
        if (fx) s.id = fx.id
        else {
          let id: string
          do id = `YR25-F2-${pad(rng.int(1, 400), 4)}-${pad(rng.int(1, 200), 3)}`
          while (usedIds.has(id))
          usedIds.add(id)
          s.id = id
        }
        s.cross = `CR25-${pad(Number(s.id.slice(8, 12)), 3)}`
        s.indiv = s.id.slice(13)
      } else {
        s.id = `P-${pad((p.firstNo ?? 0) + idx, 3)}`
        const anchor = p.id === 'GBS-2611-01' && idx < PARENT_CANDIDATES.length
        if (anchor) s.line = PARENT_CANDIDATES[idx]
        else {
          let ln: string
          do ln = `YR${rng.int(19, 23)}-${pad(rng.int(1, 9999), 4)}`
          while (usedLines.has(ln))
          usedLines.add(ln)
          s.line = ln
        }
        s.group = anchor ? '부모 후보' : '훈련 집단'
      }
      // 2) 판독값·상태
      if (fx) {
        Object.assign(s, { fail: fx.kind, status: fx.status, due: fx.date, action: fx.action, failDate: p.dates[4] ?? undefined })
        if (fx.status === '진행 중') s.rerunStart = RERUN_START
        if (p.platform === 'KASP') {
          s.called = fx.v
          s.call = (fx.v / KASP_MARKERS) * 100
        } else {
          s.call = fx.v
          s.reads = fx.kind === 'GBS_READS' ? 0.4 + rng.next() * 0.55 : 1.0 + rng.next() * 0.6
        }
      } else if (st === 4) {
        s.status = '통과'
        if (p.platform === 'KASP') {
          s.called = rng.next() < 0.88 ? 16 : 15
          s.call = (s.called / KASP_MARKERS) * 100
        } else {
          s.call = 100 - (3 + rng.next() * 9)
          s.reads = 1.5 + rng.next() * 3
        }
      } else if (st === 3 && p.platform === 'KASP') {
        const u = rng.next()
        s.called = u < 0.85 ? 16 : u < 0.96 ? 15 : rng.int(9, 14)
        s.call = (s.called / KASP_MARKERS) * 100
        s.status = s.called <= 14 ? 'QC 실패 예상' : 'QC 판정 대기'
      }
      out.push(s)
    })
  }
  // 화면 표시 순서(접수일 순)로 정렬
  const order = new Map(PLATES.map((p, i) => [p.id, i]))
  return out.sort((a, b) => order.get(a.plate)! - order.get(b.plate)! || a.idx - b.idx)
}

// ---------------------------------------------------------------- 상태(일괄 작업 대상)

export interface PlateState {
  dates: (string | null)[]
  /** 분석→QC로 옮겼지만 판독 파일이 아직 없음 */
  awaitingReadout?: boolean
}
export interface TrackState {
  plates: Record<string, PlateState>
  samples: Sample[]
}

export const INITIAL_SAMPLES: Sample[] = generateSamples()
export const INITIAL_STATE: TrackState = {
  plates: Object.fromEntries(PLATES.map(p => [p.id, { dates: p.dates.slice() }])),
  samples: INITIAL_SAMPLES,
}

// ---------------------------------------------------------------- 플레이트 계산

export interface PlateInfo {
  def: PlateDef
  dates: (string | null)[]
  stage: StageIdx
  awaitingReadout: boolean
  /** 기준일 − 접수일 */
  elapsed: number
  /** 현재 단계 체류일 */
  inStage: number
  /** 현재 단계 마감(누적, 결과 단계는 null) */
  deadline: number | null
  delay: number
  targetDate: string
  /** 결과 플레이트만 */
  tat: number | null
  /** 10월 결과 제공 */
  octResult: boolean
}

export function plateInfo(state: TrackState, id: string): PlateInfo {
  const def = PLATE_BY_ID.get(id)!
  const ps = state.plates[id]!
  const stage = stageOf(ps.dates)
  const rec = ps.dates[0]!
  const elapsed = diffDays(AS_OF, rec)
  const deadline = stage < 4 ? (DEADLINE[def.platform] as number[])[stage]! : null
  const res = ps.dates[4]
  return {
    def,
    dates: ps.dates,
    stage,
    awaitingReadout: !!ps.awaitingReadout,
    elapsed,
    inStage: diffDays(AS_OF, ps.dates[stage]!),
    deadline,
    delay: deadline === null ? 0 : Math.max(0, elapsed - deadline),
    targetDate: addDays(rec, TAT_TARGET[def.platform]),
    tat: res ? diffDays(res, rec) : null,
    octResult: !!res && res.startsWith('2026-10'),
  }
}

export interface PlateStats {
  n: number
  pass: number
  pass16: number
  pass15: number
  /** QC 실패(재분석 요청 제외, 폐기·대체 포함) */
  fail: number
  failRate: number
  alert: boolean
  meanCall: number | null
  expFail: number
  awaitingDecision: number
  unresolved: number
}

export function plateStats(state: TrackState, id: string, samples = state.samples.filter(s => s.plate === id)): PlateStats {
  const pass = samples.filter(s => s.status === '통과')
  const fail = samples.filter(s => s.fail && s.fail !== 'REQUEST').length
  const withCall = samples.filter(s => s.call != null)
  const failRate = (fail / samples.length) * 100
  void state
  return {
    n: samples.length,
    pass: pass.length,
    pass16: pass.filter(s => s.called === 16).length,
    pass15: pass.filter(s => s.called === 15).length,
    fail,
    failRate,
    alert: failRate > PLATE_ALERT_PCT,
    meanCall: withCall.length ? withCall.reduce((a, s) => a + s.call!, 0) / withCall.length : null,
    expFail: samples.filter(s => s.status === 'QC 실패 예상').length,
    awaitingDecision: samples.filter(s => s.status === 'QC 판정 대기').length,
    unresolved: samples.filter(isUnresolved).length,
  }
}

// ---------------------------------------------------------------- 단계 보드

/** 재분석 샘플의 보드 열: 대기 → 접수, 진행 중·DNA 품질 → DNA 추출, 그 밖 → 분석 */
export function rerunColumn(s: Sample): StageIdx {
  if (s.status === '대기') return 0
  if (s.status === '진행 중' && s.fail === 'KASP_DNA') return 1
  return 2
}

export interface RerunGroup {
  key: string
  col: StageIdx
  plate: string
  platform: Platform
  status: SampleStatus
  samples: Sample[]
  due: string
  causes: string[]
}

export interface BoardColumn {
  stage: StageIdx
  /** 신규 샘플 */
  samples: number
  byPlatform: Record<Platform, number>
  plates: PlateInfo[]
  rerun: number
  rerunGroups: RerunGroup[]
  delayedPlates: number
  delayedSamples: number
}

export function rerunGroups(state: TrackState): RerunGroup[] {
  const map = new Map<string, RerunGroup>()
  for (const s of state.samples) {
    if (!isUnresolved(s)) continue
    const col = rerunColumn(s)
    const key = `${col}|${s.plate}|${s.status}`
    let g = map.get(key)
    if (!g) {
      g = { key, col, plate: s.plate, platform: s.platform, status: s.status, samples: [], due: s.due ?? '', causes: [] }
      map.set(key, g)
    }
    g.samples.push(s)
    if (s.due && s.due > g.due) g.due = s.due
    const cause = s.fail === 'REQUEST' ? `재분석 요청(${s.reason})` : s.fail ? FAIL_LABEL[s.fail] : ''
    if (cause && !g.causes.includes(cause)) g.causes.push(cause)
  }
  const order = new Map(PLATES.map((p, i) => [p.id, i]))
  return [...map.values()].sort((a, b) => a.col - b.col || order.get(a.plate)! - order.get(b.plate)!)
}

export function buildBoard(state: TrackState): BoardColumn[] {
  const cols: BoardColumn[] = STAGES.map((_, i) => ({
    stage: i as StageIdx,
    samples: 0,
    byPlatform: { KASP: 0, GBS: 0, '6K': 0 },
    plates: [],
    rerun: 0,
    rerunGroups: [],
    delayedPlates: 0,
    delayedSamples: 0,
  }))
  const perPlate = countByPlate(state.samples)
  for (const def of PLATES) {
    const info = plateInfo(state, def.id)
    if (info.stage === 4 && !info.octResult) continue
    const c = cols[info.stage]!
    const n = perPlate.get(def.id) ?? 0
    c.samples += n
    c.byPlatform[def.platform] += n
    c.plates.push(info)
    if (info.delay > 0) {
      c.delayedPlates++
      c.delayedSamples += n
    }
  }
  for (const g of rerunGroups(state)) {
    cols[g.col]!.rerunGroups.push(g)
    cols[g.col]!.rerun += g.samples.length
  }
  return cols
}

function countByPlate(samples: Sample[]) {
  const m = new Map<string, number>()
  for (const s of samples) m.set(s.plate, (m.get(s.plate) ?? 0) + 1)
  return m
}

// ---------------------------------------------------------------- 요약 줄

export interface Summary {
  inProgress: { samples: number; plates: number; byPlatform: Record<Platform, number> }
  delayed: { plates: number; samples: number; ids: string[] }
  unresolved: { samples: number; plates: number; alertPlates: number; byStatus: { label: string; n: number; due: string }[] }
  oct: { samples: number; plates: number; firstPass: number; firstPassPct: number }
  tracked: { plates: number; samples: number }
}

export function buildSummary(state: TrackState): Summary {
  const perPlate = countByPlate(state.samples)
  const infos = PLATES.map(p => plateInfo(state, p.id))
  const prog = infos.filter(i => i.stage < 4)
  const byPlatform: Record<Platform, number> = { KASP: 0, GBS: 0, '6K': 0 }
  prog.forEach(i => (byPlatform[i.def.platform] += 1))
  const delayed = prog.filter(i => i.delay > 0)
  const un = state.samples.filter(isUnresolved)
  const unPlates = [...new Set(un.map(s => s.plate))]
  const alertPlates = unPlates.filter(id => plateStats(state, id).alert).length
  const byStatusMap = new Map<string, { label: string; n: number; due: string }>()
  for (const s of un) {
    const label = `${s.platform} ${s.status === '진행 중' ? '진행 중' : s.status === '대기' ? '대기' : s.status}`
    const e = byStatusMap.get(label) ?? { label, n: 0, due: s.due ?? '' }
    e.n++
    if (s.due && s.due > e.due) e.due = s.due
    byStatusMap.set(label, e)
  }
  const octPlates = infos.filter(i => i.octResult)
  const octIds = new Set(octPlates.map(i => i.def.id))
  const octSamples = state.samples.filter(s => octIds.has(s.plate))
  // 1차 QC 통과 = 첫 판정에서 실패하지 않은 샘플(이후 재분석 요청한 통과 샘플 포함)
  const firstPass = octSamples.filter(s => !s.fail || s.fail === 'REQUEST').length
  return {
    inProgress: { samples: prog.reduce((a, i) => a + (perPlate.get(i.def.id) ?? 0), 0), plates: prog.length, byPlatform },
    delayed: { plates: delayed.length, samples: delayed.reduce((a, i) => a + (perPlate.get(i.def.id) ?? 0), 0), ids: delayed.map(i => i.def.id) },
    unresolved: { samples: un.length, plates: unPlates.length, alertPlates, byStatus: [...byStatusMap.values()] },
    oct: { samples: octSamples.length, plates: octPlates.length, firstPass, firstPassPct: octSamples.length ? (firstPass / octSamples.length) * 100 : 0 },
    tracked: { plates: PLATES.length, samples: state.samples.length },
  }
}

// ---------------------------------------------------------------- 표기 보조

export function statusLabel(s: Sample, info: Pick<PlateInfo, 'stage' | 'awaitingReadout'>): string {
  switch (s.status) {
    case '진행 중':
      return '재분석 진행 중'
    case '대기':
      return '재분석 대기'
    case '폐기·대체 개체 사용':
      return '폐기·대체'
    case '판독 전':
      return info.awaitingReadout ? '판독 파일 업로드 대기' : `${STAGES[info.stage]} 중`
    default:
      return s.status
  }
}

/** "15/16(Pi9 미호출)" · "16/16" · "93.4% · 리드 2.31M" */
export function callDetail(s: Sample): string | null {
  if (s.call == null) return null
  if (s.platform === 'KASP') {
    const c = `${s.called}/${KASP_MARKERS}`
    if (s.fail === 'KASP_PI9') return `${c}(Pi9 미호출)`
    if (s.called === 15 && !s.fail) return `${c}(보조 마커 1개 미호출)`
    return c
  }
  return s.reads != null ? `리드 ${s.reads.toFixed(2)}M` : null
}

/** 웰 툴팁: "E05 · YR25-F2-0102-014 · 15/16(Pi9 미호출) · 재분석 진행 중(10/27 예정)" */
export function wellTooltip(s: Sample, info: Pick<PlateInfo, 'stage' | 'awaitingReadout'>): string {
  const parts = [s.well, s.id]
  if (s.platform === 'KASP' && s.called != null) parts.push(callDetail(s)!)
  else if (s.call != null) parts.push(`콜레이트 ${s.call.toFixed(1)}%`)
  let st = statusLabel(s, info)
  if (isUnresolved(s) && s.due) st += `(${s.due.slice(5).replace('-', '/')} 예정)`
  parts.push(st)
  return parts.join(' · ')
}

// ---------------------------------------------------------------- 이력 타임라인

export interface TimelineEvent {
  date: string | null
  stage: string
  text: string
  /** done 완료, current 현재, future 아직 오지 않은 단계, planned 예정(점선), warn 주의 이벤트 */
  kind: 'done' | 'current' | 'future' | 'planned' | 'warn'
}

export function sampleTimeline(state: TrackState, s: Sample): TimelineEvent[] {
  const info = plateInfo(state, s.plate)
  const { def, dates, stage } = info
  const ev: TimelineEvent[] = []
  const callTxt = s.call != null ? [`${s.call.toFixed(1)}%`, callDetail(s)].filter(Boolean).join(' · ') : ''
  const failedQc = s.fail && s.fail !== 'REQUEST'
  STAGES.forEach((name, i) => {
    const d = dates[i] ?? null
    if (d === null) {
      ev.push({ date: null, stage: name, text: i === 4 ? `목표 결과일 ${info.targetDate}` : '대기', kind: 'future' })
      return
    }
    const kind: TimelineEvent['kind'] = i === stage && stage < 4 ? 'current' : 'done'
    let text = ''
    if (i === 0) text = `시료 접수 · ${def.reqNo} ${def.requester}`
    else if (i === 1) text = 'DNA 추출 시작'
    else if (i === 2) text = def.platform === 'KASP' ? 'KASP 16마커 PCR·형광 판독' : '라이브러리 제작·시퀀싱'
    else if (i === 3) {
      if (stage === 3) text = info.awaitingReadout ? '판독 파일 업로드 대기' : `QC 판정 대기 · 콜레이트 ${callTxt}`
      else text = `판독 완료 · 콜레이트 ${callTxt}`
    } else {
      const over = info.tat !== null && info.tat > TAT_TARGET[def.platform] ? `TAT ${info.tat}일(목표 ${TAT_TARGET[def.platform]}일 초과)` : `TAT ${info.tat}일`
      text = failedQc ? `QC 실패 · ${FAIL_LABEL[s.fail!]} · 플레이트 ${over}` : `결과 제공 · ${over}`
    }
    ev.push({ date: d, stage: i === 4 && failedQc ? '결과·QC 실패' : name, text, kind: failedQc && i === 4 ? 'warn' : kind })
    // 플레이트 비고
    if (def.note && i === stage && stage < 4 && def.note.current) ev.push({ date: def.note.date, stage: '비고', text: def.note.text, kind: 'warn' })
    if (def.note && !def.note.current && i === 2) ev.push({ date: def.note.date, stage: '비고', text: def.note.text, kind: 'warn' })
  })
  // 실패·재분석 이벤트
  if (s.fail) {
    if (s.status === '폐기·대체 개체 사용') {
      ev.push({ date: s.due ?? SUBSTITUTE_DATE, stage: '조치', text: '형제 개체로 대체', kind: 'done' })
    } else {
      ev.push({ date: s.failDate ?? null, stage: '재분석 요청', text: s.fail === 'REQUEST' ? `재분석 요청 · ${s.reason}` : `재분석 요청 · ${s.action ?? ''}`, kind: 'done' })
      if (s.rerunStart) ev.push({ date: s.rerunStart, stage: '재분석 시작', text: s.platform === 'KASP' ? '재분석 진행 중' : '재시퀀싱 진행 중', kind: 'current' })
      if (s.due && isUnresolved(s)) {
        const text =
          s.status === '재시퀀싱 대기'
            ? 'GBS-2611-01과 같은 시퀀싱 런에 포함'
            : s.status === '대기'
              ? '다음 재분석 배치(대기열)'
              : '재분석 결과 예정'
        ev.push({ date: s.due, stage: '예정', text, kind: 'planned' })
      }
    }
  }
  // 날짜 있는 이벤트를 시간 순으로(안정 정렬), 아직 오지 않은 단계(null)는 끝에
  const dated = ev.filter(e => e.date !== null && e.kind !== 'future')
  const undated = ev.filter(e => e.date === null || e.kind === 'future')
  dated.sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))
  return [...dated, ...undated]
}

// ---------------------------------------------------------------- 검색

export interface SearchResult {
  results: Sample[]
  /** 바코드·샘플 ID 정확히 일치 */
  exact: Sample | null
}

export function searchSamples(samples: Sample[], query: string): SearchResult {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return { results: [], exact: null }
  const results = samples.filter(
    s =>
      s.barcode.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.line ?? '').toLowerCase().includes(q) ||
      (s.cross ?? '').toLowerCase().includes(q) ||
      s.plate.toLowerCase().includes(q),
  )
  const exactAll = samples.filter(s => s.barcode.toLowerCase() === q || s.id.toLowerCase() === q)
  return { results, exact: exactAll.length === 1 ? exactAll[0]! : null }
}

// ---------------------------------------------------------------- 일괄 작업(순수 함수)

const updateSamples = (state: TrackState, pred: (s: Sample) => boolean, f: (s: Sample) => Sample): TrackState => ({
  ...state,
  samples: state.samples.map(s => (pred(s) ? f(s) : s)),
})

/** 다음 단계로: 접수→DNA 추출, DNA 추출→분석, 분석→QC. 들어간 단계 일자 = 기준일 */
export function canAdvance(state: TrackState, id: string): string | null {
  const st = plateInfo(state, id).stage
  if (st === 4) return '결과 단계 플레이트는 옮길 수 없습니다'
  if (st === 3) return 'QC 단계는 「QC 승인」으로 결과 단계로 옮깁니다'
  return null
}
export function advancePlates(state: TrackState, ids: string[]): TrackState {
  const plates = { ...state.plates }
  for (const id of ids) {
    const ps = plates[id]!
    const st = stageOf(ps.dates)
    if (st >= 3) continue
    const dates = ps.dates.slice()
    dates[st + 1] = AS_OF
    plates[id] = { dates, awaitingReadout: st + 1 === 3 ? true : ps.awaitingReadout }
  }
  return { ...state, plates }
}

export function canApprove(state: TrackState, id: string): string | null {
  const info = plateInfo(state, id)
  if (info.stage !== 3) return 'QC 단계 플레이트만 승인할 수 있습니다'
  if (info.awaitingReadout) return '판독 파일이 없어 승인할 수 없습니다(판독 파일 업로드 대기)'
  return null
}
/** QC 승인: 결과일 = 기준일. QC 실패 예상 → 실패·재분석 대기(10/30), 나머지 → 통과 */
export function approveQc(state: TrackState, ids: string[]): { state: TrackState; pass: number; fail: number } {
  const set = new Set(ids)
  const plates = { ...state.plates }
  for (const id of ids) {
    const dates = plates[id]!.dates.slice()
    dates[4] = AS_OF
    plates[id] = { dates }
  }
  let pass = 0
  let fail = 0
  const next = updateSamples(
    { ...state, plates },
    s => set.has(s.plate) && (s.status === 'QC 실패 예상' || s.status === 'QC 판정 대기'),
    s => {
      if (s.status === 'QC 실패 예상') {
        fail++
        return { ...s, status: '대기', fail: 'KASP_DNA', failDate: AS_OF, due: NEXT_RERUN_BATCH, action: QUEUE }
      }
      pass++
      return { ...s, status: '통과' }
    },
  )
  return { state: next, pass, fail }
}

export function canRequestRerun(s: Sample): string | null {
  if (isUnresolved(s)) return '이미 미해결 재분석 중인 웰입니다'
  if (s.status !== '통과') return '결과가 통과인 웰만 재분석을 요청할 수 있습니다'
  return null
}
export function requestRerun(state: TrackState, barcodes: string[], reason: RerunReason): TrackState {
  const set = new Set(barcodes)
  return updateSamples(
    state,
    s => set.has(s.barcode) && s.status === '통과',
    s => ({ ...s, status: '대기', fail: 'REQUEST', reason, failDate: AS_OF, due: NEXT_RERUN_BATCH, action: QUEUE }),
  )
}

export function canStartRerun(s: Sample): string | null {
  return s.status === '대기' ? null : '재분석 대기 상태인 샘플만 시작할 수 있습니다'
}
/** 재분석 시작: 대기 → 진행 중(예정일 유지). DNA 품질 원인은 DNA 추출 열, 그 밖은 분석 열 */
export function startRerun(state: TrackState, barcodes: string[]): TrackState {
  const set = new Set(barcodes)
  return updateSamples(
    state,
    s => set.has(s.barcode) && s.status === '대기',
    s => ({ ...s, status: '진행 중', rerunStart: AS_OF, action: s.fail === 'KASP_DNA' ? 'DNA 재추출 후 재분석' : '재분석' }),
  )
}

// ---------------------------------------------------------------- DEV 검산(명세 수용 기준)

if (import.meta.env.DEV) {
  const S0 = INITIAL_STATE
  const sum = buildSummary(S0)
  const board = buildBoard(S0)
  const a = (cond: boolean, msg: string) => console.assert(cond, `[검산] sample-tracking: ${msg}`)
  a(S0.samples.length === 1128, `샘플 수 ${S0.samples.length} ≠ 1,128`)
  a(new Set(S0.samples.map(s => s.id)).size === 1128, '샘플 ID 중복')
  a(sum.inProgress.samples === 470 && sum.inProgress.plates === 5, `진행 중 ${sum.inProgress.samples}/${sum.inProgress.plates}장 ≠ 470/5`)
  a(sum.delayed.plates === 2 && sum.delayed.samples === 188, `지연 ${sum.delayed.plates}장·${sum.delayed.samples} ≠ 2장·188`)
  a(sum.unresolved.samples === 31 && sum.unresolved.plates === 6 && sum.unresolved.alertPlates === 1, `미해결 ${sum.unresolved.samples}·${sum.unresolved.plates}장·경보 ${sum.unresolved.alertPlates} ≠ 31·6·1`)
  a(sum.oct.samples === 564 && sum.oct.firstPass === 536 && sum.oct.firstPassPct.toFixed(1) === '95.0', `10월 결과 ${sum.oct.samples}·통과 ${sum.oct.firstPass} ≠ 564·536`)
  a(board.map(c => c.samples).join('/') === '94/94/188/94/564', `보드 열 ${board.map(c => c.samples).join('/')} ≠ 94/94/188/94/564`)
  a(board.map(c => c.rerun).join('/') === '11/2/18/0/0', `재분석 열 ${board.map(c => c.rerun).join('/')} ≠ 11/2/18/0`)
  const p2 = plateStats(S0, 'KSP-2610-02')
  a(p2.fail === 14 && p2.meanCall!.toFixed(1) === '98.1' && p2.pass16 === 66 && p2.pass15 === 14, `KSP-2610-02 실패 ${p2.fail}·평균 ${p2.meanCall?.toFixed(2)}·16/16 ${p2.pass16}·15/16 ${p2.pass15}`)
  const p8 = plateStats(S0, 'KSP-2610-08')
  a(p8.expFail === 4 && p8.meanCall!.toFixed(1) === '97.8', `KSP-2610-08 QC 실패 예상 ${p8.expFail} ≠ 4`)
  const fails = ['KSP-2610-01', 'KSP-2610-02', 'KSP-2610-03', 'KSP-2610-04', 'KSP-2610-05', 'KSP-2610-06'].map(id => plateStats(S0, id).fail).join(',')
  a(fails === '1,14,2,5,5,1', `10월 플레이트 실패 수 ${fails} ≠ 1,14,2,5,5,1`)
  const tats = ['KSP-2610-01', 'KSP-2610-02', 'KSP-2610-03', 'KSP-2610-04', 'KSP-2610-05', 'KSP-2610-06', 'GBS-2609-01'].map(id => plateInfo(S0, id).tat).join(',')
  a(tats === '6,6,6,6,7,6,22', `TAT ${tats} ≠ 6,6,6,6,7,6,22`)
  a(searchSamples(S0.samples, 'YR25-F2-0102').results.map(s => s.barcode).join(',') === 'KSP-2610-01-H02,KSP-2610-02-E05,KSP-2610-04-E02,KSP-2610-05-B12', '검색 YR25-F2-0102 4건 불일치')
  a(searchSamples(S0.samples, 'YR22-0412').results.map(s => `${s.barcode}/${s.id}`).join() === 'GBS-2611-01-A01/P-377', '검색 YR22-0412 불일치')
  const appr = approveQc(S0, ['KSP-2610-08'])
  const s1 = buildSummary(appr.state)
  const b1 = buildBoard(appr.state)
  a(appr.pass === 90 && appr.fail === 4, `QC 승인 통과 ${appr.pass}·실패 ${appr.fail} ≠ 90·4`)
  a(s1.oct.samples === 658 && s1.oct.plates === 7 && s1.oct.firstPass === 626 && s1.unresolved.samples === 35 && s1.unresolved.plates === 7 && b1[0]!.rerun === 15 && s1.inProgress.samples === 376,
    `QC 승인 후 결과 ${s1.oct.samples}·${s1.oct.plates}장, 통과 ${s1.oct.firstPass}, 미해결 ${s1.unresolved.samples}·${s1.unresolved.plates}장, 접수 재분석 ${b1[0]!.rerun}, 진행 ${s1.inProgress.samples}`)
  const waiting = S0.samples.filter(s => s.status === '대기').map(s => s.barcode)
  const b2 = buildBoard(startRerun(S0, waiting))
  a(b2.map(c => c.rerun).join('/') === '0/11/20/0/0', `재분석 시작 후 ${b2.map(c => c.rerun).join('/')} ≠ 0/11/20/0`)
  const adv = buildSummary(advancePlates(S0, ['KSP-2610-07']))
  a(adv.delayed.plates === 1 && adv.delayed.samples === 94, `KSP-2610-07 QC 이동 후 지연 ${adv.delayed.plates}장`)
}
