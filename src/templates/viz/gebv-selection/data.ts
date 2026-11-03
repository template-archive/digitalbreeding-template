/**
 * GEBV 기반 선발 — 목업 데이터와 순수 계산 함수.
 * 실제 서비스에서는 LINES(후보 계통의 형질별 GEBV·신뢰도)만 API 응답으로 바꾸면 나머지 계산은 그대로 쓴다.
 * 난수 소비 순서는 명세(docs/specs/gebv-selection.md)의 「목업 데이터 생성 규칙」을 그대로 따른다.
 */
import { formatSigned } from '@/lib/format'
import { createRng, type Rng } from '@/lib/rng'
import { lineName, selectionIntensity } from '@/lib/genomics'
import { pearson as pearsonR } from '@/lib/stats'

// ---------------- 상수 ----------------

export const SEED = 20261023
export const N = 600
export const N_GEN = 592
/** 육종가 방정식 매개변수(program-overview 2026년 수량 기준) */
export const R_ACC = 0.57
export const SIGMA_A = 28.2
export const L = 2.2
export const MU = 560
export const MEAN_Y = 10.0
export const SD_Y = R_ACC * SIGMA_A // 16.074
export const TRAINING_N = 1850
export const BASE_DATE = '2026-10-23'
/** 이 선발 수 미만이면 다양성 경고 */
export const DIVERSITY_MIN = 30
/** 작물 수량 ΔG 카탈로그 상한(%/년). 넘으면 '범위 초과(이론값)' 표시 */
export const DG_PCT_MAX = 2.5

export type TraitKey = 'yield' | 'culm' | 'blast' | 'taste'
export const TRAIT_KEYS: TraitKey[] = ['yield', 'culm', 'blast', 'taste']

export interface TraitDef {
  key: TraitKey
  label: string
  short: string
  unit: string
  /** +1 높을수록 좋음, −1 낮을수록 좋음 */
  d: 1 | -1
  /** 예측 정확도 r */
  acc: number
  sigmaA: number
  /** GEBV 표시 소수 자릿수 */
  digits: number
}

export const TRAITS: Record<TraitKey, TraitDef> = {
  yield: { key: 'yield', label: '쌀 수량', short: '수량', unit: 'kg/10a', d: 1, acc: 0.57, sigmaA: 28.2, digits: 1 },
  culm: { key: 'culm', label: '간장', short: '간장', unit: 'cm', d: -1, acc: 0.65, sigmaA: 4.8, digits: 1 },
  blast: { key: 'blast', label: '잎도열병 발병 지수', short: '도열병', unit: '점', d: -1, acc: 0.47, sigmaA: 1.1, digits: 2 },
  taste: { key: 'taste', label: '식미치', short: '식미', unit: '점', d: 1, acc: 0.38, sigmaA: 2.6, digits: 1 },
}

/** 원 척도(부호 정렬 전) 수량과의 GEBV 상관 */
const RHO_WITH_YIELD = { culm: 0.3, blast: 0.1, taste: -0.2 } as const

export type Weights = Record<TraitKey, number>
export type PresetKey = 'yieldFirst' | 'balanced' | 'resistance' | 'quality'

export const PRESETS: Record<PresetKey, { label: string; w: Weights }> = {
  yieldFirst: { label: '수량 중시', w: { yield: 0.5, culm: 0.15, blast: 0.2, taste: 0.15 } },
  balanced: { label: '균형', w: { yield: 0.25, culm: 0.25, blast: 0.25, taste: 0.25 } },
  resistance: { label: '저항성 중시', w: { yield: 0.3, culm: 0.1, blast: 0.5, taste: 0.1 } },
  quality: { label: '품질 중시', w: { yield: 0.3, culm: 0.1, blast: 0.15, taste: 0.45 } },
}
export const DEFAULT_PRESET: PresetKey = 'yieldFirst'

// ---------------- 후보 계통 ----------------

export interface Line {
  name: string
  anchor: boolean
  /** 앵커 툴팁 메모(유전자 보유는 가상) */
  note?: string
  gebv: Record<TraitKey, number>
  /** 신뢰도 r² */
  rel: Record<TraitKey, number>
  /** 표준화 GEBV(바람직한 방향 +), 후보 600계통 기준 */
  z: Record<TraitKey, number>
}

