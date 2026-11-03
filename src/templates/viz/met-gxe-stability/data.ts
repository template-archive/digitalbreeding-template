/**
 * 다환경 시험(MET) GxE·안정성 — 목업 데이터와 분석.
 * 실제 서비스에서는 이 파일만 교체한다(시험구 값 PLOTS를 API에서 받으면 나머지 분석은 그대로 쓸 수 있다).
 * 생성 규칙·검산: docs/specs/met-gxe-stability.md
 */
import { MET_ZONE_BY_KEY, MET_ZONES, type MetZoneKey } from '@/charts'
import { createRng } from '@/lib/rng'
import { ibeta, tTwoSided } from '@/lib/stats'

export const SEED = 20261023
export const MU = 560
export const YEARS = [2025, 2026] as const
const YEAR_EFF = [8, -8] as const
const CHECK_YEAR_MEAN = [568, 552] as const
export const REPS = 3
const SD = { siteYear: 22, rep: 8, gs: 4, gst: 7, err: 28 } as const

export const ANALYSIS = {
  title: '지역 적응 시험(MET)',
  crop: '벼',
  trait: '쌀 수량',
  unit: 'kg/10a',
  basis: '백미',
  design: '난괴법',
  analyzedAt: '2026-10-23',
} as const

/** baseline `PLANNED_APPLICATION`(program-overview와 같은 값) */
export const PLANNED_APPLICATION = { line: 'YR19-0118', year: 2026, month: 12 } as const

// ---------------- 지역·유전자형 ----------------

/** 권역(메가 환경) 라벨·순서는 MET 공통 정의(@/charts `MET_ZONES`)를 쓴다 */
export type ZoneKey = MetZoneKey
export const ZONES = MET_ZONES
export const ZONE_BY_KEY = MET_ZONE_BY_KEY

export interface Site {
  name: string
  short: string
  zone: ZoneKey
  /** 지역 주효과 */
  E: number
  /** 남부 축 */
  A: number
  /** 냉량 축 */
  B: number
}

export const SITES: Site[] = [
  { name: '경기 화성', short: '화성', zone: 'central', E: 24, A: -0.4, B: -0.2 },
  { name: '경기 이천', short: '이천', zone: 'central', E: 8, A: -0.4, B: 0 },
  { name: '충남 당진', short: '당진', zone: 'central', E: 32, A: -0.4, B: -0.3 },
  { name: '충남 예산', short: '예산', zone: 'central', E: 16, A: -0.4, B: -0.2 },
  { name: '충북 청주', short: '청주', zone: 'central', E: 0, A: -0.4, B: 0.1 },
  { name: '전북 김제', short: '김제', zone: 'south', E: 16, A: 1.2, B: -0.4 },
  { name: '경남 밀양', short: '밀양', zone: 'south', E: -32, A: 1.4, B: -0.5 },
  { name: '강원 철원', short: '철원', zone: 'north', E: -64, A: -0.6, B: 1.5 },
]

export type Role = 'check' | 'cand' | 'line'

interface GenotypeDef {
  id: string
  name: string | null
  role: Role
  /** 대비 품종 구분 */
  checkKind?: '표준' | '다수성'
  g: number
  a: number
  c: number
  d: number
}

