import { KASP_ALLELE_DIRECTION_NOTE, KASP_MARKERS, type KaspMarker } from '@/lib/genomics'
import { createRng } from '@/lib/rng'

// 명세: docs/specs/crossing-record.md — 「목업 데이터 생성 규칙」을 그대로 옮긴다.
// RNG 호출 순서가 바뀌면 화면이 바뀐다(PAIRS 정의 순서 → ID 순서 실적 → 1차 묶음 개체).

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const NURSERY_SOW = '2026-04-15'
export const TARGET_SEEDS = 40
export const EARLY_HARVEST_DAP = 28
export const BATCH1_CUTOFF = '2026-09-07'
export const RATE_LOW = 12
export const RATE_HIGH = 50
export const F1_PER_CROSS = 4
export const MIN_POLY = 3
export const SELF_SUSPECT_RATIO = 0.5
/** 교배일 허용 기간(오류 기준) */
export const SEASON_START = '2026-07-20'
export const SEASON_END = '2026-09-10'
/** 교배일 경고: 모본 출수일 이전 또는 출수일 + 7일 이후 */
export const HEADING_WINDOW_DAYS = 7
/** 이삭당 영화 수 경고 범위 */
export const FLORETS_PER_PANICLE_MIN = 20
export const FLORETS_PER_PANICLE_MAX = 80
export const SAVE_DELAY_MS = 600
export const ROUND_LABEL = '2026년 2차 교배'
export const NEXT_ROUND_LABEL = '2027년 1차 교배(온실)'
export const MARKER_PANEL_SIZE = 16

export interface BatchInfo {
  no: 1 | 2
  plate: string
  sown: string
  sampled: string
  received: string
  resulted: string
  /** 기준일에 결과가 나왔는가 */
  done: boolean
}
export const BATCHES: Record<1 | 2, BatchInfo> = {
  1: { no: 1, plate: 'KSP-2609-09', sown: '2026-09-09', sampled: '2026-09-23', received: '2026-09-24', resulted: '2026-09-30', done: true },
  2: { no: 2, plate: 'KSP-2611-01', sown: '2026-10-08', sampled: '2026-10-26', received: '2026-10-27', resulted: '2026-11-03', done: false },
}

// ---------------------------------------------------------------- 부모 14계통(cross-planner CANDIDATES 실행값 복사)

export type ParentGroup = 'A' | 'B' | 'C'
export const GROUP_LABEL: Record<ParentGroup, string> = { A: 'A 중만생 다수성', B: 'B 조생 고품질', C: 'C 저항성 공여' }

export interface Parent {
  name: string
  group: ParentGroup
  family: string
  /** 출수 일수(파종 후 일수) */
  heading: number
  /** 도열병 저항성 유전자, 없으면 null */
  pi: string | null
}

const PARENT_LIST: Parent[] = [
  { name: 'YR22-0412', group: 'A', family: 'F01', heading: 118, pi: 'Pi-ta' },
  { name: 'YR22-0415', group: 'A', family: 'F01', heading: 116, pi: 'Pi-ta' },
  { name: 'YR21-0877', group: 'A', family: 'F05', heading: 120, pi: null },
  { name: 'YR23-0136', group: 'A', family: 'F09', heading: 119, pi: 'Pib' },
  { name: 'YR22-0263', group: 'B', family: 'F12', heading: 111, pi: null },
  { name: 'YR21-0594', group: 'B', family: 'F12', heading: 107, pi: 'Pib' },
  { name: 'YR20-1108', group: 'C', family: 'F18', heading: 124, pi: 'Pi9' },
  { name: 'YR19-0731', group: 'C', family: 'F19', heading: 112, pi: 'Pigm' },
  { name: 'YR21-8380', group: 'A', family: 'F08', heading: 115, pi: 'Pi-ta' },
  { name: 'YR22-8678', group: 'A', family: 'F06', heading: 119, pi: null },
  { name: 'YR22-6348', group: 'B', family: 'F14', heading: 107, pi: null },
  { name: 'YR23-5617', group: 'C', family: 'F20', heading: 112, pi: 'Pi9' },
  { name: 'YR20-0962', group: 'B', family: 'F13', heading: 110, pi: 'Pib' },
  { name: 'YR21-7243', group: 'A', family: 'F10', heading: 117, pi: 'Pib' },
]
export const PARENTS: Record<string, Parent> = Object.fromEntries(PARENT_LIST.map(p => [p.name, p]))