const ANCHOR_REL = { culm: 0.58, blast: 0.31, taste: 0.21 }

const ANCHORS: { name: string; yield: number; relY: number; culm: number; blast: number; taste: number; note: string }[] = [
  { name: 'YR22-0412', yield: 52.4, relY: 0.58, culm: -0.8, blast: -0.45, taste: -0.6, note: '중만생 다수성, Pi-ta' },
  { name: 'YR22-0415', yield: 49.8, relY: 0.55, culm: 0.4, blast: -0.4, taste: -0.9, note: '중만생 다수성, Pi-ta(0412와 형제 계통)' },
  { name: 'YR21-0877', yield: 47.1, relY: 0.61, culm: -2.1, blast: 0.35, taste: 0.4, note: '중만생 다수성' },
  { name: 'YR23-0136', yield: 45.6, relY: 0.49, culm: 1.9, blast: -0.3, taste: -0.2, note: '중만생 다수성, Pib' },
  { name: 'YR22-0263', yield: 38.9, relY: 0.52, culm: -4.3, blast: 0.4, taste: 1.6, note: '조생 고품질' },
  { name: 'YR21-0594', yield: 36.2, relY: 0.57, culm: -2.6, blast: -0.25, taste: 1.9, note: '조생 고품질, Pib' },
  { name: 'YR20-1108', yield: 12.7, relY: 0.44, culm: 5.2, blast: -1.35, taste: -1.1, note: '저항성 공여, Pi9' },
  { name: 'YR19-0731', yield: 8.3, relY: 0.41, culm: 3.8, blast: -1.5, taste: -0.8, note: '저항성 공여, Pigm' },
]

// ---------------- 수학 보조 ----------------

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100
const round3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function mean(xs: readonly number[]): number {
  let s = 0
  for (const x of xs) s += x
  return xs.length ? s / xs.length : NaN
}
/** 모집단 표준편차(N으로 나눔) */
export function sdPop(xs: readonly number[]): number {
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) ** 2
  return xs.length ? Math.sqrt(s / xs.length) : NaN
}
/** 피어슨 상관(@/lib/stats). 한쪽 분산이 0이면 0 */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const r = pearsonR(xs, ys)
  return Number.isNaN(r) ? 0 : r
}

function relOf(rng: Rng, acc: number): number {
  return round2(clamp(acc ** 2 * (0.4 + 1.2 * rng.beta(5, 5)), 0.08, 0.65))
}

function uniqueLineName(rng: Rng, prefix: string, year: number, used: Set<string>): string {
  let name = lineName(rng, prefix, year)
  while (used.has(name)) name = lineName(rng, prefix, year)
  used.add(name)
  return name
}

// ---------------- 생성 ----------------

type RawLine = Omit<Line, 'z'>

