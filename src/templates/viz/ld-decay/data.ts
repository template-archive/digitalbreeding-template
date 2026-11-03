/**
 * LD 구조 목업 데이터.
 * 명세: docs/specs/ld-decay.md (시드 20261023)
 * 참조 구현: 분석가 검산 스크립트 ldref.mjs·check.mjs(저장소 밖 — 명세 docs/specs/ld-decay.md 「검산 기록」) — RNG 소비 순서를 그대로 옮겼다.
 * 2026-10-27 정리 회차 3: PLANTED MAF·β를 gwas-manhattan 새 표로, 리드 클레이드 목표를 CLADE_TARGET으로 분리, GS3 창 LEAD_BIAS.
 * 412계통 유전형은 SNP마다 Uint32Array(13) 비트셋으로 묶고, 집단 마스크와 AND 후 popcount로
 * n_A·n_B·n_AB를 센다. 산술(pA = n_A/n, D = pAB − pA·pB, r² = D²/den)은 참조 구현과 같아 결과가 같다.
 *
 * 실제 데이터로 바꿀 때는 `computeAll()`이 돌려주는 형태(감소 곡선 집계 `DecayResult`, 프리셋 창
 * `PresetWindow`와 집단별 분석 `PresetView`)만 유지하면 화면은 그대로 동작한다.
 */
import { createRng, type Rng } from '@/lib/rng'
import { ORGANISMS } from '@/lib/genomics'

// ---------------------------------------------------------------------------
// 상수·분석 조건(program-baseline「GWAS 패널」)
// ---------------------------------------------------------------------------

export const SEED = 20261023
/** 분석 SNP 수(QC 후) */
export const M = 36420
/** 분석 계통 수 */
export const N = 412

export const ANALYSIS = {
  panel: 'YR 다양성 패널',
  lines: N,
  snps: M,
  mafMin: 0.05,
  callRateMin: 0.9,
  analyzedAt: '2026-10-20',
  reference: 'IRGSP-1.0 근사',
  baseDate: '2026-10-23',
} as const

/** 문헌의 온대 자포니카 LD 감소 거리 하한(kb, Mather 등 2007) — 집단 표 각주 */
export const LIT_TEJ_KB = 400
/** gwas-manhattan QTL 구간 반폭(kb) */
export const QTL_HALF_KB = 200

export type GroupKey = 'ALL' | 'TEJ' | 'TRJ' | 'IND' | 'AUS'

interface SimGroup {
  key: 'TEJ' | 'TRJ' | 'IND' | 'AUS' | 'ADM'
  label: string
  n: number
  lamKb: number
}

/** 생성용 집단(혼합형 포함). population-structure와 같은 계통 수 */
const SIM_GROUPS: SimGroup[] = [
  { key: 'TEJ', label: '온대 자포니카', n: 176, lamKb: 1000 },
  { key: 'TRJ', label: '열대 자포니카', n: 54, lamKb: 400 },
  { key: 'IND', label: '인디카', n: 112, lamKb: 230 },
  { key: 'AUS', label: '아우스', n: 30, lamKb: 250 },
  { key: 'ADM', label: '혼합형', n: 40, lamKb: 250 },
]
export const ADM_COUNT = SIM_GROUPS[4]!.n

/** 화면 집단(패널 전체 + 4개 하위 집단). 혼합형은 패널 전체에만 포함 */
export const GROUPS: { key: GroupKey; label: string; short: string; n: number }[] = [
  { key: 'ALL', label: '패널 전체', short: '전체', n: N },
  { key: 'TEJ', label: '온대 자포니카', short: '온대 자포니카', n: 176 },
  { key: 'TRJ', label: '열대 자포니카', short: '열대 자포니카', n: 54 },
  { key: 'IND', label: '인디카', short: '인디카', n: 112 },
  { key: 'AUS', label: '아우스', short: '아우스', n: 30 },
]
export const GROUP_INDEX: Record<GroupKey, number> = { ALL: 0, TEJ: 1, TRJ: 2, IND: 3, AUS: 4 }
/** 표본이 작아 배경 r²가 높은 집단(n 기준) */
export const SMALL_N = 30

const K = 10
const TREE_KB = 800
const EPS = 0.01
const ALPHA = 0.5
const XMIX = 0.08
const NMAJ = 3
const STAY = 0.6
const LEAD_KB = 50
const STAY_LEAD = 0.95
const W_OWN = [0.25, 0.5, 0.25, 0.5] as const
const ADM_TEJ = 0.55
export const MAF_MIN = 0.05
export const BLOCK_R2 = 0.5
export const BLOCK_MIN_SNP = 3
export const PROXY_R2 = 0.8
export const HALF_BP = 500_000
export const DECAY = { windowsPerChr: 6, winBp: 1_000_000, sdChr: 0.2, sdWin: 0.4, binKb: 10, maxKb: 1000 } as const
/** r² 감소 거리 기준 */
export const R2_CUT = 0.2
/** 쌍별 점 솎음 목표 수 */
const RAW_TARGET = 4000

/** 계통 → 생성 집단 인덱스(0~175 TEJ, 176~229 TRJ, 230~341 IND, 342~371 AUS, 372~411 ADM) */
const LINE_GROUP: number[] = []
SIM_GROUPS.forEach((g, gi) => {
  for (let i = 0; i < g.n; i++) LINE_GROUP.push(gi)
})
const NL = LINE_GROUP.length
const WORDS = Math.ceil(NL / 32) // 13

export const CHROMS = ORGANISMS.rice!.chromosomes

