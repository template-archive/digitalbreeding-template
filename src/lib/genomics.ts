/**
 * 유전체·육종 목업 데이터 생성기. 출발점일 뿐이며 템플릿 특유의 데이터는 각 템플릿의 data.ts에서 만든다.
 * 염색체 길이는 공개 참조 유전체의 근사값(Mb)이다.
 */
import type { Rng } from './rng'

export interface Chromosome {
  id: string
  lengthMb: number
}

const chrs = (lengths: number[], prefix = 'Chr'): Chromosome[] =>
  lengths.map((lengthMb, i) => ({ id: `${prefix}${String(i + 1).padStart(2, '0')}`, lengthMb }))

export const ORGANISMS: Record<string, { name: string; chromosomes: Chromosome[] }> = {
  rice: { name: '벼', chromosomes: chrs([43.3, 35.9, 36.4, 35.5, 29.9, 31.2, 29.7, 28.4, 23.0, 23.2, 29.0, 27.5]) },
  maize: { name: '옥수수', chromosomes: chrs([308, 244, 235, 247, 223, 174, 182, 181, 159, 150]) },
  soybean: {
    name: '콩',
    chromosomes: chrs([56.8, 49.0, 45.8, 52.4, 42.2, 51.4, 44.6, 47.8, 50.2, 51.6, 34.8, 40.1, 45.9, 49.0, 51.8, 37.9, 41.6, 58.0, 50.7, 47.9]),
  },
  pepper: { name: '고추', chromosomes: chrs([272, 171, 257, 222, 233, 236, 231, 145, 252, 233, 260, 235]) },
  hanwoo: {
    name: '한우',
    chromosomes: chrs(
      [158, 137, 121, 120, 121, 119, 112, 113, 105, 103, 107, 91, 84, 84, 85, 81, 73, 66, 64, 72, 71, 61, 52, 62, 43, 52, 45, 46, 51],
      'BTA',
    ),
  },
}

// ---- 통계 보조 ----

/** 표준정규 누적분포 Φ(x) (Abramowitz–Stegun 7.1.26, 절대 오차 < 1.5×10⁻⁷) */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp((-x * x) / 2)
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

/** 표준정규 분위수 Φ⁻¹(p) (Acklam, 상대 오차 < 1.15×10⁻⁹). p ≤ 0이면 −∞, p ≥ 1이면 +∞ */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  const hi = 1 - lo
  let q: number
  let r: number
  if (p < lo) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  if (p <= hi) {
    q = p - 0.5
    r = q * q
    return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
}

/** 표준정규 밀도 φ(x) */
export function normPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
}

/**
 * 정규 상측 꼬리 확률 1 − Φ(x), x ≥ 0.
 * normCdf와 같은 근사식이지만 1에서 빼지 않고 계산해 x가 클 때 자릿수 손실이 없다.
 */
export function normUpperTail(x: number): number {
  const t = 1 / (1 + (0.3275911 * x) / Math.SQRT2)
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return 0.5 * poly * Math.exp((-x * x) / 2)
}

const LN10 = Math.log(10)

/** 큰 |z|(≥ 4)용 양측 p의 점근 근사: ln p */
function lnTwoSidedTail(z: number): number {
  return (-z * z) / 2 - 0.2258 - Math.log(z) + Math.log(1 - 1 / (z * z) + 3 / z ** 4)
}

/**
 * 양측 검정 z → −log10(p).
 * |z| < 4는 normUpperTail, 그 이상은 점근 꼬리식을 써서 p가 1e-300보다 작아도 유한한 값을 낸다.
 */
export function logPFromZ(z: number): number {
  const a = Math.abs(z)
  if (a < 4) return -Math.log10(2 * normUpperTail(a))
  return -lnTwoSidedTail(a) / LN10
}

/**
 * −log10(p) → 자유도 1 카이제곱 통계량 χ²(= z²).
 * logPFromZ의 꼬리식을 z ∈ [0.5, 15]에서 이분법(40회)으로 푼다. 목업 피크 SNP의 χ²를 만드는 용도(−log10 p ≳ 3).
 */
export function chi2FromLogP(logP: number): number {
  let lo = 0.5
  let hi = 15
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (-lnTwoSidedTail(mid) / LN10 < logP) lo = mid
    else hi = mid
  }
  const z = (lo + hi) / 2
  return z * z
}

/** χ²(1)의 중앙값. λGC의 분모 */
export const CHI2_1DF_MEDIAN = 0.4549

/**
 * 게놈 팽창 계수 λGC를 −log10(p) 배열의 중앙값으로 계산한다: λ = [Φ⁻¹(1 − p중앙/2)]² / 0.4549.
 * 원래 배열은 바꾸지 않는다. 길이가 짝수면 가운데 두 값의 평균을 중앙값으로 쓴다. 빈 배열이면 NaN.
 */