const GENOTYPE_DEFS: GenotypeDef[] = [
  { id: 'YR07-0231', name: '가람솔', role: 'check', checkKind: '표준', g: 0, a: 0, c: 0, d: 0 },
  { id: 'YR13-0819', name: '온새미로', role: 'check', checkKind: '다수성', g: 14, a: -4, c: -6, d: 0.08 },
  { id: 'YR19-0118', name: null, role: 'cand', g: 40, a: -2, c: 2, d: 0 },
  { id: 'YR20-0342', name: null, role: 'cand', g: 30, a: 36, c: -6, d: 0.05 },
  { id: 'YR20-0527', name: null, role: 'cand', g: 25, a: -6, c: 22, d: -0.12 },
  { id: 'YR20-0815', name: null, role: 'line', g: 18, a: -15, c: -10, d: 0.3 },
  { id: 'YR19-0256', name: null, role: 'line', g: 8, a: 6, c: -4, d: 0.1 },
  { id: 'YR19-0477', name: null, role: 'line', g: -6, a: -8, c: 8, d: -0.1 },
  { id: 'YR19-0902', name: null, role: 'line', g: 8, a: 4, c: -12, d: 0.18 },
  { id: 'YR20-0163', name: null, role: 'line', g: 4, a: 10, c: 3, d: 0.05 },
  { id: 'YR20-0691', name: null, role: 'line', g: -12, a: -3, c: 10, d: -0.15 },
  { id: 'YR20-1024', name: null, role: 'line', g: 0, a: -10, c: 6, d: 0 },
  { id: 'YR20-1236', name: null, role: 'line', g: 12, a: 8, c: -14, d: 0.2 },
  { id: 'YR21-0108', name: null, role: 'line', g: -2, a: 3, c: -6, d: 0.12 },
  { id: 'YR21-0335', name: null, role: 'line', g: 9, a: -6, c: -3, d: -0.05 },
  { id: 'YR21-0419', name: null, role: 'line', g: -16, a: 5, c: 4, d: -0.18 },
  { id: 'YR21-0652', name: null, role: 'line', g: 4, a: 12, c: -10, d: 0.15 },
  { id: 'YR21-0786', name: null, role: 'line', g: 0, a: -5, c: 12, d: -0.08 },
  { id: 'YR21-0943', name: null, role: 'line', g: 10, a: -2, c: 5, d: 0.02 },
  { id: 'YR21-1150', name: null, role: 'line', g: -8, a: 7, c: -8, d: 0.1 },
]

/** 비교용 "평균은 높지만 불안정한 계통" */
export const UNSTABLE_REF = 'YR20-0815'
export const CHECK_ID = 'YR07-0231'
export const DEFAULT_SELECTED = 'YR19-0118'

export const N_G = GENOTYPE_DEFS.length
export const N_S = SITES.length
export const N_Y = YEARS.length
export const N_E = N_S * N_Y
export const N_TEST = GENOTYPE_DEFS.filter(g => g.role !== 'check').length
export const N_CHECK = N_G - N_TEST
export const N_PLOTS = N_G * N_E * REPS

// ---------------- 생성 ----------------

const mean = (a: readonly number[]) => a.reduce((x, y) => x + y, 0) / a.length
const center = (a: number[]) => {
  const m = mean(a)
  return a.map(x => x - m)
}
const r1 = (x: number) => Math.round(x * 10) / 10
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const rng = createRng(SEED)
// 1) 지역×연도 효과
const sy = YEARS.map(() => center(SITES.map(() => rng.normal(0, SD.siteYear))))
// 2) 반복(블록) 효과
const repEff = YEARS.map(() => SITES.map(() => center(range(REPS).map(() => rng.normal(0, SD.rep)))))
// 3) G×L 잡음
const gsN = GENOTYPE_DEFS.map(() => center(SITES.map(() => rng.normal(0, SD.gs))))
// 4) G×L×Y 잡음
const gstN = GENOTYPE_DEFS.map(() => YEARS.map(() => center(SITES.map(() => rng.normal(0, SD.gst)))))
// 5) 시험구 값 [i][t][j][r]
const rawPlots: number[][][][] = GENOTYPE_DEFS.map((g, i) =>
  YEARS.map((_, t) =>
    SITES.map((s, j) =>
      range(REPS).map(
        r =>
          MU +
          g.g +
          s.E +
          YEAR_EFF[t]! +
          sy[t]![j]! +
          repEff[t]![j]![r]! +
          g.a * s.A +
          g.c * s.B +
          g.d * s.E +
          gsN[i]![j]! +
          gstN[i]![t]![j]! +
          rng.normal(0, SD.err),
      ),
    ),
  ),
)
// 6) 가람솔 연도 보정 → 7) 소수 1자리 반올림
for (let t = 0; t < N_Y; t++) {
  const shift = CHECK_YEAR_MEAN[t]! - mean(rawPlots[0]![t]!.flat())
  rawPlots[0]![t] = rawPlots[0]![t]!.map(rs => rs.map(x => x + shift))
}
/** 시험구 값(kg/10a) [유전자형][연도][지역][반복] */
export const PLOTS: number[][][][] = rawPlots.map(gp => gp.map(yp => yp.map(sp => sp.map(r1))))