// ---------------------------------------------------------------------------
// 0) SNP 패널 — gwas-manhattan data.ts의 Planted·PLANTED·buildPanel() 복사(RNG 순서 동일)
// ---------------------------------------------------------------------------

export type TraitKey = 'dth' | 'cl' | 'tgw' | 'blast'
export const TRAIT_SHORT: Record<TraitKey, string> = { dth: '출수기', cl: '간장', tgw: '천립중', blast: '도열병' }

export interface Planted {
  id: string
  trait: TraitKey
  chr: string
  bp: number
  logP: number
  maf: number
  pve: number
  beta: number
  gene: string | null
  geneBp: number | null
}

/** gwas-manhattan 명세 「심을 피크」 표 — 값을 그대로 쓴다 */
export const PLANTED: Planted[] = [
  { id: 'H1', trait: 'dth', chr: 'Chr06', bp: 9_310_452, logP: 16.8, maf: 0.3, pve: 0.15, beta: 6.3, gene: 'Hd1', geneBp: 9_336_000 },
  { id: 'H2', trait: 'dth', chr: 'Chr07', bp: 9_182_307, logP: 12.4, maf: 0.22, pve: 0.113, beta: -6.1, gene: 'Ghd7', geneBp: 9_152_000 },
  { id: 'H3', trait: 'dth', chr: 'Chr08', bp: 4_358_916, logP: 8.9, maf: 0.14, pve: 0.082, beta: -6.2, gene: 'DTH8', geneBp: 4_333_000 },
  { id: 'H4', trait: 'dth', chr: 'Chr03', bp: 31_168_240, logP: 6.2, maf: 0.44, pve: 0.057, beta: 3.6, gene: 'Hd6', geneBp: 31_200_000 },
  { id: 'C1', trait: 'cl', chr: 'Chr01', bp: 38_401_775, logP: 22.5, maf: 0.35, pve: 0.193, beta: -10.1, gene: 'sd1', geneBp: 38_382_000 },
  { id: 'C2', trait: 'cl', chr: 'Chr06', bp: 9_291_038, logP: 7.6, maf: 0.3, pve: 0.07, beta: 6.4, gene: 'Hd1', geneBp: 9_336_000 },
  { id: 'C3', trait: 'cl', chr: 'Chr09', bp: 17_214_560, logP: 7.0, maf: 0.19, pve: 0.064, beta: -7.1, gene: null, geneBp: null },
  { id: 'G1', trait: 'tgw', chr: 'Chr03', bp: 16_702_118, logP: 18.3, maf: 0.27, pve: 0.162, beta: 1.9, gene: 'GS3', geneBp: 16_733_000 },
  { id: 'G2', trait: 'tgw', chr: 'Chr05', bp: 5_391_644, logP: 11.2, maf: 0.16, pve: 0.103, beta: -1.8, gene: 'GW5', geneBp: 5_365_000 },
  { id: 'G3', trait: 'tgw', chr: 'Chr02', bp: 8_088_930, logP: 6.4, maf: 0.08, pve: 0.059, beta: 1.9, gene: 'GW2', geneBp: 8_115_000 },
  { id: 'B1', trait: 'blast', chr: 'Chr12', bp: 10_617_402, logP: 14.6, maf: 0.21, pve: 0.132, beta: -1.8, gene: 'Pi-ta', geneBp: 10_606_000 },
  { id: 'B2', trait: 'blast', chr: 'Chr11', bp: 27_948_215, logP: 9.7, maf: 0.14, pve: 0.089, beta: -1.7, gene: 'Pik', geneBp: 27_980_000 },
  { id: 'B3', trait: 'blast', chr: 'Chr06', bp: 10_412_873, logP: 7.4, maf: 0.12, pve: 0.068, beta: -1.6, gene: 'Pi9', geneBp: 10_390_000 },
]

const round3 = (v: number) => Math.round(v * 1000) / 1000

export interface Snp {
  id: string
  chr: string
  chrNum: number
  bp: number
  posMb: number
  cumPos: number
  /** 패널 MAF(gwas-manhattan). LD 목업 유전형과 무관하므로 화면에 쓰지 않는다 */
  maf: number
  plantedId?: string
}

function buildPanel(): { snps: Snp[] } {
  const chrs = CHROMS
  const totalLen = chrs.reduce((s, c) => s + c.lengthMb, 0) // 373.0
  const GAP = totalLen * 0.01
  const rng = createRng(SEED)

  const n = chrs.map(c => Math.round((M * c.lengthMb) / totalLen))
  n[n.length - 1]! += M - n.reduce((s, v) => s + v, 0)

  const snps: Snp[] = []
  let offset = 0
  chrs.forEach((c, ci) => {
    const chrNum = ci + 1
    const planted = PLANTED.filter(p => p.chr === c.id)
    const plantedBp = new Set(planted.map(p => p.bp))
    const k = n[ci]! - planted.length
    const maxBp = c.lengthMb * 1e6
    const set = new Set<number>()
    while (set.size < k) {
      const need = k - set.size
      for (let i = 0; i < need; i++) {
        const bp = Math.round(rng.next() * maxBp)
        if (!plantedBp.has(bp)) set.add(bp)
      }
    }
    const positions = [...set].sort((a, b) => a - b)
    const list: Snp[] = []
    for (const bp of positions) {
      const maf = 0.05 + 0.45 * rng.beta(0.8, 1.6)
      list.push({ id: `S${chrNum}_${bp}`, chr: c.id, chrNum, bp, posMb: bp / 1e6, cumPos: offset + bp / 1e6, maf: round3(maf) })
    }
    for (const p of planted) {
      list.push({ id: `S${chrNum}_${p.bp}`, chr: c.id, chrNum, bp: p.bp, posMb: p.bp / 1e6, cumPos: offset + p.bp / 1e6, maf: p.maf, plantedId: p.id })
    }
    list.sort((a, b) => a.bp - b.bp)
    snps.push(...list)
    offset += c.lengthMb + GAP
  })
  return { snps }
}

