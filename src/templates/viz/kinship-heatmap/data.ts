/**
 * 유전적 관계 히트맵 — 목업 데이터와 계산.
 * 명세: docs/specs/kinship-heatmap.md
 *
 * 1단계(후보 60계통·공조계수 f)는 workflow/cross-planner `data.ts`의 build()를
 * 같은 시드·같은 난수 호출 순서로 그대로 옮겼다(템플릿끼리 import하지 않는 규칙).
 * 이 화면에서 새로 만드는 값(대각용 잔여 이형접합도)만 별도 RNG(SEED + 1)를 쓴다.
 *
 * 실제 API로 바꿀 때는 LINES(계통 속성 + 잔여 이형접합도)와 kin()(공조계수 f) 또는 grm()(G)만 교체하면 된다.
 */
import { createRng, type Rng } from '@/lib/rng'
import { KIN_CAUTION, KIN_WARN, kinLevel, lineName, type KinLevel } from '@/lib/genomics'
import { formatFixed, formatNumber, formatSigned } from '@/lib/format'

// ---------------- 상수 ----------------

export const SEED = 20261023
export const BASE_DATE = '2026-10-23'
export const GRM_DATE = '2026-10-22'
export const SNP_COUNT = 4820
export const TRAIN_N = 1850
/** 기준 집단 평균 2pq(4,820 SNP, 추정) */
export const H_E = 0.4
/** pedigree-explorer fParents('YR22-0412') */
export const F01_PARENT_F = 0.0390625
export const F01_PARENTS = '별하랑/해솔가온 2022 교배'
/** 근연 군집 절단 높이(UPGMA 거리 1 − f̄) */
export const CLUSTER_CUT = 0.75
/** 색 척도 범위(G) */
export const SCALE_MAX = 1.3
export const DENDRO_MIN = 0.3
export const DENDRO_MAX = 1.05

export type Group = 'A' | 'B' | 'C'
export const GROUPS: Group[] = ['A', 'B', 'C']
export const GROUP_LABEL: Record<Group, string> = {
  A: 'A 중만생 다수성',
  B: 'B 조생 고품질',
  C: 'C 저항성 공여',
}

export interface Line {
  /** 후보 배열 인덱스(행렬 인덱스) */
  idx: number
  name: string
  group: Group
  family: string
  /** 쌀 수량 GEBV, kg/10a */
  gebv: number
  /** 신뢰도 r² */
  rel: number
  heading: number
  culm: number
  pi: string
  anchor: boolean
  /** 잔여 이형접합도 H_o(%) */
  het: number
  /** 근교계수 F = 1 − H_o / H_e (소수 3자리) */
  F: number
}

// ---------------- 1단계: cross-planner build() 복사 ----------------

type Seed = Omit<Line, 'idx' | 'anchor' | 'het' | 'F'>
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

