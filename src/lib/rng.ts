/**
 * 시드 기반 난수 생성기(mulberry32). 목업 데이터는 반드시 이것으로 만든다.
 * 같은 시드 → 같은 데이터 → 스크린샷 비교 가능.
 */
export interface Rng {
  /** [0, 1) 균등 */
  next(): number
  /** [min, max] 정수(양끝 포함) */
  int(min: number, max: number): number
  /** 정규분포 N(mean, sd²) */
  normal(mean?: number, sd?: number): number
  /** 베타분포 Beta(a, b) */
  beta(a: number, b: number): number
  pick<T>(arr: readonly T[]): T
  /** 새 배열을 섞어 반환(원본 불변) */
  shuffle<T>(arr: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9
  let spare: number | null = null

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const normal = (mean = 0, sd = 1): number => {
    if (spare !== null) {
      const v = spare
      spare = null
      return mean + sd * v
    }
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return mean + sd * r * Math.cos(2 * Math.PI * v)
  }

  // Marsaglia–Tsang 감마 표본
  const gamma = (k: number): number => {
    if (k < 1) return gamma(k + 1) * Math.pow(next() || Number.MIN_VALUE, 1 / k)
    const d = k - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    for (;;) {
      let x: number
      let v: number
      do {
        x = normal()
        v = 1 + c * x
      } while (v <= 0)
      v = v * v * v
      const u = next()
      if (u < 1 - 0.0331 * x * x * x * x) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }

  return {
    next,
    int(min, max) {
      const lo = Math.ceil(Math.min(min, max))
      const hi = Math.floor(Math.max(min, max))
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    normal,
    beta(a, b) {
      const x = gamma(a)
      const y = gamma(b)
      return x / (x + y)
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('pick: 빈 배열')
      return arr[Math.floor(next() * arr.length)] as (typeof arr)[number]
    },
    shuffle(arr) {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = out[i] as (typeof out)[number]
        out[i] = out[j] as (typeof out)[number]
        out[j] = tmp
      }
      return out
    },
  }
}