let panelCache: Snp[] | null = null
/** 36,420 SNP 패널(처음 호출 때 한 번 만든다) */
export function getPanel(): Snp[] {
  if (!panelCache) panelCache = buildPanel().snps
  return panelCache
}

// ---------------------------------------------------------------------------
// 비트셋 보조
// ---------------------------------------------------------------------------

function popcnt32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  x = (x + (x >>> 4)) & 0x0f0f0f0f
  return Math.imul(x, 0x01010101) >>> 24
}
function countAnd(a: Uint32Array, m: Uint32Array): number {
  let c = 0
  for (let w = 0; w < WORDS; w++) c += popcnt32(a[w]! & m[w]!)
  return c
}
function countAnd3(a: Uint32Array, b: Uint32Array, m: Uint32Array): number {
  let c = 0
  for (let w = 0; w < WORDS; w++) c += popcnt32(a[w]! & b[w]! & m[w]!)
  return c
}

/** 화면 집단별 계통 마스크(ALL = 412계통 전체) */
const GROUP_MASKS: Uint32Array[] = GROUPS.map(g => {
  const m = new Uint32Array(WORDS)
  LINE_GROUP.forEach((gi, l) => {
    if (g.key === 'ALL' || SIM_GROUPS[gi]!.key === g.key) m[l >> 5]! |= 1 << (l & 31)
  })
  return m
})
const GROUP_N = GROUPS.map(g => g.n)

/** 참조 구현 maf()와 같은 산술 */
function mafOf(count: number, n: number): number {
  const p = count / n
  return Math.min(p, 1 - p)
}
/** 참조 구현 r2()와 같은 산술. 단형이면 null */
function r2Of(ca: number, cb: number, cab: number, n: number): number | null {
  const pa = ca / n
  const pb = cb / n
  const den = pa * (1 - pa) * pb * (1 - pb)
  if (den <= 0) return null
  const D = cab / n - pa * pb
  return (D * D) / den
}

// ---------------------------------------------------------------------------
// 2) 창 하나의 유전형 생성
// ---------------------------------------------------------------------------

function dirichlet(rng: Rng, H: number, a: number): number[] {
  const out: number[] = []
  let rest = 1
  for (let k = 0; k < H - 1; k++) {
    const b = rng.beta(a, (H - 1 - k) * a)
    out.push(rest * b)
    rest *= 1 - b
  }
  out.push(rest)
  return out
}
const mix = (a: number[], b: number[], w: number) => a.map((v, i) => w * v + (1 - w) * b[i]!)
function drawCat(rng: Rng, f: number[]): number {
  const u = rng.next()
  let c = 0
  for (let i = 0; i < f.length; i++) {
    c += f[i]!
    if (u < c) return i
  }
  return f.length - 1
}
function randomClades(rng: Rng): number[] {
  let nodes = Array.from({ length: K }, (_, k) => 1 << k)
  const clades = nodes.slice()
  while (nodes.length > 2) {
    const i = rng.int(0, nodes.length - 1)
    let j = rng.int(0, nodes.length - 2)
    if (j >= i) j++
    const m = nodes[i]! | nodes[j]!
    nodes = nodes.filter((_, x) => x !== i && x !== j)
    nodes.push(m)
    clades.push(m)
  }
  return clades
}

interface WindowGeno {
  snps: Snp[]
  /** SNP별 412계통 0/1 비트셋 */
  geno: Uint32Array[]
}

/** 리드 클레이드 선택 목표 빈도(생성용). 정리 회차 3에서 gwas-manhattan 표 MAF를 실현값으로 바꿨으므로
 *  클레이드 선택은 이전 표 값을 그대로 목표로 쓴다(바꾸면 G2·B2 창의 클레이드가 바뀜). */
