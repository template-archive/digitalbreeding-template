/**
 * 품종 식별 마커 프로필 — 목업 데이터
 * 명세: docs/specs/variety-identity-markers.md (기준일 2026-10-23, 시드 20261023)
 *
 * 난수를 쓰지 않는다. 모든 값은 확정 상수(KASP 프로필·순도 검정 행)와 그 계산값이다.
 * 실제 API로 바꿀 때는 PROFILES·PURITY_ROWS만 응답으로 교체하면 나머지 계산이 따라온다.
 */

import { KASP_ALLELE_DIRECTION_NOTE, KASP_KIND, KASP_MARKERS, isKaspIdMarker, type KaspMarker } from '@/lib/genomics'
import { binomAcceptMax, binomCdf, clopperPearsonUpper } from '@/lib/stats'

export const SEED = 20261023
export const BASE_DATE = '2026-10-23'

/* ───────── 1) 마커 ───────── */
/** KASP 16마커 패널(순서·형질 설명·방향 문구는 @/lib/genomics 공통 상수) */
export const MARKERS = KASP_MARKERS
export type Marker = KaspMarker
export const N_MARKERS = MARKERS.length
export { KASP_KIND }
export const isIdMarker = isKaspIdMarker
export const ALL_IDX = MARKERS.map((_, i) => i)
export const ID_IDX = ALL_IDX.filter(i => isIdMarker(MARKERS[i]!))
export const FUNC_IDX = ALL_IDX.filter(i => !isIdMarker(MARKERS[i]!))
export const N_FUNC = FUNC_IDX.length
export const N_ID = ID_IDX.length
export const ALLELE_DIRECTION_NOTE = KASP_ALLELE_DIRECTION_NOTE

export type Geno = 0 | 1 | 2
export const gt = (v: Geno) => (v === 2 ? 'BB' : v === 1 ? 'AB' : 'AA')

/* ───────── 프로필 ───────── */
export type Role = 'cand' | 'filed' | 'reg' | 'check'
export const ROLE_LABEL: Record<Role, string> = { cand: '출원 후보', filed: '출원·심사', reg: '등록 품종', check: '대비 품종' }
export const ROLES: Role[] = ['cand', 'filed', 'reg', 'check']

export interface Profile {
  idx: number
  id: string
  name: string
  /** 행렬 세로 축용 짧은 이름(계통은 끝 4자리, 품종명은 그대로) */
  short: string
  role: Role
  status: string
  source: string
  geno: (0 | 2)[]
}

const SRC_MET = 'MET 진입 확인 분석(2025-03, 추정) · 재확인 결과 대기'
const RAW: Omit<Profile, 'idx' | 'short'>[] = [
  //                                                                                                Pi9 Pita Pib Pigm Xa21 xa5 Bph18 Wx Hd1 sd1 GS3 ID02 ID04 ID07 ID09 ID11
  { id: 'YR19-0118', name: "YR19-0118(가칭 '들솔미')", role: 'cand', status: '출원 예정 2026-12', source: SRC_MET, geno: [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 2] },
  { id: 'YR20-0342', name: 'YR20-0342', role: 'cand', status: '2027 출원 검토(남부 메가 환경)', source: SRC_MET, geno: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 2, 2, 0] },
  { id: 'YR20-0527', name: 'YR20-0527', role: 'cand', status: '2027 출원 검토(철원 메가 환경)', source: SRC_MET, geno: [0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0, 0] },
  { id: 'YR19-0083', name: '별하랑', role: 'filed', status: '2026-06-09 출원', source: '출원 서류 분석(2026-05, 추정)', geno: [0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 2, 2] },
  { id: 'YR16-0158', name: '해솔가온', role: 'filed', status: '2025 출원 · 재배심사 중', source: '출원 서류 분석(2025-01, 추정)', geno: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 2, 2, 0, 0] },
  { id: 'YR14-0472', name: '늘솔찬', role: 'reg', status: '2026 등록', source: '출원 서류 분석(2024-03, 추정)', geno: [0, 2, 2, 0, 2, 0, 0, 0, 0, 2, 2, 0, 2, 0, 2, 2] },
  { id: 'YR10-1193', name: '솔빛나래', role: 'reg', status: '2024 등록', source: '출원 서류 분석(2022-04, 추정)', geno: [0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0] },
  { id: 'YR08-1042', name: '청여울', role: 'reg', status: '2022 등록', source: '출원 서류 분석(2020-03, 추정)', geno: [0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 2, 2, 0, 0, 2] },
  { id: 'YR13-0819', name: '온새미로', role: 'check', status: '2025 등록 · MET 대비 · YR19-0118 DUS 대조', source: SRC_MET, geno: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0] },
  { id: 'YR07-0231', name: '가람솔', role: 'check', status: '2020 등록 · 표준 대비', source: SRC_MET, geno: [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 0] },
]
export const PROFILES: Profile[] = RAW.map((p, idx) => ({ ...p, idx, short: p.name.startsWith('YR') ? p.id.slice(5) : p.name }))
export const N = PROFILES.length
export const byName = (name: string) => PROFILES.find(p => p.name === name || p.id === name)!
/** 표시용 이름(가칭 괄호 없이) — 문장·쌍 표기에 쓴다 */
export const label = (p: Profile) => (p.name.startsWith('YR') ? p.id : p.name)
export const OTHER_PROGRAM_VARIETIES = 8
export const RECHECK = { req: 'RQ26-041', shipped: '10-14', state: '결과 대기', lines: 5, seeds: 20 }
export const RECHECK_TEXT = `출원 서류용 재확인 · 시료 출고 ${RECHECK.shipped}(${RECHECK.req}) · ${RECHECK.state}`
export const ENHANCE_SNP = 4820

