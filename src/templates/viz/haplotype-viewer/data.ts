/**
 * 마커·하플로타입 뷰어 목업 데이터.
 * 명세: docs/specs/haplotype-viewer.md (시드 20261023)
 * 참조 구현: 분석가 검산 스크립트 hapref.mjs(저장소 밖 — 명세 docs/specs/haplotype-viewer.md 「검산 기록」) — RNG 소비 순서를 그대로 옮겼다.
 *
 * 2026-10-27 정리 회차 3: PLANTED MAF·β를 gwas-manhattan 새 표로, 리드 클레이드 목표 CLADE_TARGET 분리, GS3 창 LEAD_BIAS(ld-decay 복사).
 *
 * 다른 템플릿을 import하지 않는다. 아래 세 부분은 원본 data.ts에서 "복사"했다(명세 「0) 복사할 코드」).
 *  - A. ld-decay: SNP 패널·창 시뮬레이션·r² 스파인 블록(감소 곡선 계산은 뺐다)
 *  - B. population-structure: 412계통 ID·소속(PC 추첨과 PCA는 뺐다 — 그 뒤 RNG를 쓰지 않아 ID·소속이 같다)
 *  - C. cross-planner: 부모 후보 60계통(관계 계수 부분은 뺐다)
 *
 * 실제 데이터로 바꿀 때는 `computeAll()`이 돌려주는 `HapData`(좌위별 창 유전형·결측·하플로타입 배정,
 * 패널·육종 계통 목록)만 같은 모양으로 채우면 화면은 그대로 동작한다.
 */
import { createRng, type Rng } from '@/lib/rng'
import { ORGANISMS, lineName } from '@/lib/genomics'

// ===========================================================================
// 상수·분석 조건(program-baseline「GWAS 패널」)
// ===========================================================================

export const SEED = 20261023
/** 분석 SNP 수(QC 후) */
export const M = 36420
/** 다양성 패널 계통 수 */
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
  chipSnps: 4820,
  gbsBatch: 'GBS-2611-01',
  gbsDate: '11/06',
} as const

export type Subpop = 'TEJ' | 'TRJ' | 'IND' | 'AUS' | 'ADM'
export const GORDER: Subpop[] = ['TEJ', 'TRJ', 'IND', 'AUS', 'ADM']
export const SUBPOP_LABEL: Record<Subpop, string> = {
  TEJ: '온대 자포니카',
  TRJ: '열대 자포니카',
  IND: '인디카',
  AUS: '아우스',
  ADM: '혼합형',
}

// ===========================================================================
// A. ld-decay data.ts 복사 — SNP 패널, 창 시뮬레이션, 블록
// ===========================================================================

interface SimGroup {
  key: Subpop
  n: number
  lamKb: number
}
const SIM_GROUPS: SimGroup[] = [
  { key: 'TEJ', n: 176, lamKb: 1000 },
  { key: 'TRJ', n: 54, lamKb: 400 },
  { key: 'IND', n: 112, lamKb: 230 },
  { key: 'AUS', n: 30, lamKb: 250 },
  { key: 'ADM', n: 40, lamKb: 250 },
]
export const SUBPOP_N: Record<Subpop, number> = Object.fromEntries(SIM_GROUPS.map(g => [g.key, g.n])) as Record<Subpop, number>
/** ld 인덱스 범위(생성 집단) */
export const RANGES: Record<Subpop, [number, number]> = { TEJ: [0, 176], TRJ: [176, 230], IND: [230, 342], AUS: [342, 372], ADM: [372, 412] }

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
export const HALF_BP = 500_000

const LINE_GROUP: number[] = []
SIM_GROUPS.forEach((g, gi) => {
  for (let i = 0; i < g.n; i++) LINE_GROUP.push(gi)
})
const NL = LINE_GROUP.length
const WORDS = Math.ceil(NL / 32) // 13

export const CHROMS = ORGANISMS.rice!.chromosomes

export type TraitKey = 'dth' | 'cl' | 'tgw' | 'blast'
export const TRAIT_SHORT: Record<TraitKey, string> = { dth: '출수기', cl: '간장', tgw: '천립중', blast: '도열병' }
export const TRAIT_UNIT: Record<TraitKey, string> = { dth: '일', cl: 'cm', tgw: 'g', blast: '점' }
/** 효과 카드 형질 표기(단위 포함) */
export const TRAIT_FULL: Record<TraitKey, string> = { dth: '출수기(일)', cl: '간장(cm)', tgw: '천립중(g)', blast: '도열병 병반 점수(점)' }

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

/** gwas-manhattan 명세 「심을 피크」 표 — 값을 그대로 쓴다(ld-decay와 같다). 정리 회차 3: MAF 실현값화·β 재계산 7행 */
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
const PLANTED_BY_ID = new Map(PLANTED.map(p => [p.id, p]))

const round3 = (v: number) => Math.round(v * 1000) / 1000

export interface Snp {
  id: string
  chr: string
  chrNum: number
  bp: number
  posMb: number
  cumPos: number
  /** 패널 MAF(gwas-manhattan). gwas 표 MAF = 리드 실현 빈도(±0.005), 화면 미표시 */
  maf: number
  plantedId?: string
}

function buildPanel(): Snp[] {
  const chrs = CHROMS
  const totalLen = chrs.reduce((s, c) => s + c.lengthMb, 0)
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
  return snps
}

let panelCache: Snp[] | null = null
function getPanel(): Snp[] {
  if (!panelCache) panelCache = buildPanel()
  return panelCache
}

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
/** 패널 전체(412계통) 마스크 */
const MASK_ALL: Uint32Array = (() => {
  const m = new Uint32Array(WORDS)
  for (let l = 0; l < NL; l++) m[l >> 5]! |= 1 << (l & 31)
  return m
})()

function mafOf(count: number, n: number): number {
  const p = count / n
  return Math.min(p, 1 - p)
}
function r2Of(ca: number, cb: number, cab: number, n: number): number | null {
  const pa = ca / n
  const pb = cb / n
  const den = pa * (1 - pa) * pb * (1 - pb)
  if (den <= 0) return null
  const D = cab / n - pa * pb
  return (D * D) / den
}

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