// ---------------------------------------------------------------- KASP 16마커와 부모 유전형

/** 분석실 KASP 16마커 패널 순서(공통 @/lib/genomics) */
export const MARKERS = KASP_MARKERS
export type Marker = KaspMarker
/** KASP 대립유전자 방향 정의(조합 상세 KASP 표 범례, 2026-10-29 정리 회차 4) */
export const ALLELE_DIRECTION_NOTE = KASP_ALLELE_DIRECTION_NOTE
/**
 * 0 = AA, 2 = BB. 고정 계통이라 이형접합 없음.
 * 기능 마커(유전자 이름 마커)는 BB = 효과(표적) 대립유전자 동형: 저항성 유전자 보유(Pi9·Pi-ta·Pib·Pigm·Xa21·xa5·Bph18),
 * Wx 저아밀로스, Hd1 출수 지연형, sd1 반왜성, GS3 천립중 증가형. Hd1·sd1·GS3·Pi-ta·Pi9 칸은 haplotype-viewer
 * 리드 SNP 표적 대립유전자 보유 판정(BREED 행)과 같다(2026-10-29 정리 회차 4). ID 마커(ID02~ID11)는 품종 식별용 중립 SNP로
 * AA = 기준 게놈(IRGSP-1.0) 대립유전자, BB = 대체 대립유전자.
 */
export type Geno = 0 | 2
// prettier-ignore
export const PARENT_GENO: Record<string, readonly Geno[]> = {
  //              Pi9 Pita Pib Pigm Xa21 xa5 Bph18 Wx Hd1 sd1 GS3 ID02 ID04 ID07 ID09 ID11
  'YR22-0412': [0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 2],
  'YR22-0415': [0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 2, 0],
  'YR21-0877': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 2, 2],
  'YR23-0136': [0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 2, 0, 0],
  'YR22-0263': [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 2, 0, 0, 2],
  'YR21-0594': [0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 2, 0],
  'YR20-1108': [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 2],
  'YR19-0731': [0, 0, 0, 2, 0, 2, 2, 0, 0, 0, 0, 2, 0, 0, 2, 0],
  'YR21-8380': [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
  'YR22-8678': [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0],
  'YR22-6348': [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 2, 0, 2],
  'YR23-5617': [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 2, 2, 0, 0],
  'YR20-0962': [0, 0, 2, 0, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0, 0, 2],
  'YR21-7243': [0, 0, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 2, 0, 0],
}
export const GENO_LABEL: Record<Geno, string> = { 0: 'AA', 2: 'BB' }

