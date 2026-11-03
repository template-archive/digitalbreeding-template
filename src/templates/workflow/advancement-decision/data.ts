import { createRng, type Rng } from '@/lib/rng'

/**
 * 계통 진급 심사 — 목업 데이터.
 * 2026 생산력 검정(AYT, 시험포장 A-3) 성적으로 2027 지역 적응 시험(MET)에 올릴 계통을 고른다.
 * 1~5단계는 workflow/field-trial-layout `build()`·`lineStats()`를 그대로 복사했다(값 복사, import 금지).
 * 실제 API로 바꿀 때는 LINES(계통별 성적·GEBV·종자)와 SAVED_DECISIONS만 교체하면 판정·집계는 그대로 동작한다.
 */

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const SOWING = '2026-04-22'
export const REVIEW_MEETING = '2026-11-06'
export const REVIEWER = { name: '강도윤', team: '시험연구팀' }
export const SAVED_AT = '10-23 09:40'
/** 저장하면 바뀌는 마지막 저장 시각(목업 고정값) */
export const SAVED_AT_NEXT = '10-23 10:12'

export const MET_TARGET = 18
export const MET = { year: 2027, years: '2027~2028', sites: 8, reps: 3, checks: 2 }
/** MET 시험구 = (목표 + 대비) × 지역 × 반복 */
export const MET_PLOTS = (MET_TARGET + MET.checks) * MET.sites * MET.reps
/** 가람솔 MET 2년 평균(안내 띠) */
export const CHECK_MET_MEAN = 560.0

/** 필수 형질 한계(표시값 기준). heading·culm·blast는 이하, taste는 이상이면 통과 */
export const LIMITS = { heading: 122, culm: 90, blast: 5.0, taste: 68.0 }
export const Y_PROMOTE = 110.0
export const Y_HOLD = 105.0
export const GEBV_RESCUE = 30.4
export const GEBV_LOW = 10.0
export const WEIGHTS = { yieldIdx: 0.35, gebv: 0.15, culm: 0.15, blast: 0.2, taste: 0.15 }
export const DIR = { yieldIdx: +1, gebv: +1, culm: -1, blast: -1, taste: +1 }
export const REASON_MIN = 5
export const REASON_MAX = 200
export const SAVE_DELAY_MS = 600
export const SEED_MET_G = 600
export const SEED_MET_MIN_HOLD = 500
export const GERM_RESULT = '2026-11-04'
/** 발아 검사 차감 립수 */
export const GERM_TEST_GRAINS = 200

export const TRIAL = {
  crop: '벼',
  name: '2026 생산력 검정(AYT)',
  field: '시험포장 A-3',
  design: '알파격자 3반복',
  blockSize: 6,
  lines: 40,
  checks: 2,
  plots: 126,
  plotArea: 6.3,
}
export const GEBV_MODEL = { when: '2026-10', method: 'GBLUP', train: 1850, chip: '6K SNP 칩', retrain: '2027-02' }
export const QUICK_PHRASES = ['GEBV 상위', '재검정 필요', '교배 모본 유지', '반복 부족 — 재시험']

// ---------------------------------------------------------------- 1~5단계: field-trial-layout 복사

const LINE_NAMES = [
  'YR20-1108', 'YR21-0347', 'YR21-0592', 'YR21-0618', 'YR21-0773', 'YR21-0915', 'YR21-1046', 'YR21-1182',
  'YR22-0094', 'YR22-0158', 'YR22-0263', 'YR22-0331', 'YR22-0412', 'YR22-0487', 'YR22-0526', 'YR22-0649',
  'YR22-0705', 'YR22-0768', 'YR22-0832', 'YR22-0901', 'YR22-0957', 'YR22-1023', 'YR22-1104', 'YR22-1176',
  'YR22-1239', 'YR23-0047', 'YR23-0112', 'YR23-0136', 'YR23-0205', 'YR23-0271', 'YR23-0318', 'YR23-0384',
  'YR23-0446', 'YR23-0503', 'YR23-0569', 'YR23-0620', 'YR23-0688', 'YR23-0741', 'YR23-0815', 'YR23-0872',
] as const

export type CheckRole = 'standard' | 'high-yield'
interface Entry {
  no: number
  name: string
  check: CheckRole | null
}
const ENTRIES: Entry[] = [
  ...LINE_NAMES.map((name, i) => ({ no: i + 1, name, check: null })),
  { no: 41, name: '가람솔', check: 'standard' },
  { no: 42, name: '온새미로', check: 'high-yield' },
]
export const STANDARD_CHECK = 41
export const HIGH_CHECK = 42
export const CHECK_LABEL: Record<CheckRole, string> = { standard: '표준 대비', 'high-yield': '다수성 대비' }