// ---------------- 셀 평균·환경 ----------------

/** 셀 평균 [i][e], e = t·8 + j */
export const CELL: number[][] = PLOTS.map(gp => {
  const row: number[] = []
  for (let t = 0; t < N_Y; t++) for (let j = 0; j < N_S; j++) row.push(mean(gp[t]![j]!))
  return row
})
const gMean = CELL.map(mean)
const eMean = range(N_E).map(e => mean(CELL.map(r => r[e]!)))
export const GRAND_MEAN = mean(gMean)
const allPlots = PLOTS.flat(3)
const plotMean = mean(allPlots)

export interface Env {
  e: number
  t: number
  j: number
  year: number
  site: Site
  label: string
  mean: number
  /** 환경 지수 I = ȳ.e − ȳ.. */
  index: number
  /** 셀 평균 1위 유전자형 */
  topId: string
}
export const ENVS: Env[] = range(N_E).map(e => {
  const t = Math.floor(e / N_S)
  const j = e % N_S
  const col = CELL.map(r => r[e]!)
  const top = col.indexOf(Math.max(...col))
  return {
    e,
    t,
    j,
    year: YEARS[t]!,
    site: SITES[j]!,
    label: `${SITES[j]!.name} ${YEARS[t]}`,
    mean: eMean[e]!,
    index: eMean[e]! - GRAND_MEAN,
    topId: GENOTYPE_DEFS[top]!.id,
  }
})
/** 지역별 연도 실측 1위 [지역][연도] */
export const SITE_YEAR_TOP_IDS: string[][] = SITES.map((_, j) => YEARS.map((_, t) => ENVS[t * N_S + j]!.topId))
export const ENV_INDEX_RANGE: [number, number] = [Math.min(...ENVS.map(e => e.index)), Math.max(...ENVS.map(e => e.index))]
export const YEAR_MEANS = YEARS.map((_, t) => mean(eMean.slice(t * N_S, t * N_S + N_S)))

/** 2년 평균 지역 값 [i][j] */
export const SITE2: number[][] = CELL.map(row => SITES.map((_, j) => (row[j]! + row[N_S + j]!) / 2))
const siteMean = SITES.map((_, j) => (eMean[j]! + eMean[N_S + j]!) / 2)

// ---------------- 분산분석 ----------------

let ssTot = 0
for (const x of allPlots) ssTot += (x - plotMean) ** 2
const ssG = REPS * N_E * gMean.reduce((s, m) => s + (m - GRAND_MEAN) ** 2, 0)
const ssE = REPS * N_G * eMean.reduce((s, m) => s + (m - GRAND_MEAN) ** 2, 0)
let ssGE = 0
for (let i = 0; i < N_G; i++) for (let e = 0; e < N_E; e++) ssGE += REPS * (CELL[i]![e]! - gMean[i]! - eMean[e]! + GRAND_MEAN) ** 2
let ssRepE = 0
for (let t = 0; t < N_Y; t++)
  for (let j = 0; j < N_S; j++)
    for (let r = 0; r < REPS; r++) {
      const rm = mean(PLOTS.map(gp => gp[t]![j]![r]!))
      ssRepE += N_G * (rm - eMean[t * N_S + j]!) ** 2
    }
const ssErr = ssTot - ssG - ssE - ssGE - ssRepE
const ssL = REPS * N_G * N_Y * siteMean.reduce((s, m) => s + (m - GRAND_MEAN) ** 2, 0)
const ssY = REPS * N_G * N_S * YEAR_MEANS.reduce((s, m) => s + (m - GRAND_MEAN) ** 2, 0)
const ssLY = ssE - ssL - ssY
let ssGL = 0
let ssGY = 0
for (let i = 0; i < N_G; i++) {
  for (let j = 0; j < N_S; j++) ssGL += REPS * N_Y * (SITE2[i]![j]! - gMean[i]! - siteMean[j]! + GRAND_MEAN) ** 2
  for (let t = 0; t < N_Y; t++) {
    const gy = mean(CELL[i]!.slice(t * N_S, t * N_S + N_S))
    ssGY += REPS * N_S * (gy - gMean[i]! - YEAR_MEANS[t]! + GRAND_MEAN) ** 2
  }
}
const ssGLY = ssGE - ssGL - ssGY
const DF = {
  G: N_G - 1,
  E: N_E - 1,
  L: N_S - 1,
  Y: N_Y - 1,
  LY: (N_S - 1) * (N_Y - 1),
  RepE: N_E * (REPS - 1),
  GE: (N_G - 1) * (N_E - 1),
  GL: (N_G - 1) * (N_S - 1),
  GY: (N_G - 1) * (N_Y - 1),
  GLY: (N_G - 1) * (N_S - 1) * (N_Y - 1),
  Err: N_E * (N_G - 1) * (REPS - 1),
}
const msErr = ssErr / DF.Err
const msGE = ssGE / DF.GE

