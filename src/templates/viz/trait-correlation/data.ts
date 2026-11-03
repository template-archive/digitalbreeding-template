/**
 * 형질 상관 행렬 — 목업 데이터와 순수 계산 함수.
 * 실제 서비스에서는 TRAITS(h²·SE·정확도·σA), RG_UP(2변량 REML 유전 상관), LINES(계통 평균 표현형·교차 검증 GEBV)만
 * API 응답으로 바꾸면 나머지(유의성·군집·분해·상관 반응)는 그대로 계산된다.
 * 난수 소비 순서는 명세(docs/specs/trait-correlation.md)의 「목업 데이터 생성 규칙」을 그대로 따른다.
 */
import { formatFixed, formatSigned, josa } from '@/lib/format'
import { createRng } from '@/lib/rng'
import { linearFit, pearson } from '@/lib/stats'
import { lineName, normUpperTail, selectionIntensity } from '@/lib/genomics'

// ---------------- 상수 ----------------

export const SEED = 20261023
export const N = 1850
export const SNP_COUNT = 4820
export const ANALYSIS_DATE = '2026-10-23'
export const BASE_DATE = '2026-10-23'
/** 세대 간격(년) */
export const L = 2.2
/** 쌀 수량 계통 평균(kg/10a, %/년 환산 분모) */
export const MU = 560
/** 작물 수량 ΔG 카탈로그 상한(%/년). gebv-selection과 같은 기준 */
export const DG_PCT_MAX = 2.5
/** 군집 묶음 절단 높이(거리 1 − |rG|) */
export const CUT_H = 0.75
/** 덴드로그램 높이 축 시작 거리(이 값부터 확대해 그림) */
export const H_MIN_DENDRO = 0.45
export const P_OPTIONS = [0.01, 0.05, 0.1, 0.2, 0.3] as const
export const DEFAULT_P = 0.1
const Z975 = 1.959964

export type TraitKey = 'yield' | 'heading' | 'culm' | 'tgw' | 'blast' | 'taste' | 'pl' | 'pan'

export interface TraitDef {
  key: TraitKey
  /** 화면 이름 */
  label: string
  /** 짧은 이름(행렬 머리·막대) */
  short: string
  /** 문장용 이름(도열병은 값의 의미대로 '발병 지수') */
  sent: string
  /** 표시 단위 */
  unit: string
  /** 단위 설명(축 제목) */
  unitLong: string
  /** +1 높을수록 좋음, −1 낮을수록 좋음, 0 방향 없음 */
  d: 1 | 0 | -1
  mean: number
  h2: number
  seH2: number
  /** GBLUP 예측 정확도 r */
  r: number
  sigmaA: number
  /** 표현형·GEBV 자릿수 */
  dp: number
  dg: number
  /** 상관 반응 표시 자릿수 */
  dr: number
  /** 단일 선발 방향과 선택 목록 이름 */
  s: 1 | -1
  singleLabel: string
  /** 수량 구성 요소(스위치로 숨김) */
  component: boolean
}