const round1 = (v: number) => Math.round(v * 10) / 10
/** −0을 0으로 정규화(음수 f를 반올림하면 −0이 생겨 "-0.00"으로 표시됨). 2026-10-26 정리 회차 */
const round2 = (v: number) => Math.round(v * 100) / 100 || 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const FAMILIES = Array.from({ length: 27 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`)
const familyGroup = (i: number): Group => (i < 10 ? 'A' : i < 17 ? 'B' : 'C')
const GEN_COUNT: Record<string, number> = {
  F01: 1, F05: 2, F09: 2,
  F11: 3, F12: 1, F13: 3, F14: 3, F15: 3, F16: 3, F17: 2,
  F18: 0, F19: 0,
}
const genCount = (fam: string, g: Group) => GEN_COUNT[fam] ?? (g === 'A' ? 3 : g === 'C' ? 1 : 0)

export const HALF_SIB: [string, string][] = [['F05', 'F09'], ['F02', 'F03'], ['F06', 'F07'], ['F13', 'F14']]
export const isHalfSib = (a: string, b: string) => HALF_SIB.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

interface GroupRule {
  mean: number
  gebv: [number, number]
  heading: [number, number, number, number]
  culm: [number, number, number, number]
  pi: [string, number][]
}
const GROUP_RULE: Record<Group, GroupRule> = {
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
    const g = GROUP_RULE[group]
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

  const lines: Line[] = [
    ...ANCHORS.map((a, i) => ({ ...a, idx: i, anchor: true, het: 0, F: 0 })),
    ...generated.map((a, i) => ({ ...a, idx: ANCHORS.length + i, anchor: false, het: 0, F: 0 })),
  ]

  const n = lines.length
  const kin = new Float64Array(n * n)
  const kinOf = (P: Line, Q: Line): number => {
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
      const P = lines[i]!
      const Q = lines[j]!
      const f = P.anchor && Q.anchor ? ANCHOR_F[i]![j]! : kinOf(P, Q)
      kin[i * n + j] = f
      kin[j * n + i] = f
    }
  }

  // ---------------- 2단계: 대각(별도 RNG, cross-planner 난수열과 독립) ----------------
  const rng2 = createRng(SEED + 1)
  for (const c of lines) {
    c.het = round1(0.5 + 2.5 * rng2.beta(2, 5))
    c.F = Math.round((1 - c.het / 100 / H_E) * 1000) / 1000
  }
  return { lines, kin, n }
}

const BUILT = build()

/** 후보 60계통(idx 순서 = cross-planner CANDIDATES 순서) */
export const LINES: Line[] = BUILT.lines
export const N = BUILT.n
export const LINE_BY_NAME = new Map(LINES.map(c => [c.name, c]))

/** 공조계수 f(소수 2자리, cross-planner kinship()과 같은 값) */
export const kin = (i: number, j: number): number => (i === j ? NaN : BUILT.kin[i * N + j]!)
/** GRM 값. 비대각 G = 2f(2f 척도), 대각 G = 1 + F */
export const grm = (i: number, j: number): number => (i === j ? 1 + LINES[i]!.F : round2(2 * kin(i, j)))

// ---------------- 3단계: 계보 기대값 ----------------

export type RelType = '형제' | '반형제' | '—'
export const fPed = (P: Line, Q: Line): number | null =>
  P.family === Q.family ? (P.family === 'F01' ? (1 + F01_PARENT_F) / 2 : 0.5) : isHalfSib(P.family, Q.family) ? 0.25 : null
export const relType = (P: Line, Q: Line): RelType => (P.family === Q.family ? '형제' : isHalfSib(P.family, Q.family) ? '반형제' : '—')

export function relDescription(P: Line, Q: Line): string {
  const t = relType(P, Q)
  if (t === '형제') return P.family === 'F01' ? `형제 계통(F01, ${F01_PARENTS})` : `형제 계통(같은 가계 ${P.family})`
  if (t === '반형제') return `반형제 가계(${P.family}·${Q.family}, 한쪽 부모 공유)`
  return '계보상 공통 조상 미기록'
}

// ---------------- 쌍 목록 ----------------

export interface Pair {
  key: string
  i: number
  j: number
  a: Line
  b: Line
  G: number
  f: number
  level: KinLevel
  rel: RelType
  fPed: number | null
  delta: number | null
  groupPair: string
}

export const pairKey = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`)

/** 1,770쌍(i < j, idx 순서) */
export const PAIRS: Pair[] = (() => {
  const out: Pair[] = []
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const a = LINES[i]!
      const b = LINES[j]!
      const f = kin(i, j)
      const fp = fPed(a, b)
      const gp = [a.group, b.group].sort().join('–')
      out.push({ key: pairKey(i, j), i, j, a, b, G: grm(i, j), f, level: kinLevel(f), rel: relType(a, b), fPed: fp, delta: fp === null ? null : f - fp, groupPair: gp })
    }
  return out
})()
export const PAIR_BY_KEY = new Map(PAIRS.map(p => [p.key, p]))