export function lambdaGC(logP: ArrayLike<number>): number {
  const n = logP.length
  if (!n) return Number.NaN
  const sorted = Float64Array.from(logP).sort()
  const med = n % 2 ? sorted[n >> 1]! : (sorted[(n >> 1) - 1]! + sorted[n >> 1]!) / 2
  const pMed = 10 ** -med
  return normInv(1 - pMed / 2) ** 2 / CHI2_1DF_MEDIAN
}

// ---- GWAS ----

export interface GwasSnp {
  id: string
  chr: string
  posMb: number
  /** 맨해튼 x축용 누적 위치(Mb, 염색체 사이 간격 포함) */
  cumPos: number
  logP: number
  maf: number
}

export interface GwasResult {
  snps: GwasSnp[]
  chrOffsets: { chr: string; start: number; end: number; mid: number }[]
  /** 게놈 팽창 계수 λGC (중앙값 χ² / 0.4549) */
  lambda: number
}

export function simulateGwas(
  rng: Rng,
  opts: {
    organism?: string
    snpCount?: number
    peaks?: { chr: string; posMb: number; logP: number }[]
    ldDecayKb?: number
  } = {},
): GwasResult {
  const org = ORGANISMS[opts.organism ?? 'rice'] ?? ORGANISMS.rice!
  const snpCount = opts.snpCount ?? 20000
  const ldMb = (opts.ldDecayKb ?? 200) / 1000
  const totalLen = org.chromosomes.reduce((s, c) => s + c.lengthMb, 0)
  const gap = totalLen * 0.01
  const inflation = 1 + rng.next() * 0.05 // 약한 집단 구조로 인한 팽창

  const peaks = opts.peaks ?? [
    { chr: org.chromosomes[0]!.id, posMb: org.chromosomes[0]!.lengthMb * 0.62, logP: 11.5 },
    { chr: org.chromosomes[Math.min(5, org.chromosomes.length - 1)]!.id, posMb: org.chromosomes[Math.min(5, org.chromosomes.length - 1)]!.lengthMb * 0.3, logP: 8.6 },
    { chr: org.chromosomes[Math.min(8, org.chromosomes.length - 1)]!.id, posMb: org.chromosomes[Math.min(8, org.chromosomes.length - 1)]!.lengthMb * 0.78, logP: 7.1 },
  ]

  const snps: GwasSnp[] = []
  const chrOffsets: GwasResult['chrOffsets'] = []
  const chisq: number[] = []
  let offset = 0
  for (const chr of org.chromosomes) {
    const n = Math.max(1, Math.round((snpCount * chr.lengthMb) / totalLen))
    const positions = Array.from({ length: n }, () => rng.next() * chr.lengthMb).sort((a, b) => a - b)
    const chrPeaks = peaks.filter(p => p.chr === chr.id)
    for (const posMb of positions) {
      const z = rng.normal(0, Math.sqrt(inflation))
      const p = 2 * (1 - normCdf(Math.abs(z)))
      let logP = -Math.log10(Math.max(p, 1e-300))
      chisq.push(z * z)
      for (const pk of chrPeaks) {
        const dist = Math.abs(posMb - pk.posMb)
        const signal = pk.logP * Math.exp(-dist / ldMb) * (0.75 + 0.25 * rng.next())
        if (signal > logP) logP = signal
      }
      const maf = Math.min(0.5, Math.max(0.05, rng.beta(0.9, 2.2) * 0.5 + 0.03))
      snps.push({
        id: `S${chr.id.replace(/\D/g, '')}_${Math.round(posMb * 1e6)}`,
        chr: chr.id,
        posMb: Number(posMb.toFixed(4)),
        cumPos: Number((offset + posMb).toFixed(4)),
        logP: Number(logP.toFixed(3)),
        maf: Number(maf.toFixed(3)),
      })
    }
    chrOffsets.push({ chr: chr.id, start: offset, end: offset + chr.lengthMb, mid: offset + chr.lengthMb / 2 })
    offset += chr.lengthMb + gap
  }
  chisq.sort((a, b) => a - b)
  const median = chisq[Math.floor(chisq.length / 2)] ?? 0.4549
  return { snps, chrOffsets, lambda: Number((median / 0.4549).toFixed(3)) }
}

// ---- GEBV ----

export interface GebvRecord {
  id: string
  traits: Record<string, { gebv: number; reliability: number; pheno?: number }>
}

/**
 * 개체별 유전체 추정 육종가(GEBV). gebv는 형질 단위의 편차(평균 0 기준),
 * pheno는 표현형 관측값(평균 포함). 정확도 r = corr(GEBV, TBV), 신뢰도 ≈ r².
 */