// F·t 분포 상측 확률: 정규화 불완전 베타(@/lib/stats ibeta·tTwoSided)
const fUpper = (F: number, d1: number, d2: number) => ibeta(d2 / 2, d1 / 2, d2 / (d2 + d1 * F))

export interface AnovaRow {
  key: string
  label: string
  sub?: boolean
  df: number
  ss: number
  ms: number
  F: number | null
  p: number | null
}
const anovaRow = (key: string, label: string, ss: number, df: number, sub = false, test = true): AnovaRow => ({
  key,
  label,
  sub,
  df,
  ss,
  ms: ss / df,
  F: test ? ss / df / msErr : null,
  p: test ? fUpper(ss / df / msErr, df, DF.Err) : null,
})
export const ANOVA: AnovaRow[] = [
  anovaRow('G', '유전자형(G)', ssG, DF.G),
  anovaRow('E', '환경(E)', ssE, DF.E),
  anovaRow('L', '지역(L)', ssL, DF.L, true),
  anovaRow('Y', '연도(Y)', ssY, DF.Y, true),
  anovaRow('LY', 'L×Y', ssLY, DF.LY, true),
  anovaRow('RepE', '반복(E 안)', ssRepE, DF.RepE),
  anovaRow('GE', 'G×E', ssGE, DF.GE),
  anovaRow('GL', 'G×L', ssGL, DF.GL, true),
  anovaRow('GY', 'G×Y', ssGY, DF.GY, true),
  anovaRow('GLY', 'G×L×Y', ssGLY, DF.GLY, true),
  anovaRow('Err', '오차', ssErr, DF.Err, false, false),
]

const sum3 = ssG + ssE + ssGE
/** 분산 분해 % (SS_G + SS_E + SS_GE 대비, 원 실행값) */
export const VAR_PCT = { G: (100 * ssG) / sum3, E: (100 * ssE) / sum3, GE: (100 * ssGE) / sum3 }
export const VAR_SUB_PCT = {
  L: (100 * ssL) / sum3,
  Y: (100 * ssY) / sum3,
  LY: (100 * ssLY) / sum3,
  GL: (100 * ssGL) / sum3,
  GY: (100 * ssGY) / sum3,
  GLY: (100 * ssGLY) / sum3,
}
export const GE_OVER_G = ssGE / ssG
export const CV = (100 * Math.sqrt(msErr)) / plotMean
/** t(0.975, df_GE) — 이분법 */
export const T975 = (() => {
  let lo = 1
  let hi = 3
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2
    if (tTwoSided(m, DF.GE) > 0.05) lo = m
    else hi = m
  }
  return (lo + hi) / 2
})()
/** LSD(5%), 2년·8지역 평균 비교 */
export const LSD = T975 * Math.sqrt((2 * msGE) / (N_E * REPS))
export const MS_GE = msGE
/** 환경을 임의 효과로 볼 때의 검정(각주용): G는 G×E 대비, E는 반복(E 안) 대비 */
export interface RandomEnvTest {
  key: 'G' | 'E'
  denomLabel: string
  F: number
  df1: number
  df2: number
  p: number
}
export const RANDOM_ENV_TESTS: RandomEnvTest[] = (
  [
    ['G', 'GE', 'G×E'],
    ['E', 'RepE', '반복(E 안)'],
  ] as const
).map(([key, den, denomLabel]) => {
  const n = ANOVA.find(r => r.key === key)!
  const d = ANOVA.find(r => r.key === den)!
  const F = n.ms / d.ms
  return { key, denomLabel, F, df1: n.df, df2: d.df, p: fUpper(F, n.df, d.df) }
})
export const DF_GE = DF.GE