export type PairFilter = 'flagged' | 'warn' | 'ped' | 'all'
export const PAIR_FILTER_TEST: Record<PairFilter, (p: Pair) => boolean> = {
  flagged: p => p.level !== 'ok',
  warn: p => p.level === 'warn',
  ped: p => p.fPed !== null,
  all: () => true,
}
export const PAIR_FILTER_LABEL: Record<PairFilter, string> = {
  flagged: '근연 주의 이상',
  warn: '강한 근연',
  ped: '계보 비교 가능',
  all: '전체',
}
export const PAIR_FILTER_COUNT: Record<PairFilter, number> = {
  flagged: PAIRS.filter(PAIR_FILTER_TEST.flagged).length,
  warn: PAIRS.filter(PAIR_FILTER_TEST.warn).length,
  ped: PAIRS.filter(PAIR_FILTER_TEST.ped).length,
  all: PAIRS.length,
}

// ---------------- 그룹 평균 ----------------

export interface GroupMean {
  x: Group
  y: Group
  n: number
  G: number
  f: number
}
const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN)

export const GROUP_MEANS: GroupMean[] = (() => {
  const out: GroupMean[] = []
  for (let a = 0; a < 3; a++)
    for (let b = a; b < 3; b++) {
      const x = GROUPS[a]!
      const y = GROUPS[b]!
      const v = PAIRS.filter(p => (p.a.group === x && p.b.group === y) || (p.a.group === y && p.b.group === x)).map(p => p.G)
      const G = mean(v)
      out.push({ x, y, n: v.length, G, f: G / 2 })
    }
  return out
})()
export const groupMean = (x: Group, y: Group) => GROUP_MEANS.find(g => (g.x === x && g.y === y) || (g.x === y && g.y === x))!
export const GROUP_DIAG_MEAN: Record<Group, number> = Object.fromEntries(
  GROUPS.map(g => [g, mean(LINES.filter(c => c.group === g).map(c => 1 + c.F))]),
) as Record<Group, number>
export const GROUP_SIZE: Record<Group, number> = Object.fromEntries(GROUPS.map(g => [g, LINES.filter(c => c.group === g).length])) as Record<Group, number>

// ---------------- 4단계: UPGMA와 정렬 ----------------

export interface TreeNode {
  ids: number[]
  /** 원소 최소 idx */
  min: number
  /** 병합 높이(잎 0) */
  h: number
  left: TreeNode | null
  right: TreeNode | null
}

function upgma(): TreeNode {
  let clusters: TreeNode[] = LINES.map(c => ({ ids: [c.idx], min: c.idx, h: 0, left: null, right: null }))
  const avg = (A: TreeNode, B: TreeNode) => {
    let s = 0
    for (const i of A.ids) for (const j of B.ids) s += 1 - kin(i, j)
    return s / (A.ids.length * B.ids.length)
  }
  while (clusters.length > 1) {
    let best: { x: number; y: number; d: number; k0: number; k1: number } | null = null
    for (let x = 0; x < clusters.length; x++)
      for (let y = x + 1; y < clusters.length; y++) {
        const A = clusters[x]!
        const B = clusters[y]!
        const d = avg(A, B)
        const k0 = Math.min(A.min, B.min)
        const k1 = Math.max(A.min, B.min)
        if (!best || d < best.d - 1e-12 || (Math.abs(d - best.d) <= 1e-12 && (k0 < best.k0 || (k0 === best.k0 && k1 < best.k1)))) best = { x, y, d, k0, k1 }
      }
    const A = clusters[best!.x]!
    const B = clusters[best!.y]!
    const [L, R] = A.min < B.min ? [A, B] : [B, A]
    const M: TreeNode = { ids: [...L.ids, ...R.ids], min: L.min, h: best!.d, left: L, right: R }
    clusters = clusters.filter((_, k) => k !== best!.x && k !== best!.y)
    clusters.push(M)
  }
  return clusters[0]!
}

export const TREE: TreeNode = upgma()