// ---------------------------------------------------------------- 날짜 보조

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
/** '2026-08-01' → '08-01' */
export const mmdd = (iso: string) => iso.slice(5)
/** '2026-10-27' → '10/27' */
export const mSlashD = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`

// ---------------------------------------------------------------- 생성

const PAIRS: readonly (readonly [string, string])[] = [
  ['YR21-0594', 'YR21-8380'], ['YR21-0594', 'YR22-8678'], ['YR22-6348', 'YR22-0412'], ['YR22-6348', 'YR21-0877'],
  ['YR22-0263', 'YR21-7243'], ['YR22-0263', 'YR21-8380'], ['YR20-0962', 'YR22-0415'], ['YR20-0962', 'YR23-0136'],
  ['YR19-0731', 'YR21-8380'], ['YR19-0731', 'YR22-6348'], ['YR23-5617', 'YR22-0412'], ['YR23-5617', 'YR21-7243'],
  ['YR21-8380', 'YR23-0136'], ['YR21-8380', 'YR20-1108'], ['YR22-0415', 'YR22-8678'], ['YR22-0415', 'YR23-5617'],
  ['YR21-7243', 'YR19-0731'], ['YR22-0412', 'YR21-7243'], ['YR22-0412', 'YR20-0962'], ['YR23-0136', 'YR22-6348'],
  ['YR22-8678', 'YR20-1108'], ['YR21-0877', 'YR20-0962'], ['YR21-0877', 'YR21-7243'], ['YR20-1108', 'YR22-0263'],
]
const pairKey = (f: string, m: string) => `${f}x${m}`
const LOW_SET = new Set([pairKey('YR22-6348', 'YR21-0877'), pairKey('YR22-8678', 'YR20-1108')])
const INCOMPLETE_EMASC = new Set([pairKey('YR22-0415', 'YR22-8678'), pairKey('YR20-1108', 'YR22-0263')])
const UNENTERED = new Set([pairKey('YR21-0877', 'YR21-7243'), pairKey('YR22-0412', 'YR21-7243')])

/** 결실 이상 원인 메모(추정) — 모본×부본 키 */
const MEMO: Record<string, string> = {
  [pairKey('YR22-6348', 'YR21-0877')]: '출수 차 13일 — 부본 분할 파종 3회차 꽃가루 부족(추정)',
  [pairKey('YR22-8678', 'YR20-1108')]: '수분 직후 강우(08-14, 추정)',
}

export type PlantCall = 'F1' | 'self'

/** 교배 조합 원본(생성 시점에 고정되는 값) */
export interface Cross {
  id: string
  female: string
  male: string
  femaleHeading: string
  /** 화면 기본값(기록된 교배일) */
  date: string
  panicles: number
  florets: number
  /** 생성기가 만든 실제 립수(미입력 조합의 입력 예시 값) */
  trueSeeds: number
  /** 화면 기본 립수, 미입력이면 null */
  seeds: number | null
  pSelf: number
  harvest: string
  batch: 1 | 2
  /** 다형 마커 인덱스(MARKERS 기준) */
  poly: number[]
  /** 1차 묶음 개체 판정(F1-1~F1-4), 2차 묶음은 null */
  plants: PlantCall[] | null
  memo: string | null
}

function generate(): Cross[] {
  const rng = createRng(SEED)
  // 1) 교배일 — PAIRS 정의 순서
  const base = PAIRS.map(([female, male]) => {
    const femaleHeading = addDays(NURSERY_SOW, PARENTS[female]!.heading)
    return { female, male, femaleHeading, date: addDays(femaleHeading, rng.int(1, 2)) }
  })
  // 2) 교배일 → 모본명 → 부본명 오름차순 정렬 후 ID
  base.sort((a, b) => a.date.localeCompare(b.date) || a.female.localeCompare(b.female) || a.male.localeCompare(b.male))
  const out: Cross[] = []
  // 3) 교배 실적 — ID 순서
  base.forEach((b, i) => {
    const k = pairKey(b.female, b.male)
    const panicles = rng.int(4, 8)
    let florets = 0
    for (let j = 0; j < panicles; j++) florets += Math.round(Math.min(62, Math.max(30, rng.normal(46, 7))))
    let s: number
    let selfAdd = 0
    if (LOW_SET.has(k)) s = 0.04 + 0.06 * rng.next()
    else if (INCOMPLETE_EMASC.has(k)) {
      s = 0.03 + 0.05 * rng.next()
      selfAdd = 0.45 + 0.15 * rng.next()
    } else s = Math.min(0.42, Math.max(0.14, rng.normal(0.28, 0.06)))
    const crossSeeds = Math.round(florets * s)
    const selfSeeds = Math.round(florets * selfAdd)
    const trueSeeds = Math.min(florets, crossSeeds + selfSeeds)
    const harvest = addDays(b.date, EARLY_HARVEST_DAP)
    const fg = PARENT_GENO[b.female]!
    const mg = PARENT_GENO[b.male]!
    out.push({
      id: `CR26-${301 + i}`,
      ...b,
      panicles,
      florets,
      trueSeeds,
      seeds: UNENTERED.has(k) ? null : trueSeeds,
      pSelf: trueSeeds ? (selfSeeds + 0.02 * crossSeeds) / trueSeeds : 0, // 0.02 = 정상 제웅의 잔여 자식률(추정)
      harvest,
      batch: harvest <= BATCH1_CUTOFF ? 1 : 2,
      poly: MARKERS.map((_, mi) => mi).filter(mi => fg[mi] !== mg[mi]),
      plants: null,
      memo: MEMO[k] ?? null,
    })
  })
  // 4) 1차 묶음 F1 개체 — ID 순서, 조합당 min(4, trueSeeds)주
  for (const c of out)
    if (c.batch === 1) c.plants = Array.from({ length: Math.min(F1_PER_CROSS, c.trueSeeds) }, () => (rng.next() < c.pSelf ? 'self' : 'F1'))
  return out
}

export const CROSSES: Cross[] = generate()
export const CROSS_BY_ID: Record<string, Cross> = Object.fromEntries(CROSSES.map(c => [c.id, c]))
export const DEFAULT_SELECTED = 'CR26-315'

/** 개체 유전형(난수 없음): 다형 마커에서 F1 → 'AB', 자식 → 모본 유전형. 다형이 아닌 마커는 부모 공통 유전형 */
export function plantGenotype(c: Cross, call: PlantCall, markerIdx: number): 'AA' | 'BB' | 'AB' {
  const f = PARENT_GENO[c.female]![markerIdx]!
  const m = PARENT_GENO[c.male]![markerIdx]!
  if (f === m) return GENO_LABEL[f] as 'AA' | 'BB'
  return call === 'F1' ? 'AB' : (GENO_LABEL[f] as 'AA' | 'BB')
}

// ---------------------------------------------------------------- 편집 값과 검증

/** 편집 가능한 필드(입력 문자열 그대로). 교배일은 MM-DD */
export interface Fields {
  date: string
  panicles: string
  florets: string
  seeds: string
}
export type FieldKey = keyof Fields
export const FIELD_KEYS: FieldKey[] = ['date', 'panicles', 'florets', 'seeds']
export const FIELD_LABEL: Record<FieldKey, string> = { date: '교배일', panicles: '제웅 이삭', florets: '교배 영화', seeds: '결실 립수' }

export function defaultFields(c: Cross): Fields {
  return { date: mmdd(c.date), panicles: String(c.panicles), florets: String(c.florets), seeds: c.seeds == null ? '' : String(c.seeds) }
}
export const DEFAULT_FIELDS: Record<string, Fields> = Object.fromEntries(CROSSES.map(c => [c.id, defaultFields(c)]))

export type F1Status = 'pending' | 'confirmed' | 'suspect'
export const STATUS_LABEL: Record<F1Status, string> = { pending: '대기', confirmed: '확인', suspect: '자식 의심' }
export type OverrideReason = 'reread' | 'growth' | 'other'
export const REASON_LABEL: Record<OverrideReason, string> = { reread: '재판독', growth: 'F1 생육 특성 확인', other: '기타' }
export interface Override {
  status: F1Status
  reason: OverrideReason
}

export interface FieldIssue {
  level: 'error' | 'warn'
  message: string
}

const INT_RE = /^\d+$/
function parseIntField(s: string): number | null | 'bad' {
  const t = s.trim()
  if (t === '') return null
  if (!INT_RE.test(t)) return 'bad'
  return Number(t)
}
function parseDateField(s: string): string | 'bad' {
  const t = s.trim()
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(t) ?? /^2026-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (!m) return 'bad'
  const mo = Number(m[1])
  const d = Number(m[2])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return 'bad'
  const iso = `2026-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return addDays(iso, 0) === iso ? iso : 'bad'
}