// ---------------- SVD(Jacobi) ----------------

function jacobiEigen(Ain: number[][]): { values: number[]; vectors: number[][] } {
  const n = Ain.length
  const A = Ain.map(r => r.slice())
  const V: number[][] = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p]![q]! ** 2
    if (off < 1e-18) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p]![q]!) < 1e-300) continue
        const th = (A[q]![q]! - A[p]![p]!) / (2 * A[p]![q]!)
        const tt = (Math.sign(th) || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(tt * tt + 1)
        const s = tt * c
        for (let k = 0; k < n; k++) {
          const akp = A[k]![p]!
          const akq = A[k]![q]!
          A[k]![p] = c * akp - s * akq
          A[k]![q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p]![k]!
          const aqk = A[q]![k]!
          A[p]![k] = c * apk - s * aqk
          A[q]![k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k]![p]!
          const vkq = V[k]![q]!
          V[k]![p] = c * vkp - s * vkq
          V[k]![q] = s * vkp + c * vkq
        }
      }
  }
  const idx = range(n).sort((a, b) => A[b]![b]! - A[a]![a]!)
  return { values: idx.map(i => A[i]![i]!), vectors: idx.map(i => V.map(r => r[i]!)) }
}

/** X(n×m) → 특이값, V(열 벡터 목록), U(열 벡터 목록) — XᵀX 고윳값 분해 */
function svd(X: number[][]) {
  const n = X.length
  const m = X[0]!.length
  const XtX = range(m).map(a =>
    range(m).map(b => {
      let s = 0
      for (let i = 0; i < n; i++) s += X[i]![a]! * X[i]![b]!
      return s
    }),
  )
  const { values, vectors } = jacobiEigen(XtX)
  const sv = values.map(v => Math.sqrt(Math.max(v, 0)))
  const U = vectors.map((v, k) => X.map(row => row.reduce((s, x, j) => s + x * v[j]!, 0) / (sv[k] || 1)))
  return { sv, V: vectors, U }
}

// ---------------- GGE 바이플롯(2년 평균 지역 값, 환경 중심화·척도 없음·대칭 SVP) ----------------

export type Pt = [number, number]

const ggeRes = (() => {
  const cm = SITES.map((_, j) => mean(SITE2.map(r => r[j]!)))
  const X = SITE2.map(r => r.map((x, j) => x - cm[j]!))
  const { sv, V, U } = svd(X)
  const tot = sv.reduce((s, x) => s + x * x, 0)
  const s1 = Math.sign(V[0]!.reduce((a, b) => a + b, 0)) || 1
  const s2 = Math.sign(V[1]![SITES.findIndex(s => s.name === '강원 철원')]!) || 1
  const gsc: Pt[] = SITE2.map((_, i) => [s1 * U[0]![i]! * Math.sqrt(sv[0]!), s2 * U[1]![i]! * Math.sqrt(sv[1]!)])
  const esc: Pt[] = SITES.map((_, j) => [s1 * V[0]![j]! * Math.sqrt(sv[0]!), s2 * V[1]![j]! * Math.sqrt(sv[1]!)])
  // 볼록 껍질(monotone chain, 반시계)
  type P = { x: number; y: number; i: number }
  const pts: P[] = gsc.map((p, i) => ({ x: p[0], y: p[1], i })).sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: P[] = []
  const upper: P[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  for (const p of pts.slice().reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1)).map(p => p.i)
  const winnerOf = (dir: Pt) => {
    let best = -1
    let bv = -Infinity
    for (const h of hull) {
      const v = gsc[h]![0] * dir[0] + gsc[h]![1] * dir[1]
      if (v > bv) {
        bv = v
        best = h
      }
    }
    return best
  }
  return {
    pc: [(100 * sv[0]! ** 2) / tot, (100 * sv[1]! ** 2) / tot] as [number, number],
    gsc,
    esc,
    hull,
    siteWinner: esc.map(winnerOf),
    genoSector: gsc.map(winnerOf),
  }
})()