/* ───────── 2) 쌍 계산 ───────── */
export const DISTINCT_MIN = 2
export const dist = (a: readonly Geno[], b: readonly Geno[], idx: readonly number[] = ALL_IDX) => idx.filter(i => a[i] !== b[i]).length
export const diffMarkers = (a: readonly Geno[], b: readonly Geno[], idx: readonly number[] = ALL_IDX) => idx.filter(i => a[i] !== b[i]).map(i => MARKERS[i]!)
export const diffIdx = (a: readonly Geno[], b: readonly Geno[]) => ALL_IDX.filter(i => a[i] !== b[i])

export interface Pair {
  i: number
  j: number
  d: number
  markers: Marker[]
  dId: number
  idMarkers: Marker[]
}
export const PAIRS: Pair[] = []
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++) {
    const a = PROFILES[i]!.geno
    const b = PROFILES[j]!.geno
    PAIRS.push({ i, j, d: dist(a, b), markers: diffMarkers(a, b), dId: dist(a, b, ID_IDX), idMarkers: diffMarkers(a, b, ID_IDX) })
  }
export const pairOf = (i: number, j: number) => PAIRS.find(p => (p.i === Math.min(i, j) && p.j === Math.max(i, j)))!
export const D_MATRIX: number[][] = PROFILES.map((_, i) => PROFILES.map((_, j) => (i === j ? 0 : pairOf(i, j).d)))
export const D_ID_MATRIX: number[][] = PROFILES.map((_, i) => PROFILES.map((_, j) => (i === j ? 0 : pairOf(i, j).dId)))

const ds = PAIRS.map(p => p.d)
const sortedD = [...ds].sort((x, y) => x - y)
export const PAIR_STATS = {
  pairs: PAIRS.length,
  min: Math.min(...ds),
  max: Math.max(...ds),
  mean: ds.reduce((s, v) => s + v, 0) / ds.length,
  median: sortedD.length % 2 ? sortedD[(sortedD.length - 1) / 2]! : (sortedD[sortedD.length / 2 - 1]! + sortedD[sortedD.length / 2]!) / 2,
  sum: ds.reduce((s, v) => s + v, 0),
}
export const DISTINCT_PAIRS = PAIRS.filter(p => p.d >= DISTINCT_MIN)
export const HARD_PAIRS = PAIRS.filter(p => p.d < DISTINCT_MIN)
export const MIN_PAIRS = PAIRS.filter(p => p.d === DISTINCT_MIN)
export const ID_HARD_PAIRS = PAIRS.filter(p => p.dId < DISTINCT_MIN)
export const ID_ZERO_PAIRS = PAIRS.filter(p => p.dId === 0)
export const DISTINCT_PCT = (DISTINCT_PAIRS.length / PAIRS.length) * 100
export const MAX_PAIR = PAIRS.find(p => p.d === PAIR_STATS.max)!

