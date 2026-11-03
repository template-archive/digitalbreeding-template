/**
 * 통계 보조 함수(@/lib/stats) — 템플릿 간 공통.
 * 상관·단순 회귀·t/F 분포 꼬리 확률. 결과는 승격 전 템플릿 로컬 구현과 비트 단위로 같다
 * (합산 순서·연산 형태를 바꾸지 말 것: 템플릿 DEV 검산이 이 값을 고정값과 비교한다).
 */

/** 산술 평균(앞에서부터 차례로 더한다) */
function mean(xs: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i]!
  return s / xs.length
}

/**
 * 피어슨 상관 계수(두 단계 계산: 평균 → 편차 곱 합).
 * 한쪽 분산이 0이면 NaN(0/0)을 돌려준다. 0으로 바꿀지는 호출부가 정한다.
 */
export function pearson(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxy / Math.sqrt(sxx * syy)
}

/** 최소제곱 단순 회귀 y = intercept + slope·x */
export function linearFit(xs: ArrayLike<number>, ys: ArrayLike<number>): { slope: number; intercept: number } {
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx
    sxy += dx * (ys[i]! - my)
    sxx += dx * dx
  }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

/** ln Γ(x), x > 0 (Lanczos 근사, Numerical Recipes gammln) */
export function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const cj of c) ser += cj / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** 불완전 베타 연분수(Numerical Recipes betacf, 최대 300회, 수렴 3e-14) */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-14) break
  }
  return h
}

/** 정규화 불완전 베타 I_x(a, b). x ≤ 0 → 0, x ≥ 1 → 1 */
export function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** t 분포 양측 p = P(|T| ≥ |t|), 자유도 df */
export const tTwoSided = (t: number, df: number): number => ibeta(df / 2, 0.5, df / (df + t * t))

/* ───────── 이항 분포(순도·균일성 수용 판정) — 2026-10-30 승격(variety-application-brief·variety-identity-markers) ───────── */

/** 누적 이항 확률 P(X ≤ k | n, p). 첫 항 (1 − p)^n에서 점화식으로 더한다(합산 순서 고정, 승격 전 로컬 구현과 비트 단위로 같음) */
export function binomCdf(k: number, n: number, p: number): number {
  let term = Math.pow(1 - p, n)
  let sum = term
  for (let i = 0; i < k; i++) {
    term *= ((n - i) / (i + 1)) * (p / (1 - p))
    sum += term
  }
  return sum
}

/**
 * 이항 수용 허용 수: P(X ≤ k | n, p) ≥ acceptProb인 최소 k.
 * UPOV TG/16/9(계통 품종 모집단 기준 0.1%, 수용 확률 95%)의 이형주·이형립 허용 수. 예: `binomAcceptMax(400, 0.001, 0.95) === 2`
 */
export function binomAcceptMax(n: number, p: number, acceptProb: number): number {
  let k = 0
  while (binomCdf(k, n, p) < acceptProb) k++
  return k
}

/**
 * 단측 Clopper–Pearson 상한 p_U: P(X ≤ x | n, p_U) = alpha (기본 0.05 → 95% 상한). 이분법 100회.
 * 이형률 상한이다. 순도 하한은 `1 − clopperPearsonUpper(x, n)`.
 */
export function clopperPearsonUpper(x: number, n: number, alpha = 0.05): number {
  let lo = 0
  let hi = 1
  for (let it = 0; it < 100; it++) {
    const mid = (lo + hi) / 2
    if (binomCdf(x, n, mid) > alpha) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