export const GGE_PC = ggeRes.pc
export const GGE_PC_SUM = GGE_PC[0] + GGE_PC[1]
/** 다각형 꼭짓점(반시계) 유전자형 id */
export const HULL_IDS = ggeRes.hull.map(i => GENOTYPE_DEFS[i]!.id)
export const SITE_SCORES: Pt[] = ggeRes.esc
export const SITE_WINNER_IDS = ggeRes.siteWinner.map(i => GENOTYPE_DEFS[i]!.id)

export interface MegaEnv {
  key: string
  /** 구역 승자(꼭짓점 유전자형) */
  winnerId: string
  label: string
  zone: ZoneKey
  sites: Site[]
  colorIndex: number
}
const megaWinners = [...new Set(ggeRes.siteWinner)]
export const MEGA_ENVS: MegaEnv[] = megaWinners.map(w => {
  const sites = SITES.filter((_, j) => ggeRes.siteWinner[j] === w)
  const zone = sites[0]!.zone
  const label = sites.length === 1 && zone === 'north' ? '중북부지(철원)' : ZONE_BY_KEY[zone].label
  return { key: GENOTYPE_DEFS[w]!.id, winnerId: GENOTYPE_DEFS[w]!.id, label, zone, sites, colorIndex: ZONES.findIndex(z => z.key === zone) }
})
export const MEGA_BY_WINNER = Object.fromEntries(MEGA_ENVS.map(m => [m.winnerId, m])) as Record<string, MegaEnv>

/** 메가 환경 근거: 그 지역들의 지역·연도 실측 1위 n(= 지역 수 × 연도 수)개 중 구역 승자가 1위인 횟수 k */
export const MEGA_EVIDENCE = MEGA_ENVS.map(m => {
  const tops = m.sites.flatMap(s => SITE_YEAR_TOP_IDS[SITES.indexOf(s)]!)
  return { mega: m, n: tops.length, k: tops.filter(id => id === m.winnerId).length }
})

// ---------------- 안정성: Finlay–Wilkinson, Wricke, AMMI ASV ----------------

const envIdx = ENVS.map(e => e.index)
const sII = envIdx.reduce((s, x) => s + x * x, 0)
const fw = CELL.map((row, i) => {
  const b = row.reduce((s, y, e) => s + (y - gMean[i]!) * envIdx[e]!, 0) / sII
  const ssRes = row.reduce((s, y, e) => s + (y - gMean[i]! - b * envIdx[e]!) ** 2, 0)
  const ssTotG = row.reduce((s, y) => s + (y - gMean[i]!) ** 2, 0)
  return { b, r2: 1 - ssRes / ssTotG, seB: Math.sqrt(ssRes / (N_E - 2) / sII) }
})
const W = CELL.map((row, i) => row.reduce((s, y, e) => s + (y - gMean[i]! - eMean[e]! + GRAND_MEAN) ** 2, 0))
export const W_SUM = W.reduce((a, b) => a + b, 0)
const wPct = W.map(w => (100 * w) / W_SUM)

const GEm = CELL.map((row, i) => row.map((y, e) => y - gMean[i]! - eMean[e]! + GRAND_MEAN))
const am = svd(GEm)
const amTot = am.sv.reduce((a, b) => a + b * b, 0)
export const IPCA_PCT: [number, number] = [(100 * am.sv[0]! ** 2) / amTot, (100 * am.sv[1]! ** 2) / amTot]
const ip = (k: number) => GEm.map((_, i) => am.U[k]![i]! * Math.sqrt(am.sv[k]!))
const ip1 = ip(0)
const ip2 = ip(1)
const ssRatio = am.sv[0]! ** 2 / am.sv[1]! ** 2
const asv = GENOTYPE_DEFS.map((_, i) => Math.sqrt((ssRatio * ip1[i]!) ** 2 + ip2[i]! ** 2))
export const ASV_MEAN = mean(asv)

// ---------------- 순위·지수 ----------------

/** 큰 값 = 1위 */
const rankDesc = (vals: number[]) => {
  const o = vals.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
  const r = Array<number>(vals.length)
  o.forEach(([, i], k) => (r[i] = k + 1))
  return r
}
const meanRank = rankDesc(gMean)
const wRank = rankDesc(wPct.map(x => -x))
const asvRank = rankDesc(asv.map(x => -x))
const siteRanks = SITES.map((_, j) => rankDesc(SITE2.map(r => r[j]!)))
export const SITE_TOP_IDS = siteRanks.map(r => GENOTYPE_DEFS[r.indexOf(1)]!.id)
const checkMean = gMean[0]!
const zoneMean = (i: number, z: ZoneKey) => mean(SITES.map((s, j) => (s.zone === z ? SITE2[i]![j]! : NaN)).filter(v => !Number.isNaN(v)))