const LAYOUT: number[][] = [
  [32, 25, 8, 1, 6, 41, 23, 16, 42, 35, 19, 12, 31, 24],
  [39, 18, 15, 36, 13, 34, 30, 9, 7, 28, 26, 5, 38, 17],
  [4, 11, 22, 29, 20, 27, 37, 2, 14, 21, 33, 40, 3, 10],
  [15, 14, 36, 35, 25, 17, 7, 40, 12, 4, 34, 26, 38, 30],
  [23, 6, 3, 27, 33, 9, 8, 32, 20, 37, 42, 18, 5, 22],
  [31, 39, 11, 19, 41, 1, 16, 24, 28, 29, 2, 10, 13, 21],
  [2, 40, 27, 18, 14, 5, 32, 23, 19, 10, 37, 35, 24, 15],
  [11, 31, 29, 9, 16, 36, 41, 21, 28, 1, 6, 26, 33, 13],
  [20, 22, 38, 7, 25, 34, 3, 12, 30, 39, 8, 17, 42, 4],
]
const K_POS: [number, 0 | 1][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1],
]
const REPS = 3
const BLOCKS = 7
const BLOCK_SIZE = 6
const YIELD_TARGET = { mean: 561.4, sd: 49.2 }

type PlotTrait = 'yield' | 'heading' | 'culm'
export type PlotStatus = 'ok' | 'missing' | 'outlier'
export interface Plot {
  no: number
  rep: number
  entry: number
  values: Record<PlotTrait, number | null>
  status: Record<PlotTrait, PlotStatus>
}
interface Issue {
  plot: number
  trait: PlotTrait
  kind: 'missing' | 'outlier'
  value?: number
}
const ISSUES: Issue[] = [
  { plot: 110, trait: 'yield', kind: 'outlier', value: 248.0 },
  { plot: 225, trait: 'culm', kind: 'outlier', value: 148 },
  { plot: 332, trait: 'yield', kind: 'outlier', value: 812.0 },
  { plot: 131, trait: 'yield', kind: 'missing' },
  { plot: 211, trait: 'yield', kind: 'missing' },
  { plot: 211, trait: 'culm', kind: 'missing' },
  { plot: 224, trait: 'heading', kind: 'missing' },
  { plot: 318, trait: 'yield', kind: 'missing' },
  { plot: 328, trait: 'culm', kind: 'missing' },
]
/** field-trial-layout INITIAL_MEMOS 복사 */
export const PLOT_MEMOS: Record<number, string> = {
  110: '참새 피해 심함 — 방조망 설치 지연(9/2)',
  131: '건조장에서 시료 봉투 분실',
  204: '잎도열병 경미(9/5 관찰)',
  211: '8월 집중호우로 침수·도복, 수확 불가(배수 불량 구역)',
  224: '출수기 조사 누락(8/12~8/14 조사 공백)',
  307: '생육 균일',
  318: '벼멸구 피해(호퍼번)로 고사, 수확 불가',
  328: '간장 조사 누락',
}

const REP_EFFECT = [6, 0, -6]
const ANCHOR: Record<number, [number, number, number]> = {
  1: [-14, 124, 95],
  11: [16, 111, 76],
  13: [34, 118, 84],
  28: [28, 119, 88],
  41: [0, 117, 86],
  42: [10, 119, 81],
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const sdPop = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length)
}
const sdSample = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

const spatial = (row: number, col: number) =>
  -12 + (24 * (col - 1)) / 13 - 70 * Math.exp(-((row - 5) ** 2 + (col - 4) ** 2) / (2 * 1.3 ** 2))