export type FieldIssues = Partial<Record<FieldKey, FieldIssue>>

/** 한 조합의 입력 검증(오류는 저장 차단, 경고는 표시만) */
export function validate(c: Cross, f: Fields): FieldIssues {
  const out: FieldIssues = {}
  const date = parseDateField(f.date)
  if (date === 'bad') out.date = { level: 'error', message: 'MM-DD 형식의 날짜를 입력하세요' }
  else if (date < SEASON_START || date > SEASON_END)
    out.date = { level: 'error', message: `교배일이 회차 기간(${mmdd(SEASON_START)}~${mmdd(SEASON_END)}) 밖입니다` }
  else if (date < c.femaleHeading || date > addDays(c.femaleHeading, HEADING_WINDOW_DAYS))
    out.date = { level: 'warn', message: `모본 출수일 ${mmdd(c.femaleHeading)} 기준 범위 밖` }

  const pan = parseIntField(f.panicles)
  if (pan === 'bad' || pan === null || pan <= 0) out.panicles = { level: 'error', message: '제웅 이삭은 1 이상의 정수입니다' }
  const flo = parseIntField(f.florets)
  if (flo === 'bad' || flo === null || flo <= 0) out.florets = { level: 'error', message: '교배 영화는 1 이상의 정수입니다' }
  else if (typeof pan === 'number' && pan > 0) {
    const per = flo / pan
    if (per < FLORETS_PER_PANICLE_MIN || per > FLORETS_PER_PANICLE_MAX)
      out.florets = { level: 'warn', message: `이삭당 영화 ${formatPer(per)}개 — ${FLORETS_PER_PANICLE_MIN}~${FLORETS_PER_PANICLE_MAX} 밖` }
  }
  const seeds = parseIntField(f.seeds)
  if (seeds === 'bad') out.seeds = { level: 'error', message: '0 이상의 정수를 입력하세요' }
  else if (seeds !== null && typeof flo === 'number' && flo > 0 && seeds > flo)
    out.seeds = { level: 'error', message: `결실 립수가 교배 영화 수(${flo.toLocaleString('ko-KR')})보다 많습니다` }
  return out
}
function formatPer(v: number) {
  return (Math.round(v * 10) / 10).toFixed(1)
}