/** 마커 정보량: 구별하는 쌍 수 = nBB × nAA */
export const MARKER_INFO = MARKERS.map((m, k) => {
  const nBB = PROFILES.filter(p => p.geno[k] === 2).length
  return { marker: m, nBB, pairs: nBB * (N - nBB), mono: nBB === 0 || nBB === N }
})
export const INFO_SUM = MARKER_INFO.reduce((s, v) => s + v.pairs, 0)
export const MONO_MARKERS = MARKER_INFO.filter(v => v.mono).map(v => v.marker)

/** 최근접 품종(동률이면 모두) */
export function nearest(a: number) {
  const d = Math.min(...PROFILES.filter(p => p.idx !== a).map(p => D_MATRIX[a]![p.idx]!))
  return { d, idx: PROFILES.filter(p => p.idx !== a && D_MATRIX[a]![p.idx] === d).map(p => p.idx) }
}

export const LINE = PROFILES[0]! // YR19-0118
export const LINE_NEAREST = nearest(LINE.idx)
export const DUS_CHECK = byName('온새미로')
export const LINE_DUS_D = D_MATRIX[LINE.idx]![DUS_CHECK.idx]!
export const DEFAULT_PAIR: [number, number] = [byName('YR20-0342').idx, byName('온새미로').idx]

export const bbCount = (p: Profile) => p.geno.filter(v => v === 2).length

/* ───────── 3) 종자 순도 검정 ───────── */
export const SEEDS_PER_TEST = 188 // 94시료 × 2판
export const POP_STD = 0.001
export const ACCEPT_PROB = 0.95

export type OffKind = 'hyb' | 'mix'
export const OFF_KIND_LABEL: Record<OffKind, string> = { hyb: '교잡형', mix: '혼입형' }

interface PurityRaw {
  id: string
  year: 2025 | 2026
  line: string
  plot: string
  lot: string | null
  intakeG: number | null
  noCall: number
  /** 재분석 립(기준 프로필과 마커 1개만 다름): 오호출 마커와 유형(AB = 이형 클러스터, opp = 반대 동형) */
  recheck: { marker: Marker; call: RecheckCall }[]
  offTypes: { kind: OffKind; donor: string }[]
  memo?: string
}

/** 재분석 립 유형: AB = 이형 클러스터, opp = 반대 동형(2 − 기준) */
export type RecheckCall = 'AB' | 'opp'
export const RECHECK_CALL_LABEL: Record<RecheckCall, string> = { AB: 'AB', opp: '반대 동형' }
/** 'ID04:AB sd1:opp' → 재분석 목록 */
function rc(spec: string): { marker: Marker; call: RecheckCall }[] {
  return spec.split(' ').map(t => {
    const [marker, call] = t.split(':') as [Marker, RecheckCall]
    return { marker, call }
  })
}
/** 마커당 오호출률(추정, KASP 0.1~0.5%의 중간 아래) */
export const MISCALL_RATE = 0.002
/** 정확히 1개 마커만 오호출될 기대 비율 16e(1−e)^15 */
export const RECHECK_EXPECT = N_MARKERS * MISCALL_RATE * (1 - MISCALL_RATE) ** (N_MARKERS - 1)