/** field-trial-layout build() 복사. 6단계가 같은 rng 인스턴스를 이어 쓰도록 rng와 계통 효과 G를 함께 돌려준다 */
function build(): { rng: Rng; plots: Plot[]; G: number[] } {
  const rng = createRng(SEED)
  const G: number[] = []
  const H: number[] = []
  const C: number[] = []
  for (let e = 1; e <= 40; e++) G[e] = clamp(rng.normal(0, 20), -36, 36)
  for (let e = 1; e <= 40; e++) H[e] = Math.round(clamp(rng.normal(116, 4), 106, 126))
  for (let e = 1; e <= 40; e++) C[e] = Math.round(clamp(rng.normal(83, 6), 70, 98))
  for (const [e, [g, h, c]] of Object.entries(ANCHOR)) {
    G[+e] = g
    H[+e] = h
    C[+e] = c
  }
  const B: number[][] = []
  for (let r = 1; r <= REPS; r++) {
    B[r] = []
    for (let b = 1; b <= BLOCKS; b++) B[r]![b] = clamp(rng.normal(0, 8), -12, 12)
  }
  const plots: (Plot & { raw: number })[] = []
  for (let r = 1; r <= REPS; r++) {
    for (let b = 1; b <= BLOCKS; b++) {
      for (let k = 1; k <= BLOCK_SIZE; k++) {
        const [ro, side] = K_POS[k - 1]!
        const row = 3 * (r - 1) + ro
        const col = 2 * (b - 1) + 1 + side
        const entry = LAYOUT[row - 1]![col - 1]!
        const eY = clamp(rng.normal(0, 28), -61.6, 61.6)
        const eH = rng.normal(0, 1.2)
        const eC = rng.normal(0, 2.5)
        const S = spatial(row, col)
        const raw = 560 + G[entry]! + REP_EFFECT[r - 1]! + B[r]![b]! + S + eY
        plots.push({
          no: r * 100 + (b - 1) * BLOCK_SIZE + k,
          rep: r,
          entry,
          raw,
          values: {
            yield: raw,
            heading: Math.round(clamp(H[entry]! + eH, 104, 128)),
            culm: Math.round(clamp(C[entry]! + 0.08 * S + eC, 66, 104)),
          },
          status: { yield: 'ok', heading: 'ok', culm: 'ok' },
        })
      }
    }
  }
  plots.sort((a, b) => a.no - b.no)
  const byNo = new Map(plots.map(p => [p.no, p]))
  for (const is of ISSUES) byNo.get(is.plot)!.status[is.trait] = is.kind
  const O = plots.filter(p => p.status.yield === 'ok')
  const m = O.reduce((s, p) => s + p.raw, 0) / O.length
  const s = Math.sqrt(O.reduce((acc, p) => acc + (p.raw - m) ** 2, 0) / (O.length - 1))
  for (const p of plots) p.values.yield = YIELD_TARGET.mean + (YIELD_TARGET.sd * (p.raw - m)) / s
  for (const is of ISSUES) {
    const p = byNo.get(is.plot)!
    p.values[is.trait] = is.kind === 'missing' ? null : is.value!
  }
  return { rng, plots: plots.map(({ raw: _raw, ...rest }) => rest), G }
}

const normalValues = (trait: PlotTrait, plots: Plot[]) => plots.filter(p => p.status[trait] === 'ok').map(p => p.values[trait] as number)

// ---------------------------------------------------------------- 6단계: 같은 rng로 이어서

const ANCHOR2: Record<number, [number | null, number | null]> = {
  1: [1.3, 69.4],
  11: [4.6, 77.2],
  13: [2.7, 71.3],
  28: [3.0, 71.8],
  24: [5.8, null],
  40: [null, 67.4],
  41: [4.0, 72.0],
  42: [4.3, 70.6],
}
/** gebv-selection 실행값 복사 [GEBV, r²] */
export const GEBV_SHARED: Record<string, [number, number]> = {
  'YR20-1108': [12.7, 0.44],
  'YR21-1182': [34.4, 0.38],
  'YR22-0263': [38.9, 0.52],
  'YR22-0412': [52.4, 0.58],
  'YR23-0136': [45.6, 0.49],
}
/** pedigree-explorer 2026-10 재추정(표현형 포함) */
const CHECK_GEBV: Record<number, [number, number]> = { 41: [-2.4, 0.74], 42: [11.6, 0.73] }

/** seed-inventory AYT_LOTS 복사 [계통, 정조 천립중 g, 반입량 g] */
const AYT_LOTS: [string, number, number][] = [
  ['YR20-1108', 28.3, 1380], ['YR21-0347', 27.9, 1360], ['YR21-0592', 27.3, 1400], ['YR21-0618', 26.1, 1570],
  ['YR21-0773', 26.2, 930], ['YR21-0915', 26.6, 1270], ['YR21-1046', 27.7, 1360], ['YR21-1182', 28, 1540],
  ['YR22-0094', 26.9, 1440], ['YR22-0158', 28, 1400], ['YR22-0263', 27.7, 1450], ['YR22-0331', 28.1, 1380],
  ['YR22-0412', 27.3, 1540], ['YR22-0487', 27.4, 1480], ['YR22-0526', 27.7, 1390], ['YR22-0649', 29.1, 1510],
  ['YR22-0705', 28, 1520], ['YR22-0768', 26.8, 1330], ['YR22-0832', 27.9, 890], ['YR22-0901', 28.2, 1460],
  ['YR22-0957', 28.5, 1400], ['YR22-1023', 26.3, 1440], ['YR22-1104', 26.1, 1460], ['YR22-1176', 29.5, 1560],
  ['YR22-1239', 26.9, 1310], ['YR23-0047', 26.9, 1520], ['YR23-0112', 26.6, 1010], ['YR23-0136', 27.6, 1600],
  ['YR23-0205', 27, 1180], ['YR23-0271', 26.5, 1550], ['YR23-0318', 27, 1410], ['YR23-0384', 26.5, 1540],
  ['YR23-0446', 26.8, 1280], ['YR23-0503', 27.3, 1370], ['YR23-0569', 26.2, 1320], ['YR23-0620', 28.1, 1450],
  ['YR23-0688', 25.4, 1420], ['YR23-0741', 25.9, 1510], ['YR23-0815', 26.8, 1390], ['YR23-0872', 26.2, 1600],
]