// ---------------------------------------------------------------- 파생값

export type Band = 'normal' | 'low' | 'high' | 'missing'
export const BAND_LABEL: Record<Band, string> = { normal: '정상', low: '결실 저조', high: '결실 과다', missing: '미입력' }
export type Recross = 'suspect' | 'short' | 'needInput' | null

export interface Derived {
  cross: Cross
  /** 계산에 쓰는 값(오류가 있는 필드는 마지막 저장값) */
  date: string
  harvest: string
  panicles: number
  florets: number
  seeds: number | null
  rate: number | null
  band: Band
  kaspStatus: F1Status
  status: F1Status
  /** 유효 F1·재교배·진행 차트 색·달성 내역을 정하는 판정(재판독 대기면 KASP 판정) */
  basis: F1Status
  /** 재판독 대기: KASP 결과가 있는데 수동으로 '대기'로 바꾼 조합 */
  reread: boolean
  manual: boolean
  nSelf: number
  nF1: number
  /** 유효 F1(원값, 반올림 전) */
  eff: number
  recross: Recross
}

export function kaspStatus(c: Cross): F1Status {
  if (!c.plants || c.plants.length === 0) return 'pending'
  const nSelf = c.plants.filter(p => p === 'self').length
  return nSelf / c.plants.length >= SELF_SUSPECT_RATIO ? 'suspect' : 'confirmed'
}

function usable(c: Cross, f: Fields, fallback: Fields, issues: FieldIssues) {
  const pick = (k: FieldKey) => (issues[k]?.level === 'error' ? fallback[k] : f[k])
  const d = parseDateField(pick('date'))
  const date = d === 'bad' ? c.date : d
  const p = parseIntField(pick('panicles'))
  const fl = parseIntField(pick('florets'))
  const s = parseIntField(pick('seeds'))
  const florets = typeof fl === 'number' ? fl : c.florets
  return {
    date,
    panicles: typeof p === 'number' ? p : c.panicles,
    florets,
    seeds: typeof s === 'number' && s <= florets ? s : null,
  }
}