export const TRAITS: TraitDef[] = [
  { key: 'yield', label: '쌀 수량', short: '수량', sent: '쌀 수량', unit: 'kg/10a', unitLong: 'kg/10a, 백미', d: 1, mean: 560, h2: 0.36, seH2: 0.04, r: 0.57, sigmaA: 28.2, dp: 1, dg: 1, dr: 1, s: 1, singleLabel: '쌀 수량 증가', component: false },
  { key: 'heading', label: '출수기', short: '출수기', sent: '출수기', unit: '일', unitLong: '파종 후 일수', d: 0, mean: 113, h2: 0.72, seH2: 0.028, r: 0.68, sigmaA: 4.0, dp: 1, dg: 2, dr: 1, s: -1, singleLabel: '출수기 앞당김(조생화)', component: false },
  { key: 'culm', label: '간장', short: '간장', sent: '간장', unit: 'cm', unitLong: 'cm', d: -1, mean: 78, h2: 0.62, seH2: 0.032, r: 0.65, sigmaA: 4.8, dp: 1, dg: 2, dr: 1, s: -1, singleLabel: '간장 단축(단간화)', component: false },
  { key: 'tgw', label: '천립중', short: '천립중', sent: '천립중', unit: 'g', unitLong: 'g, 현미', d: 0, mean: 21.8, h2: 0.55, seH2: 0.035, r: 0.61, sigmaA: 0.9, dp: 2, dg: 3, dr: 2, s: 1, singleLabel: '천립중 증가', component: false },
  { key: 'blast', label: '도열병 저항성', short: '도열병', sent: '도열병 발병 지수', unit: '점', unitLong: '발병 지수 0~9', d: -1, mean: 4.5, h2: 0.3, seH2: 0.042, r: 0.47, sigmaA: 1.1, dp: 2, dg: 3, dr: 2, s: -1, singleLabel: '도열병 저항성(발병 지수 감소)', component: false },
  { key: 'taste', label: '밥맛(식미치)', short: '밥맛', sent: '밥맛', unit: '점', unitLong: '식미계', d: 1, mean: 72, h2: 0.18, seH2: 0.045, r: 0.38, sigmaA: 2.6, dp: 1, dg: 2, dr: 2, s: 1, singleLabel: '밥맛 향상', component: false },
  { key: 'pl', label: '수장', short: '수장', sent: '수장', unit: 'cm', unitLong: 'cm', d: 0, mean: 20.7, h2: 0.5, seH2: 0.036, r: 0.58, sigmaA: 1.05, dp: 2, dg: 3, dr: 2, s: 1, singleLabel: '수장 증가', component: true },
  { key: 'pan', label: '주당 이삭수', short: '이삭수', sent: '주당 이삭수', unit: '개', unitLong: '개', d: 0, mean: 15.1, h2: 0.35, seH2: 0.041, r: 0.5, sigmaA: 1.15, dp: 1, dg: 3, dr: 2, s: 1, singleLabel: '주당 이삭수 증가', component: true },
]
export const K = TRAITS.length
export const IDX = Object.fromEntries(TRAITS.map((t, i) => [t.key, i])) as Record<TraitKey, number>
export const BLAST = IDX.blast

/** 2변량 REML 유전 상관(상삼각, 행 < 열, TRAITS 순서) — API 응답 자리 */
export const RG_UP: Record<string, number> = {
  'yield,heading': 0.31, 'yield,culm': 0.3, 'yield,tgw': 0.26, 'yield,blast': 0.1, 'yield,taste': -0.2, 'yield,pl': 0.22, 'yield,pan': 0.41,
  'heading,culm': 0.47, 'heading,tgw': 0.12, 'heading,blast': 0.06, 'heading,taste': -0.11, 'heading,pl': 0.28, 'heading,pan': 0.08,
  'culm,tgw': 0.18, 'culm,blast': -0.12, 'culm,taste': -0.07, 'culm,pl': 0.43, 'culm,pan': -0.16,
  'tgw,blast': 0.02, 'tgw,taste': -0.13, 'tgw,pl': 0.17, 'tgw,pan': -0.37,
  'blast,taste': 0.15, 'blast,pl': 0.05, 'blast,pan': 0.14,
  'taste,pl': 0.01, 'taste,pan': -0.09,
  'pl,pan': -0.32,
}
/** 설계 환경 상관 — 생성에만 쓴다(화면은 rP에서 역산한 rE) */
const RE_UP: Record<string, number> = {
  'yield,heading': 0.12, 'yield,culm': 0.35, 'yield,tgw': 0.22, 'yield,blast': -0.25, 'yield,taste': -0.12, 'yield,pl': 0.28, 'yield,pan': 0.48,
  'heading,culm': 0.18, 'heading,tgw': -0.05, 'heading,blast': -0.08, 'heading,taste': 0.05, 'heading,pl': 0.1, 'heading,pan': 0.02,
  'culm,tgw': 0.1, 'culm,blast': -0.05, 'culm,taste': -0.06, 'culm,pl': 0.3, 'culm,pan': 0.12,
  'tgw,blast': -0.1, 'tgw,taste': 0.03, 'tgw,pl': 0.12, 'tgw,pan': -0.18,
  'blast,taste': -0.06, 'blast,pl': -0.04, 'blast,pan': 0.1,
  'taste,pl': 0.0, 'taste,pan': -0.08,
  'pl,pan': -0.12,
}

function full(up: Record<string, number>): number[][] {
  const M: number[][] = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? 1 : 0)))
  for (const [k, v] of Object.entries(up)) {
    const [a, b] = k.split(',').map(x => IDX[x as TraitKey]) as [number, number]
    M[a]![b] = v
    M[b]![a] = v
  }
  return M
}
export const RG = full(RG_UP)
const RE_DESIGN = full(RE_UP)

/** 표준 하삼각 콜레스키. 양정치가 아니면 null */
function cholesky(A: number[][]): number[][] | null {
  const n = A.length
  const Lm = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i]![j]!
      for (let k = 0; k < j; k++) s -= Lm[i]![k]! * Lm[j]![k]!
      if (i === j) {
        if (s <= 0) return null
        Lm[i]![j] = Math.sqrt(s)
      } else Lm[i]![j] = s / Lm[j]![j]!
    }
  return Lm
}
const LG = cholesky(RG)
const LE = cholesky(RE_DESIGN)