// ---------------------------------------------------------------- 7단계: 판정

export type Trait = 'heading' | 'culm' | 'blast' | 'taste'
export const TRAIT_ORDER: Trait[] = ['heading', 'culm', 'blast', 'taste']
export const TRAIT_LABEL: Record<Trait, string> = { heading: '출수기', culm: '간장', blast: '도열병', taste: '밥맛' }
export const TRAIT_UNIT: Record<Trait, string> = { heading: '일', culm: 'cm', blast: '', taste: '' }
export type Rec = 'promote' | 'hold' | 'drop'
export type Decision = Rec
export const REC_LABEL: Record<Rec, string> = { promote: '진급', hold: '보류', drop: '탈락' }
export type Basis = 'yield' | 'rescue' | 'border' | 'short' | 'violation'
export const BASIS_LABEL: Record<Basis, string> = {
  yield: '수량 지수',
  rescue: 'GEBV 보완',
  border: '수량 경계',
  short: '수량 미달',
  violation: '필수 형질 위반',
}
export type IndexKey = keyof typeof WEIGHTS
export const INDEX_KEYS: IndexKey[] = ['yieldIdx', 'gebv', 'culm', 'blast', 'taste']
export const INDEX_LABEL: Record<IndexKey, string> = { yieldIdx: '수량 지수', gebv: '수량 GEBV', culm: '간장', blast: '도열병', taste: '밥맛' }

export interface YieldPlot {
  no: number
  rep: number
  value: number | null
  status: PlotStatus
}

export interface Line {
  no: number
  name: string
  check: CheckRole | null
  plots: number[]
  yieldPlots: YieldPlot[]
  /** 원값 */
  yieldMean: number
  yieldIdx: number
  heading: number
  culm: number
  blast: number
  blastScores: number[]
  taste: number
  gebv: number
  rel: number
  shared: boolean
  n: Record<PlotTrait, number>
  /** 표시값(판정 기준) */
  d: { yield: number; idx: number; heading: number; culm: number; blast: number; taste: number }
  viol: Trait[]
  border: Trait[]
  rec: Rec | null
  basis: Basis | null
  gebvLow: boolean
  /** AYT 로트 재고(발아 검사 차감 후) g */
  stock: number
  stockAfter: number
  seedWarn: boolean
  z: Record<IndexKey, number>
  contrib: Record<IndexKey, number>
  index: number
  rank: number
  memos: { plot: number; text: string }[]
}