export function derive(c: Cross, f: Fields, fallback: Fields, override: Override | undefined): Derived {
  const issues = validate(c, f)
  const v = usable(c, f, fallback, issues)
  const rate = v.seeds == null ? null : (v.seeds / v.florets) * 100
  const band: Band = rate == null ? 'missing' : rate < RATE_LOW ? 'low' : rate > RATE_HIGH ? 'high' : 'normal'
  const ks = kaspStatus(c)
  const status = override?.status ?? ks
  const nSelf = c.plants ? c.plants.filter(p => p === 'self').length : 0
  const nF1 = c.plants ? c.plants.length - nSelf : 0
  // KASP 결과가 있는 조합을 수동 '대기'로 바꾸면(재판독 대기) 유효 F1·재교배는 KASP 판정 기준 값을 유지
  const basis: F1Status = status === 'pending' && c.plants && c.plants.length ? ks : status
  let eff = 0
  if (v.seeds != null) {
    if (basis === 'suspect') eff = 0
    else if (basis === 'confirmed') eff = c.plants && c.plants.length ? (v.seeds * nF1) / c.plants.length : v.seeds
    else eff = v.seeds
  }
  const recross: Recross = basis === 'suspect' ? 'suspect' : v.seeds == null ? 'needInput' : eff < TARGET_SEEDS ? 'short' : null
  return {
    cross: c,
    date: v.date,
    harvest: addDays(v.date, EARLY_HARVEST_DAP),
    panicles: v.panicles,
    florets: v.florets,
    seeds: v.seeds,
    rate,
    band,
    kaspStatus: ks,
    status,
    basis,
    reread: status === 'pending' && basis !== 'pending',
    manual: override !== undefined && override.status !== ks,
    nSelf,
    nF1,
    eff,
    recross,
  }
}

export interface Summary {
  n: number
  target: number
  effCapped: number
  progress: number
  reached: number
  /** 목표 달성 조합의 진위 상태별 내역 */
  reachedBy: Record<F1Status, number>
  /** 재판독 대기 조합 수 */
  reread: number
  entered: number
  seedsSum: number
  enteredFlorets: number
  pooledRate: number | null
  status: Record<F1Status, number>
  bands: Record<Band, number>
  recross: { total: number; suspect: number; short: number; needInput: number }
}

export function summarize(rows: Derived[]): Summary {
  const n = rows.length
  const target = n * TARGET_SEEDS
  const effCapped = rows.reduce((a, r) => a + Math.min(r.eff, TARGET_SEEDS), 0)
  const entered = rows.filter(r => r.seeds != null)
  const seedsSum = entered.reduce((a, r) => a + (r.seeds ?? 0), 0)
  const enteredFlorets = entered.reduce((a, r) => a + r.florets, 0)
  const count = <K extends string>(keys: K[], get: (r: Derived) => K) => Object.fromEntries(keys.map(k => [k, rows.filter(r => get(r) === k).length])) as Record<K, number>
  const reachedRows = rows.filter(r => r.eff >= TARGET_SEEDS)
  const suspect = rows.filter(r => r.recross === 'suspect').length
  const short = rows.filter(r => r.recross === 'short').length
  return {
    n,
    target,
    effCapped,
    progress: target ? (effCapped / target) * 100 : 0,
    reached: reachedRows.length,
    reachedBy: Object.fromEntries((['confirmed', 'suspect', 'pending'] as F1Status[]).map(k => [k, reachedRows.filter(r => r.basis === k).length])) as Record<F1Status, number>,
    reread: rows.filter(r => r.reread).length,
    entered: entered.length,
    seedsSum,
    enteredFlorets,
    pooledRate: enteredFlorets ? (seedsSum / enteredFlorets) * 100 : null,
    status: count<F1Status>(['confirmed', 'suspect', 'pending'], r => r.status),
    bands: count<Band>(['normal', 'low', 'high', 'missing'], r => r.band),
    recross: { total: suspect + short, suspect, short, needInput: rows.filter(r => r.recross === 'needInput').length },
  }
}

export function deriveAll(fields: Record<string, Fields>, fallback: Record<string, Fields>, overrides: Record<string, Override | undefined>): Derived[] {
  return CROSSES.map(c => derive(c, fields[c.id]!, fallback[c.id]!, overrides[c.id]))
}