function leafOrder(t: TreeNode): number[] {
  const out: number[] = []
  const walk = (c: TreeNode) => {
    if (!c.left || !c.right) {
      out.push(c.ids[0]!)
      return
    }
    walk(c.left)
    walk(c.right)
  }
  walk(t)
  return out
}

function cutTree(t: TreeNode, h: number): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (c: TreeNode) => {
    if (c.h <= h + 1e-12 || !c.left || !c.right) {
      out.push(c)
      return
    }
    walk(c.left)
    walk(c.right)
  }
  walk(t)
  return out
}

/** 근연 군집(높이 ≤ 0.75 최대 부분 트리 중 2계통 이상) */
export const KIN_CLUSTERS: TreeNode[] = cutTree(TREE, CLUSTER_CUT).filter(c => c.ids.length >= 2)

export type SortKey = 'cluster' | 'gebv' | 'group'
export const SORT_LABEL: Record<SortKey, string> = { cluster: '군집 순', gebv: 'GEBV 순', group: '그룹 순' }
export const ORDERS: Record<SortKey, number[]> = {
  cluster: leafOrder(TREE),
  gebv: LINES.slice()
    .sort((x, y) => y.gebv - x.gebv || x.name.localeCompare(y.name))
    .map(c => c.idx),
  group: LINES.slice()
    .sort((x, y) => x.group.localeCompare(y.group) || x.family.localeCompare(y.family) || y.gebv - x.gebv || x.name.localeCompare(y.name))
    .map(c => c.idx),
}

/** 덴드로그램 선분(행 위치 = 군집 순 순서). [h0, y0, h1, y1] */
export interface DendroSeg {
  x0: number
  y0: number
  x1: number
  y1: number
}
export const DENDRO: { segs: DendroSeg[]; rootH: number } = (() => {
  const pos = new Map(ORDERS.cluster.map((idx, k) => [idx, k]))
  const segs: DendroSeg[] = []
  const leafX = DENDRO_MIN
  const walk = (c: TreeNode): { x: number; y: number } => {
    if (!c.left || !c.right) return { x: leafX, y: pos.get(c.ids[0]!)! }
    const L = walk(c.left)
    const R = walk(c.right)
    const x = c.h
    segs.push({ x0: L.x, y0: L.y, x1: x, y1: L.y })
    segs.push({ x0: R.x, y0: R.y, x1: x, y1: R.y })
    segs.push({ x0: x, y0: L.y, x1: x, y1: R.y })
    return { x, y: (L.y + R.y) / 2 }
  }
  walk(TREE)
  return { segs, rootH: TREE.h }
})()

// ---------------- 요약(KPI) ----------------

const offDiag = PAIRS.map(p => p.G)
const diag = LINES.map(c => 1 + c.F)
const Fs = LINES.map(c => c.F)
export const SUMMARY = {
  lines: N,
  pairs: PAIRS.length,
  meanG: mean(offDiag),
  meanF: mean(offDiag) / 2,
  minG: Math.min(...offDiag),
  maxG: Math.max(...offDiag),
  meanDiag: mean(diag),
  minDiag: Math.min(...diag),
  maxDiag: Math.max(...diag),
  minF: Math.min(...Fs),
  maxF: Math.max(...Fs),
  warn: PAIR_FILTER_COUNT.warn,
  caution: PAIRS.filter(p => p.level === 'caution').length,
  clusters: KIN_CLUSTERS.length,
}

export const DEFAULT_SELECTION: [number, number] = [LINE_BY_NAME.get('YR22-0412')!.idx, LINE_BY_NAME.get('YR22-0415')!.idx]

// ---------------- 표기 ----------------