function make() {
  const { rng, plots, G } = build()
  const byEntry = new Map<number, Plot[]>()
  for (const p of plots) byEntry.set(p.entry, [...(byEntry.get(p.entry) ?? []), p])

  // 6-1 ~ 6-7
  const bMu: number[] = []
  const taste: number[] = []
  const scores: number[][] = []
  for (let e = 1; e <= 42; e++) bMu[e] = clamp(rng.normal(3.8, 1.0), 1.5, 6.5)
  for (let e = 1; e <= 42; e++) taste[e] = r1(clamp(rng.normal(72.0, 1.8), 67.0, 77.0))
  for (const [e, [b, t]] of Object.entries(ANCHOR2)) {
    if (b !== null) bMu[+e] = b
    if (t !== null) taste[+e] = t
  }
  for (let e = 1; e <= 42; e++) scores[e] = [0, 1, 2].map(() => Math.round(clamp(bMu[e]! + rng.normal(0, 0.7), 0, 9)))
  const gebv: number[] = []
  const rel: number[] = []
  for (let e = 1; e <= 40; e++) gebv[e] = r1(15.0 + 16.07 * (0.57 * (G[e]! / 20) + Math.sqrt(1 - 0.57 ** 2) * rng.normal()))
  for (let e = 1; e <= 40; e++) rel[e] = r2(clamp(0.57 ** 2 * (0.4 + 1.2 * rng.beta(5, 5)), 0.08, 0.65))

  const stdYield = mean(normalValues('yield', byEntry.get(STANDARD_CHECK)!))
  const lines: Line[] = ENTRIES.map(e => {
    const ps = byEntry.get(e.no)!
    const shared = GEBV_SHARED[e.name]
    const cg = CHECK_GEBV[e.no]
    const [g, r] = cg ?? shared ?? [gebv[e.no]!, rel[e.no]!]
    const yieldMean = mean(normalValues('yield', ps))
    const heading = mean(normalValues('heading', ps))
    const culm = mean(normalValues('culm', ps))
    const blast = mean(scores[e.no]!)
    const idx = (100 * yieldMean) / stdYield
    const d = { yield: r1(yieldMean), idx: r1(idx), heading: Math.round(heading), culm: Math.round(culm), blast: r1(blast), taste: taste[e.no]! }
    const lot = AYT_LOTS.find(l => l[0] === e.name)
    const stock = lot ? lot[2] - (GERM_TEST_GRAINS * lot[1]) / 1000 : NaN
    return {
      no: e.no,
      name: e.name,
      check: e.check,
      plots: ps.map(p => p.no),
      yieldPlots: ps.map(p => ({ no: p.no, rep: p.rep, value: p.values.yield, status: p.status.yield })),
      yieldMean,
      yieldIdx: idx,
      heading,
      culm,
      blast,
      blastScores: scores[e.no]!,
      taste: taste[e.no]!,
      gebv: g,
      rel: r,
      shared: !!shared,
      n: { yield: normalValues('yield', ps).length, heading: normalValues('heading', ps).length, culm: normalValues('culm', ps).length },
      d,
      viol: [],
      border: [],
      rec: null,
      basis: null,
      gebvLow: false,
      stock,
      stockAfter: stock - SEED_MET_G,
      seedWarn: lot ? stock - SEED_MET_G < SEED_MET_MIN_HOLD : false,
      z: { yieldIdx: 0, gebv: 0, culm: 0, blast: 0, taste: 0 },
      contrib: { yieldIdx: 0, gebv: 0, culm: 0, blast: 0, taste: 0 },
      index: 0,
      rank: 0,
      memos: ps.filter(p => PLOT_MEMOS[p.no]).map(p => ({ plot: p.no, text: PLOT_MEMOS[p.no]! })),
    }
  })

  const tests = lines.filter(l => !l.check)
  const raw: Record<IndexKey, (l: Line) => number> = {
    yieldIdx: l => l.yieldIdx,
    gebv: l => l.gebv,
    culm: l => l.culm,
    blast: l => l.blast,
    taste: l => l.taste,
  }
  const stats = {} as Record<IndexKey, { m: number; s: number }>
  for (const k of INDEX_KEYS) {
    const xs = tests.map(raw[k])
    stats[k] = { m: mean(xs), s: sdPop(xs) }
  }
  for (const l of lines) {
    let I = 0
    for (const k of INDEX_KEYS) {
      l.z[k] = (DIR[k] * (raw[k](l) - stats[k].m)) / stats[k].s
      l.contrib[k] = WEIGHTS[k] * l.z[k]
      I += l.contrib[k]
    }
    l.index = I
  }
  ;[...tests].sort((a, b) => b.index - a.index).forEach((l, i) => (l.rank = i + 1))

  for (const l of tests) {
    const { d } = l
    if (d.heading > LIMITS.heading) l.viol.push('heading')
    if (d.culm > LIMITS.culm) l.viol.push('culm')
    if (d.blast > LIMITS.blast) l.viol.push('blast')
    if (d.taste < LIMITS.taste) l.viol.push('taste')
    if (d.heading === LIMITS.heading) l.border.push('heading')
    if (d.culm === LIMITS.culm) l.border.push('culm')
    if (d.blast === LIMITS.blast) l.border.push('blast')
    if (d.taste === LIMITS.taste) l.border.push('taste')
    if (l.viol.length) [l.rec, l.basis] = ['drop', 'violation']
    else if (d.idx >= Y_PROMOTE) [l.rec, l.basis] = ['promote', 'yield']
    else if (d.idx >= Y_HOLD) [l.rec, l.basis] = l.gebv >= GEBV_RESCUE ? ['promote', 'rescue'] : ['hold', 'border']
    else [l.rec, l.basis] = ['drop', 'short']
    l.gebvLow = l.rec === 'promote' && l.gebv < GEBV_LOW
  }
  return { lines, stdYield, plots, stats }
}

const BUILT = make()
export const LINES: Line[] = BUILT.lines
export const TEST_LINES: Line[] = LINES.filter(l => !l.check)
export const CHECK_LINES: Line[] = LINES.filter(l => !!l.check)
export const LINE_BY_NAME = new Map(LINES.map(l => [l.name, l]))
export const STD = LINE_BY_NAME.get('가람솔')!
export const HIGH = LINE_BY_NAME.get('온새미로')!
/** 가람솔 A-3 평균(지수 100 기준, 원값) */
export const STD_YIELD = BUILT.stdYield
export const INDEX_STATS = BUILT.stats
export const TRIAL_CV = (() => {
  const v = BUILT.plots.filter(p => p.status.yield === 'ok').map(p => p.values.yield as number)
  return (100 * sdSample(v)) / mean(v)
})()

