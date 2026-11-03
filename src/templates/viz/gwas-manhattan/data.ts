/**
 * GWAS 결과 뷰어 목업 데이터.
 * 명세: docs/specs/gwas-manhattan.md (시드 20261023)
 *
 * 실제 데이터로 바꿀 때는 `PANEL`(SNP 위치·MAF)과 `getTraitResult()`가 돌려주는 형태
 * (logP·chi2 배열, 리드 SNP 목록, λ, QQ 데이터)만 유지하면 화면은 그대로 동작한다.
 */
import { createRng } from '@/lib/rng'
import { ORGANISMS, chi2FromLogP, lambdaGC, logPFromZ } from '@/lib/genomics'

// ---------------------------------------------------------------------------
// 상수·분석 조건
// ---------------------------------------------------------------------------

export const SEED = 20261023
/** 분석 SNP 수(QC 후) */
export const M = 36420
/** 분석 계통 수 */
export const N = 412
/** 제안적 유의 수준 −log10(1e-5) */
export const SUGGESTIVE = 5
/** clumping 창(bp) */
const CLUMP_BP = 500_000
/** QTL 구간 반폭(Mb) */
const QTL_HALF_MB = 0.2
/** λGC 계산에서 뺄 유의 피크 주변 반폭(bp) — 알려진 연관 구간 제외 */
export const LAMBDA_EXCLUDE_BP = 1_000_000
/** λGC 제외 대상 피크의 기준선: 본페로니(두 기준 중 낮은 선)라서 기준 토글과 무관하게 λ가 고정된다 */
const LAMBDA_PEAK_LINE = -Math.log10(0.05 / M)
/** LD 신호 감소 상수(Mb) */
const TAU = 0.15
/**
 * 형질별 p값 RNG 시드 추가 오프셋. 명세 규칙은 createRng(SEED + k + 1)이지만
 * 출수기(k=0)는 그 시드에서 귀무 SNP 하나(S6_460967, −log10 p 6.66)가 유의선을 넘었다
 * (λ=1.04, M=36,420에서 기대 약 0.01개). 값을 손으로 덮어쓰지 않고 시드만 +10 옮겼다.
 * 결과: 귀무 최대 4.80, λ 1.06, 유의 좌위 4(본페로니)·3(5×10⁻⁸). 나머지 형질은 명세 그대로.
 */
const P_SEED_OFFSET: Record<TraitKey, number> = { dth: 10, cl: 0, tgw: 0, blast: 0 }

export const ANALYSIS = {
  panel: 'YR 다양성 패널',
  organism: ORGANISMS.rice!.name,
  lines: N,
  snps: M,
  filter: 'MAF ≥ 0.05 · 콜레이트 ≥ 90%',
  model: 'MLM (PC 3개 + GRM)',
  phenotypeYear: 2025,
  analyzedAt: '2026-10-20',
  reference: 'IRGSP-1.0 근사',
} as const

export type Criterion = 'bonferroni' | 'gw5e8'

export const CRITERIA: { value: Criterion; label: string; line: number; desc: string }[] = [
  { value: 'bonferroni', label: '본페로니 0.05/M', line: -Math.log10(0.05 / M), desc: `0.05/${M.toLocaleString('ko-KR')}` },
  { value: 'gw5e8', label: '5×10⁻⁸', line: -Math.log10(5e-8), desc: '5×10⁻⁸' },
]

export function sigLineOf(c: Criterion): number {
  return CRITERIA.find(x => x.value === c)!.line
}

export type TraitKey = 'dth' | 'cl' | 'tgw' | 'blast'

export interface Trait {
  key: TraitKey
  label: string
  short: string
  unit: string
  mean: number
  sdP: number
  h2: number
  lambda: number
  direction: string
}

export const TRAITS: Trait[] = [
  { key: 'dth', label: '출수기(파종 후 일수)', short: '출수기', unit: '일', mean: 112, sdP: 7.5, h2: 0.75, lambda: 1.04, direction: '+는 출수 지연' },
  { key: 'cl', label: '간장', short: '간장', unit: 'cm', mean: 92, sdP: 11.0, h2: 0.65, lambda: 1.02, direction: '−는 단간' },
  { key: 'tgw', label: '천립중', short: '천립중', unit: 'g', mean: 23.8, sdP: 2.1, h2: 0.7, lambda: 0.99, direction: '+는 무거운 낟알' },
  { key: 'blast', label: '도열병 저항성(병반 점수 0~9)', short: '도열병', unit: '점', mean: 4.6, sdP: 2.0, h2: 0.45, lambda: 1.04, direction: '음수 = 저항성 증가' },
]