// ---------------- 생성 ----------------

const roundTo = (v: number, k: number) => Math.round(v * 10 ** k) / 10 ** k

export interface Lines {
  names: string[]
  /** 도열병 발병 지수 0~9 척도에서 잘린(clamp) 계통 수 */
  blastClamp: { lo: number; hi: number }
  /** pheno[t][n] — 계통 평균 표현형(반올림 값) */
  pheno: Float64Array[]
  /** gebv[t][n] — 교차 검증 GEBV(반올림 값) */
  gebv: Float64Array[]
}

const RESERVED =
  'YR01-0388 YR03-0516 YR05-0337 YR07-0231 YR08-1042 YR10-0866 YR10-1193 YR13-0819 YR14-0472 YR16-0158 YR19-0083 YR19-0118 YR19-0256 YR19-0477 YR19-0731 YR19-0902 YR20-0163 YR20-0342 YR20-0527 YR20-0691 YR20-0815 YR20-1024 YR20-1108 YR20-1236 YR21-0108 YR21-0335 YR21-0419 YR21-0594 YR21-0652 YR21-0786 YR21-0877 YR21-0943 YR21-1150 YR22-0263 YR22-0412 YR22-0415 YR23-0136'.split(
    ' ',
  )

function build(): Lines {
  const pheno = TRAITS.map(() => new Float64Array(N))
  const gebv = TRAITS.map(() => new Float64Array(N))
  const names: string[] = []
  const blastClamp = { lo: 0, hi: 0 }
  if (!LG || !LE) return { names, blastClamp, pheno, gebv }
  const rng = createRng(SEED)
  const mv = (Lm: number[][]) => {
    const z = Array.from({ length: K }, () => rng.normal())
    return Lm.map(row => row.reduce((s, l, k) => s + l * z[k]!, 0))
  }
  for (let n = 0; n < N; n++) {
    const u = mv(LG) // 참 육종가(표준화)
    const v = mv(LE) // 환경(잔차)
    const w = mv(LG) // GEBV 예측 오차 성분
    for (let t = 0; t < K; t++) {
      const tr = TRAITS[t]!
      const sE = tr.sigmaA * Math.sqrt((1 - tr.h2) / tr.h2)
      let p = tr.mean + tr.sigmaA * u[t]! + sE * v[t]!
      if (t === BLAST) {
        if (p < 0) blastClamp.lo++
        if (p > 9) blastClamp.hi++
        p = Math.min(9, Math.max(0, p))
      }
      pheno[t]![n] = roundTo(p, tr.dp)
      gebv[t]![n] = roundTo(tr.r * tr.sigmaA * (tr.r * u[t]! + Math.sqrt(1 - tr.r ** 2) * w[t]!), tr.dg)
    }
  }
  const used = new Set(RESERVED)
  for (let n = 0; n < N; n++) {
    let name: string
    do name = lineName(rng, 'YR', rng.int(2014, 2025))
    while (used.has(name))
    used.add(name)
    names.push(name)
  }
  return { names, blastClamp, pheno, gebv }
}

export const LINES: Lines = build()

// ---------------- 통계 보조 ----------------

// 상관·회귀는 @/lib/stats(템플릿 간 공통)
export { pearson }
export function ols(xs: ArrayLike<number>, ys: ArrayLike<number>): { slope: number; icpt: number } {
  const { slope, intercept } = linearFit(xs, ys)
  return { slope, icpt: intercept }
}
const pTwo = (z: number) => 2 * normUpperTail(Math.abs(z))
export const stars = (p: number) => (p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '')

// ---------------- 쌍별 결과 ----------------

export interface PairStat {
  /** TRAITS 인덱스(a < b) */
  a: number
  b: number
  key: string
  rg: number
  se: number
  pg: number
  rgLo: number
  rgHi: number
  rp: number
  pp: number
  rpLo: number
  rpHi: number
  /** rP에서 역산한 환경 상관 */
  re: number
  gen: number
  env: number
  /** GEBV 간 상관(교차 검증 GEBV) */
  rgebv: number
}