export const PURITY_RAW: PurityRaw[] = [
  { id: 'PT26-01', year: 2026, line: '가람솔', plot: 'C-1', lot: 'L26-001', intakeG: 8000, noCall: 1, recheck: rc('ID04:AB ID02:AB sd1:AB'), offTypes: [] },
  { id: 'PT26-02', year: 2026, line: '온새미로', plot: 'C-1', lot: 'L26-002', intakeG: 8000, noCall: 2, recheck: rc('xa5:AB Bph18:AB Pib:opp xa5:AB Pi9:AB Bph18:AB ID07:AB'), offTypes: [] },
  { id: 'PT26-03', year: 2026, line: 'YR19-0118', plot: 'C-1', lot: 'L26-003', intakeG: 5000, noCall: 0, recheck: rc('sd1:AB Xa21:AB Pigm:AB ID11:AB GS3:AB GS3:opp Wx:AB Xa21:AB Pigm:AB'), offTypes: [] },
  { id: 'PT26-04', year: 2026, line: 'YR20-0342', plot: 'C-1', lot: 'L26-004', intakeG: 5000, noCall: 1, recheck: rc('ID11:AB Xa21:AB ID11:opp Pi9:AB Pi9:AB Pi-ta:AB Xa21:AB ID02:AB ID07:opp Bph18:AB ID04:AB'), offTypes: [{ kind: 'hyb', donor: '가람솔' }] },
  { id: 'PT26-05', year: 2026, line: 'YR20-0527', plot: 'C-1', lot: 'L26-005', intakeG: 5000, noCall: 2, recheck: rc('ID04:opp Pi9:AB Pi-ta:AB Wx:AB ID11:AB Pigm:AB Pi9:AB'), offTypes: [] },
  {
    id: 'PT26-06',
    year: 2026,
    line: 'YR20-0527',
    plot: 'C-1 북측 구획',
    lot: null,
    intakeG: null,
    noCall: 3,
    recheck: rc('sd1:AB Pigm:AB ID09:AB GS3:AB Pi9:AB'),
    offTypes: [
      { kind: 'mix', donor: '가람솔' },
      { kind: 'hyb', donor: '가람솔' },
      { kind: 'hyb', donor: '가람솔' },
      { kind: 'hyb', donor: 'YR20-0342' },
    ],
    memo: '북측 구획 — 대비 품종 채종 구획과 인접, 개화기 겹침(추정). 합격 구획 수확분만 L26-005로 입고',
  },
  { id: 'PT25-01', year: 2025, line: '가람솔', plot: 'C-1', lot: 'L25-001', intakeG: 6000, noCall: 2, recheck: rc('ID02:AB GS3:AB Pi-ta:AB GS3:AB ID11:AB'), offTypes: [] },
  { id: 'PT25-02', year: 2025, line: '온새미로', plot: 'C-1', lot: 'L25-002', intakeG: 6000, noCall: 1, recheck: rc('Pi9:opp Wx:AB sd1:AB Pigm:AB Pigm:AB'), offTypes: [{ kind: 'hyb', donor: '가람솔' }] },
  { id: 'PT25-03', year: 2025, line: 'YR19-0118', plot: 'C-1', lot: 'L25-003', intakeG: 3000, noCall: 0, recheck: rc('Xa21:opp Xa21:opp Pigm:AB sd1:AB'), offTypes: [] },
  { id: 'PT25-04', year: 2025, line: 'YR20-0342', plot: 'C-1', lot: 'L25-004', intakeG: 3000, noCall: 2, recheck: rc('ID11:AB ID09:AB ID09:AB GS3:AB'), offTypes: [] },
  { id: 'PT25-05', year: 2025, line: 'YR20-0527', plot: 'C-1', lot: 'L25-005', intakeG: 3000, noCall: 1, recheck: rc('xa5:AB sd1:opp GS3:AB ID11:AB Hd1:AB ID07:AB ID04:AB'), offTypes: [] },
]
export const PURITY_DATES: Record<2025 | 2026, { sampled: string; judged: string; intake: string }> = {
  2026: { sampled: '09-14', judged: '09-22', intake: '10-02' },
  2025: { sampled: '09-15', judged: '09-23', intake: '10-01' },
}

/** P(X ≤ k | n, p) — 공통 @/lib/stats */
export { binomCdf }
/** 허용 이형립 수: P(X ≤ k | n, 0.1%) ≥ 95%인 최소 k */
export const allowed = (n: number) => binomAcceptMax(n, POP_STD, ACCEPT_PROB)
/** 단측 Clopper–Pearson 95% 하한(순도 쪽): 1 − p_U, P(X ≤ x | n, p_U) = 0.05 */
export const lower95 = (x: number, n: number) => 1 - clopperPearsonUpper(x, n, 0.05)
/** 허용 k가 같은 판독 립수 범위(표시용) */
export const ALLOWED_RANGE = (() => {
  let lo = 1
  while (allowed(lo) < 1) lo++
  let hi = lo
  while (allowed(hi + 1) === 1) hi++
  return { lo, hi, k: 1 }
})()

export const hybrid = (ref: readonly Geno[], donor: readonly Geno[]): Geno[] => ref.map((x, i) => (x === donor[i] ? x : 1))
export const mixture = (donor: readonly Geno[]): Geno[] => [...donor]

