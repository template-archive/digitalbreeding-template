/**
 * 교배 조합 설계 — 목업 데이터와 예측 계산.
 * 명세: docs/specs/cross-planner.md
 *
 * - 앵커 8계통과 앵커 간 공조계수(f)는 명세 상수표 그대로다.
 * - 나머지 52계통과 그 관계 계수만 시드 RNG(20261023)로 만든다.
 * - μ·σ·UC·등급·추천·요약은 모두 아래 함수로 계산한다(하드코딩 없음).
 * 실제 API로 바꿀 때는 CANDIDATES와 kinship()만 교체하면 된다.
 */
import { createRng, type Rng } from '@/lib/rng'
import { KIN_CAUTION, KIN_WARN, kinLevel, lineName, type KinLevel } from '@/lib/genomics'
import { formatFixed, formatSigned } from '@/lib/format'

// ---------------- 상수 ----------------

export const SEED = 20261023
/** 상가적 유전 표준편차 σA(kg/10a). program-overview 2026년 수량과 같은 값 */
export const SIGMA_A = 28.2
export type PKey = '10' | '5' | '1'
/** 조합 내 선발 비율 p → 선발 강도 i (카탈로그 2장) */
export const I_BY_P: Record<PKey, number> = { '10': 1.755, '5': 2.063, '1': 2.665 }
export const HEADING_GAP = 10
export const PARENT_MAX_USE = 3
export const MAX_PARENTS = 12
export const MAX_CROSSES = 30
export const RECOMMEND_N = 5

export const PLAN = {
  name: '2027년 1차 교배 계획(온실)',
  crop: '벼',
  trait: '쌀 수량 GEBV(kg/10a)',
  asOf: '2026-10-23',
  idPrefix: 'CR27-',
} as const

export type Group = 'A' | 'B' | 'C'
export const GROUP_LABEL: Record<Group, string> = {
  A: 'A 중만생 다수성',
  B: 'B 조생 고품질',
  C: 'C 저항성 공여',
}

export interface Candidate {
  /** 후보 배열 인덱스(관계 계수 행렬 인덱스) */
  idx: number
  name: string
  group: Group
  family: string
  /** 쌀 수량 GEBV, kg/10a(기준 집단 평균 대비) */
  gebv: number
  /** 신뢰도 r² */
  rel: number
  /** 출수기(파종 후 일수) */
  heading: number
  /** 간장(cm) */
  culm: number
  /** 도열병 저항성 유전자 */
  pi: string
  anchor: boolean
}

// ---------------- 앵커(명세 상수) ----------------

type Seed = Omit<Candidate, 'idx' | 'anchor'>
const ANCHORS: Seed[] = [
  { name: 'YR22-0412', group: 'A', family: 'F01', gebv: 52.4, rel: 0.58, heading: 118, culm: 84, pi: 'Pi-ta' },
  { name: 'YR22-0415', group: 'A', family: 'F01', gebv: 49.8, rel: 0.55, heading: 116, culm: 86, pi: 'Pi-ta' },
  { name: 'YR21-0877', group: 'A', family: 'F05', gebv: 47.1, rel: 0.61, heading: 120, culm: 81, pi: '없음' },
  { name: 'YR23-0136', group: 'A', family: 'F09', gebv: 45.6, rel: 0.49, heading: 119, culm: 88, pi: 'Pib' },
  { name: 'YR22-0263', group: 'B', family: 'F12', gebv: 38.9, rel: 0.52, heading: 111, culm: 76, pi: '없음' },
  { name: 'YR21-0594', group: 'B', family: 'F12', gebv: 36.2, rel: 0.57, heading: 107, culm: 79, pi: 'Pib' },
  { name: 'YR20-1108', group: 'C', family: 'F18', gebv: 12.7, rel: 0.44, heading: 124, culm: 95, pi: 'Pi9' },
  { name: 'YR19-0731', group: 'C', family: 'F19', gebv: 8.3, rel: 0.41, heading: 112, culm: 92, pi: 'Pigm' },
]