export const CLADE_TARGET: Record<string, number> = { H1: 0.31, H2: 0.22, H3: 0.14, H4: 0.41, C1: 0.36, C2: 0.3, C3: 0.18, G1: 0.27, G2: 0.19, G3: 0.08, B1: 0.24, B2: 0.16, B3: 0.12 }
/** 하위 집단 편향 리드: 소수 대립유전자 보유 빈도 IND ≥ IND_RATIO × TEJ, TEJ ≥ TEJ_MIN */
export const LEAD_BIAS: Record<string, 'IND'> = { G1: 'IND' }
export const IND_RATIO = 3
export const TEJ_MIN = 0.02
function pickLeadMask(clist: number[], freqOf: (m: number) => number, state: Int8Array, lead: { bp: number; maf: number; id?: string }): number {
  const target = lead.id ? CLADE_TARGET[lead.id]! : lead.maf
  const bias = lead.id ? LEAD_BIAS[lead.id] : undefined
  let cands = clist
  if (bias === 'IND') {
    const u: number[] = clist.slice()
    for (let i = 0; i < clist.length; i++) for (let j = i + 1; j < clist.length; j++) if ((clist[i]! & clist[j]!) === 0) u.push(clist[i]! | clist[j]!)
    const grpFreq = (m: number, gi: number) => {
      let c = 0, n = 0
      for (let l = 0; l < NL; l++) if (LINE_GROUP[l] === gi) { n++; if (m & (1 << state[l]!)) c++ }
      return c / n
    }
    const ok = u.filter(m => {
      const q = freqOf(m)
      const minor = q < 0.5 ? m : ((1 << K) - 1) & ~m
      const tej = grpFreq(minor, 0), ind = grpFreq(minor, 2)
      return ind >= IND_RATIO * tej && tej >= TEJ_MIN
    })
    if (ok.length) cands = ok
  }
  let bd = 9, best = cands[0]!
  for (const m of cands) {
    const q = freqOf(m)
    const d = Math.abs(Math.min(q, 1 - q) - target)
    if (d < bd) { bd = d; best = m }
  }
  return best
}
function simulateWindow(chr: string, startBp: number, endBp: number, seed: number, rate: number, lead: { bp: number; maf: number; id?: string } | null): WindowGeno {
  const snps = getPanel().filter(s => s.chr === chr && s.bp >= startBp && s.bp <= endBp)
  const rng = createRng(seed)
  const half = K / 2
  const sub = (lo: number) => {
    const d = dirichlet(rng, half, ALPHA)
    const v = new Array<number>(K).fill(0)
    d.forEach((x, i) => (v[lo + i] = x))
    return v
  }
  const J = mix(sub(0), sub(half), 1 - XMIX)
  const I = mix(sub(half), sub(0), 1 - XMIX)
  const own = [sub(0), sub(0), sub(half), sub(half)]
  const f = [mix(own[0]!, J, W_OWN[0]), mix(own[1]!, J, W_OWN[1]), mix(own[2]!, I, W_OWN[2]), mix(own[3]!, I, W_OWN[3])]
  f.push(mix(f[0]!, f[2]!, ADM_TEJ))
  const state = new Int8Array(NL)
  for (let l = 0; l < NL; l++) state[l] = drawCat(rng, f[LINE_GROUP[l]!]!)
  const freqOf = (m: number) => {
    let c = 0
    for (let l = 0; l < NL; l++) if (m & (1 << state[l]!)) c++
    return c / NL
  }
  const eligible = () => {
    const cl = rng.shuffle(randomClades(rng))
    const e = cl.filter(m => {
      const q = freqOf(m)
      return q >= 0.08 && q <= 0.92
    })
    return e.length ? e : cl
  }
  const e0 = eligible()
  const major = Array.from({ length: NMAJ }, (_, i) => e0[i % e0.length]!)
  let cur = 0
  let zoneSet = false
  let leadMask = 0
  let prevBp = snps.length ? snps[0]!.bp : startBp
  const geno: Uint32Array[] = []
  for (const snp of snps) {
    const gap = (snp.bp - prevBp) / 1000
    prevBp = snp.bp
    if (gap > 0) {
      for (let l = 0; l < NL; l++) {
        const g = LINE_GROUP[l]!
        if (rng.next() < 1 - Math.exp((-gap * rate) / SIM_GROUPS[g]!.lamKb)) state[l] = drawCat(rng, f[g]!)
      }
      if (rng.next() < 1 - Math.exp((-gap * rate) / TREE_KB)) {
        const slot = rng.int(0, NMAJ - 1)
        const nm = eligible()[0]!
        if (!(zoneSet && major[slot] === leadMask && lead && Math.abs(snp.bp - lead.bp) <= LEAD_KB * 1000)) major[slot] = nm
      }
    }
    const inZone = !!lead && Math.abs(snp.bp - lead.bp) <= LEAD_KB * 1000
    if (inZone && !zoneSet) {
      zoneSet = true
      const clist = randomClades(rng)
      leadMask = pickLeadMask(clist, freqOf, state, lead!)
      cur = rng.int(0, NMAJ - 1)
      major[cur] = leadMask
    } else if (rng.next() >= (inZone ? STAY_LEAD : STAY)) cur = rng.int(0, NMAJ - 1)
    const mask = lead && snp.bp === lead.bp ? leadMask : major[cur]!
    const g = new Uint32Array(WORDS)
    for (let l = 0; l < NL; l++) {
      let a = (mask >> state[l]!) & 1
      if (rng.next() < EPS) a ^= 1
      if (a) g[l >> 5]! |= 1 << (l & 31)
    }
    geno.push(g)
  }
  return { snps, geno }
}

// ---------------------------------------------------------------------------
// 3) 감소 곡선(12개 염색체 × 6창)
// ---------------------------------------------------------------------------

export interface Bin {
  /** 쌍 수 */
  n: number
  /** 평균 거리(kb) */
  d: number
  /** 평균 r² */
  r: number
}

export interface DecayFit {
  h: number
  a: number
  b: number
  sse: number
  r0: number
  d02: number | null
}

/** 구간 평균(쌍 수 가중 최소제곱) 적합: r² = b + a/(1 + d/h), b는 비연관 쌍 평균으로 고정 */
export function fitDecay(bins: Bin[], b: number): DecayFit {
  let best: Omit<DecayFit, 'r0' | 'd02'> | null = null
  for (let k = 0; k <= 400; k++) {
    const h = 5 * Math.pow(3000 / 5, k / 400)
    let sxx = 0
    let sxy = 0
    for (const B of bins) {
      if (!B.n) continue
      const x = 1 / (1 + B.d / h)
      sxx += B.n * x * x
      sxy += B.n * x * (B.r - b)
    }
    const a = sxy / sxx
    let sse = 0
    for (const B of bins) {
      if (!B.n) continue
      const e = B.r - (b + a / (1 + B.d / h))
      sse += B.n * e * e
    }
    if (!best || sse < best.sse) best = { h, a, b, sse }
  }
  const r0 = best!.a + best!.b
  const d02 = best!.b < R2_CUT && r0 > R2_CUT ? best!.h * (best!.a / (R2_CUT - best!.b) - 1) : null
  return { ...best!, r0, d02 }
}