/** 다른 의뢰를 뺀 KSP-2609-09 이 회차 웰 수(F1) */
export const BATCH1_PLANTS = CROSSES.reduce((a, c) => a + (c.plants?.length ?? 0), 0)
export const BATCH1_SELF = CROSSES.reduce((a, c) => a + (c.plants?.filter(p => p === 'self').length ?? 0), 0)

/** 결실률 표시: 원값에서 소수 1자리로 한 번만 반올림 */
export const fmtRate = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

// ---------------------------------------------------------------- DEV 검산(명세 수용 기준)

if (import.meta.env.DEV) {
  const rows = deriveAll(DEFAULT_FIELDS, DEFAULT_FIELDS, {})
  const s = summarize(rows)
  const b1 = CROSSES.filter(c => c.batch === 1)
  const chk = (ok: boolean, msg: string) => console.assert(ok, `[검산] crossing-record: ${msg}`)
  chk(CROSSES.length === 24 && CROSSES[0]!.id === 'CR26-301' && CROSSES[23]!.id === 'CR26-324', '조합 24건(CR26-301~324) 아님')
  chk(b1.length === 16 && BATCH1_PLANTS === 64 && BATCH1_SELF === 4, `1차 묶음 16조합·64주·자식 4 기대, 실제 ${b1.length}·${BATCH1_PLANTS}·${BATCH1_SELF}`)
  chk(s.status.confirmed === 15 && s.status.suspect === 1 && s.status.pending === 8, `진위 15/1/8 기대, 실제 ${s.status.confirmed}/${s.status.suspect}/${s.status.pending}`)
  chk(s.bands.normal === 18 && s.bands.low === 2 && s.bands.high === 2 && s.bands.missing === 2, '결실 판정 18/2/2/2 아님')
  chk(s.seedsSum === 1666 && s.enteredFlorets === 5797, `립수 합 1,666·영화 5,797 기대, 실제 ${s.seedsSum}·${s.enteredFlorets}`)
  chk(s.effCapped === 804 && Math.abs(s.progress - 83.75) < 1e-9 && s.reached === 19, `유효 합 804·진행률 83.75·달성 19 기대, 실제 ${s.effCapped}·${s.progress}·${s.reached}`)
  chk(s.reachedBy.confirmed === 14 && s.reachedBy.pending === 5 && s.reachedBy.suspect === 0, `달성 내역 확인 14 · 대기 5 기대, 실제 ${s.reachedBy.confirmed} · ${s.reachedBy.pending}`)
  chk(s.recross.total === 3 && s.recross.suspect === 1 && s.recross.short === 2 && s.recross.needInput === 2, '재교배 3(자식 의심 1·종자 부족 2)·입력 필요 2 아님')
  chk(Math.min(...CROSSES.map(c => c.poly.length)) >= MIN_POLY, `다형 마커 최소 ${MIN_POLY}개 미만 조합 있음`)
  chk(CROSSES.every(c => c.trueSeeds <= c.florets), '립수 > 영화 수인 조합 있음')
  const c315 = CROSS_BY_ID['CR26-315']!
  chk(c315.poly.map(i => MARKERS[i]).join(',') === 'Pi-ta,Hd1,sd1,ID04,ID07,ID09' && c315.plants?.join(',') === 'self,self,F1,self', 'CR26-315 다형 마커·개체 판정 불일치')
  const polySum = CROSSES.reduce((a, c) => a + c.poly.length, 0)
  chk(polySum === 150, `다형 마커 합 150 기대, 실제 ${polySum}`)
  chk(CROSS_BY_ID['CR26-304']!.poly.length === 3 && Math.min(...CROSSES.map(c => c.poly.length)) === 3, '최소 다형 조합 CR26-304 = 3 아님')
  const bb = (m: Marker) => Object.values(PARENT_GENO).filter(g => g[MARKERS.indexOf(m)] === 2).length
  const bbExp: [Marker, number][] = [['Hd1', 5], ['sd1', 8], ['GS3', 3], ['Wx', 2], ['Pi-ta', 3], ['Pi9', 2]]
  chk(bbExp.every(([m, n]) => bb(m) === n), `마커별 BB 부모 수 불일치: ${bbExp.map(([m]) => `${m} ${bb(m)}`).join(' · ')}`)
  const r312 = rows.find(r => r.cross.id === 'CR26-312')!
  chk(r312.status === 'confirmed' && r312.eff === 55.5, `CR26-312 확인·유효 55.5 기대, 실제 ${r312.status}·${r312.eff}`)
  chk(fmtRate(rows[0]!.rate!) === '23.2' && fmtRate(rows[14]!.rate!) === '66.6', '결실률 표시 301 23.2·315 66.6 아님')
  // 입력 예시
  const demo1: Record<string, Fields> = { ...DEFAULT_FIELDS, 'CR26-319': { ...DEFAULT_FIELDS['CR26-319']!, seeds: '73' } }
  const s1 = summarize(deriveAll(demo1, demo1, {}))
  chk(s1.effCapped === 844 && s1.reached === 20 && s1.seedsSum === 1739, '입력 예시 319=73 → 844·20·1,739 아님')
  const demo2 = { ...demo1, 'CR26-323': { ...demo1['CR26-323']!, seeds: '67' } }
  const s2 = summarize(deriveAll(demo2, demo2, {}))
  chk(s2.effCapped === 884 && s2.reached === 21 && s2.seedsSum === 1806 && s2.recross.total === 3 && s2.recross.needInput === 0, '입력 예시 323=67 → 884·21·1,806 아님')
  const bad = validate(CROSS_BY_ID['CR26-319']!, { ...DEFAULT_FIELDS['CR26-319']!, seeds: '250' })
  chk(bad.seeds?.level === 'error' && bad.seeds.message.includes('(223)'), '319=250 오류 문구 아님')
  const sm = summarize(deriveAll(DEFAULT_FIELDS, DEFAULT_FIELDS, { 'CR26-315': { status: 'confirmed', reason: 'reread' } }))
  chk(sm.effCapped === 844 && sm.recross.total === 2, '315 수동 확인 → 844·재교배 2 아님')
  const sp315 = summarize(deriveAll(DEFAULT_FIELDS, DEFAULT_FIELDS, { 'CR26-315': { status: 'pending', reason: 'reread' } }))
  chk(sp315.reread === 1 && sp315.reachedBy.confirmed === 14 && sp315.reachedBy.pending === 5, `315 수동 대기 → 재판독 대기 1·달성 내역 확인 14 · 대기 5 기대, 실제 ${sp315.reread}·${sp315.reachedBy.confirmed} · ${sp315.reachedBy.pending}`)
  chk(sp315.effCapped === 804 && sp315.recross.total === 3 && sp315.recross.suspect === 1 && sp315.status.pending === 9 && sp315.status.suspect === 0, `315 수동 대기 → 유효 합 804·재교배 3·진위 15/0/9 기대, 실제 ${sp315.effCapped}·${sp315.recross.total}`)
  const sp312 = summarize(deriveAll(DEFAULT_FIELDS, DEFAULT_FIELDS, { 'CR26-312': { status: 'pending', reason: 'reread' } }))
  const r312p = deriveAll(DEFAULT_FIELDS, DEFAULT_FIELDS, { 'CR26-312': { status: 'pending', reason: 'reread' } }).find(r => r.cross.id === 'CR26-312')!
  chk(sp312.effCapped === 804 && r312p.eff === 55.5 && sp312.status.confirmed === 14 && sp312.status.pending === 9, `312 수동 대기 → 유효 55.5·합 804·진위 14/1/9 기대, 실제 ${r312p.eff}·${sp312.effCapped}`)
  chk(sp312.reread === 1 && sp312.reached === 19 && sp312.reachedBy.confirmed === 14 && sp312.reachedBy.pending === 5 && r312p.reread && r312p.basis === 'confirmed', `312 수동 대기 → 달성 내역 확인 14 · 대기 5·재판독 대기 1 기대, 실제 ${sp312.reachedBy.confirmed} · ${sp312.reachedBy.pending}·${sp312.reread}`)
  chk(s.reread === 0, `기본 상태 재판독 대기 0 기대, 실제 ${s.reread}`)
}