export type OffClass = 'hyb' | 'mix' | 'recheck' | 'normal'
export function classify(ref: readonly Geno[], g: readonly Geno[]) {
  const hetIdx = ALL_IDX.filter(i => g[i] === 1)
  const mismIdx = ALL_IDX.filter(i => g[i] !== 1 && g[i] !== ref[i])
  const het = hetIdx.length
  const mism = mismIdx.length
  const cls: OffClass = het >= 2 ? 'hyb' : het === 1 ? 'recheck' : mism >= 2 ? 'mix' : mism === 1 ? 'recheck' : 'normal'
  return { cls, het: hetIdx.map(i => MARKERS[i]!), mism: mismIdx.map(i => MARKERS[i]!) }
}
export function origin(ref: readonly Geno[], g: readonly Geno[], cls: OffClass): string {
  const probe: Geno[] = cls === 'hyb' ? g.map((x, i) => (x === 1 ? ((2 - ref[i]!) as Geno) : x)) : [...g]
  const hit = PROFILES.filter(p => dist(p.geno, probe) === 0)
  return hit.length ? hit.map(label).join('·') : '목록 밖'
}
export const undetectable = (line: Profile) => PROFILES.filter(p => p.idx !== line.idx && D_MATRIX[line.idx]![p.idx]! < DISTINCT_MIN)

export type Verdict = 'pass' | 'edge' | 'fail'
export const VERDICT_LABEL: Record<Verdict, string> = { pass: '합격', edge: '합격(한계)', fail: '불합격' }

export interface OffSeed {
  no: string
  kind: OffKind
  cls: OffClass
  het: Marker[]
  mism: Marker[]
  origin: string
  geno: Geno[]
}
export interface PurityRow {
  id: string
  year: 2025 | 2026
  line: Profile
  plot: string
  lot: string | null
  intakeG: number | null
  tested: number
  noCall: number
  n: number
  x: number
  nHyb: number
  nMix: number
  purity: number
  k: number
  verdict: Verdict
  lower: number
  undetect: Profile[]
  offs: OffSeed[]
  /** 재분석 립 — 같은 립 DNA 재실행에서 모두 기준 프로필과 일치(판독 n에 포함, 이형립 x에 불포함) */
  recheck: RecheckSeed[]
  nRecheck: number
  memo?: string
}
export interface RecheckSeed {
  no: string
  marker: Marker
  call: RecheckCall
  result: 'match'
  geno: Geno[]
}
export const PURITY_ROWS: PurityRow[] = PURITY_RAW.map(r => {
  const line = byName(r.line)
  const n = SEEDS_PER_TEST - r.noCall
  const offs: OffSeed[] = r.offTypes.map((o, k) => {
    const donor = byName(o.donor).geno
    const g = o.kind === 'hyb' ? hybrid(line.geno, donor) : mixture(donor)
    const c = classify(line.geno, g)
    return { no: `O${k + 1}`, kind: o.kind, cls: c.cls, het: c.het, mism: c.mism, origin: origin(line.geno, g, c.cls), geno: g }
  })
  const recheck: RecheckSeed[] = r.recheck.map((c, j) => {
    const mi = MARKERS.indexOf(c.marker)
    const geno: Geno[] = line.geno.map((v, i) => (i === mi ? (c.call === 'AB' ? 1 : ((2 - v) as Geno)) : v))
    return { no: `R${j + 1}`, marker: c.marker, call: c.call, result: 'match', geno }
  })
  const x = offs.length
  const k = allowed(n)
  const verdict: Verdict = x > k ? 'fail' : x === k && k >= 1 ? 'edge' : 'pass'
  return {
    id: r.id,
    year: r.year,
    line,
    plot: r.plot,
    lot: r.lot,
    intakeG: r.intakeG,
    tested: SEEDS_PER_TEST,
    noCall: r.noCall,
    n,
    x,
    nHyb: offs.filter(o => o.cls === 'hyb').length,
    nMix: offs.filter(o => o.cls === 'mix').length,
    purity: ((n - x) / n) * 100,
    k,
    verdict,
    lower: lower95(x, n) * 100,
    undetect: undetectable(line),
    offs,
    recheck,
    nRecheck: recheck.length,
    memo: r.memo,
  }
})
export const YEARS: (2025 | 2026)[] = [2026, 2025]
export function yearSummary(year: 2025 | 2026) {
  const rows = PURITY_ROWS.filter(r => r.year === year)
  const intake = rows.filter(r => r.lot)
  const intakeN = intake.reduce((s, r) => s + r.n, 0)
  const intakeX = intake.reduce((s, r) => s + r.x, 0)
  const read = rows.reduce((s, r) => s + r.n, 0)
  const recheck = rows.reduce((s, r) => s + r.nRecheck, 0)
  return {
    recheck,
    recheckPct: (recheck / read) * 100,
    rows,
    tests: rows.length,
    tested: rows.reduce((s, r) => s + r.tested, 0),
    read,
    off: rows.reduce((s, r) => s + r.x, 0),
    pass: rows.filter(r => r.verdict !== 'fail').length,
    edge: rows.filter(r => r.verdict === 'edge').length,
    fail: rows.filter(r => r.verdict === 'fail'),
    intakeLots: intake.length,
    intakeN,
    intakeX,
    intakePurity: ((intakeN - intakeX) / intakeN) * 100,
  }
}
export const Y2026 = yearSummary(2026)
export const Y2025 = yearSummary(2025)
export const AXIS_MAX = 5