/** 적합 곡선 값 */
export const fitValue = (f: DecayFit, dKb: number) => f.b + f.a / (1 + dKb / f.h)

export interface DecayGroup {
  key: GroupKey
  n: number
  pairs: number
  unlinked: number
  bg: number
  fit: DecayFit
  bins: Bin[]
  /** 0~10 kb 구간 평균 r² */
  near: number
  /** 염색체별(12) 구간과 적합(b = 통합 배경) */
  chrBins: Bin[][]
  chrFits: DecayFit[]
  /** 쌍별 점(생성 순서에서 ceil(N/4000)번째마다): [거리 kb, r², 염색체 인덱스] */
  raw: [number, number, number][]
}

export interface DecayResult {
  chrMult: number[]
  groups: DecayGroup[]
  minR2: number
  maxR2: number
}

const NB = DECAY.maxKb / DECAY.binKb

function computeDecay(): DecayResult {
  const wr = createRng(SEED + 500)
  const chrMult = CHROMS.map(() => Math.exp(wr.normal(0, DECAY.sdChr)))
  type Acc = { n: number; sd: number; sr: number }
  const newBins = (): Acc[] => Array.from({ length: NB }, () => ({ n: 0, sd: 0, sr: 0 }))
  const G = GROUPS.length
  const pooled = GROUPS.map(newBins)
  const perChr = CHROMS.map(() => GROUPS.map(newBins))

  interface Win {
    ci: number
    w: number
    snps: Snp[]
    geno: Uint32Array[]
    /** 집단별 SNP 대립유전자 수 */
    cnt: Int16Array[]
    ok: Uint8Array[]
  }
  const wins: Win[] = []
  CHROMS.forEach((c, ci) => {
    for (let w = 0; w < DECAY.windowsPerChr; w++) {
      const start = Math.round(wr.next() * (c.lengthMb * 1e6 - DECAY.winBp))
      const rate = chrMult[ci]! * Math.exp(wr.normal(0, DECAY.sdWin))
      const { snps, geno } = simulateWindow(c.id, start, start + DECAY.winBp, SEED + 1000 + ci * 10 + w, rate, null)
      const cnt = GROUP_MASKS.map(m => Int16Array.from(geno, g => countAnd(g, m)))
      const ok = cnt.map((cc, k) => Uint8Array.from(cc, x => (mafOf(x, GROUP_N[k]!) >= MAF_MIN ? 1 : 0)))
      wins.push({ ci, w, snps, geno, cnt, ok })
    }
  })

  // 쌍 수(솎음 간격용): 다형 SNP k개 → k(k−1)/2. MAF ≥ 0.05면 r²가 항상 정의된다
  const totalPairs = GROUPS.map((_, k) =>
    wins.reduce((s, W) => {
      let m = 0
      for (const v of W.ok[k]!) m += v
      return s + (m * (m - 1)) / 2
    }, 0),
  )
  const stride = totalPairs.map(t => Math.max(1, Math.ceil(t / RAW_TARGET)))
  const pairIdx = new Array<number>(G).fill(0)
  const raw: [number, number, number][][] = GROUPS.map(() => [])
  let minR2 = 1
  let maxR2 = 0

  for (const W of wins) {
    const { snps, geno } = W
    for (let k = 0; k < G; k++) {
      const m = GROUP_MASKS[k]!
      const n = GROUP_N[k]!
      const cnt = W.cnt[k]!
      const ok = W.ok[k]!
      for (let i = 0; i < snps.length; i++) {
        if (!ok[i]) continue
        for (let j = i + 1; j < snps.length; j++) {
          if (!ok[j]) continue
          const v = r2Of(cnt[i]!, cnt[j]!, countAnd3(geno[i]!, geno[j]!, m), n)
          if (v == null) continue
          if (v > maxR2) maxR2 = v
          if (v < minR2) minR2 = v
          const d = (snps[j]!.bp - snps[i]!.bp) / 1000
          const b = Math.min(NB - 1, Math.floor(d / DECAY.binKb))
          const P = pooled[k]![b]!
          P.n++
          P.sd += d
          P.sr += v
          const C = perChr[W.ci]![k]![b]!
          C.n++
          C.sd += d
          C.sr += v
          if (pairIdx[k]! % stride[k]! === 0) raw[k]!.push([d, v, W.ci])
          pairIdx[k]!++
        }
      }
    }
  }

  // 비연관 쌍: 창 (c, w) × 창 ((c+1) mod 12, w), 짝수 인덱스 SNP만
  const unl = GROUPS.map(() => [0, 0] as [number, number])
  for (const A of wins) {
    const B = wins.find(x => x.ci === (A.ci + 1) % CHROMS.length && x.w === A.w)!
    for (let k = 0; k < G; k++) {
      const m = GROUP_MASKS[k]!
      const n = GROUP_N[k]!
      for (let i = 0; i < A.snps.length; i += 2) {
        if (!A.ok[k]![i]) continue
        for (let j = 0; j < B.snps.length; j += 2) {
          if (!B.ok[k]![j]) continue
          const v = r2Of(A.cnt[k]![i]!, B.cnt[k]![j]!, countAnd3(A.geno[i]!, B.geno[j]!, m), n)
          if (v != null) {
            unl[k]![0] += v
            unl[k]![1]++
          }
        }
      }
    }
  }

  const fin = (bins: Acc[]): Bin[] => bins.map(B => ({ n: B.n, d: B.n ? B.sd / B.n : 0, r: B.n ? B.sr / B.n : 0 }))
  const groups: DecayGroup[] = GROUPS.map((g, k) => {
    const bg = unl[k]![0] / unl[k]![1]
    const bins = fin(pooled[k]!)
    const chrBins = CHROMS.map((_, ci) => fin(perChr[ci]![k]!))
    return {
      key: g.key,
      n: g.n,
      pairs: bins.reduce((s, b) => s + b.n, 0),
      unlinked: unl[k]![1],
      bg,
      fit: fitDecay(bins, bg),
      bins,
      near: bins[0]!.r,
      chrBins,
      chrFits: chrBins.map(b => fitDecay(b, bg)),
      raw: raw[k]!,
    }
  })
  return { chrMult, groups, minR2, maxR2 }
}