function generate(): RawLine[] {
  const rng = createRng(SEED)

  // 1) 수량 z: 절단 정규(−3.0 ≤ z ≤ 2.05) 거부 표집 → 표준화
  const zRaw: number[] = []
  while (zRaw.length < N_GEN) {
    const z = rng.normal()
    if (z >= -3.0 && z <= 2.05) zRaw.push(z)
  }
  const zm = mean(zRaw)
  const zs = sdPop(zRaw)
  const zy = zRaw.map(z => (z - zm) / zs)

  // 2) 600계통 평균 10.0, 모집단 SD 16.074가 되도록 a, b
  const sumA = ANCHORS.reduce((s, x) => s + x.yield, 0)
  const ssA = ANCHORS.reduce((s, x) => s + (x.yield - MEAN_Y) ** 2, 0)
  const a = (N * MEAN_Y - sumA) / N_GEN
  const b = Math.sqrt((N * SD_Y ** 2 - ssA) / N_GEN - (a - MEAN_Y) ** 2)

  const anchorLines: RawLine[] = ANCHORS.map(x => ({
    name: x.name,
    anchor: true,
    note: x.note,
    gebv: { yield: x.yield, culm: x.culm, blast: x.blast, taste: x.taste },
    rel: { yield: x.relY, culm: ANCHOR_REL.culm, blast: ANCHOR_REL.blast, taste: ANCHOR_REL.taste },
  }))

  const used = new Set(ANCHORS.map(x => x.name))
  const gen: RawLine[] = []
  for (let i = 0; i < N_GEN; i++) {
    const zi = zy[i]!
    let y = round1(a + b * zi)
    if (y >= 45.6) {
      if (import.meta.env?.DEV) console.warn(`[검산] [gebv-selection] 생성 수량 GEBV ${y}가 앵커 4위(45.6) 이상 — 44.9로 제한`)
      y = 44.9
    }
    const name = uniqueLineName(rng, 'YR', rng.int(2019, 2024), used)
    const relY = relOf(rng, 0.57)
    const culm = round1(TRAITS.culm.sigmaA * 0.65 * (RHO_WITH_YIELD.culm * zi + Math.sqrt(1 - RHO_WITH_YIELD.culm ** 2) * rng.normal()))
    const blast = round2(TRAITS.blast.sigmaA * 0.47 * (RHO_WITH_YIELD.blast * zi + Math.sqrt(1 - RHO_WITH_YIELD.blast ** 2) * rng.normal()))
    const taste = round1(TRAITS.taste.sigmaA * 0.38 * (RHO_WITH_YIELD.taste * zi + Math.sqrt(1 - RHO_WITH_YIELD.taste ** 2) * rng.normal()))
    const relCulm = relOf(rng, 0.65)
    const relBlast = relOf(rng, 0.47)
    const relTaste = relOf(rng, 0.38)
    gen.push({
      name,
      anchor: false,
      gebv: { yield: y, culm, blast, taste },
      rel: { yield: relY, culm: relCulm, blast: relBlast, taste: relTaste },
    })
  }
  return [...anchorLines, ...gen]
}

const RAW = generate()

/** 형질별 후보 집단 평균·모집단 SD */
export const STATS: Record<TraitKey, { mean: number; sd: number }> = Object.fromEntries(
  TRAIT_KEYS.map(t => {
    const xs = RAW.map(x => x.gebv[t])
    return [t, { mean: mean(xs), sd: sdPop(xs) }]
  }),
) as Record<TraitKey, { mean: number; sd: number }>

export function zOf(value: number, t: TraitKey): number {
  const s = STATS[t]
  return (TRAITS[t].d * (value - s.mean)) / s.sd
}

/** 후보 600계통(앵커 8 → 생성 592) */
export const LINES: Line[] = RAW.map(x => ({
  ...x,
  z: { yield: zOf(x.gebv.yield, 'yield'), culm: zOf(x.gebv.culm, 'culm'), blast: zOf(x.gebv.blast, 'blast'), taste: zOf(x.gebv.taste, 'taste') },
}))

/** 수량과 다른 형질 사이 GEBV 상관(원 척도) */
export const CORR_WITH_YIELD: Record<TraitKey, number> = Object.fromEntries(
  TRAIT_KEYS.map(t => [
    t,
    pearson(
      LINES.map(x => x.gebv.yield),
      LINES.map(x => x.gebv[t]),
    ),
  ]),
) as Record<TraitKey, number>

// ---------------- 선발 계산 ----------------

export type Mode = 'yield' | 'index'

/** 가중치 정규화(합 1). 모두 0이면 null */
export function normalizeWeights(w: Weights): Weights | null {
  const s = TRAIT_KEYS.reduce((acc, t) => acc + w[t], 0)
  if (!(s > 0)) return null
  return { yield: w.yield / s, culm: w.culm / s, blast: w.blast / s, taste: w.taste / s }
}

export function indexOf(line: Line, wn: Weights): number {
  return TRAIT_KEYS.reduce((acc, t) => acc + wn[t] * line.z[t], 0)
}

/** 선발 강도 i(소수 3자리 반올림값을 표시·계산 모두에 사용) */
export const iOf = (p: number) => round3(selectionIntensity(p))
export const nSelOf = (p: number) => Math.max(1, Math.round(p * N))

export interface RankedLine {
  line: Line
  /** 현재 선발 기준 값(수량 GEBV 또는 지수 I) */
  value: number
  /** 지수 I(가중치가 모두 0이면 null) */
  index: number | null
  rank: number
  selected: boolean
}