interface Planted {
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

/** 명세 「심을 피크」 표 — 값을 그대로 쓴다 */
const PLANTED: Planted[] = [
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

// ---------------------------------------------------------------------------
// 통계 보조
// ---------------------------------------------------------------------------

const round3 = (v: number) => Math.round(v * 1000) / 1000

// ---------------------------------------------------------------------------
// 1) SNP 패널 — 모든 형질 공통(위치·MAF 동일)
// ---------------------------------------------------------------------------

export interface Snp {
  id: string
  chr: string
  /** 염색체 번호(1~12) */
  chrNum: number
  bp: number
  posMb: number
  /** 맨해튼 x축 누적 위치(Mb, 염색체 사이 간격 포함) */
  cumPos: number
  maf: number
  plantedId?: string
}

export interface ChrOffset {
  chr: string
  chrNum: number
  lengthMb: number
  start: number
  end: number
  mid: number
  /** 이 염색체 SNP의 PANEL 인덱스 범위 [from, to) */
  from: number
  to: number
}

function buildPanel(): { snps: Snp[]; chrOffsets: ChrOffset[]; totalMb: number } {
  const chrs = ORGANISMS.rice!.chromosomes
  const totalLen = chrs.reduce((s, c) => s + c.lengthMb, 0) // 373.0
  const GAP = totalLen * 0.01
  const rng = createRng(SEED)

  const n = chrs.map(c => Math.round((M * c.lengthMb) / totalLen))
  n[n.length - 1]! += M - n.reduce((s, v) => s + v, 0)

  const snps: Snp[] = []
  const chrOffsets: ChrOffset[] = []
  let offset = 0
  chrs.forEach((c, ci) => {
    const chrNum = ci + 1
    const planted = PLANTED.filter(p => p.chr === c.id)
    const plantedBp = new Set(planted.map(p => p.bp))
    const k = n[ci]! - planted.length
    const maxBp = c.lengthMb * 1e6
    const set = new Set<number>()
    // k개 추첨 → 중복(또는 심은 위치와 충돌) 제거 후 부족분 재추첨
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
    const from = snps.length
    snps.push(...list)
    chrOffsets.push({ chr: c.id, chrNum, lengthMb: c.lengthMb, start: offset, end: offset + c.lengthMb, mid: offset + c.lengthMb / 2, from, to: snps.length })
    offset += c.lengthMb + GAP
  })
  return { snps, chrOffsets, totalMb: offset - GAP }
}

export const PANEL = buildPanel()

// ---------------------------------------------------------------------------
// 2) 형질별 p값  3) 파생 값  4) QQ
// ---------------------------------------------------------------------------

export interface Lead {
  /** PANEL 인덱스 */
  idx: number
  id: string
  chr: string
  chrNum: number
  bp: number
  posMb: number
  logP: number
  p: number
  maf: number
  beta: number
  pve: number
  qtlStart: number
  qtlEnd: number
  gene: string | null
  geneDistKb: number | null
  plantedId?: string
}

export interface QqPoint {
  exp: number
  obs: number
  idx: number
}

export interface TraitResult {
  trait: Trait
  /** PANEL 순서의 −log10(p) */
  logP: Float64Array
  chi2: Float64Array
  /** 제안선(5) 이상 리드 SNP, −log10(p) 내림차순(= p 오름차순) */
  leads: Lead[]
  /** λGC — 본페로니 유의 리드 SNP ±1 Mb 안의 SNP를 뺀 p값 중앙값으로 계산 */
  lambda: number
  /** 참고: 전체 SNP로 계산한 λGC */
  lambdaAll: number
  /** λ 계산에 쓴 SNP 수 */
  lambdaN: number
  /** λ 계산에서 제외한 피크(리드 SNP) 수 */
  lambdaPeaks: number
  maxLogP: number
  /** 내림차순 정렬 logP (유의 SNP 수 계산용) */
  sortedDesc: Float64Array
  qq: QqPoint[]
  /** [기대 −log10(p), 하한, 상한] 95% 신뢰 띠 */
  band: [number, number, number][]
}

function computeTrait(key: TraitKey, opts: { nullOnly?: boolean } = {}): TraitResult {
  const k = TRAITS.findIndex(t => t.key === key)
  const trait = TRAITS[k]!
  const r = createRng(SEED + k + 1 + P_SEED_OFFSET[key])
  const sd = Math.sqrt(trait.lambda)
  const peaks = opts.nullOnly ? [] : PLANTED.filter(p => p.trait === key)
  const { snps } = PANEL
  const logP = new Float64Array(M)
  const chi2 = new Float64Array(M)

  for (let i = 0; i < M; i++) {
    const snp = snps[i]!
    const z = r.normal(0, sd)
    let lp = logPFromZ(z)
    let c2 = z * z
    for (const pk of peaks) {
      if (pk.chr !== snp.chr) continue
      if (snp.plantedId === pk.id) {
        lp = pk.logP
        c2 = chi2FromLogP(pk.logP)
        continue
      }
      const d = Math.abs(snp.posMb - pk.bp / 1e6)
      if (d < 1.0) {
        const s = pk.logP * Math.exp(-d / TAU) * (0.6 + 0.35 * r.next())
        if (s > lp) {
          lp = s
          c2 = chi2FromLogP(s)
        }
      }
    }
    // 개발용 빈 상태(?state=empty): 제안선을 넘는 SNP가 없는 결과를 흉내 낸다
    if (opts.nullOnly && lp >= SUGGESTIVE) lp = SUGGESTIVE - 0.01
    logP[i] = round3(lp)
    chi2[i] = c2
  }

  const sortedAsc = Float64Array.from(logP).sort()
  const sortedDesc = sortedAsc.slice().reverse()

  // clumping (±500 kb)
  let cand = Array.from({ length: M }, (_, i) => i)
    .filter(i => logP[i]! >= SUGGESTIVE)
    .sort((a, b) => logP[b]! - logP[a]!)
  const leads: Lead[] = []
  while (cand.length) {
    const top = cand.shift()!
    const s = snps[top]!
    cand = cand.filter(i => !(snps[i]!.chr === s.chr && Math.abs(snps[i]!.bp - s.bp) <= CLUMP_BP))
    const planted = s.plantedId ? PLANTED.find(p => p.id === s.plantedId && p.trait === key) : undefined
    const pve = planted ? planted.pve : chi2[top]! / (N + chi2[top]!)
    const sign = s.bp % 2 === 0 ? 1 : -1
    const beta = planted ? planted.beta : sign * trait.sdP * Math.sqrt(pve / (s.maf * (1 - s.maf)))
    const chrLen = PANEL.chrOffsets[s.chrNum - 1]!.lengthMb
    const near = peaks.find(p => p.chr === s.chr && p.gene && Math.abs(p.bp - s.bp) <= CLUMP_BP)
    leads.push({
      idx: top,
      id: s.id,
      chr: s.chr,
      chrNum: s.chrNum,
      bp: s.bp,
      posMb: s.posMb,
      logP: logP[top]!,
      p: 10 ** -logP[top]!,
      maf: s.maf,
      beta,
      pve,
      qtlStart: Math.max(0, s.posMb - QTL_HALF_MB),
      qtlEnd: Math.min(chrLen, s.posMb + QTL_HALF_MB),
      gene: near?.gene ?? null,
      geneDistKb: near?.geneBp != null ? Math.round(Math.abs(s.bp - near.geneBp) / 1000) : null,
      plantedId: planted?.id,
    })
  }

  // λGC — 본페로니 유의 리드 SNP ±1 Mb 안의 SNP(알려진 연관 구간)를 빼고 중앙값으로 계산.
  // QQ 플롯은 전체 SNP를 그대로 그린다.
  const exPeaks = leads.filter(l => l.logP >= LAMBDA_PEAK_LINE)
  const lambdaInput: number[] = []
  for (let i = 0; i < M; i++) {
    const s = snps[i]!
    if (exPeaks.some(l => l.chr === s.chr && Math.abs(l.bp - s.bp) <= LAMBDA_EXCLUDE_BP)) continue
    lambdaInput.push(logP[i]!)
  }
  const lambda = lambdaGC(lambdaInput)
  const lambdaAll = lambdaGC(logP)

  // QQ — 관측 내림차순, 기대 −log10((i−0.5)/M), 기대 < 2 구간은 20개마다 1개
  const order = Array.from({ length: M }, (_, i) => i).sort((a, b) => logP[b]! - logP[a]!)
  const qq: QqPoint[] = []
  for (let i = 1; i <= M; i++) {
    const exp = -Math.log10((i - 0.5) / M)
    if (exp < 2 && i % 20 !== 0) continue
    const idx = order[i - 1]!
    qq.push({ exp, obs: logP[idx]!, idx })
  }

  // 95% 신뢰 띠 — p(i) ≈ Gamma(i,1)/M, Wilson–Hilferty, 로그 간격 약 200개 순위
  const ranks = new Set<number>()
  for (let j = 0; j < 200; j++) ranks.add(Math.round(Math.exp((Math.log(M) * j) / 199)))
  const band: [number, number, number][] = []
  for (const i of [...ranks].sort((a, b) => a - b)) {
    let qLo: number
    let qHi: number
    if (i === 1) {
      qLo = -Math.log(0.975)
      qHi = -Math.log(0.025)
    } else {
      const wh = (zz: number) => i * (1 - 1 / (9 * i) + zz / (3 * Math.sqrt(i))) ** 3
      qLo = wh(-1.96)
      qHi = wh(1.96)
    }
    const exp = -Math.log10((i - 0.5) / M)
    band.push([exp, -Math.log10(qHi / M), -Math.log10(qLo / M)])
  }

  return { trait, logP, chi2, leads, lambda, lambdaAll, lambdaN: lambdaInput.length, lambdaPeaks: exPeaks.length, maxLogP: sortedDesc[0]!, sortedDesc, qq, band }
}

const cache = new Map<string, TraitResult>()

/** 형질 key 단위 캐시. nullOnly는 개발용 빈 상태 확인용 */
export function getTraitResult(key: TraitKey, opts: { nullOnly?: boolean } = {}): TraitResult {
  const ck = `${key}:${opts.nullOnly ? 'null' : 'full'}`
  let res = cache.get(ck)
  if (!res) {
    res = computeTrait(key, opts)
    cache.set(ck, res)
  }
  return res
}

/** 유의선 이상 SNP 수(내림차순 배열에서 이분 탐색) */
export function countAtLeast(sortedDesc: Float64Array, line: number): number {
  let lo = 0
  let hi = sortedDesc.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedDesc[mid]! >= line) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** λGC 판정 */
export function lambdaStatus(l: number): { tone: 'positive' | 'warning'; label: string } {
  const v = Math.round(l * 100) / 100
  if (v > 1.1) return { tone: 'warning', label: '구조 미보정 의심' }
  if (v < 0.95) return { tone: 'warning', label: '과보정 의심' }
  return { tone: 'positive', label: '정상' }
}

// ---------------------------------------------------------------------------
// DEV 검산(명세 수용 기준, 2026-10-26 정리 회차). 실제 데이터로 바꾸면 지운다.
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  const b = getTraitResult('blast')
  const shown = (Math.round(b.lambda * 100) / 100).toFixed(2)
  console.assert(Math.abs(b.lambda - 1.0595) < 1e-4, `[검산] 도열병 λGC(피크 ±1 Mb 제외) ${b.lambda.toFixed(4)} ≠ 1.0595`)
  console.assert(Math.abs(b.lambdaAll - 1.076) < 1e-4, `[검산] 도열병 전체 SNP λ ${b.lambdaAll.toFixed(4)} ≠ 1.0760`)
  console.assert(shown === '1.06' && lambdaStatus(b.lambda).label === '정상', `[검산] 도열병 λGC 표시 ${shown}·${lambdaStatus(b.lambda).label} (기대 1.06·정상)`)
  console.assert(b.lambdaAll.toFixed(2) === '1.08', `[검산] 도열병 툴팁 전체 SNP λ ${b.lambdaAll.toFixed(2)} ≠ 1.08`)
  console.assert(b.lambdaN === 35818, `[검산] 도열병 λ 계산 SNP 수 ${b.lambdaN} ≠ 35,818`)
  // 정리 회차 3: 심은 피크 MAF = 리드 실현 빈도(소수 2자리), β 재계산 → PVE ≈ MAF(1−MAF)β²/σP² ±0.5%p
  for (const p of PLANTED) {
    const t = TRAITS.find(x => x.key === p.trait)!
    const calc = (p.maf * (1 - p.maf) * p.beta * p.beta) / (t.sdP * t.sdP)
    console.assert(Math.abs(calc - p.pve) <= 0.005, `[검산] ${p.id} PVE ${p.pve} vs MAF·β 계산 ${calc.toFixed(4)}(±0.005)`)
  }
}