/** 소수 d자리 표기는 @/lib/format의 formatFixed(U+2212, −0 방지). 2026-10-26 공통 승격 */
export const fmt2 = (v: number) => formatFixed(v, 2)
export const fmt3 = (v: number) => formatFixed(v, 3)
export const fmt4 = (v: number) => formatFixed(v, 4)
export const fmtGebv = (v: number) => formatSigned(v, 1)
export const fmtDelta = (v: number) => formatSigned(v, 2)
export const fmtHet = (v: number) => `${formatNumber(v, { digits: 1 })}%`
export const fmtInt = (v: number) => formatNumber(v, { digits: 0 })

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const ck = (cond: boolean, msg: string) => console.assert(cond, `[검산] kinship-heatmap: ${msg}`)
  const head = LINES.slice(0, 12).map(c => c.name).join(',')
  ck(
    head === 'YR22-0412,YR22-0415,YR21-0877,YR23-0136,YR22-0263,YR21-0594,YR20-1108,YR19-0731,YR23-6127,YR20-8715,YR23-9089,YR21-6913',
    `앞 12계통이 cross-planner와 다름: ${head}`,
  )
  ck(N === 60 && PAIRS.length === 1770, `계통 ${N}, 쌍 ${PAIRS.length} (기대 60, 1,770)`)
  let sym = true
  let twoF = true
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      if (i === j) continue
      if (grm(i, j) !== grm(j, i)) sym = false
      if (Math.abs(grm(i, j) - 2 * kin(i, j)) > 1e-9) twoF = false
    }
  ck(sym, 'G 행렬이 대칭이 아님')
  ck(twoF, '비대각 G ≠ 2f')
  const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol
  ck(near(SUMMARY.minG, -0.1) && near(SUMMARY.maxG, 1.28), `비대각 G 범위 ${SUMMARY.minG} ~ ${SUMMARY.maxG} (기대 −0.10 ~ 1.28)`)
  ck(near(SUMMARY.meanG, 0.16777, 5e-6) && fmt2(SUMMARY.meanG) === '0.17' && fmt2(SUMMARY.meanF) === '0.08', `평균 G ${SUMMARY.meanG} (기대 0.16777 → 0.17, f 0.08)`)
  ck(PAIRS.filter(p => p.G === 0).length === 67 && PAIRS.filter(p => p.G < 0).length === 420, `G = 0 쌍 ${PAIRS.filter(p => p.G === 0).length}, 음수 쌍 ${PAIRS.filter(p => p.G < 0).length} (기대 67, 420)`)
  ck(PAIRS.every(p => !Object.is(p.G, -0) && !Object.is(p.f, -0)), '−0 값이 남아 있음(round2 정규화 누락)')
  const sibF = PAIRS.filter(p => p.rel === '형제').map(p => p.f)
  const sibMean = mean(sibF)
  const sibSd = Math.sqrt(sibF.reduce((s2, x) => s2 + (x - sibMean) ** 2, 0) / (sibF.length - 1))
  ck(sibSd >= 0.06 && sibSd <= 0.08 && near(Math.min(...sibF), 0.38) && near(Math.max(...sibF), 0.64), `형제 f SD ${sibSd} 범위 ${Math.min(...sibF)}~${Math.max(...sibF)} (기대 SD 0.066, 0.38~0.64)`)
  // 2026-10-26 정리 회차 2: 반형제 실현 f SD 0.044~0.046, 범위 0.15~0.36(상한 < 강한 근연 0.375)
  const halfF = PAIRS.filter(p => p.rel === '반형제').map(p => p.f)
  const halfMean = mean(halfF)
  const halfSd = Math.sqrt(halfF.reduce((s2, x) => s2 + (x - halfMean) ** 2, 0) / (halfF.length - 1))
  ck(halfF.length === 36 && near(halfMean, 0.27722, 5e-5) && halfSd >= 0.04 && halfSd <= 0.05 && near(Math.min(...halfF), 0.15) && near(Math.max(...halfF), 0.36), `반형제 f ${halfF.length}쌍 평균 ${halfMean} SD ${halfSd} 범위 ${Math.min(...halfF)}~${Math.max(...halfF)} (기대 36쌍, 0.2772, SD 0.045, 0.15~0.36)`)
  ck(fmt3(SUMMARY.minDiag) === '1.943' && fmt3(SUMMARY.maxDiag) === '1.985' && fmt2(SUMMARY.meanDiag) === '1.97', `대각 ${SUMMARY.minDiag} ~ ${SUMMARY.maxDiag}, 평균 ${SUMMARY.meanDiag}`)
  ck(SUMMARY.warn === 49 && SUMMARY.caution === 29, `강한 근연 ${SUMMARY.warn}, 근연 주의 ${SUMMARY.caution} (기대 49, 29)`)
  ck(PAIR_FILTER_COUNT.flagged === 78 && PAIR_FILTER_COUNT.ped === 85, `필터 개수 ${PAIR_FILTER_COUNT.flagged}/${PAIR_FILTER_COUNT.ped} (기대 78/85)`)
  ck(PAIRS.filter(PAIR_FILTER_TEST.flagged).every(p => p.fPed !== null), '근연 주의 이상 쌍 중 계보 f가 없는 쌍이 있음')
  const deltas = PAIRS.filter(p => p.delta !== null).map(p => p.delta!)
  ck(near(Math.min(...deltas), -0.13953125, 1e-6) && near(Math.max(...deltas), 0.14, 1e-6), `Δ 범위 ${Math.min(...deltas)} ~ ${Math.max(...deltas)} (기대 −0.1395 ~ +0.1400)`)
  ck(PAIRS.filter(p => p.rel === '반형제' && p.level === 'ok').length === 7, '정상 등급 반형제 쌍이 7개가 아님')
  const sel = PAIR_BY_KEY.get(pairKey(...DEFAULT_SELECTION))!
  ck(fmt2(sel.G) === '1.04' && fmt2(sel.f) === '0.52' && fmt4(sel.fPed!) === '0.5195' && fmtDelta(sel.delta!) === '0.00', 'YR22-0412 × YR22-0415 값 불일치')
  const GM_EXP = [0.29802, 0.19993, -0.03273, 0.31305, -0.0357, 0.10756]
  ck(GROUP_MEANS.every((g, k) => near(g.G, GM_EXP[k]!, 1e-5)), `그룹 평균 ${GROUP_MEANS.map(g => g.G.toFixed(5)).join('/')} (기대 ${GM_EXP.join('/')})`)
  ck(GROUP_MEANS.map(g => g.n).join('/') === '435/600/300/190/200/45', '그룹 쌍 수 불일치')
  ck(SUMMARY.clusters === 13, `근연 군집 ${SUMMARY.clusters} (기대 13)`)
  const co = ORDERS.cluster.map(i => LINES[i]!.name)
  ck(co[0] === 'YR22-0412' && co[1] === 'YR23-6127' && co[2] === 'YR22-0415' && co[59] === 'YR22-7121', `군집 순 머리/끝 ${co.slice(0, 3).join(',')} … ${co[59]}`)
  const rootL = new Set(TREE.left!.ids.map(i => LINES[i]!.group))
  ck(TREE.left!.ids.length === 50 && TREE.right!.ids.length === 10 && !rootL.has('C') && fmt3(TREE.h) === '1.017', `루트 분할 ${TREE.left!.ids.length}|${TREE.right!.ids.length}, h ${TREE.h}`)
  const go = ORDERS.gebv.slice(0, 3).map(i => LINES[i]!.name).join(',')
  ck(go === 'YR22-0412,YR22-0415,YR21-0877', `GEBV 순 머리 ${go}`)
  const fams = [...new Set(LINES.map(c => c.family))].filter(fm => LINES.filter(c => c.family === fm).length > 1)
  const contiguous = fams.every(fm => {
    const pos = ORDERS.cluster.map((x, k) => (LINES[x]!.family === fm ? k : -1)).filter(k => k >= 0)
    return pos[pos.length - 1]! - pos[0]! === pos.length - 1
  })
  ck(fams.length === 17 && contiguous, `2계통 이상 가계 ${fams.length}개(기대 17), 연속 블록 ${contiguous}`)
  ck(KIN_WARN === 0.375 && KIN_CAUTION === 0.25, '근연 기준값이 바뀜')
}