export function simulateGebv(
  rng: Rng,
  opts: { n: number; traits: { key: string; h2: number; mean: number; sd: number }[]; accuracy?: number },
): GebvRecord[] {
  const baseAcc = opts.accuracy ?? 0.7
  const year = 2024
  return Array.from({ length: opts.n }, () => {
    const traits: GebvRecord['traits'] = {}
    for (const t of opts.traits) {
      const sdG = Math.sqrt(t.h2) * t.sd
      const sdE = Math.sqrt(1 - t.h2) * t.sd
      const acc = Math.min(0.97, Math.max(0.2, baseAcc + rng.normal(0, 0.06)))
      const g = rng.normal(0, sdG)
      const gebv = acc * acc * g + acc * Math.sqrt(1 - acc * acc) * sdG * rng.normal()
      const observed = rng.next() < 0.85
      traits[t.key] = {
        gebv: Number(gebv.toFixed(3)),
        reliability: Number(Math.min(0.99, acc * acc).toFixed(3)),
        ...(observed ? { pheno: Number((t.mean + g + rng.normal(0, sdE)).toFixed(2)) } : {}),
      }
    }
    return { id: lineName(rng, 'YR', year), traits }
  })
}

/** 계통명. lineName(rng, 'YR', 2024) → "YR24-0153" */
export function lineName(rng: Rng, prefix = 'YR', year = 2024): string {
  return `${prefix}${String(year % 100).padStart(2, '0')}-${String(rng.int(1, 9999)).padStart(4, '0')}`
}

/** 절단 선발 강도 i = φ(x)/p, p = 선발 비율(0~1) */
export function selectionIntensity(p: number): number {
  if (!(p > 0 && p < 1)) return p >= 1 ? 0 : Infinity
  const x = normInv(1 - p)
  return normPdf(x) / p
}

// ---------------- 근연 등급(program-baseline 근연 표기) ----------------

/** 공조계수 f가 이 값 이상이면 "강한 근연"(자손 분리 분산이 작음) */
export const KIN_WARN = 0.375
/** 공조계수 f가 이 값 이상(KIN_WARN 미만)이면 "근연 주의" */
export const KIN_CAUTION = 0.25
/** 근연 등급: warn = 강한 근연, caution = 근연 주의, ok = 정상 */
export type KinLevel = 'warn' | 'caution' | 'ok'
/** 공조계수 f → 근연 등급(f ≥ 0.375 강한 근연, 0.25 ≤ f < 0.375 근연 주의, 그 밖 정상) */
export const kinLevel = (f: number): KinLevel => (f >= KIN_WARN ? 'warn' : f >= KIN_CAUTION ? 'caution' : 'ok')
export const KIN_LEVEL_LABEL: Record<KinLevel, string> = { warn: '강한 근연', caution: '근연 주의', ok: '정상' }

/* ───────── 벼 KASP 16마커 패널 — 2026-10-30 승격(crossing-record·variety-application-brief·variety-identity-markers) ───────── */

/**
 * 분석실 KASP 16마커 패널 순서(기능 11 + 식별 5). 유전형 배열 인덱스가 이 순서를 따른다(0 = AA, 2 = BB).
 * 방향 정의는 breeding-metrics program-baseline 「KASP 대립유전자 방향」 행과 같다.
 */
export const KASP_MARKERS = ['Pi9', 'Pi-ta', 'Pib', 'Pigm', 'Xa21', 'xa5', 'Bph18', 'Wx', 'Hd1', 'sd1', 'GS3', 'ID02', 'ID04', 'ID07', 'ID09', 'ID11'] as const
export type KaspMarker = (typeof KASP_MARKERS)[number]
/** 마커별 형질 설명(기능 마커는 BB 쪽 효과, ID 마커는 '식별(중립)') */
export const KASP_KIND: Record<KaspMarker, string> = {
  Pi9: '도열병',
  'Pi-ta': '도열병',
  Pib: '도열병',
  Pigm: '도열병',
  Xa21: '흰잎마름병',
  xa5: '흰잎마름병',
  Bph18: '벼멸구',
  Wx: '저아밀로스',
  Hd1: '출수 지연형',
  sd1: '반왜성',
  GS3: '천립중 증가형',
  ID02: '식별(중립)',
  ID04: '식별(중립)',
  ID07: '식별(중립)',
  ID09: '식별(중립)',
  ID11: '식별(중립)',
}
/** KASP 표 범례에 쓰는 대립유전자 방향 문구 */
export const KASP_ALLELE_DIRECTION_NOTE =
  '기능 마커 BB = 효과 대립유전자(저항성·저아밀로스·출수 지연형·반왜성·천립중 증가형) · ID 마커(품종 식별용) BB = 대체 대립유전자'
/** 식별용 중립 마커(ID02~ID11)인가 */
export const isKaspIdMarker = (m: string): boolean => m.startsWith('ID')