/** 리드 클레이드 선택 목표 빈도(생성용). 정리 회차 3에서 gwas-manhattan 표 MAF를 실현값으로 바꿨으므로
 *  클레이드 선택은 이전 표 값을 그대로 목표로 쓴다(바꾸면 G2·B2 창의 클레이드가 바뀜). (ld-decay 복사) */
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
function simulateWindow(chr: string, startBp: number, endBp: number, seed: number, rate: number, lead: { bp: number; maf: number; id?: string } | null): { snps: Snp[]; geno: Uint32Array[] } {
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

export interface Block {
  from: number
  to: number
  nSnp: number
}

function findBlocks(R: Float64Array, ok: boolean[]): Block[] {
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

// ===========================================================================
// B. population-structure data.ts 복사 — 412계통 ID·K = 4 소속
// ===========================================================================

type Origin = 'YR' | 'YRG'
export interface PanelLine {
  id: string
  name: string | null
  origin: Origin
  group: Subpop
  dom: number
  maxQ: number
  anchor: boolean
}

const Q_ASSIGN = 0.7
const MAIN_SPREAD = 0.3
const MAIN_SPREAD_YR_IND = 0.5
const AFF_YR_IND_TEJ = 6
const PURE: Subpop[] = ['TEJ', 'TRJ', 'IND', 'AUS']
const AFF = (g: number, j: number, origin: Origin) =>
  g === 2 && origin === 'YR' ? (j === 0 ? AFF_YR_IND_TEJ : 1) : (g < 2) === (j < 2) ? 3 : 1
const RESERVED = [
  'YR07-0231', 'YR13-0819', 'YR14-0472', 'YR19-0083', 'YR20-1108', 'YR19-0731',
  'YR22-0412', 'YR22-0415', 'YR21-0877', 'YR23-0136', 'YR22-0263', 'YR21-0594',
]
function toMilli(q: number[]): number[] {
  const m = q.map(x => Math.round(x * 1000))
  const d = 1000 - m.reduce((a, b) => a + b, 0)
  let im = 0
  m.forEach((x, i) => {
    if (x > m[im]!) im = i
  })
  m[im] = m[im]! + d
  return m
}
const pad = (v: number, n: number) => String(v).padStart(n, '0')

function generatePanelLines(): PanelLine[] {
  const rng = createRng(SEED)
  type Spec = { g: number | 'ADM'; origin: Origin; pair?: [number, number] }
  const spec: Spec[] = []
  const push = (n: number, g: number | 'ADM', origin: Origin, pair?: [number, number]) => {
    for (let i = 0; i < n; i++) spec.push({ g, origin, pair })
  }
  push(116, 0, 'YR'); push(56, 0, 'YRG'); push(54, 1, 'YRG'); push(38, 2, 'YR'); push(74, 2, 'YRG'); push(30, 3, 'YRG')
  push(14, 'ADM', 'YR', [0, 2]); push(4, 'ADM', 'YR', [0, 1])
  push(4, 'ADM', 'YRG', [0, 2]); push(6, 'ADM', 'YRG', [0, 1]); push(6, 'ADM', 'YRG', [2, 3]); push(4, 'ADM', 'YRG', [1, 2])

  type Draft = { id: string; name: string | null; origin: Origin; q4m: number[]; anchor: boolean }
  const drafts: Draft[] = spec.map(sp => {
    const q = [0, 0, 0, 0]
    if (sp.g !== 'ADM') {
      const g = sp.g
      const main = 1 - (g === 2 && sp.origin === 'YR' ? MAIN_SPREAD_YR_IND : MAIN_SPREAD) * rng.beta(1, 6)
      const others = [0, 1, 2, 3].filter(j => j !== g)
      const w = others.map(j => -Math.log(1 - rng.next()) * AFF(g, j, sp.origin))
      const sw = w.reduce((a, b) => a + b, 0)
      q[g] = main
      others.forEach((j, k) => (q[j] = ((1 - main) * w[k]!) / sw))
    } else {
      const [g1, g2] = sp.pair!
      const q1 = 0.4 + 0.28 * rng.next()
      const q2 = (1 - q1) * (0.8 + 0.15 * rng.next())
      const r = 1 - q1 - q2
      const others = [0, 1, 2, 3].filter(j => j !== g1 && j !== g2)
      const w = others.map(() => -Math.log(1 - rng.next()))
      const sw = w[0]! + w[1]!
      q[g1] = q1
      q[g2] = q2
      others.forEach((j, k) => (q[j] = (r * w[k]!) / sw))
    }
    // s, t(K = 5·6 분할) 추첨 — 값은 쓰지 않지만 RNG 순서를 지키려고 그대로 소비한다
    rng.beta(1, 4)
    rng.beta(1, 4)
    return { id: '', name: null, origin: sp.origin, q4m: toMilli(q), anchor: false }
  })

  const used = new Set(RESERVED)
  for (const d of drafts) {
    if (d.origin !== 'YR') continue
    let id: string
    do {
      id = `YR${pad(rng.int(5, 18), 2)}-${pad(rng.int(1, 1999), 4)}`
    } while (used.has(id))
    used.add(id)
    d.id = id
  }
  const yrg = drafts.filter(d => d.origin === 'YRG')
  const perm = rng.shuffle(yrg.map((_, i) => i + 1))
  yrg.forEach((d, i) => (d.id = `YRG-${pad(perm[i]!, 4)}`))

  const anchors: [string, string | null, number[]][] = [
    ['YR07-0231', '가람솔', [970, 20, 10, 0]],
    ['YR13-0819', '온새미로', [910, 30, 60, 0]],
    ['YR14-0472', '늘솔찬', [790, 30, 180, 0]],
    ['YR19-0083', '별하랑', [880, 25, 95, 0]],
    ['YR20-1108', null, [610, 30, 360, 0]],
    ['YR19-0731', null, [560, 0, 410, 30]],
  ]
  for (const [id, name, q4m] of anchors) drafts.push({ id, name, origin: 'YR', q4m, anchor: true })

  return drafts.map(d => {
    const mx = Math.max(...d.q4m)
    const dom = d.q4m.indexOf(mx)
    return { id: d.id, name: d.name, origin: d.origin, group: mx >= Q_ASSIGN * 1000 ? PURE[dom]! : 'ADM', dom, maxQ: mx / 1000, anchor: d.anchor }
  })
}

function compareDefault(a: PanelLine, b: PanelLine): number {
  const ga = GORDER.indexOf(a.group)
  const gb = GORDER.indexOf(b.group)
  if (ga !== gb) return ga - gb
  if (a.group === 'ADM' && a.dom !== b.dom) return a.dom - b.dom
  if (a.maxQ !== b.maxQ) return b.maxQ - a.maxQ
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// ===========================================================================
// C. cross-planner data.ts 복사 — 부모 후보 60계통
// ===========================================================================

export type ParentGroup = 'A' | 'B' | 'C'
export const PARENT_GROUP_LABEL: Record<ParentGroup, string> = { A: 'A 중만생 다수성', B: 'B 조생 고품질', C: 'C 저항성 공여' }

interface CandSeed {
  name: string
  group: ParentGroup
  family: string
  gebv: number
  rel: number
  heading: number
  culm: number
  pi: string
}
const ANCHORS: CandSeed[] = [
  { name: 'YR22-0412', group: 'A', family: 'F01', gebv: 52.4, rel: 0.58, heading: 118, culm: 84, pi: 'Pi-ta' },
  { name: 'YR22-0415', group: 'A', family: 'F01', gebv: 49.8, rel: 0.55, heading: 116, culm: 86, pi: 'Pi-ta' },
  { name: 'YR21-0877', group: 'A', family: 'F05', gebv: 47.1, rel: 0.61, heading: 120, culm: 81, pi: '없음' },
  { name: 'YR23-0136', group: 'A', family: 'F09', gebv: 45.6, rel: 0.49, heading: 119, culm: 88, pi: 'Pib' },
  { name: 'YR22-0263', group: 'B', family: 'F12', gebv: 38.9, rel: 0.52, heading: 111, culm: 76, pi: '없음' },
  { name: 'YR21-0594', group: 'B', family: 'F12', gebv: 36.2, rel: 0.57, heading: 107, culm: 79, pi: 'Pib' },
  { name: 'YR20-1108', group: 'C', family: 'F18', gebv: 12.7, rel: 0.44, heading: 124, culm: 95, pi: 'Pi9' },
  { name: 'YR19-0731', group: 'C', family: 'F19', gebv: 8.3, rel: 0.41, heading: 112, culm: 92, pi: 'Pigm' },
]
const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100 || 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FAMILIES = Array.from({ length: 27 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`)
const familyGroup = (i: number): ParentGroup => (i < 10 ? 'A' : i < 17 ? 'B' : 'C')
const GEN_COUNT: Record<string, number> = {
  F01: 1, F05: 2, F09: 2,
  F11: 3, F12: 1, F13: 3, F14: 3, F15: 3, F16: 3, F17: 2,
  F18: 0, F19: 0,
}
const genCount = (fam: string, g: ParentGroup) => GEN_COUNT[fam] ?? (g === 'A' ? 3 : g === 'C' ? 1 : 0)
interface GroupRule {
  mean: number
  gebv: [number, number]
  heading: [number, number, number, number]
  culm: [number, number, number, number]
  pi: [string, number][]
}
const GROUP_RULE: Record<ParentGroup, GroupRule> = {
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
function buildCandidates(): CandSeed[] {
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
  const generated: CandSeed[] = []
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
  return [...ANCHORS, ...generated]
}

// ===========================================================================
// D. 하플로타입 분석(명세 1)~6))
// ===========================================================================

export type LocusKey = 'sd1' | 'Hd1' | 'GS3' | 'Pi-ta' | 'Pi9'
export type LocusKind = 'fav' | 'dir'

export interface LocusDef {
  key: LocusKey
  /** ld-decay PRESETS 인덱스(창 시드 SEED + 2000 + pi) */
  pi: number
  kind: LocusKind
  planted: string
  others: string[]
  /** 선택 상자 형질 표기 */
  traits: string
  /** 표적 대립유전자 이름: 유리형 '유리', 방향 선택형 '출수 지연형' 등 */
  effectName: string
  /** 요약 표 짧은 표기(방향 선택형) */
  effectShort: string
  /** 유리형: 목표 방향 설명 */
  goal: string
}

export const LOCI: LocusDef[] = [
  { key: 'sd1', pi: 4, kind: 'fav', planted: 'C1', others: [], traits: '간장', effectName: '반왜성', effectShort: '반왜성', goal: '간장 감소' },
  { key: 'Hd1', pi: 0, kind: 'dir', planted: 'H1', others: ['C2'], traits: '출수기·간장', effectName: '출수 지연형', effectShort: '지연형', goal: '' },
  { key: 'GS3', pi: 6, kind: 'dir', planted: 'G1', others: [], traits: '천립중', effectName: '천립중 증가형', effectShort: '증가형', goal: '' },
  { key: 'Pi-ta', pi: 9, kind: 'fav', planted: 'B1', others: [], traits: '도열병', effectName: '도열병 저항성', effectShort: '저항성', goal: '병반 점수 감소' },
  { key: 'Pi9', pi: 11, kind: 'fav', planted: 'B3', others: [], traits: '도열병', effectName: '도열병 저항성', effectShort: '저항성', goal: '병반 점수 감소' },
]
export const FAV_LOCI = LOCI.filter(l => l.kind === 'fav').map(l => l.key)
/** 이름 있는 하플로타입: 블록 완전 호출 계통 수 하한 */
export const NAMED_MIN = 5
export const RARE = '희귀'
export const UNDET = '미정'

const ANCH = { garam: 'YR07-0231', onsae: 'YR13-0819', neul: 'YR14-0472', byeol: 'YR19-0083', pi9: 'YR20-1108', pigm: 'YR19-0731' } as const
const ANCHOR_IDS = new Set<string>(Object.values(ANCH))
const SWAP_ORDER = [ANCH.garam, ANCH.neul, ANCH.byeol, ANCH.pi9, ANCH.pigm]
const COND: Record<LocusKey, Record<string, string>> = {
  sd1: { [ANCH.garam]: 'carry', [ANCH.neul]: 'carry', [ANCH.byeol]: `hap:${ANCH.garam}`, [ANCH.pi9]: 'non', [ANCH.pigm]: 'non' },
  Hd1: { [ANCH.byeol]: `hap:${ANCH.garam}`, [ANCH.pi9]: 'carry', [ANCH.pigm]: 'non' },
  GS3: { [ANCH.garam]: 'non', [ANCH.neul]: 'carry', [ANCH.byeol]: `hap:${ANCH.neul}` },
  'Pi-ta': { [ANCH.garam]: 'non', [ANCH.neul]: 'carry', [ANCH.byeol]: `hap:${ANCH.neul}`, [ANCH.pi9]: 'non', [ANCH.pigm]: 'non' },
  Pi9: { [ANCH.garam]: 'non', [ANCH.neul]: 'non', [ANCH.byeol]: `hap:${ANCH.garam}`, [ANCH.pi9]: 'favTop', [ANCH.pigm]: 'non' },
}

export type BreedRole = 'app' | 'check' | 'ref' | 'parent'
export const ROLE_ORDER: Record<BreedRole, number> = { app: 0, check: 1, ref: 2, parent: 3 }
export const ROLE_LABEL: Record<BreedRole, string> = { app: '출원 후보', check: '대비 품종', ref: '참고 품종', parent: '부모 후보' }

export interface BreedLine {
  id: string
  name: string | null
  role: BreedRole
  group: ParentGroup | null
  family: string | null
  /** 쌀 수량 GEBV(kg/10a). 출원 후보는 없음 */
  gebv: number | null
  heading: number | null
  culm: number | null
  /** 도열병 저항성 유전자 기록 */
  piRecord: string
  /** MET 수량 지수(%) — 출원 후보 */
  metIdx: number | null
  /** 다양성 패널 구성원(패널 유전형 그대로) */
  panelMember: boolean
  subpop: Subpop
  /** 하위 집단이 육종 그룹으로 추정한 값 */
  subpopEstimated: boolean
}

export interface Assign {
  hap: string
  /** 결측 보정 배정 */
  imputed: boolean
  /** 표적 대립유전자 보유(null = 판정 불가) */
  carry: boolean | null
  /** 리드 결측 → 하플로타입으로 추정 */
  inferred: boolean
  /** ld 인덱스(유전형 출처) */
  slot: number
  /** 관측 유전형(결측 포함)을 쓰는지. false면 임퓨테이션 참값 */
  observed: boolean
}

export interface Hap {
  name: string
  /** 블록 SNP 순서 0/1 */
  seq: string
  /** M(주)/m(소수) 표기 */
  code: string
  complete: number
  target: boolean
}

export interface LocusResult {
  def: LocusDef
  planted: Planted
  others: Planted[]
  lo: number
  hi: number
  snps: Snp[]
  leadIdx: number
  otherIdx: number[]
  blocks: Block[]
  leadBlock: Block
  leadBlockNo: number
  leadBlockKb: number
  geneIn: boolean | null
  geneOutKb: number | null
  otherR2: (number | null)[]
  /** 창 SNP × 412(ld 인덱스) 참값 0/1 */
  G: Uint8Array
  /** 창 SNP × 412 결측 */
  miss: Uint8Array
  /** SNP별 소수 대립유전자(관측 빈도 기준) */
  minor: Uint8Array
  /** 표적 대립유전자(리드 SNP 소수) */
  target: 0 | 1
  leadPos: number
  named: Hap[]
  distinctComplete: number
  /** 범주 순서: H1…Hk, 희귀, 미정 */
  cats: string[]
  /** 표적 하플로타입 중 가장 흔한 것 */
  repTarget: Hap
  /** 표적 하플로타입 비교 기준 대립유전자(SNP별) */
  compareRef: Uint8Array
  slot: Record<string, number>
  /** PANEL 순서 */
  panel: Assign[]
  /** BREED 순서 */
  breed: Assign[]
  missCells: number
  minCallRate: number
  blockMissCells: number
}

export interface HapData {
  panel: PanelLine[]
  breed: BreedLine[]
  loci: LocusResult[]
  /** BREED 순서, 유리형 3좌위 유리 대립유전자 수 */
  favCount: number[]
  ms: number
}

const MET = [
  { id: 'YR19-0118', idx: 106.6 },
  { id: 'YR20-0342', idx: 104.8 },
  { id: 'YR20-0527', idx: 103.5 },
]
const VARIETIES: { id: string; name: string; role: BreedRole; gebv: number; pi: string }[] = [
  { id: ANCH.garam, name: '가람솔', role: 'check', gebv: -2.4, pi: '없음' },
  { id: ANCH.onsae, name: '온새미로', role: 'check', gebv: 11.6, pi: '—' },
  { id: ANCH.byeol, name: '별하랑', role: 'ref', gebv: 36.4, pi: 'Pi-ta·Pib' },
  { id: ANCH.neul, name: '늘솔찬', role: 'ref', gebv: -8.9, pi: 'Pi-ta·Pib' },
]

const logistic = (x: number) => 1 / (1 + Math.exp(-x))

export function computeAll(): HapData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0

  // ---- 계통 목록 ----
  const panel = generatePanelLines().sort(compareDefault)
  const groupOf = new Map(panel.map(p => [p.id, p.group]))
  const nameOf = new Map(panel.map(p => [p.id, p.name]))
  const cands = buildCandidates()
  const breed: BreedLine[] = [
    ...cands.map(c => ({
      id: c.name, name: null, role: 'parent' as const, group: c.group, family: c.family, gebv: c.gebv, heading: c.heading, culm: c.culm, piRecord: c.pi, metIdx: null,
      panelMember: groupOf.has(c.name), subpop: groupOf.get(c.name) ?? (c.group === 'C' ? 'ADM' : 'TEJ'), subpopEstimated: !groupOf.has(c.name),
    })),
    ...MET.map(m => ({
      id: m.id, name: null, role: 'app' as const, group: null, family: null, gebv: null, heading: null, culm: null, piRecord: '—', metIdx: m.idx,
      panelMember: groupOf.has(m.id), subpop: groupOf.get(m.id) ?? ('TEJ' as Subpop), subpopEstimated: !groupOf.has(m.id),
    })),
    ...VARIETIES.map(v => ({
      id: v.id, name: nameOf.get(v.id) ?? v.name, role: v.role, group: null, family: null, gebv: v.gebv, heading: null, culm: null, piRecord: v.pi, metIdx: null,
      panelMember: groupOf.has(v.id), subpop: groupOf.get(v.id) ?? ('TEJ' as Subpop), subpopEstimated: !groupOf.has(v.id),
    })),
  ]

  // ---- 1) 창 유전형 ----
  const wr = createRng(SEED + 500)
  const chrMult = CHROMS.map(() => Math.exp(wr.normal(0, 0.2)))

  const base: Record<string, number> = {}
  for (const g of GORDER) {
    let next = RANGES[g][0]
    for (const ln of panel) if (ln.group === g) base[ln.id] = next++
  }

  const results: Partial<Record<LocusKey, LocusResult>> = {}
  for (const def of LOCI) {
    const pl = PLANTED_BY_ID.get(def.planted)!
    const others = def.others.map(id => PLANTED_BY_ID.get(id)!)
    const ci = Number(pl.chr.slice(3)) - 1
    const len = CHROMS[ci]!.lengthMb * 1e6
    const lo = Math.max(0, pl.bp - HALF_BP)
    const hi = Math.min(Math.round(len), pl.bp + HALF_BP)
    const { snps, geno } = simulateWindow(pl.chr, lo, hi, SEED + 2000 + def.pi, chrMult[ci]!, { bp: pl.bp, maf: pl.maf, id: pl.id })
    const n = snps.length
    const li = snps.findIndex(s => s.bp === pl.bp)
    const otherIdx = others.map(o => snps.findIndex(s => s.bp === o.bp))

    // r²(패널 전체) → 블록
    const cnt = geno.map(g => countAnd(g, MASK_ALL))
    const ok = cnt.map(c => mafOf(c, NL) >= MAF_MIN)
    const R = new Float64Array(n * n).fill(-1)
    for (let i = 0; i < n; i++) {
      R[i * n + i] = 1
      for (let j = i + 1; j < n; j++) {
        if (!ok[i] || !ok[j]) continue
        const v = r2Of(cnt[i]!, cnt[j]!, countAnd3(geno[i]!, geno[j]!, MASK_ALL), NL) ?? 0
        R[i * n + j] = v
        R[j * n + i] = v
      }
    }
    const blocks = findBlocks(R, ok)
    const lb = ok[li] ? blocks.find(b => li >= b.from && li <= b.to) : undefined
    if (!lb) throw new Error(`${def.key} 리드 SNP가 블록 밖에 있습니다`)
    let geneIn: boolean | null = null
    let geneOutKb: number | null = null
    if (pl.geneBp != null) {
      const a = snps[lb.from]!.bp
      const z = snps[lb.to]!.bp
      geneIn = pl.geneBp >= a && pl.geneBp <= z
      if (!geneIn) geneOutKb = Math.min(Math.abs(pl.geneBp - a), Math.abs(pl.geneBp - z)) / 1000
    }
    const otherR2 = otherIdx.map(j => (j < 0 || !ok[j] ? null : R[li * n + j]!))

    const G = new Uint8Array(n * NL)
    for (let j = 0; j < n; j++) for (let l = 0; l < NL; l++) G[j * NL + l] = (geno[j]![l >> 5]! >>> (l & 31)) & 1
    const g = (j: number, l: number) => G[j * NL + l]!
    const c1 = cnt[li]!
    const target: 0 | 1 = c1 / NL < 0.5 ? 1 : 0
    const hapTrue = (l: number) => {
      let h = ''
      for (let j = lb.from; j <= lb.to; j++) h += g(j, l)
      return h
    }
    const favTrue = (l: number) => g(li, l) === target

    // ---- 2) 슬롯 대응(창별 교환) ----
    const m: Record<string, number> = { ...base }
    const owner: Record<number, string> = {}
    for (const [id, x] of Object.entries(m)) owner[x] = id
    const fc = new Map<string, number>()
    for (let l = 0; l < NL; l++) if (favTrue(l)) fc.set(hapTrue(l), (fc.get(hapTrue(l)) || 0) + 1)
    const favTop = [...fc].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0]
    const okCond = (cond: string, x: number) =>
      cond === 'carry' ? favTrue(x) : cond === 'non' ? !favTrue(x) : cond === 'favTop' ? hapTrue(x) === favTop : hapTrue(x) === hapTrue(m[cond.slice(4)]!)
    for (const id of SWAP_ORDER) {
      const cond = COND[def.key][id]
      if (!cond || okCond(cond, m[id]!)) continue
      const [a0, a1] = RANGES[groupOf.get(id)!]
      let t = -1
      for (let x = a0; x < a1; x++)
        if (!ANCHOR_IDS.has(owner[x]!) && okCond(cond, x)) {
          t = x
          break
        }
      if (t < 0) throw new Error(`교환 대상 없음 ${def.key} ${id}`)
      const other = owner[t]!
      owner[m[id]!] = other
      owner[t] = id
      m[other] = m[id]!
      m[id] = t
    }

    // ---- 3) 결측 ----
    const r = createRng(SEED + 3000 + def.pi)
    const miss = new Uint8Array(n * NL)
    let missCells = 0
    let maxRate = 0
    for (let j = 0; j < n; j++) {
      const rate = 0.002 + 0.03 * r.beta(1, 4)
      let c = 0
      for (let l = 0; l < NL; l++) {
        if (r.next() < rate) {
          miss[j * NL + l] = 1
          c++
        }
      }
      missCells += c
      maxRate = Math.max(maxRate, c / NL)
    }
    let blockMissCells = 0
    for (let j = lb.from; j <= lb.to; j++) for (let l = 0; l < NL; l++) blockMissCells += miss[j * NL + l]!
    // 주/소수(관측 빈도)
    const minor = new Uint8Array(n)
    for (let j = 0; j < n; j++) {
      let c = 0
      let k = 0
      for (let l = 0; l < NL; l++)
        if (!miss[j * NL + l]) {
          k++
          c += g(j, l)
        }
      minor[j] = c / k < 0.5 ? 1 : 0
    }

    // ---- 4) 하플로타입 ----
    const obsHap = (l: number) => {
      let h = ''
      for (let j = lb.from; j <= lb.to; j++) h += miss[j * NL + l] ? 'N' : String(g(j, l))
      return h
    }
    const counts = new Map<string, number>()
    for (const p of panel) {
      const h = obsHap(m[p.id]!)
      if (!h.includes('N')) counts.set(h, (counts.get(h) || 0) + 1)
    }
    const leadPos = li - lb.from
    const named: Hap[] = [...counts]
      .filter(([, c]) => c >= NAMED_MIN)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([h, c], i) => ({
        name: `H${i + 1}`,
        seq: h,
        code: [...h].map((ch, k) => (Number(ch) === minor[lb.from + k] ? 'm' : 'M')).join(''),
        complete: c,
        target: Number(h[leadPos]) === target,
      }))
    const assign = (h: string): { hap: string; imputed: boolean } => {
      if (!h.includes('N')) {
        const f = named.find(x => x.seq === h)
        return f ? { hap: f.name, imputed: false } : { hap: RARE, imputed: false }
      }
      const comp = named.filter(x => [...h].every((c, i) => c === 'N' || c === x.seq[i]))
      return comp.length === 1 ? { hap: comp[0]!.name, imputed: true } : comp.length === 0 ? { hap: RARE, imputed: false } : { hap: UNDET, imputed: false }
    }
    const status = (h: string, hap: string): { carry: boolean | null; inferred: boolean } => {
      const c = h[leadPos]
      if (c !== 'N') return { carry: Number(c) === target, inferred: false }
      const nh = named.find(x => x.name === hap)
      return nh ? { carry: nh.target, inferred: true } : { carry: null, inferred: false }
    }
    const mk = (h: string, slot: number, observed: boolean): Assign => {
      const a = assign(h)
      const s = status(h, a.hap)
      return { hap: a.hap, imputed: a.imputed, carry: s.carry, inferred: s.inferred, slot, observed }
    }
    const panelRes = panel.map(p => mk(obsHap(m[p.id]!), m[p.id]!, true))

    // 비교 기준: 대표 표적 하플로타입
    const repTarget = named.find(x => x.target)!
    const repSlots = panelRes.filter(a => a.hap === repTarget.name).map(a => a.slot)
    const compareRef = new Uint8Array(n)
    for (let j = 0; j < n; j++) {
      if (j >= lb.from && j <= lb.to) {
        compareRef[j] = Number(repTarget.seq[j - lb.from])
        continue
      }
      let c0 = 0
      let c1x = 0
      for (const s of repSlots) {
        if (miss[j * NL + s]) continue
        if (g(j, s)) c1x++
        else c0++
      }
      compareRef[j] = c1x > c0 ? 1 : c0 > c1x ? 0 : minor[j]!
    }

    results[def.key] = {
      def, planted: pl, others, lo, hi, snps, leadIdx: li, otherIdx, blocks, leadBlock: lb,
      leadBlockNo: blocks.indexOf(lb) + 1, leadBlockKb: (snps[lb.to]!.bp - snps[lb.from]!.bp) / 1000,
      geneIn, geneOutKb, otherR2, G, miss, minor, target, leadPos, named, distinctComplete: counts.size,
      cats: [...named.map(x => x.name), RARE, UNDET], repTarget, compareRef, slot: m, panel: panelRes, breed: [],
      missCells, minCallRate: 1 - maxRate, blockMissCells,
    }
  }

  // ---- 5) 육종 계통 공여 ----
  const tejIds = panel.filter(p => p.group === 'TEJ' && p.origin === 'YR' && !p.anchor).map(p => p.id)
  const cIds = panel.filter(p => (p.group === 'ADM' || p.group === 'IND') && !p.anchor).map(p => p.id)
  const br = createRng(SEED + 4000)
  const donor: Partial<Record<LocusKey, number[]>> = {}
  for (const def of [...LOCI].sort((a, b) => a.pi - b.pi)) {
    const L = results[def.key]!
    const S = L.slot
    const favTrue = (x: number) => L.G[L.leadIdx * NL + x] === L.target
    donor[def.key] = breed.map(b => {
      if (b.panelMember) return S[b.id]!
      const u1 = br.next()
      const u2 = br.next()
      let need: 'any' | 'carry' | 'non' = 'any'
      if (b.role === 'parent') {
        if (def.key === 'Hd1') need = u1 < logistic((b.heading! - 119) / 2.5) ? 'carry' : 'non'
        if (def.key === 'sd1') need = u1 < logistic((88 - b.culm!) / 3) ? 'carry' : 'non'
        if (def.key === 'Pi-ta') need = b.piRecord === 'Pi-ta' ? 'carry' : 'non'
        if (def.key === 'Pi9') need = b.piRecord === 'Pi9' ? 'carry' : 'non'
      }
      let pool = (b.group === 'C' ? cIds : tejIds).map(id => S[id]!)
      if (def.key === 'Pi-ta' && need === 'carry' && b.group !== 'C') pool = [S[ANCH.byeol]!, S[ANCH.neul]!]
      if (need !== 'any') pool = pool.filter(x => favTrue(x) === (need === 'carry'))
      if (!pool.length) throw new Error(`빈 공여 풀 ${def.key} ${b.id}`)
      return def.key === 'Pi-ta' && b.family === 'F01' ? S[ANCH.byeol]! : pool[Math.floor(u2 * pool.length)]!
    })
  }
  for (const def of LOCI) {
    const L = results[def.key]!
    const lb = L.leadBlock
    L.breed = breed.map((b, i) => {
      const s = donor[def.key]![i]!
      let h = ''
      for (let j = lb.from; j <= lb.to; j++) h += b.panelMember && L.miss[j * NL + s] ? 'N' : String(L.G[j * NL + s])
      const a = (() => {
        if (!h.includes('N')) {
          const f = L.named.find(x => x.seq === h)
          return { hap: f ? f.name : RARE, imputed: false }
        }
        const comp = L.named.filter(x => [...h].every((c, k) => c === 'N' || c === x.seq[k]))
        return comp.length === 1 ? { hap: comp[0]!.name, imputed: true } : { hap: comp.length === 0 ? RARE : UNDET, imputed: false }
      })()
      const c = h[L.leadPos]
      const nh = L.named.find(x => x.name === a.hap)
      const st = c !== 'N' ? { carry: Number(c) === L.target, inferred: false } : nh ? { carry: nh.target, inferred: true } : { carry: null, inferred: false }
      return { hap: a.hap, imputed: a.imputed, carry: st.carry, inferred: st.inferred, slot: s, observed: b.panelMember }
    })
  }

  const loci = LOCI.map(d => results[d.key]!)
  const favCount = breed.map((_, i) => loci.filter(L => L.def.kind === 'fav' && L.breed[i]!.carry === true).length)
  const out: HapData = { panel, breed, loci, favCount, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 }
  if (import.meta.env.DEV) devCheck(out)
  return out
}

// ===========================================================================
// 파생 값(난수 없음)
// ===========================================================================

/** 셀 값: 0/1, 결측 −1 */
export function cellValue(L: LocusResult, a: Assign, j: number): number {
  const k = j * N + a.slot
  if (a.observed && L.miss[k]) return -1
  return L.G[k]!
}

export const hapRank = (L: LocusResult, hap: string) => {
  const i = L.cats.indexOf(hap)
  return i < 0 ? 99 : i
}

export type RowSet = Subpop | 'ALL' | 'BREED'
export const ROWSETS: RowSet[] = ['TEJ', 'TRJ', 'IND', 'AUS', 'ADM', 'ALL', 'BREED']

/** 범주별 계통 수(L.cats 순서) */
export function catCounts(L: LocusResult, data: HapData, set: RowSet): { counts: number[]; n: number } {
  const rows = set === 'BREED' ? L.breed : set === 'ALL' ? L.panel : L.panel.filter((_, i) => data.panel[i]!.group === set)
  return { counts: L.cats.map(c => rows.filter(r => r.hap === c).length), n: rows.length }
}

export interface LocusSummary {
  targetHaps: Hap[]
  targetHapLines: number
  carryPanel: number
  nullPanel: number
  inferredPanel: number
  imputedPanel: number
  carryTej: number
  parentCarry: number
  parentByGroup: Record<ParentGroup, [number, number]>
  breedCarry: number
  rareN: number
  undetN: number
}

export function locusSummary(L: LocusResult, data: HapData): LocusSummary {
  const targetHaps = L.named.filter(h => h.target)
  const tn = new Set(targetHaps.map(h => h.name))
  const parents = data.breed.map((b, i) => ({ b, a: L.breed[i]! })).filter(x => x.b.role === 'parent')
  const byG = (g: ParentGroup): [number, number] => {
    const xs = parents.filter(x => x.b.group === g)
    return [xs.filter(x => x.a.carry === true).length, xs.length]
  }
  return {
    targetHaps,
    targetHapLines: L.panel.filter(a => tn.has(a.hap)).length,
    carryPanel: L.panel.filter(a => a.carry === true).length,
    nullPanel: L.panel.filter(a => a.carry === null).length,
    inferredPanel: L.panel.filter(a => a.inferred).length,
    imputedPanel: L.panel.filter(a => a.imputed).length,
    carryTej: L.panel.filter((a, i) => a.carry === true && data.panel[i]!.group === 'TEJ').length,
    parentCarry: parents.filter(x => x.a.carry === true).length,
    parentByGroup: { A: byG('A'), B: byG('B'), C: byG('C') },
    breedCarry: L.breed.filter(a => a.carry === true).length,
    rareN: L.panel.filter(a => a.hap === RARE).length,
    undetN: L.panel.filter(a => a.hap === UNDET).length,
  }
}

/** 부모 후보의 보유/비보유 평균 형질 */
export function parentTraitDiff(L: LocusResult, data: HapData, trait: 'culm' | 'heading') {
  const rows = data.breed.map((b, i) => ({ b, a: L.breed[i]! })).filter(x => x.b.role === 'parent')
  const yes = rows.filter(x => x.a.carry === true)
  const no = rows.filter(x => x.a.carry === false)
  const mean = (xs: typeof rows) => xs.reduce((s, x) => s + (x.b[trait] ?? 0), 0) / xs.length
  return { nYes: yes.length, nNo: no.length, mYes: mean(yes), mNo: mean(no), diff: mean(yes) - mean(no) }
}

/** 부모 후보 저항성 기록과 판정 일치 */
export function parentRecordAgreement(L: LocusResult, data: HapData) {
  const rows = data.breed.map((b, i) => ({ b, a: L.breed[i]! })).filter(x => x.b.role === 'parent')
  const key = L.def.key
  return {
    recorded: rows.filter(x => x.b.piRecord === key).length,
    agree: rows.filter(x => (x.b.piRecord === key) === (x.a.carry === true)).length,
    total: rows.length,
    pigm: rows.filter(x => x.b.piRecord === 'Pigm').length,
    pigmCarry: rows.filter(x => x.b.piRecord === 'Pigm' && x.a.carry === true).length,
  }
}

/** 부모 후보 유리 대립유전자 수 분포와 조합 */
export function favSummary(data: HapData) {
  const idx = data.breed.map((_, i) => i).filter(i => data.breed[i]!.role === 'parent')
  const L = (k: LocusKey) => data.loci.find(x => x.def.key === k)!
  const has = (k: LocusKey, i: number) => L(k).breed[i]!.carry === true
  const dist = [0, 1, 2, 3].map(k => idx.filter(i => data.favCount[i] === k).length)
  const both = (a: LocusKey, b: LocusKey) => idx.filter(i => has(a, i) && has(b, i))
  const sdPita = both('sd1', 'Pi-ta')
  const sdPi9 = both('sd1', 'Pi9')
  const pitaPi9 = both('Pi-ta', 'Pi9')
  const groupsOf = (xs: number[]) => [...new Set(xs.map(i => data.breed[i]!.group))].join('·')
  return {
    nParents: idx.length,
    dist,
    mean: idx.reduce((s, i) => s + data.favCount[i]!, 0) / idx.length,
    all3: idx.filter(i => data.favCount[i] === 3).length,
    sdPita: { n: sdPita.length, groups: groupsOf(sdPita), ids: sdPita.map(i => data.breed[i]!.id) },
    sdPi9: { n: sdPi9.length, ids: sdPi9.map(i => data.breed[i]!.id) },
    pitaPi9: { n: pitaPi9.length },
    pi9Carriers: idx.filter(i => has('Pi9', i)).map(i => data.breed[i]!),
  }
}

// ---- 정렬(명세 6)) ----

export type SortMode = 'hap' | 'subpop' | 'gebv'

export function panelOrder(L: LocusResult, data: HapData, mode: SortMode): number[] {
  const idx = data.panel.map((_, i) => i)
  const P = data.panel
  const cmpId = (a: number, b: number) => (P[a]!.id < P[b]!.id ? -1 : 1)
  const gi = (i: number) => GORDER.indexOf(P[i]!.group)
  if (mode === 'subpop') return idx.sort((a, b) => gi(a) - gi(b) || hapRank(L, L.panel[a]!.hap) - hapRank(L, L.panel[b]!.hap) || cmpId(a, b))
  return idx.sort((a, b) => hapRank(L, L.panel[a]!.hap) - hapRank(L, L.panel[b]!.hap) || gi(a) - gi(b) || cmpId(a, b))
}

export function breedOrder(L: LocusResult, data: HapData, mode: SortMode): number[] {
  const idx = data.breed.map((_, i) => i)
  const B = data.breed
  const cmpId = (a: number, b: number) => (B[a]!.id < B[b]!.id ? -1 : 1)
  const gv = (i: number) => B[i]!.gebv ?? -999
  if (mode === 'gebv') return idx.sort((a, b) => gv(b) - gv(a) || cmpId(a, b))
  if (mode === 'subpop') {
    const gi = (i: number) => GORDER.indexOf(B[i]!.subpop)
    return idx.sort((a, b) => gi(a) - gi(b) || hapRank(L, L.breed[a]!.hap) - hapRank(L, L.breed[b]!.hap) || cmpId(a, b))
  }
  return idx.sort(
    (a, b) => hapRank(L, L.breed[a]!.hap) - hapRank(L, L.breed[b]!.hap) || ROLE_ORDER[B[a]!.role] - ROLE_ORDER[B[b]!.role] || gv(b) - gv(a) || cmpId(a, b),
  )
}

/** 요약 표 기본 정렬: 역할 → 유리 수 내림차순 → GEBV 내림차순 → ID */
export function summaryOrder(data: HapData): number[] {
  const B = data.breed
  const gv = (i: number) => B[i]!.gebv ?? -999
  return B.map((_, i) => i).sort(
    (a, b) => ROLE_ORDER[B[a]!.role] - ROLE_ORDER[B[b]!.role] || data.favCount[b]! - data.favCount[a]! || gv(b) - gv(a) || (B[a]!.id < B[b]!.id ? -1 : 1),
  )
}

export const lineLabel = (l: { id: string; name: string | null }) => (l.name ? `${l.name} (${l.id})` : l.id)
export const mb2 = (bp: number) => (bp / 1e6).toFixed(2)
export const kb1 = (v: number) => v.toFixed(1)
export const locusOptionLabel = (L: LocusResult) => `${L.def.key} · ${L.def.traits} (${L.planted.chr} ${mb2(L.planted.bp)} Mb)`

// ===========================================================================
// DEV 검산 — 명세 8)·수용 기준
// ===========================================================================

function devCheck(d: HapData) {
  const A = (cond: boolean, msg: string) => console.assert(cond, `[검산] haplotype-viewer: ${msg}`)
  A(getPanel().length === M, `패널 SNP 수 ${getPanel().length} ≠ ${M}`)
  const gc = GORDER.map(g => d.panel.filter(p => p.group === g).length).join('/')
  A(gc === '176/54/112/30/40', `하위 집단 계통 수 ${gc} ≠ 176/54/112/30/40`)
  const key = d.loci.map(L => L.def.key)
  {
    // 하플로타입 표 sd1 H2 최다 하위 집단 칸 "온대 자포니카 47 (26.7%)" = 47/176
    const L0 = d.loci[0]!
    const byG = GORDER.map(g => ({ g, n: L0.panel.filter((a, i) => a.hap === 'H2' && d.panel[i]!.group === g).length }))
    const top = byG.reduce((x, y) => (y.n > x.n ? y : x))
    const cell = `${top.g} ${top.n} (${((100 * top.n) / SUBPOP_N[top.g]).toFixed(1)}%)`
    A(cell === 'TEJ 47 (26.7%)', `sd1 H2 최다 하위 집단 ${cell} ≠ TEJ 47 (26.7%)`)
  }
  const exp = {
    nSnp: [94, 108, 95, 75, 107],
    blocks: [13, 17, 15, 14, 16],
    kb: ['99.2', '39.5', '36.0', '57.8', '35.6'],
    lbSnp: [8, 8, 4, 7, 5],
    named: [7, 4, 4, 5, 5],
    distinct: [27, 19, 7, 19, 11],
    carry: [145, 125, 110, 86, 48],
    tgtLines: [120, 109, 104, 79, 38],
    parent: [40, 18, 9, 14, 3],
    miss: [294, 348, 306, 242, 343],
    breedMiss: [3, 2, 5, 0, 4],
  }
  d.loci.forEach((L, k) => {
    const s = locusSummary(L, d)
    A(L.snps.length === exp.nSnp[k], `${key[k]} 창 SNP ${L.snps.length} ≠ ${exp.nSnp[k]}`)
    A(L.blocks.length === exp.blocks[k], `${key[k]} 블록 ${L.blocks.length} ≠ ${exp.blocks[k]}`)
    A(kb1(L.leadBlockKb) === exp.kb[k] && L.leadBlock.nSnp === exp.lbSnp[k], `${key[k]} 리드 블록 ${kb1(L.leadBlockKb)} kb/${L.leadBlock.nSnp} SNP ≠ ${exp.kb[k]}/${exp.lbSnp[k]}`)
    A(L.named.length === exp.named[k] && L.distinctComplete === exp.distinct[k], `${key[k]} 하플로타입 ${L.named.length}(${L.distinctComplete}) ≠ ${exp.named[k]}(${exp.distinct[k]})`)
    A(s.carryPanel === exp.carry[k], `${key[k]} 패널 표적 보유 ${s.carryPanel} ≠ ${exp.carry[k]}`)
    A(s.targetHapLines === exp.tgtLines[k], `${key[k]} 표적 하플로타입 계통 ${s.targetHapLines} ≠ ${exp.tgtLines[k]}`)
    A(s.parentCarry === exp.parent[k], `${key[k]} 부모 후보 보유 ${s.parentCarry} ≠ ${exp.parent[k]}`)
    A(L.missCells === exp.miss[k], `${key[k]} 결측 셀 ${L.missCells} ≠ ${exp.miss[k]}`)
    const bm = d.breed.reduce((acc, b, i) => {
      if (!b.panelMember) return acc
      let c = 0
      for (let j = 0; j < L.snps.length; j++) if (cellValue(L, L.breed[i]!, j) < 0) c++
      return acc + c
    }, 0)
    A(bm === exp.breedMiss[k], `${key[k]} 육종 보기 결측 셀 ${bm} ≠ ${exp.breedMiss[k]}`)
    const slots = Object.values(L.slot)
    A(new Set(slots).size === N && slots.every(x => x >= 0 && x < N), `${key[k]} 슬롯이 0..411 순열이 아님`)
    A(d.panel.every(p => L.slot[p.id]! >= RANGES[p.group][0] && L.slot[p.id]! < RANGES[p.group][1]), `${key[k]} 슬롯이 집단 범위 밖`)
  })
  {
    // 정리 회차 3: GS3 표적 하플로타입(천립중 증가형) 인디카 57/112 · 온대 자포니카 22/176 — 각주 "인디카에 많다"
    const gs3 = d.loci[2]!
    const tn = new Set(gs3.named.filter(h => h.target).map(h => h.name))
    const tg = (g: 'TEJ' | 'IND') => {
      const { counts, n } = catCounts(gs3, d, g)
      return `${gs3.cats.reduce((acc, c, i) => acc + (tn.has(c) ? counts[i]! : 0), 0)}/${n}`
    }
    const ind = tg('IND'), tej = tg('TEJ')
    A(ind === '57/112' && tej === '22/176', `GS3 표적 하플로타입 IND ${ind} · TEJ ${tej} ≠ 57/112 · 22/176`)
    A([...tn].join('·') === 'H2·H3', `GS3 표적 하플로타입 ${[...tn].join('·')} ≠ H2·H3`)
  }
  const sd1 = d.loci[0]!
  const dist = sd1.cats.map(c => sd1.panel.filter(a => a.hap === c).length).join('/')
  A(dist === '214/114/10/7/7/6/6/43/5', `sd1 패널 하플로타입 분포 ${dist}`)
  A(sd1.named.filter(h => h.target).map(h => h.name).join('·') === 'H2·H6', 'sd1 표적 하플로타입 ≠ H2·H6')
  A(sd1.snps[sd1.leadIdx]!.id === 'S1_38401775' && sd1.snps[sd1.leadBlock.from]!.id === 'S1_38357091' && sd1.snps[sd1.leadBlock.to]!.id === 'S1_38456284' && sd1.leadBlockNo === 6, 'sd1 리드 블록 ≠ B6 S1_38357091~S1_38456284')
  const hd1 = d.loci[1]!
  A(hd1.otherR2[0] != null && hd1.otherR2[0].toFixed(2) === '0.87' && hd1.otherIdx[0]! >= hd1.leadBlock.from && hd1.otherIdx[0]! <= hd1.leadBlock.to, 'Hd1 C2 r² ≠ 0.87 또는 블록 밖')
  // 별하랑 리드 블록 조합 = 지정 부모
  const hapOf = (L: LocusResult, id: string) => {
    const s = L.slot[id]!
    let h = ''
    for (let j = L.leadBlock.from; j <= L.leadBlock.to; j++) h += L.G[j * N + s]
    return h
  }
  const par: Record<LocusKey, string> = { sd1: ANCH.garam, Hd1: ANCH.garam, GS3: ANCH.neul, 'Pi-ta': ANCH.neul, Pi9: ANCH.garam }
  d.loci.forEach(L => A(hapOf(L, ANCH.byeol) === hapOf(L, par[L.def.key]), `별하랑 ${L.def.key} 리드 블록 조합이 지정 부모와 다름`))
  for (const L of [d.loci[3]!, d.loci[4]!]) {
    const ag = parentRecordAgreement(L, d)
    A(ag.agree === 60, `${L.def.key} 부모 후보 기록 일치 ${ag.agree}/60`)
  }
  const fs = favSummary(d)
  A(fs.dist.join('/') === '14/35/11/0', `부모 후보 유리 수 분포 ${fs.dist.join('/')} ≠ 14/35/11/0`)
  A(fs.sdPita.n === 10 && fs.sdPi9.n === 1 && fs.sdPi9.ids[0] === 'YR22-7121' && fs.pitaPi9.n === 0, '유리 조합 sd1+Pi-ta 10 · sd1+Pi9 1(YR22-7121) · Pi-ta+Pi9 0 불일치')
  const sdd = parentTraitDiff(sd1, d, 'culm')
  A(sdd.mYes.toFixed(1) === '80.5' && sdd.mNo.toFixed(1) === '91.1' && sdd.diff.toFixed(1) === '-10.6', `sd1 간장 차 ${sdd.mYes.toFixed(2)}/${sdd.mNo.toFixed(2)}`)
  const hdd = parentTraitDiff(hd1, d, 'heading')
  A(hdd.mYes.toFixed(1) === '119.6' && hdd.mNo.toFixed(1) === '112.3' && hdd.diff.toFixed(1) === '7.3', `Hd1 출수 차 ${hdd.mYes.toFixed(2)}/${hdd.mNo.toFixed(2)}`)
  A(d.panel[panelOrder(sd1, d, 'hap')[0]!]!.id === 'YR05-0784', 'sd1 패널 하플로타입 정렬 첫 행 ≠ YR05-0784')
  const go = breedOrder(sd1, d, 'gebv')
  A(d.breed[go[0]!]!.id === 'YR22-0412' && go.slice(-3).every(i => d.breed[i]!.role === 'app'), 'GEBV 정렬 첫 행 YR22-0412·출원 후보 맨 뒤 불일치')
  const so = summaryOrder(d).slice(0, 7).map(i => d.breed[i]!.id).join(',')
  A(so === 'YR20-0527,YR19-0118,YR20-0342,YR07-0231,YR13-0819,YR19-0083,YR14-0472', `요약 표 첫 7행 ${so}`)
}