export const W_RULE = 100 / N_G
export const INDEX_RULE = 103

export interface Genotype extends GenotypeDef {
  label: string
  mean: number
  index: number
  rank: number
  yearMeans: number[]
  site2: number[]
  siteRanks: number[]
  /** 지역 2년 평균 − 가람솔 */
  siteDiff: number[]
  zoneIndex: Record<ZoneKey, number>
  b: number
  seB: number
  r2: number
  wPct: number
  wRank: number
  asv: number
  asvRank: number
  gge: Pt
  /** 바이플롯에서 이 점이 놓인 구역의 꼭짓점 유전자형 */
  sectorId: string
  isVertex: boolean
  /** 메가 환경 승자이면 그 메가 환경 */
  mega: MegaEnv | null
  topCount: number
  diffVsCheck: number
  overLsd: boolean
  verdict: 'check' | 'pass' | 'indexOnly' | 'fail'
}

export const GENOTYPES: Genotype[] = GENOTYPE_DEFS.map((g, i) => {
  const mega = MEGA_BY_WINNER[g.id] ?? null
  const index = (100 * gMean[i]!) / checkMean
  const passIndex = index >= INDEX_RULE
  const passStab = wPct[i]! <= W_RULE || mega !== null
  const verdict: Genotype['verdict'] = g.role === 'check' ? 'check' : passIndex && passStab ? 'pass' : passIndex ? 'indexOnly' : 'fail'
  const diff = gMean[i]! - checkMean
  return {
    ...g,
    label: g.name ? `${g.id} ${g.name}` : g.id,
    mean: gMean[i]!,
    index,
    rank: meanRank[i]!,
    yearMeans: YEARS.map((_, t) => mean(CELL[i]!.slice(t * N_S, t * N_S + N_S))),
    site2: SITE2[i]!,
    siteRanks: siteRanks.map(r => r[i]!),
    siteDiff: SITE2[i]!.map((v, j) => v - SITE2[0]![j]!),
    zoneIndex: Object.fromEntries(ZONES.map(z => [z.key, (100 * zoneMean(i, z.key)) / zoneMean(0, z.key)])) as Record<ZoneKey, number>,
    b: fw[i]!.b,
    seB: fw[i]!.seB,
    r2: fw[i]!.r2,
    wPct: wPct[i]!,
    wRank: wRank[i]!,
    asv: asv[i]!,
    asvRank: asvRank[i]!,
    gge: ggeRes.gsc[i]!,
    sectorId: GENOTYPE_DEFS[ggeRes.genoSector[i]!]!.id,
    isVertex: ggeRes.hull.includes(i),
    mega,
    topCount: ENVS.filter(e => e.topId === g.id).length,
    diffVsCheck: diff,
    overLsd: diff > LSD,
    verdict,
  }
})
export const GENO_BY_ID = Object.fromEntries(GENOTYPES.map(g => [g.id, g])) as Record<string, Genotype>
export const CHECK = GENO_BY_ID[CHECK_ID]!
export const PASSED = GENOTYPES.filter(g => g.verdict === 'pass')
export const INDEX_ONLY = GENOTYPES.filter(g => g.verdict === 'indexOnly')
/** 지수 기준을 넘은 시험 계통(규칙 박스 대상) */
export const RULE_TARGETS = GENOTYPES.filter(g => g.verdict === 'pass' || g.verdict === 'indexOnly').sort((a, b) => b.index - a.index)
export const CELL_RANGE: [number, number] = [Math.min(...CELL.flat()), Math.max(...CELL.flat())]
export const ENV_MEAN_RANGE: [number, number] = [Math.min(...eMean), Math.max(...eMean)]

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const fx = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
  console.assert(fx(CHECK.mean, 1) === 560 && fx(CHECK.yearMeans[0]!, 1) === 568 && fx(CHECK.yearMeans[1]!, 1) === 552, `[검산] 가람솔 2년/연도 평균 ${CHECK.mean}/${CHECK.yearMeans.join('/')} ≠ 560.0/568.0/552.0`)
  const bMean = mean(GENOTYPES.map(g => g.b))
  console.assert(Math.abs(bMean - 1) < 1e-9, `[검산] b 평균 ${bMean} ≠ 1.000`)
  console.assert(Math.abs(W_SUM - ssGE / REPS) < 1e-6, `[검산] ΣW ${W_SUM} ≠ SS_GE/3 ${ssGE / REPS}`)
  console.assert(fx(GGE_PC[0], 1) === 42.1 && fx(GGE_PC[1], 1) === 27.9 && fx(GGE_PC_SUM, 1) === 70, `[검산] GGE PC ${GGE_PC.join('/')} (합 ${GGE_PC_SUM}) ≠ 42.1/27.9/70.0`)
  console.assert(MEGA_ENVS.length === 3, `[검산] 메가 환경 ${MEGA_ENVS.length}개 ≠ 3`)
  const passIds = PASSED.map(g => g.id).sort().join(',')
  console.assert(passIds === 'YR19-0118,YR20-0342,YR20-0527', `[검산] 후보 판정 통과 ${passIds} ≠ YR19-0118,YR20-0342,YR20-0527`)
  const hullExp = 'YR21-0419,YR19-0477,YR21-1150,YR20-1236,YR20-0342,YR19-0118,YR20-0527'
  console.assert(HULL_IDS.join(',') === hullExp, `[검산] 다각형 꼭짓점 ${HULL_IDS.join(',')} ≠ ${hullExp}`)
  console.assert(
    fx(VAR_PCT.G, 1) === 8.8 && fx(VAR_PCT.E, 1) === 68.6 && fx(VAR_PCT.GE, 1) === 22.7,
    `[검산] 분산 분해 ${VAR_PCT.G}/${VAR_PCT.E}/${VAR_PCT.GE} ≠ 8.8/68.6/22.7`,
  )
  console.assert(fx(GRAND_MEAN, 1) === 566.4 && fx(LSD, 1) === 15.7 && fx(CV, 1) === 5.2, `[검산] 평균/LSD/CV ${GRAND_MEAN}/${LSD}/${CV} ≠ 566.4/15.7/5.2`)
  const topExp = 'YR19-0118,YR19-0118,YR20-0815,YR20-0815,YR20-0527,YR20-0342,YR20-0342,YR20-0527'
  const [rG, rE] = RANDOM_ENV_TESTS
  console.assert(fx(rG!.F, 1) === 5.8 && rG!.p < 0.001 && fx(rE!.F, 1) === 53.5 && rE!.p < 0.001, `[검산] 임의 환경 검정 G/G×E F ${rG!.F} p ${rG!.p}, E/반복 F ${rE!.F} p ${rE!.p} ≠ 5.8/53.5, p < 0.001`)
  const cw = SITE_YEAR_TOP_IDS[SITES.findIndex(s => s.short === '철원')]!.join(',')
  console.assert(cw === 'YR20-0527,YR20-0527', `[검산] 철원 연도별 실측 1위 ${cw} ≠ YR20-0527,YR20-0527`)
  const evKn = MEGA_EVIDENCE.map(e => `${e.k}/${e.n}`).join(',')
  console.assert(evKn === '4/10,3/4,2/2', `[검산] 메가 환경 근거 k/n ${evKn} ≠ 4/10,3/4,2/2`)
  console.assert(PASSED.every(g => g.overLsd), '[검산] 출원 후보 중 LSD 이하 계통이 있음(기대: 모두 LSD 초과)')
  const ur = GENO_BY_ID[UNSTABLE_REF]!
  console.assert(ur.rank === 4 && fx(ur.wPct, 1) === 11.7 && ur.mega === null && ur.verdict === 'indexOnly', `[검산] ${UNSTABLE_REF} 순위/W/승자 ${ur.rank}/${ur.wPct}/${ur.mega?.label} ≠ 4/11.7/아님`)
  console.assert(SITE_TOP_IDS.join(',') === topExp, `[검산] 지역 1위 ${SITE_TOP_IDS.join(',')} ≠ ${topExp}`)
}