// ---------------------------------------------------------------------------
// 4) 히트맵 창(프리셋 12개)
// ---------------------------------------------------------------------------

export interface Preset {
  pi: number
  planted: Planted
  /** 같은 창 안의 다른 심은 리드(H1 창의 C2) */
  others: Planted[]
  /** 선택 상자 라벨 */
  label: string
  /** 표기용 이름(유전자 또는 위치) */
  name: string
  traits: string
}

const PRESET_PLANTED = PLANTED.filter(p => p.id !== 'C2')
export const PRESETS: Preset[] = PRESET_PLANTED.map((p, pi) => {
  const others = PLANTED.filter(o => o.id !== p.id && o.chr === p.chr && Math.abs(o.bp - p.bp) <= HALF_BP && !PRESET_PLANTED.includes(o))
  const name = p.gene ?? `${p.chr} ${(p.bp / 1e6).toFixed(2)} Mb`
  const traits = [p, ...others].map(x => TRAIT_SHORT[x.trait]).filter((t, i, a) => a.indexOf(t) === i)
  return { pi, planted: p, others, name, traits: traits.join('·'), label: `${name} (${traits.join('·')})` }
})

export interface Block {
  from: number
  to: number
  nSnp: number
}

export interface PresetWindow {
  pi: number
  lo: number
  hi: number
  snps: Snp[]
  geno: Uint32Array[]
  leadIdx: number
  /** others와 같은 순서의 SNP 인덱스 */
  otherIdx: number[]
}

export interface PresetView {
  pi: number
  group: GroupKey
  n: number
  /** 집단 안 MAF ≥ 0.05 */
  ok: boolean[]
  nPoly: number
  /** n×n r²(대각 1, 단형 쌍 −1) */
  R: Float64Array
  blocks: Block[]
  leadBlock: Block | null
  /** 리드가 집단 안 단형 */
  mono: boolean
  leadMaf: number
  /** r² ≥ 0.8 프록시(리드 제외), r² 내림차순 */
  proxies: { idx: number; r2: number }[]
  meanR2: number
  /** 가장 넓은 블록 */
  largest: Block | null
  /** 후보 유전자가 리드 블록 안 */
  geneIn: boolean | null
  /** 후보 유전자가 리드 블록 밖일 때 가까운 블록 끝까지 거리(kb) */
  geneOutKb: number | null
  /** 리드와 같은 창 다른 리드의 r² */
  otherR2: (number | null)[]
}

export const blockSpanKb = (w: { snps: Snp[] }, b: Block) => (w.snps[b.to]!.bp - w.snps[b.from]!.bp) / 1000

export function findBlocks(R: Float64Array, ok: boolean[]): Block[] {
  const n = ok.length
  const at = (i: number, j: number) => R[i * n + j]!
  const out: Block[] = []
  let i = 0
  while (i < n) {
    if (!ok[i]) {
      i++
      continue
    }
    let bestJ = i
    for (let j = i + 1; j < n; j++) {
      if (!ok[j]) continue
      let good = true
      for (let k = i + 1; k <= j && good; k++) if (ok[k] && at(i, k) < BLOCK_R2) good = false
      for (let k = i; k < j && good; k++) if (ok[k] && at(k, j) < BLOCK_R2) good = false
      if (good) bestJ = j
    }
    let cnt = 0
    for (let k = i; k <= bestJ; k++) if (ok[k]) cnt++
    if (cnt >= BLOCK_MIN_SNP) {
      out.push({ from: i, to: bestJ, nSnp: cnt })
      i = bestJ + 1
    } else i++
  }
  return out
}

function buildPresetWindow(p: Preset, chrMult: number[]): PresetWindow {
  const pl = p.planted
  const ci = Number(pl.chr.slice(3)) - 1
  const len = CHROMS[ci]!.lengthMb * 1e6
  const lo = Math.max(0, pl.bp - HALF_BP)
  const hi = Math.min(Math.round(len), pl.bp + HALF_BP)
  const { snps, geno } = simulateWindow(pl.chr, lo, hi, SEED + 2000 + p.pi, chrMult[ci]!, { bp: pl.bp, maf: pl.maf, id: pl.id })
  return {
    pi: p.pi,
    lo,
    hi,
    snps,
    geno,
    leadIdx: snps.findIndex(s => s.bp === pl.bp),
    otherIdx: p.others.map(o => snps.findIndex(s => s.bp === o.bp)),
  }
}