/** 앵커 간 공조계수(상삼각). ANCHOR_F[i][j], i<j */
const ANCHOR_F: number[][] = [
  [0, 0.52, 0.14, 0.11, 0.06, 0.05, -0.02, -0.01],
  [0, 0, 0.15, 0.12, 0.07, 0.04, -0.01, -0.02],
  [0, 0, 0, 0.27, 0.08, 0.06, -0.03, 0],
  [0, 0, 0, 0, 0.05, 0.09, -0.02, -0.01],
  [0, 0, 0, 0, 0, 0.46, -0.01, 0.01],
  [0, 0, 0, 0, 0, 0, -0.02, 0],
  [0, 0, 0, 0, 0, 0, 0, 0.06],
  [0, 0, 0, 0, 0, 0, 0, 0],
]

// ---------------- 생성 규칙 ----------------

const round1 = (v: number) => Math.round(v * 10) / 10
/** −0을 0으로 정규화(음수 f를 반올림하면 −0이 생겨 "-0.00"으로 표시됨). 2026-10-26 정리 회차 */
const round2 = (v: number) => Math.round(v * 100) / 100 || 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const FAMILIES = Array.from({ length: 27 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`)
const familyGroup = (i: number): Group => (i < 10 ? 'A' : i < 17 ? 'B' : 'C')
/** 가계별 생성 계통 수(앵커 제외) */
const GEN_COUNT: Record<string, number> = {
  F01: 1, F05: 2, F09: 2, // A: 나머지 7가계 3
  F11: 3, F12: 1, F13: 3, F14: 3, F15: 3, F16: 3, F17: 2, // B
  F18: 0, F19: 0, // C: F20..F27 각 1
}
const genCount = (fam: string, g: Group) => GEN_COUNT[fam] ?? (g === 'A' ? 3 : g === 'C' ? 1 : 0)

const HALF_SIB: [string, string][] = [['F05', 'F09'], ['F02', 'F03'], ['F06', 'F07'], ['F13', 'F14']]
const isHalfSib = (a: string, b: string) => HALF_SIB.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

interface GroupRule {
  mean: number
  gebv: [number, number]
  heading: [number, number, number, number]
  culm: [number, number, number, number]
  pi: [string, number][]
}
const GROUP: Record<Group, GroupRule> = {
  A: { mean: 22, gebv: [-15, 44.0], heading: [118, 3, 110, 126], culm: [84, 5, 72, 96], pi: [['Pi-ta', 0.3], ['Pib', 0.2], ['없음', 0.5]] },
  B: { mean: 10, gebv: [-15, 44.0], heading: [108, 3, 101, 115], culm: [78, 4, 68, 88], pi: [['Pib', 0.3], ['없음', 0.7]] },
  C: { mean: -8, gebv: [-25, 8.0], heading: [116, 7, 100, 130], culm: [92, 8, 75, 110], pi: [['Pi9', 0.35], ['Pigm', 0.35], ['Pi-ta', 0.15], ['Pib', 0.15]] },
}

function weightedPick(rng: Rng, items: [string, number][]): string {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let u = rng.next() * total
  for (const [v, w] of items) {
    u -= w
    if (u < 0) return v
  }
  return items[items.length - 1]![0]
}

function build() {
  const rng = createRng(SEED)
  const famEffect: Record<string, number> = Object.fromEntries(FAMILIES.map(f => [f, rng.normal(0, 7)]))
  const used = new Set(ANCHORS.map(a => a.name))
  const uniqueLineName = (prefix: string, year: number) => {
    for (;;) {
      const n = lineName(rng, prefix, year)
      if (!used.has(n)) {
        used.add(n)
        return n
      }
    }
  }

  const generated: Seed[] = []
  FAMILIES.forEach((fam, i) => {
    const group = familyGroup(i)
    const g = GROUP[group]
    for (let k = 0; k < genCount(fam, group); k++) {
      const name = uniqueLineName('YR', rng.int(2019, 2023))
      const gebv = round1(clamp(g.mean + famEffect[fam]! + rng.normal(0, 6), g.gebv[0], g.gebv[1]))
      const rel = round2(0.3 + 0.3 * rng.beta(4, 4))
      const heading = Math.round(clamp(rng.normal(g.heading[0], g.heading[1]), g.heading[2], g.heading[3]))
      const culm = Math.round(clamp(rng.normal(g.culm[0], g.culm[1]), g.culm[2], g.culm[3]))
      const pi = weightedPick(rng, g.pi)
      generated.push({ name, group, family: fam, gebv, rel, heading, culm, pi })
    }
  })

  // 후보 배열 = 앵커 8 → 생성 52(가계 순서)
  const candidates: Candidate[] = [
    ...ANCHORS.map((a, i) => ({ ...a, idx: i, anchor: true })),
    ...generated.map((a, i) => ({ ...a, idx: ANCHORS.length + i, anchor: false })),
  ]

  const n = candidates.length
  const kin = new Float64Array(n * n)
  const kinOf = (P: Candidate, Q: Candidate): number => {
    // 2026-10-26 정리 회차: 형제 SD 0.03 → 0.07(하한 0.38), C와 A·B 사이 음수 허용(VanRaden 방법 1, 훈련 집단 빈도 기준), A–B 0.06 → 0.10(평균 G 0.1678 유지)
    // 2026-10-26 정리 회차 2: 반형제 0.27 + N(0, 0.025) → 0.28 + N(0, 0.04) 절단 0.15~0.36(실현 SD 0.027 → 0.045, 근연 주의 29 유지, 상한 0.36 < 강한 근연 0.375),
    //   같은 그룹 A·B 평균 0.11 → 0.1092(반형제 평균 상승분 상쇄, 평균 G 0.1678·그룹 He 유지)
    if (P.family === Q.family) return round2(clamp(0.5 + rng.normal(0, 0.07), 0.38, 0.66))
    if (isHalfSib(P.family, Q.family)) return round2(clamp(0.28 + rng.normal(0, 0.04), 0.15, 0.36))
    if (P.group === Q.group)
      return P.group === 'C' ? round2(clamp(0.05 + rng.normal(0, 0.015), 0.01, 0.09)) : round2(clamp(0.1092 + rng.normal(0, 0.03), 0.04, 0.19))
    if (P.group !== 'C' && Q.group !== 'C') return round2(clamp(0.1 + rng.normal(0, 0.015), 0.06, 0.14))
    return round2(clamp(-0.018 + rng.normal(0, 0.012), -0.06, 0.03))
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const P = candidates[i]!
      const Q = candidates[j]!
      const f = P.anchor && Q.anchor ? ANCHOR_F[i]![j]! : kinOf(P, Q)
      kin[i * n + j] = f
      kin[j * n + i] = f
    }
  }
  return { candidates, kin, n }
}

const BUILT = build()

/** 후보 60계통 */
export const CANDIDATES: Candidate[] = BUILT.candidates
export const CANDIDATE_BY_NAME = new Map(CANDIDATES.map(c => [c.name, c]))
export const ANCHOR_NAMES = ANCHORS.map(a => a.name)

/** 부모 간 공조계수 f_PQ(소수 2자리 저장값) */
export function kinship(P: Candidate, Q: Candidate): number {
  return BUILT.kin[P.idx * BUILT.n + Q.idx]!
}

// ---------------- 조합 예측(난수 없음) ----------------

// 근연 등급 기준(KIN_WARN·KIN_CAUTION)·판정(kinLevel)·표기(KIN_LEVEL_LABEL)는 공통 규칙 @/lib/genomics

export interface CrossPred {
  /** 정렬된 부모 쌍 키(행 부모|열 부모) */
  key: string
  /** 행 부모(GEBV가 높은 쪽) */
  a: Candidate
  /** 열 부모 */
  b: Candidate
  mu: number
  f: number
  k: number
  sigma: number
  i: number
  uc: number
  level: KinLevel
  headingGap: number
}

/** 행렬·목록에서 부모 표시 순서: GEBV 내림차순(같으면 이름) */
export const parentOrder = (a: Candidate, b: Candidate) => b.gebv - a.gebv || a.name.localeCompare(b.name)

export function crossKey(P: Candidate, Q: Candidate): string {
  const [a, b] = parentOrder(P, Q) <= 0 ? [P, Q] : [Q, P]
  return `${a.name}|${b.name}`
}

export function predict(P: Candidate, Q: Candidate, p: PKey): CrossPred {
  const [a, b] = parentOrder(P, Q) <= 0 ? [P, Q] : [Q, P]
  const f = kinship(a, b)
  const mu = (a.gebv + b.gebv) / 2
  const k = 0.85 + 0.25 * Math.min(1, Math.abs(a.gebv - b.gebv) / 50)
  const sigma = SIGMA_A * Math.sqrt(1 - f) * k
  const i = I_BY_P[p]
  return { key: `${a.name}|${b.name}`, a, b, mu, f, k, sigma, i, uc: mu + i * sigma, level: kinLevel(f), headingGap: Math.abs(a.heading - b.heading) }
}

export function predictByKey(key: string, p: PKey): CrossPred | null {
  const [x, y] = key.split('|')
  const P = CANDIDATE_BY_NAME.get(x ?? '')
  const Q = CANDIDATE_BY_NAME.get(y ?? '')
  return P && Q ? predict(P, Q, p) : null
}

/** 선택 부모의 모든 쌍(상삼각) */
export function allPairs(parents: Candidate[], p: PKey): CrossPred[] {
  const sorted = parents.slice().sort(parentOrder)
  const out: CrossPred[] = []
  for (let r = 0; r < sorted.length; r++) for (let c = r + 1; c < sorted.length; c++) out.push(predict(sorted[r]!, sorted[c]!, p))
  return out
}

/** 추천: f < 0.25인 쌍 중 UC 내림차순 상위 5 */
export function recommend(pairs: CrossPred[]): CrossPred[] {
  return pairs.filter(x => x.f < KIN_CAUTION).sort((x, y) => y.uc - x.uc).slice(0, RECOMMEND_N)
}

// ---------------- 선택 조합 ----------------

export interface PlannedCross {
  key: string
  /** 모본(♀) 이름 */
  female: string
  /** 부본(♂) 이름 */
  male: string
}

export type WarnKind = 'kinWarn' | 'kinCaution' | 'heading' | 'overuse'
export interface PlanWarning {
  id: string
  kind: WarnKind
  severity: 'warn' | 'caution'
  title: string
  detail: string
  /** 관련 조합 키 */
  keys: string[]
}

const short = (name: string) => name

export function parentUse(plan: PlannedCross[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of plan) {
    m.set(c.female, (m.get(c.female) ?? 0) + 1)
    m.set(c.male, (m.get(c.male) ?? 0) + 1)
  }
  return m
}

export function planWarnings(plan: PlannedCross[], p: PKey): PlanWarning[] {
  const out: PlanWarning[] = []
  const preds = plan.map(c => predictByKey(c.key, p)).filter((x): x is CrossPred => !!x)
  for (const x of preds) {
    const label = `${short(x.a.name)} × ${short(x.b.name)}`
    if (x.level === 'warn')
      out.push({ id: `kw-${x.key}`, kind: 'kinWarn', severity: 'warn', title: '강한 근연 조합', detail: `${label} · f ${x.f.toFixed(2)} (≥ ${KIN_WARN}) · 자손 분산이 작음`, keys: [x.key] })
    else if (x.level === 'caution')
      out.push({ id: `kc-${x.key}`, kind: 'kinCaution', severity: 'caution', title: '근연 주의 조합', detail: `${label} · f ${x.f.toFixed(2)} (≥ ${KIN_CAUTION}) · 자손 분산이 작음`, keys: [x.key] })
  }
  for (const x of preds) {
    if (x.headingGap > HEADING_GAP)
      out.push({
        id: `hd-${x.key}`,
        kind: 'heading',
        severity: 'caution',
        title: '개화기 불일치',
        detail: `${x.a.name} × ${x.b.name} · 출수기 차 ${x.headingGap}일 — 파종 시기 조절 필요`,
        keys: [x.key],
      })
  }
  for (const [name, n] of parentUse(plan)) {
    if (n > PARENT_MAX_USE)
      out.push({
        id: `ou-${name}`,
        kind: 'overuse',
        severity: 'caution',
        title: '부모 편중',
        detail: `${name} ${n}건 사용 (${PARENT_MAX_USE + 1}건 이상)`,
        keys: plan.filter(c => c.female === name || c.male === name).map(c => c.key),
      })
  }
  const rank = { warn: 0, caution: 1 } as const
  return out.sort((x, y) => rank[x.severity] - rank[y.severity])
}

export interface PlanSummary {
  crosses: number
  parents: number
  meanUc: number
  meanF: number
}

export function planSummary(plan: PlannedCross[], p: PKey): PlanSummary {
  const preds = plan.map(c => predictByKey(c.key, p)).filter((x): x is CrossPred => !!x)
  const n = preds.length
  return {
    crosses: n,
    parents: parentUse(plan).size,
    meanUc: n ? preds.reduce((s, x) => s + x.uc, 0) / n : Number.NaN,
    meanF: n ? preds.reduce((s, x) => s + x.f, 0) / n : Number.NaN,
  }
}

// ---------------- 필터 ----------------

export interface Filters {
  gebvMin: number
  relMin: number
  headingMin: number
  headingMax: number
  culmMax: number
  groups: Group[]
}

export const DEFAULT_FILTERS: Filters = { gebvMin: -25, relMin: 0.3, headingMin: 100, headingMax: 130, culmMax: 110, groups: ['A', 'B', 'C'] }

export function applyFilters(list: Candidate[], f: Filters): Candidate[] {
  return list.filter(
    c => c.gebv >= f.gebvMin && c.rel >= f.relMin - 1e-9 && c.heading >= f.headingMin && c.heading <= f.headingMax && c.culm <= f.culmMax && f.groups.includes(c.group),
  )
}

/** 기본값과 다른 필터 수(모바일 "필터 · 적용 n개") */
export function activeFilterCount(f: Filters): number {
  const d = DEFAULT_FILTERS
  return (
    Number(f.gebvMin !== d.gebvMin) +
    Number(f.relMin !== d.relMin) +
    Number(f.headingMin !== d.headingMin || f.headingMax !== d.headingMax) +
    Number(f.culmMax !== d.culmMax) +
    Number(f.groups.length !== d.groups.length)
  )
}

// ---------------- 표기 ----------------

/** 소수 1자리(GEBV·μ·σ·UC). −0.0 방지 */
export const fmt1 = (v: number) => formatFixed(v, 1)
/** 소수 2자리(f·신뢰도). 반올림해 0이면 부호 없이, 음수는 U+2212 */
export const fmt2 = (v: number) => formatFixed(v, 2)
/** 부호 포함 소수 1자리. 반올림해 0이면 부호 없이 0.0 */
export const fmtSigned1 = (v: number) => formatSigned(v, 1)
export const crossId = (i: number) => `${PLAN.idPrefix}${String(i + 1).padStart(3, '0')}`

// ---------------- DEV 검산(명세 수용 기준, 2026-10-26 정리 회차) ----------------
if (import.meta.env.DEV) {
  const ck = (cond: boolean, msg: string) => console.assert(cond, `[검산] cross-planner: ${msg}`)
  const fs: number[] = []
  for (let i = 0; i < CANDIDATES.length; i++) for (let j = i + 1; j < CANDIDATES.length; j++) fs.push(kinship(CANDIDATES[i]!, CANDIDATES[j]!))
  const fMin = Math.min(...fs)
  const fMax = Math.max(...fs)
  ck(Math.abs(fMin + 0.05) < 1e-9 && Math.abs(fMax - 0.64) < 1e-9, `후보 쌍 f 범위 ${fMin} ~ ${fMax} (기대 −0.05 ~ 0.64)`)
  ck(fs.filter(v => v < 0).length === 420, `음수 f 쌍 ${fs.filter(v => v < 0).length} (기대 420)`)
  ck(fs.every(v => !Object.is(v, -0)), '−0 값이 남아 있음(round2 정규화 누락)')
  const A8 = CANDIDATES.slice(0, 8)
  const no = (c: Candidate) => A8.indexOf(c) + 1
  const recKeys = (p: PKey) => recommend(allPairs(A8, p)).map(x => `${no(x.a)}×${no(x.b)}`).join(',')
  ck(recKeys('5') === '1×4,1×5,1×6,1×3,2×6', `p = 5% 추천 ${recKeys('5')} (기대 1×4,1×5,1×6,1×3,2×6)`)
  ck(recKeys('1') === '1×5,1×6,1×7,1×4,1×8', `p = 1% 추천 ${recKeys('1')} (기대 1×5,1×6,1×7,1×4,1×8 — YR20-1108·YR19-0731 조합 포함)`)
  const plan = recommend(allPairs(A8, '5')).map(x => ({ key: x.key, female: x.a.name, male: x.b.name }))
  const sm = planSummary(plan, '5')
  ck(sm.crosses === 5 && sm.parents === 6 && Math.abs(sm.meanUc - 96.875) < 1e-3 && fmt2(sm.meanF) === '0.08', `기본 요약 ${sm.crosses}건 ${sm.parents}계통 UC ${sm.meanUc} f ${sm.meanF} (기대 5, 6, 96.875, 0.08)`)
}