export interface SelectionResult {
  mode: Mode
  p: number
  nSel: number
  i: number
  cutoff: number
  ranked: RankedLine[]
  /** 이름 → 순위 정보 */
  byName: Map<string, RankedLine>
  /** 형질별 실현 선발 차(원 단위) */
  S: Record<TraitKey, number>
  /** 형질별 표준화 선발 차 d·S/SD(바람직한 방향 +) */
  Sz: Record<TraitKey, number>
  /** 기준 값의 전체 평균·선발 평균 */
  valueMean: number
  valueSelMean: number
  /** 육종가 방정식 기대 반응(수량) */
  R: number
  /** 기대 연간 유전적 개량량(수량 모드: R/L, 지수 모드: S수량/L) */
  dG: number
  dGpct: number
}

/** 지수 모드에서 가중치가 모두 0이면 null */
export function computeSelection(mode: Mode, p: number, weights: Weights): SelectionResult | null {
  const wn = normalizeWeights(weights)
  if (mode === 'index' && !wn) return null
  const nSel = nSelOf(p)
  const i = iOf(p)
  const items = LINES.map(line => {
    const index = wn ? indexOf(line, wn) : null
    return { line, index, value: mode === 'yield' ? line.gebv.yield : (index as number) }
  })
  items.sort((x, y) => y.value - x.value || (x.line.name < y.line.name ? -1 : x.line.name > y.line.name ? 1 : 0))
  const ranked: RankedLine[] = items.map((x, k) => ({ ...x, rank: k + 1, selected: k < nSel }))
  const byName = new Map(ranked.map(r => [r.line.name, r]))
  const sel = ranked.filter(r => r.selected)
  const S = {} as Record<TraitKey, number>
  const Sz = {} as Record<TraitKey, number>
  for (const t of TRAIT_KEYS) {
    S[t] = mean(sel.map(r => r.line.gebv[t])) - STATS[t].mean
    Sz[t] = (TRAITS[t].d * S[t]) / STATS[t].sd
  }
  const R = i * R_ACC * SIGMA_A
  const dG = mode === 'yield' ? R / L : S.yield / L
  return {
    mode,
    p,
    nSel,
    i,
    cutoff: ranked[nSel - 1]!.value,
    ranked,
    byName,
    S,
    Sz,
    valueMean: mean(ranked.map(r => r.value)),
    valueSelMean: mean(sel.map(r => r.value)),
    R,
    dG,
    dGpct: (dG / MU) * 100,
  }
}

// ---------------- 히스토그램·KDE ----------------

export interface HistBin {
  x0: number
  x1: number
  sel: number
  unsel: number
}

export function histogram(ranked: RankedLine[], width: number): HistBin[] {
  const vals = ranked.map(r => r.value)
  const lo = Math.floor(Math.min(...vals) / width) * width
  const hi = Math.ceil(Math.max(...vals) / width) * width + (Number.isInteger(Math.max(...vals) / width) ? width : 0)
  const n = Math.max(1, Math.round((hi - lo) / width))
  const bins: HistBin[] = Array.from({ length: n }, (_, k) => ({ x0: lo + k * width, x1: lo + (k + 1) * width, sel: 0, unsel: 0 }))
  for (const r of ranked) {
    const k = clamp(Math.floor((r.value - lo) / width + 1e-9), 0, n - 1)
    if (r.selected) bins[k]!.sel++
    else bins[k]!.unsel++
  }
  return bins
}

/** 가우스 커널 KDE, h = 1.06·sd·N^(−1/5), 200점, 막대 높이에 맞춰 × N × binWidth */
export function kde(values: number[], binWidth: number, lo: number, hi: number): [number, number][] {
  const n = values.length
  const h = 1.06 * sdPop(values) * Math.pow(n, -0.2)
  const out: [number, number][] = []
  const G = 200
  const c = 1 / (Math.sqrt(2 * Math.PI) * h * n)
  for (let k = 0; k < G; k++) {
    const x = lo + ((hi - lo) * k) / (G - 1)
    let s = 0
    for (const v of values) {
      const u = (x - v) / h
      s += Math.exp(-0.5 * u * u)
    }
    out.push([x, s * c * n * binWidth])
  }
  return out
}

// ---------------- 표기 ----------------

/** 형질 GEBV 표기(형질별 자릿수) */
export const fmtGebv = (v: number, t: TraitKey) => formatSigned(v, TRAITS[t].digits)