function analyzePreset(win: PresetWindow, gk: GroupKey): PresetView {
  const k = GROUP_INDEX[gk]
  const m = GROUP_MASKS[k]!
  const nL = GROUP_N[k]!
  const { snps, geno, leadIdx: li } = win
  const n = snps.length
  const cnt = geno.map(g => countAnd(g, m))
  const ok = cnt.map(c => mafOf(c, nL) >= MAF_MIN)
  const R = new Float64Array(n * n).fill(-1)
  let sr = 0
  let nr = 0
  for (let i = 0; i < n; i++) {
    R[i * n + i] = 1
    for (let j = i + 1; j < n; j++) {
      if (!ok[i] || !ok[j]) continue
      const v = r2Of(cnt[i]!, cnt[j]!, countAnd3(geno[i]!, geno[j]!, m), nL) ?? 0
      R[i * n + j] = v
      R[j * n + i] = v
      sr += v
      nr++
    }
  }
  const blocks = findBlocks(R, ok)
  const mono = !ok[li]
  const leadBlock = mono ? null : (blocks.find(b => li >= b.from && li <= b.to) ?? null)
  const proxies = mono
    ? []
    : snps
        .map((_, j) => ({ idx: j, r2: R[li * n + j]! }))
        .filter(x => x.idx !== li && ok[x.idx] && x.r2 >= PROXY_R2)
        .sort((a, b) => b.r2 - a.r2)
  let largest: Block | null = null
  for (const b of blocks) if (!largest || blockSpanKb(win, b) > blockSpanKb(win, largest)) largest = b
  const geneBp = PRESETS[win.pi]!.planted.geneBp
  let geneIn: boolean | null = null
  let geneOutKb: number | null = null
  if (leadBlock && geneBp != null) {
    const a = snps[leadBlock.from]!.bp
    const z = snps[leadBlock.to]!.bp
    geneIn = geneBp >= a && geneBp <= z
    if (!geneIn) geneOutKb = Math.min(Math.abs(geneBp - a), Math.abs(geneBp - z)) / 1000
  }
  return {
    pi: win.pi,
    group: gk,
    n,
    ok,
    nPoly: ok.filter(Boolean).length,
    R,
    blocks,
    leadBlock,
    mono,
    leadMaf: mafOf(cnt[li]!, nL),
    proxies,
    meanR2: nr ? sr / nr : 0,
    largest,
    geneIn,
    geneOutKb,
    otherR2: win.otherIdx.map(j => (mono || j < 0 || !ok[j] ? null : R[li * n + j]!)),
  }
}

// ---------------------------------------------------------------------------
// 전체 계산(마운트 1회)
// ---------------------------------------------------------------------------

export interface LdData {
  decay: DecayResult
  windows: PresetWindow[]
  /** [pi][groupIndex] */
  views: PresetView[][]
  ms: number
}

export function computeAll(): LdData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0
  const decay = computeDecay()
  const windows = PRESETS.map(p => buildPresetWindow(p, decay.chrMult))
  const views = windows.map(w => GROUPS.map(g => analyzePreset(w, g.key)))
  const out: LdData = { decay, windows, views, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 }
  if (import.meta.env.DEV) devCheck(out)
  return out
}

// ---------------------------------------------------------------------------
// 표시 보조
// ---------------------------------------------------------------------------

/** d₀.₂ 표시값(kb, 정수) */
export const kb0 = (v: number | null) => (v == null ? '—' : String(Math.round(v)))
export const windowLabel = (w: PresetWindow) => `${PRESETS[w.pi]!.planted.chr} ${(w.lo / 1e6).toFixed(2)}~${(w.hi / 1e6).toFixed(2)} Mb`
/** 배경 r² ÷ (1/n) */
export const bgFold = (g: DecayGroup) => g.bg * g.n

// ---------------------------------------------------------------------------
// DEV 검산 — 명세 「수용 기준」·「검산 기록」 값
// ---------------------------------------------------------------------------

const EXPECT = {
  d02: { ALL: 151, TEJ: 411, TRJ: 175, IND: 100, AUS: 118 } as Record<GroupKey, number>,
  h: { ALL: 59.6, TEJ: 176.9, TRJ: 53.3, IND: 27.7, AUS: 29.0 } as Record<GroupKey, number>,
  bg: { ALL: 0.016, TEJ: 0.006, TRJ: 0.02, IND: 0.009, AUS: 0.033 } as Record<GroupKey, number>,
  near: { ALL: 0.639, TEJ: 0.695, TRJ: 0.7, IND: 0.707, AUS: 0.71 } as Record<GroupKey, number>,
  pairs: { ALL: 332888, TEJ: 223378, TRJ: 214120, IND: 196395, AUS: 191196 } as Record<GroupKey, number>,
  chr06: { ALL: 127, TEJ: 245, TRJ: 122, IND: 80, AUS: 85 } as Record<GroupKey, number>,
}