export const pairKey = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`)

function computePairs(): Map<string, PairStat> {
  const m = new Map<string, PairStat>()
  for (let a = 0; a < K; a++)
    for (let b = a + 1; b < K; b++) {
      const ta = TRAITS[a]!
      const tb = TRAITS[b]!
      const rg = RG[a]![b]!
      // Robertson(1959) 근사
      const se = ((1 - rg * rg) / Math.SQRT2) * Math.sqrt((ta.seH2 * tb.seH2) / (ta.h2 * tb.h2))
      const pg = pTwo(rg / se)
      const rp = pearson(LINES.pheno[a]!, LINES.pheno[b]!)
      const tp = (rp * Math.sqrt(N - 2)) / Math.sqrt(1 - rp * rp)
      const pp = pTwo(tp)
      const zf = Math.atanh(rp)
      const hw = Z975 / Math.sqrt(N - 3)
      const hh = Math.sqrt(ta.h2 * tb.h2)
      const ee = Math.sqrt((1 - ta.h2) * (1 - tb.h2))
      const re = (rp - hh * rg) / ee
      m.set(pairKey(a, b), {
        a,
        b,
        key: pairKey(a, b),
        rg,
        se,
        pg,
        rgLo: Math.max(-1, rg - Z975 * se),
        rgHi: Math.min(1, rg + Z975 * se),
        rp,
        pp,
        rpLo: Math.tanh(zf - hw),
        rpHi: Math.tanh(zf + hw),
        re,
        gen: hh * rg,
        env: ee * re,
        rgebv: pearson(LINES.gebv[a]!, LINES.gebv[b]!),
      })
    }
  return m
}
export const PAIRS = computePairs()
export const pairOf = (i: number, j: number) => PAIRS.get(pairKey(i, j))!

/** 기본 선택 쌍: 쌀 수량–밥맛 */
export const DEFAULT_PAIR: [number, number] = [IDX.yield, IDX.taste]

/** 도열병 표현형 척도 경계 계통 수 — 반올림된 표현형이 정확히 0.00 또는 9.00인 계통(화면 점과 같은 기준).
 *  생성 중 clamp 개수(LINES.blastClamp, 47 = 16 + 31)와는 9 바로 아래 1계통만큼 다르다. */
export const BLAST_EDGE = (() => {
  const ph = LINES.pheno[BLAST]!
  let lo = 0
  let hi = 0
  for (let n = 0; n < ph.length; n++) {
    if (ph[n] === 0) lo++
    else if (ph[n] === 9) hi++
  }
  return { lo, hi, total: lo + hi }
})()

// ---------------- 보이는 형질 ----------------

export const visibleTraits = (withComponents: boolean): number[] =>
  TRAITS.map((t, i) => (withComponents || !t.component ? i : -1)).filter(i => i >= 0)

export interface Summary {
  pairs: number
  sigRg: number
  bonfRg: number
  sigRp: number
  bonfAlpha: number
  strongest: PairStat
  signDiff: PairStat[]
}

export function summarize(vis: number[]): Summary {
  const list: PairStat[] = []
  for (let x = 0; x < vis.length; x++) for (let y = x + 1; y < vis.length; y++) list.push(pairOf(vis[x]!, vis[y]!))
  const bonfAlpha = 0.05 / list.length
  let strongest = list[0]!
  for (const q of list) if (Math.abs(q.rg) > Math.abs(strongest.rg)) strongest = q
  return {
    pairs: list.length,
    sigRg: list.filter(q => q.pg < 0.05).length,
    bonfRg: list.filter(q => q.pg < bonfAlpha).length,
    sigRp: list.filter(q => q.pp < 0.05).length,
    bonfAlpha,
    strongest,
    signDiff: list.filter(q => Math.sign(q.rg) !== Math.sign(q.rp) && Math.abs(q.rg) >= 0.05 && Math.abs(q.rp) >= 0.05),
  }
}

// ---------------- UPGMA(d = 1 − |rG|) ----------------

export interface DendroNode {
  /** 잎 순서(TRAITS 인덱스) */
  order: number[]
  /** 병합 높이(잎 0) */
  h: number
  children: [DendroNode, DendroNode] | null
}

export interface Clustering {
  order: number[]
  root: DendroNode
  /** 병합 높이(병합 순서) */
  heights: number[]
  /** h = CUT_H에서 자른 묶음(잎 순서대로) */
  groups: number[][]
}

export function upgma(vis: number[]): Clustering {
  type C = { members: number[]; minIdx: number; node: DendroNode }
  let clusters: C[] = vis.map(i => ({ members: [i], minIdx: i, node: { order: [i], h: 0, children: null } }))
  const dist = (A: C, B: C) => {
    let s = 0
    for (const a of A.members) for (const b of B.members) s += 1 - Math.abs(RG[a]![b]!)
    return s / (A.members.length * B.members.length)
  }
  const heights: number[] = []
  while (clusters.length > 1) {
    let best: { a: number; b: number; d: number } | null = null
    for (let a = 0; a < clusters.length; a++)
      for (let b = a + 1; b < clusters.length; b++) {
        const d = dist(clusters[a]!, clusters[b]!)
        if (!best || d < best.d - 1e-12) best = { a, b, d }
      }
    const A = clusters[best!.a]!
    const B = clusters[best!.b]!
    const [first, second] = A.minIdx < B.minIdx ? [A, B] : [B, A]
    const merged: C = {
      members: [...A.members, ...B.members],
      minIdx: Math.min(A.minIdx, B.minIdx),
      node: { order: [...first.node.order, ...second.node.order], h: best!.d, children: [first.node, second.node] },
    }
    heights.push(best!.d)
    clusters = clusters.filter((_, k) => k !== best!.a && k !== best!.b)
    clusters.push(merged)
  }
  const root = clusters[0]!.node
  const groups: number[][] = []
  const cut = (n: DendroNode) => {
    if (n.h <= CUT_H || !n.children) groups.push(n.order)
    else n.children.forEach(cut)
  }
  cut(root)
  return { order: root.order, root, heights, groups }
}

/** 묶음 라벨: 2형질 이상 묶음에만 */
export function groupLabel(g: number[]): string | null {
  if (g.length < 2) return null
  const hasY = g.includes(IDX.yield)
  const hasH = g.includes(IDX.heading)
  if (hasY && hasH) return '수량·생육'
  if (hasY) return '수량·구성 요소'
  if (hasH) return '생육·초형'
  return null
}

// ---------------- 상관 반응 ----------------

export type PresetKey = 'yieldFirst' | 'balanced' | 'resistance' | 'quality'
/** gebv-selection `PRESETS` 그대로 복제(src/templates/viz/gebv-selection/data.ts) */
export const PRESETS: Record<PresetKey, { label: string; w: Partial<Record<TraitKey, number>> }> = {
  yieldFirst: { label: '수량 중시', w: { yield: 0.5, culm: 0.15, blast: 0.2, taste: 0.15 } },
  balanced: { label: '균형', w: { yield: 0.25, culm: 0.25, blast: 0.25, taste: 0.25 } },
  resistance: { label: '저항성 중시', w: { yield: 0.3, culm: 0.1, blast: 0.5, taste: 0.1 } },
  quality: { label: '품질 중시', w: { yield: 0.3, culm: 0.1, blast: 0.15, taste: 0.45 } },
}
export const PRESET_KEYS: PresetKey[] = ['yieldFirst', 'balanced', 'resistance', 'quality']

/** 선발 기준: 'idx:yieldFirst' | 'single:yield' */
export type Criterion = `idx:${PresetKey}` | `single:${TraitKey}`
export const DEFAULT_CRITERION: Criterion = 'idx:yieldFirst'
export const BASE_CRITERION: Criterion = 'single:yield'

export function criterionLabel(c: Criterion): string {
  const [kind, key] = c.split(':') as ['idx' | 'single', string]
  if (kind === 'idx') return `지수 · ${PRESETS[key as PresetKey].label}`
  return `${TRAITS[IDX[key as TraitKey]]!.singleLabel}(단일)`
}
/** 문장 주어 */
export function criterionSubject(c: Criterion): string {
  const [kind, key] = c.split(':') as ['idx' | 'single', string]
  if (kind === 'idx') return `${PRESETS[key as PresetKey].label} 지수`
  return `${TRAITS[IDX[key as TraitKey]]!.singleLabel} 단일 선발`
}

/** 선발 강도(소수 3자리 반올림값으로 계산) */
export const intensity = (p: number) => roundTo(selectionIntensity(p), 3)

/** GEBV 간 상관 모수: ρ_kl = rG_kl(r_k r_l + √((1 − r_k²)(1 − r_l²))), ρ_kk = 1 */
const rhoGebv = (k: number, l: number) => {
  if (k === l) return 1
  const rk = TRAITS[k]!.r
  const rl = TRAITS[l]!.r
  return RG[k]![l]! * (rk * rl + Math.sqrt((1 - rk ** 2) * (1 - rl ** 2)))
}

export interface Response {
  /** 형질별 기대 반응(형질 단위/세대), TRAITS 순서 */
  resp: number[]
  /** 지수일 때 σ_I */
  sdI: number | null
  /** 정규화 가중치(지수일 때) */
  weights: { key: TraitKey; w: number }[] | null
}

export function computeResponse(c: Criterion, p: number): Response {
  const i = intensity(p)
  const [kind, key] = c.split(':') as ['idx' | 'single', string]
  if (kind === 'single') {
    const x = IDX[key as TraitKey]
    const tx = TRAITS[x]!
    return { resp: TRAITS.map((t, y) => i * tx.r * tx.s * RG[x]![y]! * t.sigmaA), sdI: null, weights: null }
  }
  const w = PRESETS[key as PresetKey].w
  const keys = Object.keys(w) as TraitKey[]
  const sum = keys.reduce((s, k) => s + w[k]!, 0)
  const wn = keys.map(k => w[k]! / sum)
  const ix = keys.map(k => IDX[k])
  const dd = ix.map(t => TRAITS[t]!.d)
  let varI = 0
  for (let a = 0; a < keys.length; a++) for (let b = 0; b < keys.length; b++) varI += wn[a]! * wn[b]! * dd[a]! * dd[b]! * rhoGebv(ix[a]!, ix[b]!)
  const sdI = Math.sqrt(varI)
  const resp = TRAITS.map((t, y) => (i * keys.reduce((acc, _k, a) => acc + wn[a]! * dd[a]! * TRAITS[ix[a]!]!.r * RG[ix[a]!]![y]! * t.sigmaA, 0)) / sdI)
  return { resp, sdI, weights: keys.map((k, a) => ({ key: k, w: wn[a]! })) }
}

/** 판정 기준: σA 단위 ±0.05, 출수기 ±1.0일 */
export const VERDICT_EPS = 0.05
export const HEADING_ALERT_DAYS = 1.0

export type Verdict = '개선' | '손해' | '변화 미미' | '증가' | '감소' | '출수 지연 주의' | '출수 촉진 주의'
export type VerdictTone = 'positive' | 'warning' | 'neutral'

export function verdictOf(y: number, R: number): Verdict {
  const t = TRAITS[y]!
  const z = R / t.sigmaA
  if (t.d !== 0) {
    const g = t.d * z
    return g > VERDICT_EPS ? '개선' : g < -VERDICT_EPS ? '손해' : '변화 미미'
  }
  if (t.key === 'heading' && Math.abs(R) >= HEADING_ALERT_DAYS) return R > 0 ? '출수 지연 주의' : '출수 촉진 주의'
  if (Math.abs(z) < VERDICT_EPS) return '변화 미미'
  return R > 0 ? '증가' : '감소'
}
export const verdictTone = (v: Verdict): VerdictTone =>
  v === '개선' ? 'positive' : v === '손해' || v === '출수 지연 주의' || v === '출수 촉진 주의' ? 'warning' : 'neutral'

/** 연간 수량 개량량 */
export function annualYield(Ryield: number) {
  const perYear = Ryield / L
  const pct = (perYear / MU) * 100
  return { perYear, pct, over: pct > DG_PCT_MAX }
}

// ---------------- 표기 ----------------

export const f2 = (v: number) => formatFixed(v, 2)
export const f3 = (v: number) => formatFixed(v, 3)
export const s2 = (v: number) => formatSigned(v, 2)
export const s3 = (v: number) => formatSigned(v, 3)
export const fmtInt = (v: number) => v.toLocaleString('ko-KR')
export const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : p < 0.01 ? `p = ${p.toFixed(3)}` : `p = ${p.toFixed(2)}`)
export const fmtPct = (p: number) => `${Math.round(p * 100)}%`
/** 형질 단위 반응 표기(형질별 자릿수, 부호) */
export const fmtResp = (y: number, R: number) => `${formatSigned(R, TRAITS[y]!.dr)}${unitSuffix(TRAITS[y]!.unit)}`
/** 한글 단위(점·일·개)는 붙여 쓰고 그 밖(cm, g, kg/10a)은 띄운다 */
export const unitSuffix = (unit: string) => (/^[가-힣]/.test(unit) ? unit : ` ${unit}`)
export const fmtGebvVal = (t: number, v: number) => formatSigned(v, TRAITS[t]!.dg)
/** 행렬 머리·축의 방향 표기 */
export const dirText = (t: TraitDef) => (t.key === 'blast' ? '낮을수록 저항' : t.d > 0 ? '높을수록 좋음' : t.d < 0 ? '낮을수록 좋음' : '방향 없음')

/** 받침 유무에 따른 조사(@/lib/format) */
export { josa }

// ---------------- 해석 문장(D) ----------------

function sizeGrade(r: number) {
  const a = Math.abs(r)
  return a < 0.1 ? '거의 없음' : a < 0.3 ? '약한' : a < 0.5 ? '중간' : '강한'
}

/** 해석 둘째 문장의 주어 구: 형질의 단일 선발 방향 s로 선발할 때 */
function selectPhrase(t: TraitDef): string {
  switch (t.key) {
    case 'yield':
      return '쌀 수량을 높이는'
    case 'taste':
      return '밥맛을 높이는'
    case 'culm':
      return '간장을 줄이는(단간화)'
    case 'blast':
      return '도열병 저항성을 높이는(발병 지수를 낮추는)'
    case 'heading':
      return '출수기를 앞당기는(조생화)'
    default:
      return `${josa(t.sent, '를을')} 늘리는`
  }
}

/** 상대 형질의 변화 동사(up = 값이 커지는 쪽). sent가 '도열병 발병 지수'라 도열병은 "발병 지수를 높이는/낮추는"이 된다 */
function changeVerb(t: TraitDef, up: boolean): string {
  if (t.key === 'heading') return up ? '늦추는' : '앞당기는'
  if (t.key === 'blast') return up ? '높이는' : '낮추는'
  return up ? '늘리는' : '줄이는'
}

export function interpretPair(q: PairStat): string[] {
  const x = TRAITS[q.a]!
  const y = TRAITS[q.b]!
  const out: string[] = []
  const grade = sizeGrade(q.rg)
  const gradeText = grade === '거의 없음' ? '상관이 거의 없습니다' : `${grade} ${q.rg > 0 ? '양의' : '음의'} 상관입니다`
  const ci0 = q.rgLo <= 0 && q.rgHi >= 0
  const sig =
    q.pg >= 0.05
      ? ` (유의하지 않음, ${fmtP(q.pg)}, ${ci0 ? `95% 신뢰구간(${f2(q.rgLo)}~${f2(q.rgHi)})이 0을 포함` : `95% 신뢰구간 ${f2(q.rgLo)}~${f2(q.rgHi)}`})`
      : ` (${fmtP(q.pg)})`
  out.push(`${josa(x.sent, '와과')} ${y.sent}의 유전 상관은 rG = ${f2(q.rg)} ± ${f2(q.se)}로 ${gradeText}${sig}.`)
  if (Math.abs(q.rg) >= 0.1) {
    if (x.d !== 0 && y.d !== 0) {
      out.push(
        Math.sign(q.rg) * x.d * y.d > 0
          ? '한쪽을 개량하면 다른 쪽도 함께 좋아집니다(동반 개량).'
          : '한쪽을 개량하면 다른 쪽은 나빠지는 쪽으로 작용합니다(상충).',
      )
    } else {
      // 주어 = d ≠ 0인 형질(둘 다 0이면 x), 실제 선발 방향 s 기준으로 상대 형질의 변화 방향을 서술
      const [subj, other] = x.d === 0 && y.d !== 0 ? [y, x] : [x, y]
      const up = Math.sign(q.rg) * subj.s > 0
      out.push(`${selectPhrase(subj)} 선발은 ${josa(other.sent, '를을')} ${changeVerb(other, up)} 경향이 있습니다.`)
    }
  }
  out.push(`표현형 상관(rP = ${f2(q.rp)})은 유전 기여(${f3(q.gen)})와 환경 기여(${f3(q.env)})의 합입니다.`)
  if (Math.sign(q.rg) !== Math.sign(q.rp) && Math.abs(q.rg) >= 0.05 && Math.abs(q.rp) >= 0.05) {
    out.push(
      `유전 상관과 표현형 상관의 부호가 다릅니다. 환경 상관(rE = ${f2(q.re)})이 표현형 상관을 반대 방향으로 끌었습니다 — 표현형만 보고 선발 방향을 정하면 오해할 수 있습니다.`,
    )
  }
  return out
}

// ---------------- 해설 문장(G) ----------------

export function explainResponse(c: Criterion, cur: number[], base: number[]): string {
  const y0 = IDX.yield
  const subj = criterionSubject(c)
  if (c === BASE_CRITERION) {
    const harms = TRAITS.map((_, y) => y).filter(y => TRAITS[y]!.d !== 0 && verdictOf(y, base[y]!) === '손해')
    const list = harms.map(y => `${TRAITS[y]!.sent} ${fmtResp(y, base[y]!)}`).join(', ')
    return `${josa(subj, '는은')} 수량 ${fmtResp(y0, base[y0]!)}/세대를 얻는 대신 ${list}의 손해를 함께 낳습니다.`
  }
  const fixed = TRAITS.map((_, y) => y).filter(
    y => TRAITS[y]!.d !== 0 && verdictOf(y, base[y]!) === '손해' && verdictOf(y, cur[y]!) !== '손해',
  )
  const ratio = cur[y0]! / base[y0]!
  const yieldPart =
    cur[y0]! > 0
      ? `수량 반응을 수량 단일 선발의 ${fmtPct(ratio)}(${formatSigned(cur[y0]!, 1)} vs ${formatSigned(base[y0]!, 1)} kg/10a/세대)로 낮추는 대신`
      : `수량을 ${formatSigned(cur[y0]!, 1)} kg/10a/세대 바꾸며(수량 단일 ${formatSigned(base[y0]!, 1)})`
  if (fixed.length === 0) return `${josa(subj, '는은')} ${yieldPart} 수량 단일 선발의 손해 형질을 하나도 해소하지 못합니다.`
  const list = fixed
    .map(y => `${TRAITS[y]!.sent} ${formatSigned(base[y]!, TRAITS[y]!.dr)} → ${formatSigned(cur[y]!, TRAITS[y]!.dr)}${unitSuffix(TRAITS[y]!.unit)}`)
    .join(', ')
  return `${josa(subj, '는은')} ${yieldPart} ${list}으로 손해를 없앱니다.`
}

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
  console.assert(LG !== null, '[검산] RG 콜레스키 실패(양정치 아님)')
  console.assert(LE !== null, '[검산] RE 콜레스키 실패(양정치 아님)')
  const all = [...PAIRS.values()]
  console.assert(
    all.every(q => Math.abs(q.rg) <= 1 && Math.abs(q.rp) <= 1 && Math.abs(q.re) <= 1),
    '[검산] rG·rP·rE 중 [−1, 1] 밖 값이 있음',
  )
  const ytaste = pairOf(IDX.yield, IDX.taste)
  const yblast = pairOf(IDX.yield, IDX.blast)
  console.assert(near(ytaste.rp, -0.103543, 5e-6), `[검산] rP(수량–밥맛) ${ytaste.rp} ≠ −0.103543`)
  console.assert(near(yblast.rp, -0.157191, 5e-6), `[검산] rP(수량–도열병) ${yblast.rp} ≠ −0.157191`)
  const s8 = summarize(visibleTraits(true))
  const s6 = summarize(visibleTraits(false))
  console.assert(s8.sigRg === 15 && s8.sigRp === 21 && s8.bonfRg === 13, `[검산] 유의 쌍 rG ${s8.sigRg}·rP ${s8.sigRp}·본페로니 ${s8.bonfRg} ≠ 15·21·13`)
  console.assert(s6.sigRg === 7 && s6.sigRp === 11 && s6.bonfRg === 6, `[검산] 6형질 유의 쌍 ${s6.sigRg}·${s6.sigRp}·${s6.bonfRg} ≠ 7·11·6`)
  const ord8 = upgma(visibleTraits(true)).order.map(i => TRAITS[i]!.key).join(',')
  console.assert(ord8 === 'yield,pan,tgw,heading,culm,pl,blast,taste', `[검산] 8형질 군집 잎 순서 ${ord8}`)
  const ord6 = upgma(visibleTraits(false)).order.map(i => TRAITS[i]!.key).join(',')
  console.assert(ord6 === 'yield,heading,culm,tgw,blast,taste', `[검산] 6형질 군집 잎 순서 ${ord6}`)
  const base = computeResponse(BASE_CRITERION, 0.1)
  console.assert(near(base.resp[IDX.yield]!, 28.2099, 1e-3), `[검산] 수량 단일 p 10% 수량 반응 ${base.resp[IDX.yield]} ≠ 28.2099`)
  const yf = computeResponse('idx:yieldFirst', 0.1)
  console.assert(near(yf.sdI!, 0.47757, 1e-4), `[검산] 수량 중시 σ_I ${yf.sdI} ≠ 0.47757`)
  console.assert(formatSigned(yf.resp[IDX.heading]!, 1) === '+0.5', `[검산] 수량 중시 출수기 반응 표시 ${formatSigned(yf.resp[IDX.heading]!, 1)} ≠ +0.5`)
  console.assert(
    BLAST_EDGE.total === 48 && BLAST_EDGE.lo === 16 && BLAST_EDGE.hi === 32,
    `[검산] 도열병 경계 계통 ${BLAST_EDGE.total}(0점 ${BLAST_EDGE.lo} · 9점 ${BLAST_EDGE.hi}) ≠ 48(16 · 32)`,
  )
  console.assert(LINES.names[0] === 'YR25-4559' && LINES.names[N - 1] === 'YR23-0519', `[검산] 계통명 ${LINES.names[0]}…${LINES.names[N - 1]}`)
}