/* ───────── 문구 ───────── */
export const DUS_NOTE = '마커 구별은 품종 식별(동일성 확인) 참고 자료입니다. 품종보호를 위한 DUS 심사의 구별성은 형태·생리 형질로 판정합니다'

/* ───────── 5) DEV 검산 ───────── */
if (import.meta.env.DEV) {
  const A = (c: boolean, msg: string) => console.assert(c, `[검산] variety-identity-markers: ${msg}`)
  const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps
  const g = (name: string) => byName(name).geno.join('')

  // VAB KASP 4행 복사
  A(g('YR19-0118') === '0020000000022002', 'YR19-0118 프로필 ≠ VAB')
  A(g('온새미로') === '0000000020020200', '온새미로 프로필 ≠ VAB')
  A(g('늘솔찬') === '0220200002202022', '늘솔찬 프로필 ≠ VAB')
  A(g('가람솔') === '0000000022000020', '가람솔 프로필 ≠ VAB')
  A(MARKERS.filter((_, i) => LINE.geno[i] === 2).join('·') === 'Pib·ID02·ID04·ID11', 'YR19-0118 BB 마커 ≠ Pib·ID02·ID04·ID11')

  // haplotype-viewer 표적 보유 35칸(sd1·Hd1·GS3·Pi-ta·Pi9)
  const HAP: Record<string, boolean[]> = {
    // 순서: YR19-0118, YR20-0342, YR20-0527, 가람솔, 온새미로, 별하랑, 늘솔찬
    sd1: [false, false, true, true, false, true, true],
    Hd1: [false, true, false, true, true, true, false],
    GS3: [false, false, false, false, false, true, true],
    'Pi-ta': [false, false, false, false, false, true, true],
    Pi9: [false, false, false, false, false, false, false],
  }
  const hapLines = ['YR19-0118', 'YR20-0342', 'YR20-0527', '가람솔', '온새미로', '별하랑', '늘솔찬']
  let hapOk = 0
  for (const [m, carry] of Object.entries(HAP)) {
    const k = MARKERS.indexOf(m as Marker)
    hapLines.forEach((nm, j) => (hapOk += (byName(nm).geno[k] === 2) === carry[j] ? 1 : 0))
  }
  A(hapOk === 35, `haplotype-viewer 고정점 ${hapOk}/35`)

  // 계보 불일치 0
  const P22: Record<string, (0 | 2)[]> = {
    'YR22-0412': [0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 2],
    'YR22-0415': [0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 2, 0],
  }
  const trios: [readonly Geno[], string, string][] = [
    [byName('별하랑').geno, '가람솔', '늘솔찬'],
    [byName('늘솔찬').geno, '청여울', '솔빛나래'],
    [LINE.geno, '온새미로', '늘솔찬'],
    [P22['YR22-0412']!, '별하랑', '해솔가온'],
    [P22['YR22-0415']!, '별하랑', '해솔가온'],
  ]
  for (const [c, f, m] of trios) {
    const fg = byName(f).geno
    const mg = byName(m).geno
    const bad = ALL_IDX.filter(i => c[i] !== fg[i] && c[i] !== mg[i]).length
    A(bad === 0, `계보 불일치 ${f}/${m} ${bad}개`)
  }
  const hs = byName('해솔가온').geno
  A(ALL_IDX.filter(i => hs[i] !== DUS_CHECK.geno[i]).every(i => ['Hd1', 'sd1', 'ID04'].includes(MARKERS[i]!)), '해솔가온 vs 온새미로 차이 ≠ Hd1·sd1·ID04')

  // 쌍 통계
  A(PAIRS.length === 45 && DISTINCT_PAIRS.length === 44 && HARD_PAIRS.length === 1, `식별 가능 ${DISTINCT_PAIRS.length}/${PAIRS.length} ≠ 44/45`)
  const hp = HARD_PAIRS[0]!
  A(label(PROFILES[hp.i]!) === 'YR20-0342' && PROFILES[hp.j]!.name === '온새미로' && hp.markers.join() === 'ID09', '식별 곤란 쌍 ≠ YR20-0342 ↔ 온새미로(ID09)')
  A(MIN_PAIRS.length === 1 && label(PROFILES[MIN_PAIRS[0]!.i]!) === 'YR20-0527' && PROFILES[MIN_PAIRS[0]!.j]!.name === '해솔가온' && MIN_PAIRS[0]!.markers.join('·') === 'Pib·ID02', 'd = 2 쌍 ≠ YR20-0527 ↔ 해솔가온(Pib·ID02)')
  A(PAIR_STATS.min === 1 && PAIR_STATS.max === 11 && near(PAIR_STATS.mean, 5.622222) && PAIR_STATS.median === 5, `쌍 통계 ${PAIR_STATS.min}/${PAIR_STATS.max}/${PAIR_STATS.mean}/${PAIR_STATS.median}`)
  A(PROFILES[MAX_PAIR.i]!.name === '늘솔찬' && PROFILES[MAX_PAIR.j]!.name === '온새미로', '최대 쌍 ≠ 늘솔찬 ↔ 온새미로')
  A(near(DISTINCT_PCT, 97.77778), `식별 가능 비율 ${DISTINCT_PCT}`)
  const dl = (nm: string) => D_MATRIX[LINE.idx]![byName(nm).idx]
  A(dl('온새미로') === 5 && dl('늘솔찬') === 6 && dl('가람솔') === 7, 'YR19-0118 차이 온새미로·늘솔찬·가람솔 ≠ 5·6·7')
  A(LINE_NEAREST.d === 3 && LINE_NEAREST.idx.length === 1 && PROFILES[LINE_NEAREST.idx[0]!]!.name === '청여울', 'YR19-0118 최근접 ≠ 청여울 3')
  A(diffMarkers(LINE.geno, byName('청여울').geno).join('·') === 'Pi-ta·Hd1·sd1', 'YR19-0118 ↔ 청여울 차이 ≠ Pi-ta·Hd1·sd1')
  const dist_hist = Array.from({ length: 12 }, (_, d) => PAIRS.filter(p => p.d === d).length)
  A(dist_hist.join() === '0,1,1,4,7,11,8,6,2,2,2,1', `d 분포 ${dist_hist.join()}`)

  // 정보량
  A(INFO_SUM === 253 && INFO_SUM === PAIR_STATS.sum, `정보량 합 ${INFO_SUM} ≠ Σd ${PAIR_STATS.sum} ≠ 253`)
  A(MONO_MARKERS.join('·') === 'Pi9·Pigm·xa5·Bph18·Wx', `단형 마커 ${MONO_MARKERS.join('·')}`)
  A(MARKER_INFO.map(v => v.pairs).join() === '0,21,25,0,16,0,0,0,25,21,21,25,25,25,25,24', `정보량 ${MARKER_INFO.map(v => v.pairs).join()}`)

  // ID 마커만
  A(ID_HARD_PAIRS.length === 8 && ID_ZERO_PAIRS.length === 1, `ID 마커만 식별 곤란 ${ID_HARD_PAIRS.length} ≠ 8`)
  A(label(PROFILES[ID_ZERO_PAIRS[0]!.i]!) === 'YR19-0118' && PROFILES[ID_ZERO_PAIRS[0]!.j]!.name === '청여울', 'ID 0개 쌍 ≠ YR19-0118 ↔ 청여울')

  // 순도
  const R = (id: string) => PURITY_ROWS.find(r => r.id === id)!
  A(Y2026.rows.length === 6 && Y2026.pass === 5 && Y2026.fail.length === 1 && Y2026.fail[0]!.id === 'PT26-06' && Y2026.edge === 1, '2026 판정 ≠ 합격 5(한계 1)·불합격 PT26-06')
  A(Y2025.rows.length === 5 && Y2025.pass === 5, '2025 판정 ≠ 5건 모두 합격')
  A(R('PT26-06').x === 4 && R('PT26-06').n === 185 && near(R('PT26-06').purity, 97.837838) && near(R('PT26-06').lower, 95.12075, 1e-3), 'PT26-06 4/185 97.84% 하한 95.1 불일치')
  A(R('PT26-04').verdict === 'edge' && R('PT26-04').n === 187 && near(R('PT26-04').purity, 99.465241) && near(R('PT26-04').lower, 97.48843, 1e-3), 'PT26-04 합격(한계) 1/187 불일치')
  A(near(R('PT26-01').lower, 98.41077, 1e-3) && near(R('PT26-02').lower, 98.40229, 1e-3) && near(R('PT26-03').lower, 98.41915, 1e-3), '이형 0 하한 98.4 불일치')
  A(PURITY_ROWS.every(r => r.k === 1), '허용 k ≠ 1')
  A(ALLOWED_RANGE.lo === 52 && ALLOWED_RANGE.hi === 355, `허용 1립 범위 ${ALLOWED_RANGE.lo}~${ALLOWED_RANGE.hi} ≠ 52~355`)
  A(near(binomCdf(0, 186, POP_STD), 0.8302, 1e-4) && near(binomCdf(1, 186, POP_STD), 0.98477, 1e-4), 'P(X ≤ 0·1 | 186) 불일치')
  const o6 = R('PT26-06').offs
  A(o6[0]!.cls === 'mix' && o6[0]!.mism.join('·') === 'Pib·Hd1·ID04·ID07·ID09' && o6[0]!.origin === '가람솔', 'PT26-06 O1 혼입형 가람솔 불일치')
  A(o6[1]!.cls === 'hyb' && o6[2]!.cls === 'hyb' && o6[1]!.origin === '가람솔' && o6[2]!.origin === '가람솔' && o6[1]!.het.join('·') === 'Pib·Hd1·ID04·ID07·ID09', 'PT26-06 O2·O3 교잡형 가람솔 불일치')
  A(o6[3]!.cls === 'hyb' && o6[3]!.origin === 'YR20-0342' && o6[3]!.het.join('·') === 'Pib·Hd1·sd1·ID02·ID04·ID09', 'PT26-06 O4 교잡형 YR20-0342 불일치')
  A(R('PT26-04').offs[0]!.het.join('·') === 'sd1·ID02·ID07' && R('PT26-04').offs[0]!.origin === '가람솔', 'PT26-04 O1 불일치')
  A(R('PT25-02').offs[0]!.het.join('·') === 'sd1·ID02·ID07·ID09' && R('PT25-02').offs[0]!.origin === '가람솔', 'PT25-02 O1 불일치')
  A(PURITY_ROWS.every(r => r.offs.every(o => o.cls === o.kind)), '이형립 분류가 생성 유형과 다름')
  A(Y2026.read === 1119 && Y2026.tested === 1128 && Y2026.off === 5 && Y2026.intakeN === 934 && Y2026.intakeX === 1 && near(Y2026.intakePurity, 99.89293), '2026 합계 불일치')
  A(Y2025.read === 934 && Y2025.tested === 940 && Y2025.off === 1, '2025 합계 불일치')
  A(R('PT26-02').undetect.map(label).join() === 'YR20-0342' && R('PT26-04').undetect.map(label).join() === '온새미로' && R('PT26-01').undetect.length === 0, '검출 불가 혼입 불일치')
  A(R('PT26-01').intakeG === 8000 && R('PT26-03').intakeG === 5000, '입고량 ≠ seed-inventory')

  // 재분석 립(정리 회차 5 B1)
  A(PURITY_ROWS.map(r => r.nRecheck).join() === '3,7,9,11,7,5,5,5,4,4,7', `재분석 립 ${PURITY_ROWS.map(r => r.nRecheck).join()}`)
  A(Y2026.recheck === 42 && Y2025.recheck === 25, `재분석 합 ${Y2026.recheck}/${Y2025.recheck} ≠ 42/25`)
  A(near(Y2026.recheckPct, 3.753351) && near(Y2025.recheckPct, 2.676660), `재분석 비율 ${Y2026.recheckPct}/${Y2025.recheckPct}`)
  A(PURITY_ROWS.every(r => r.recheck.every(s => classify(r.line.geno, s.geno).cls === 'recheck')), '재분석 립 classify ≠ recheck')
  A(near(RECHECK_EXPECT * 100, 3.1052, 1e-3), `재분석 기대 비율 ${RECHECK_EXPECT}`)
}