function devCheck(d: LdData) {
  const A = (cond: boolean, msg: string) => console.assert(cond, `[검산] ld-decay: ${msg}`)
  A(getPanel().length === M, `패널 SNP 수 ${getPanel().length} ≠ ${M}`)
  A(d.decay.chrMult[0]!.toFixed(4) === '0.9505', `chrMult[0] ${d.decay.chrMult[0]!.toFixed(4)} ≠ 0.9505`)
  for (const g of d.decay.groups) {
    A(Math.round(g.fit.d02 ?? -1) === EXPECT.d02[g.key], `${g.key} d₀.₂ ${g.fit.d02} ≠ ${EXPECT.d02[g.key]}`)
    A(Number(g.fit.h.toFixed(1)) === EXPECT.h[g.key], `${g.key} 반감 거리 ${g.fit.h.toFixed(1)} ≠ ${EXPECT.h[g.key]}`)
    A(Number(g.bg.toFixed(3)) === EXPECT.bg[g.key], `${g.key} 배경 r² ${g.bg.toFixed(3)} ≠ ${EXPECT.bg[g.key]}`)
    A(Number(g.near.toFixed(3)) === EXPECT.near[g.key], `${g.key} 근거리 r² ${g.near.toFixed(3)} ≠ ${EXPECT.near[g.key]}`)
    A(g.pairs === EXPECT.pairs[g.key], `${g.key} 쌍 수 ${g.pairs} ≠ ${EXPECT.pairs[g.key]}`)
    A(Math.round(g.chrFits[5]!.d02 ?? -1) === EXPECT.chr06[g.key], `${g.key} Chr06 d₀.₂ ${g.chrFits[5]!.d02} ≠ ${EXPECT.chr06[g.key]}`)
  }
  const gs = d.decay.groups
  for (let ci = 0; ci < CHROMS.length; ci++) {
    const tej = gs[1]!.chrFits[ci]!.d02 ?? 0
    A(gs.every((g, k) => k === 1 || (g.chrFits[ci]!.d02 ?? 0) < tej), `${CHROMS[ci]!.id}에서 온대 자포니카 d₀.₂가 최대가 아님`)
  }
  const ratio = (gs[1]!.fit.d02 ?? 0) / (gs[3]!.fit.d02 ?? 1)
  A(ratio.toFixed(1) === '4.1', `집단 간 배율 ${ratio.toFixed(3)} ≠ 4.1`)
  A(bgFold(gs[0]!).toFixed(1) === '6.5', `배경/(1/n) ${bgFold(gs[0]!).toFixed(2)} ≠ 6.5`)

  const w0 = d.windows[0]!
  const v0 = d.views[0]![0]!
  A(w0.snps.length === 108 && w0.leadIdx === 41 && w0.otherIdx[0] === 37, `Hd1 창 SNP ${w0.snps.length}/리드 ${w0.leadIdx}/C2 ${w0.otherIdx[0]} ≠ 108/41/37`)
  A(v0.blocks.length === 17, `Hd1 블록 ${v0.blocks.length} ≠ 17`)
  A(!!v0.leadBlock && w0.snps[v0.leadBlock.from]!.id === 'S6_9286115' && w0.snps[v0.leadBlock.to]!.id === 'S6_9325658' && v0.leadBlock.nSnp === 8, 'Hd1 리드 블록 ≠ S6_9286115~S6_9325658, 8 SNP')
  A(v0.proxies.length === 7, `Hd1 프록시 ${v0.proxies.length} ≠ 7`)
  A(v0.largest != null && blockSpanKb(w0, v0.largest).toFixed(1) === '82.6', 'Hd1 최대 블록 ≠ 82.6 kb')
  A(v0.otherR2[0] != null && v0.otherR2[0].toFixed(2) === '0.87', `r²(H1, C2) ${v0.otherR2[0]} ≠ 0.87`)
  A(v0.geneOutKb != null && v0.geneOutKb.toFixed(1) === '10.3', `Hd1–리드 블록 끝 ${v0.geneOutKb} ≠ 10.3 kb`)
  const sd1 = d.views[4]![0]!
  A(d.windows[4]!.snps.length === 94 && sd1.blocks.length === 13 && !!sd1.leadBlock && blockSpanKb(d.windows[4]!, sd1.leadBlock).toFixed(1) === '99.2' && sd1.leadBlock.nSnp === 8 && sd1.geneIn === true, 'sd1 창 ≠ 94 SNP·블록 13·99.2 kb/8·유전자 블록 안')
  const pi9 = d.views[11]![1]!
  A(pi9.mono && pi9.nPoly === 16 && d.windows[11]!.snps.length === 107 && pi9.leadMaf.toFixed(3) === '0.011', `Pi9 × 온대 자포니카 다형 ${pi9.nPoly}/${d.windows[11]!.snps.length}, MAF ${pi9.leadMaf.toFixed(3)} ≠ 16/107 단형 0.011`)
  const expBlocks = [17, 15, 13, 14, 13, 15, 15, 16, 15, 14, 15, 16]
  const expProx = [7, 4, 1, 8, 2, 1, 2, 1, 1, 4, 2, 0]
  d.views.forEach((vs, pi) => {
    A(vs[0]!.blocks.length === expBlocks[pi], `프리셋 ${pi} 블록 ${vs[0]!.blocks.length} ≠ ${expBlocks[pi]}`)
    A(vs[0]!.proxies.length === expProx[pi], `프리셋 ${pi} 프록시 ${vs[0]!.proxies.length} ≠ ${expProx[pi]}`)
  })
  A(d.views[8]![0]!.leadBlock == null, 'GW2 리드가 블록 밖이 아님')
  // 정리 회차 3: GS3 표적(소수) 대립유전자가 인디카 우세·온대 자포니카 소수, 리드 실현 빈도 = gwas 표 MAF
  const gs3w = d.windows[6]!
  const gs3 = d.views[6]!
  A(gs3[0]!.leadMaf.toFixed(5) === '0.26699' && gs3[1]!.leadMaf.toFixed(5) === '0.12500' && gs3[3]!.leadMaf.toFixed(5) === '0.47321', `GS3 리드 MAF 전체/TEJ/IND ${gs3[0]!.leadMaf}/${gs3[1]!.leadMaf}/${gs3[3]!.leadMaf} ≠ 0.26699/0.12500/0.47321`)
  A(!!gs3[0]!.leadBlock && blockSpanKb(gs3w, gs3[0]!.leadBlock).toFixed(1) === '36.0' && gs3[0]!.leadBlock.nSnp === 4, 'GS3 리드 블록 ≠ 36.0 kb · 4 SNP')
  d.views.forEach((vs, pi) => {
    const v = vs[0]!
    const pm = PRESETS[pi]!.planted.maf
    A(Math.abs(v.leadMaf - pm) <= 0.005, `프리셋 ${pi} 리드 실현 MAF ${v.leadMaf.toFixed(5)} ≠ 표 MAF ${pm}(±0.005)`)
  })
}