/** 시험 40계통 평균(원값 평균 — 진급 계통 평균 promotedMean과 같은 기준, 표시할 때 한 번만 반올림) */
export const TEST_MEAN = {
  yield: mean(TEST_LINES.map(l => l.yieldMean)),
  idx: mean(TEST_LINES.map(l => l.yieldIdx)),
  gebv: mean(TEST_LINES.map(l => l.gebv)),
}

/** 진급 지수 기여 최댓값: 시험 40계통 모든 형질 |wₜ·zₜ|의 최댓값 */
export const CONTRIB_MAX = Math.max(...TEST_LINES.flatMap(l => INDEX_KEYS.map(k => Math.abs(l.contrib[k]))))
/** 기여 막대(DivergingBar) domain: 최댓값을 0.1 단위로 올림 */
export const CONTRIB_DOMAIN = Math.ceil(CONTRIB_MAX * 10 - 1e-9) / 10

/** 날짜: 파종일 + 일수 → "MM-DD" */
export function dayToDate(days: number): string {
  const d = new Date(`${SOWING}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 반복 부족 형질(정상 관측 구 < 3) */
export const repShort = (l: Line): PlotTrait[] => (['yield', 'heading', 'culm'] as PlotTrait[]).filter(t => l.n[t] < 3)
export const PLOT_TRAIT_LABEL: Record<PlotTrait, string> = { yield: '수량', heading: '출수기', culm: '간장' }

// ---------------------------------------------------------------- 결정

export interface DecisionState {
  decision: Decision | null
  reason: string
}
export type Decisions = Record<string, DecisionState>

const PROMOTE_SAME = ['YR22-0412', 'YR23-0136', 'YR22-0705', 'YR22-0263', 'YR23-0741', 'YR23-0271', 'YR21-1182', 'YR22-0901']
const DROP_SAME = ['YR20-1108', 'YR21-0347', 'YR21-0773', 'YR22-0331', 'YR23-0446', 'YR21-0915', 'YR22-1239', 'YR22-0768', 'YR22-0832']
const DROP_MEMO: Record<string, string> = { 'YR20-1108': 'MET 진급 안 함. Pi9 공여친으로 교배 모본 유지(부모 후보 C 그룹)' }
/** 기준과 다르게 저장된 결정(사유는 저장된 사용자 입력) */
export const SAVED_OVERRIDES: Record<string, DecisionState> = {
  'YR22-0487': { decision: 'promote', reason: '수량 지수 109.7로 진급 기준 110.0에 0.3 못 미치지만 진급 지수 2위, 도열병 1.7·간장 74 cm로 형질이 고름' },
  'YR22-1176': { decision: 'hold', reason: '수량 지수 115.7로 상위지만 잎도열병 6.0(감수). 2027 밭못자리 검정을 다시 한 뒤 재심' },
  'YR23-0815': { decision: 'hold', reason: '수량 지수 103.0으로 기준 미달이지만 수량 GEBV +34.2로 부모 선발 컷오프 +30.4 이상. 2027 AYT 재시험' },
}

export const SAVED_DECISIONS: Decisions = Object.fromEntries(
  TEST_LINES.map(l => {
    if (SAVED_OVERRIDES[l.name]) return [l.name, SAVED_OVERRIDES[l.name]!]
    if (PROMOTE_SAME.includes(l.name)) return [l.name, { decision: 'promote', reason: '' }]
    if (DROP_SAME.includes(l.name)) return [l.name, { decision: 'drop', reason: DROP_MEMO[l.name] ?? '' }]
    return [l.name, { decision: null, reason: '' }]
  }),
)

export const differs = (l: Line, s: DecisionState) => s.decision !== null && s.decision !== l.rec
export const reasonOk = (s: DecisionState) => s.reason.trim().length >= REASON_MIN
export const needsReason = (l: Line, s: DecisionState) => differs(l, s) && !reasonOk(s)
export const sameState = (a: DecisionState, b: DecisionState) => a.decision === b.decision && a.reason === b.reason

export interface DropReasons {
  short: number
  heading: number
  culm: number
  blast: number
  taste: number
  reviewer: number
}

export interface Summary {
  decided: number
  undecided: number
  dirty: number
  promote: number
  hold: number
  drop: number
  expected: { promote: number; hold: number; drop: number }
  undecidedRec: { promote: number; hold: number; drop: number }
  differ: number
  differReasoned: number
  differBy: { promote: number; hold: number; drop: number }
  missingReason: number
  violLines: number
  violBy: Record<Trait, number>
  promoted: Line[]
  held: Line[]
  dropped: Line[]
  promotedMean: { yield: number; idx: number; gebv: number } | null
  promotedSeedWarn: Line[]
  dropReasons: DropReasons
}

export function summarize(dec: Decisions, saved: Decisions): Summary {
  const s: Summary = {
    decided: 0,
    undecided: 0,
    dirty: 0,
    promote: 0,
    hold: 0,
    drop: 0,
    expected: { promote: 0, hold: 0, drop: 0 },
    undecidedRec: { promote: 0, hold: 0, drop: 0 },
    differ: 0,
    differReasoned: 0,
    differBy: { promote: 0, hold: 0, drop: 0 },
    missingReason: 0,
    violLines: 0,
    violBy: { heading: 0, culm: 0, blast: 0, taste: 0 },
    promoted: [],
    held: [],
    dropped: [],
    promotedMean: null,
    promotedSeedWarn: [],
    dropReasons: { short: 0, heading: 0, culm: 0, blast: 0, taste: 0, reviewer: 0 },
  }
  const byRank = [...TEST_LINES].sort((a, b) => a.rank - b.rank)
  for (const l of byRank) {
    const st = dec[l.name]!
    if (!sameState(st, saved[l.name]!)) s.dirty++
    if (l.viol.length) s.violLines++
    for (const t of l.viol) s.violBy[t]++
    if (st.decision === null) {
      s.undecided++
      s.undecidedRec[l.rec!]++
      s.expected[l.rec!]++
      continue
    }
    s.decided++
    s[st.decision]++
    s.expected[st.decision]++
    if (st.decision === 'promote') s.promoted.push(l)
    if (st.decision === 'hold') s.held.push(l)
    if (st.decision === 'drop') {
      s.dropped.push(l)
      if (l.rec !== 'drop') s.dropReasons.reviewer++
      else if (l.basis === 'short') s.dropReasons.short++
      else for (const t of l.viol) s.dropReasons[t]++
    }
    if (differs(l, st)) {
      s.differ++
      s.differBy[st.decision]++
      if (reasonOk(st)) s.differReasoned++
      else s.missingReason++
    }
  }
  if (s.promoted.length)
    s.promotedMean = {
      yield: mean(s.promoted.map(l => l.yieldMean)),
      idx: mean(s.promoted.map(l => l.yieldIdx)),
      gebv: mean(s.promoted.map(l => l.gebv)),
    }
  s.promotedSeedWarn = s.promoted.filter(l => l.seedWarn)
  return s
}

/** 미결정 계통에 자동 판정을 채운다(저장은 하지 않음) */
export function applyRecommendations(dec: Decisions): Decisions {
  const out: Decisions = { ...dec }
  for (const l of TEST_LINES) if (out[l.name]!.decision === null) out[l.name] = { ...out[l.name]!, decision: l.rec }
  return out
}

// ---------------------------------------------------------------- DEV 검산

if (import.meta.env.DEV) {
  const okPlots = BUILT.plots.filter(p => p.status.yield === 'ok').map(p => p.values.yield as number)
  const m = mean(okPlots)
  const s = sdSample(okPlots)
  console.assert(okPlots.length === 121, `[검산] 정상 수량 구 ${okPlots.length} ≠ 121`)
  console.assert(Math.abs(m - 561.4) < 0.05 && Math.abs(s - 49.2) < 0.05, `[검산] 정상 수량 평균·SD ${m.toFixed(3)}·${s.toFixed(3)} ≠ 561.4·49.2`)
  console.assert(STD.d.yield === 525.0 && STD.d.idx === 100.0, `[검산] 가람솔 ${STD.d.yield}(${STD.d.idx}) ≠ 525.0(100.0)`)
  console.assert(HIGH.d.yield === 603.7 && HIGH.d.idx === 115.0, `[검산] 온새미로 ${HIGH.d.yield}(${HIGH.d.idx}) ≠ 603.7(115.0)`)
  const cnt = (f: (l: Line) => boolean) => TEST_LINES.filter(f).length
  const rc = [cnt(l => l.rec === 'promote'), cnt(l => l.rec === 'hold'), cnt(l => l.rec === 'drop')]
  console.assert(rc.join('/') === '14/3/23', `[검산] 자동 판정 ${rc.join('/')} ≠ 14/3/23`)
  const bc = [cnt(l => l.basis === 'yield'), cnt(l => l.basis === 'rescue'), cnt(l => l.basis === 'violation'), cnt(l => l.basis === 'short')]
  console.assert(bc.join('/') === '11/3/12/11', `[검산] 판정 근거 ${bc.join('/')} ≠ 11/3/12/11`)
  const vb = TRAIT_ORDER.map(t => cnt(l => l.viol.includes(t)))
  console.assert(vb.join('/') === '3/7/4/1', `[검산] 위반 형질 ${vb.join('/')} ≠ 3/7/4/1`)
  for (const [name, [g, r]] of Object.entries(GEBV_SHARED)) {
    const l = LINE_BY_NAME.get(name)!
    console.assert(l.gebv === g && l.rel === r, `[검산] 공유 GEBV ${name} ${l.gebv}·${l.rel} ≠ ${g}·${r}`)
  }
  const sm = summarize(SAVED_DECISIONS, SAVED_DECISIONS)
  console.assert(sm.promote === 9 && sm.expected.promote === 15 && sm.differ === 3 && sm.decided === 20, `[검산] 기본 상태 진급 ${sm.promote}·예상 ${sm.expected.promote}·다름 ${sm.differ}·결정 ${sm.decided} ≠ 9·15·3·20`)
  const ap = summarize(applyRecommendations(SAVED_DECISIONS), SAVED_DECISIONS)
  console.assert(ap.promote === 15 && ap.hold === 4 && ap.drop === 21 && ap.dirty === 20 && ap.missingReason === 0, `[검산] 일괄 적용 ${ap.promote}/${ap.hold}/${ap.drop}·미저장 ${ap.dirty} ≠ 15/4/21·20`)
  const top = [...TEST_LINES].sort((a, b) => a.rank - b.rank)[0]!
  console.assert(top.name === 'YR22-0412', `[검산] 진급 지수 1위 ${top.name} ≠ YR22-0412`)
  const pm = sm.promotedMean!
  console.assert(r1(pm.yield) === 590.4 && r1(pm.idx) === 112.4 && r1(pm.gebv) === 30.9, `[검산] 진급 계통 평균 ${r1(pm.yield)}·${r1(pm.idx)}·${r1(pm.gebv)} ≠ 590.4·112.4·30.9`)
  // 저장된 사유 문장 속 숫자 = 표시값
  const L = (n: string) => LINE_BY_NAME.get(n)!
  const a = L('YR22-0487')
  const b = L('YR22-1176')
  const c = L('YR23-0815')
  const reasonNums: [string, string][] = [
    [SAVED_OVERRIDES['YR22-0487']!.reason, `수량 지수 ${a.d.idx.toFixed(1)}`],
    [SAVED_OVERRIDES['YR22-0487']!.reason, `기준 ${Y_PROMOTE.toFixed(1)}에 ${(Y_PROMOTE - a.d.idx).toFixed(1)}`],
    [SAVED_OVERRIDES['YR22-0487']!.reason, `진급 지수 ${a.rank}위`],
    [SAVED_OVERRIDES['YR22-0487']!.reason, `도열병 ${a.d.blast.toFixed(1)}·간장 ${a.d.culm} cm`],
    [SAVED_OVERRIDES['YR22-1176']!.reason, `수량 지수 ${b.d.idx.toFixed(1)}`],
    [SAVED_OVERRIDES['YR22-1176']!.reason, `잎도열병 ${b.d.blast.toFixed(1)}`],
    [SAVED_OVERRIDES['YR23-0815']!.reason, `수량 지수 ${c.d.idx.toFixed(1)}`],
    [SAVED_OVERRIDES['YR23-0815']!.reason, `GEBV +${c.gebv.toFixed(1)}`],
    [SAVED_OVERRIDES['YR23-0815']!.reason, `컷오프 +${GEBV_RESCUE.toFixed(1)}`],
  ]
  for (const [text, frag] of reasonNums) console.assert(text.includes(frag), `[검산] 저장된 사유에 "${frag}"가 없음(표시값과 다름)`)
  const idxR = [Math.min(...TEST_LINES.map(l => l.d.idx)), Math.max(...TEST_LINES.map(l => l.d.idx))]
  console.assert(Math.abs(TEST_MEAN.yield - 560.434) < 0.0005 && Math.abs(TEST_MEAN.idx - 106.742268) < 0.0000005, `[검산] 시험 40계통 원값 평균 ${TEST_MEAN.yield.toFixed(3)}·${TEST_MEAN.idx.toFixed(6)} ≠ 560.434·106.742268`)
  console.assert(r1(TEST_MEAN.yield) === 560.4 && r1(TEST_MEAN.idx) === 106.7, `[검산] 시험 40계통 평균 표시 ${r1(TEST_MEAN.yield)}·${r1(TEST_MEAN.idx)} ≠ 560.4·106.7`)
  console.assert(Math.abs(CONTRIB_MAX - 0.672) < 0.0005 && CONTRIB_DOMAIN === 0.7, `[검산] 기여 최댓값 ${CONTRIB_MAX.toFixed(3)} → domain ${CONTRIB_DOMAIN} ≠ 0.672 → 0.7`)
  console.assert(idxR[0] === 94.4 && idxR[1] === 118.8, `[검산] 지수 범위 ${idxR.join('~')} ≠ 94.4~118.8`)
}
