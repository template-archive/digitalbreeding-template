import { createRng } from '@/lib/rng'

/*
 * 시험포장 배치·관리 목업 데이터. 명세: docs/specs/field-trial-layout.md
 * 배치·결측·이상치·메모·앵커 값은 상수, 계통 효과·블록 효과·구 오차만 시드 난수다.
 * 요약 수치(126구, 98.4%, 561.4 kg/10a, CV 8.8%, 경고 9건)는 모두 아래에서 계산한다.
 * 실제 API로 바꿀 때는 PLOTS(구별 관측값)·ENTRIES·INITIAL_MEMOS만 교체하면 나머지 통계는 그대로 동작한다.
 */

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const SOWING = '2026-04-22'
export const TRANSPLANT = '2026-05-20'
export const PLOT_AREA_M2 = 6.3
export const YIELD_TARGET = { mean: 561.4, sd: 49.2 }
export const ROWS = 9
export const COLS = 14
export const REPS = 3
export const BLOCKS = 7
export const BLOCK_SIZE = 6

export const TRIAL = {
  crop: '벼',
  name: '2026 생산력 검정(AYT)',
  field: '시험포장 A-3',
  program: '중부 평야지 벼 육종 프로그램',
  design: '알파격자 3반복',
}

export type TraitKey = 'yield' | 'heading' | 'culm'

export const TRAITS: Record<TraitKey, { label: string; short: string; abbr: string; unit: string; cellDigits: number; digits: number; range: [number, number] }> = {
  yield: { label: '쌀 수량', short: '수량', abbr: '수', unit: 'kg/10a', cellDigits: 0, digits: 1, range: [300, 800] },
  heading: { label: '출수기', short: '출수기', abbr: '출', unit: '일', cellDigits: 0, digits: 0, range: [95, 135] },
  culm: { label: '간장', short: '간장', abbr: '간', unit: 'cm', cellDigits: 0, digits: 0, range: [55, 120] },
}
export const TRAIT_KEYS: TraitKey[] = ['yield', 'heading', 'culm']

// ---------------- 처리(entry) ----------------

export type CheckRole = 'standard' | 'high-yield'
export interface Entry {
  no: number
  name: string
  check: CheckRole | null
}

const LINE_NAMES = [
  'YR20-1108', 'YR21-0347', 'YR21-0592', 'YR21-0618', 'YR21-0773', 'YR21-0915', 'YR21-1046', 'YR21-1182',
  'YR22-0094', 'YR22-0158', 'YR22-0263', 'YR22-0331', 'YR22-0412', 'YR22-0487', 'YR22-0526', 'YR22-0649',
  'YR22-0705', 'YR22-0768', 'YR22-0832', 'YR22-0901', 'YR22-0957', 'YR22-1023', 'YR22-1104', 'YR22-1176',
  'YR22-1239', 'YR23-0047', 'YR23-0112', 'YR23-0136', 'YR23-0205', 'YR23-0271', 'YR23-0318', 'YR23-0384',
  'YR23-0446', 'YR23-0503', 'YR23-0569', 'YR23-0620', 'YR23-0688', 'YR23-0741', 'YR23-0815', 'YR23-0872',
] as const

export const ENTRIES: Entry[] = [
  ...LINE_NAMES.map((name, i) => ({ no: i + 1, name, check: null })),
  { no: 41, name: '가람솔', check: 'standard' },
  { no: 42, name: '온새미로', check: 'high-yield' },
]
export const ENTRY_BY_NO = new Map(ENTRIES.map(e => [e.no, e]))
export const STANDARD_CHECK = 41
export const CHECK_LABEL: Record<CheckRole, string> = { standard: '표준 대비', 'high-yield': '다수성 대비' }

// ---------------- 배치(알파격자 α(0,1), 랜덤화 고정 결과) ----------------

/** 배치표: LAYOUT[행-1][열-1] = 처리 번호 */
export const LAYOUT: number[][] = [
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

/** 블록 안 위치 k(1..6) → (행 오프셋, 왼/오른 열). 뱀형 순서 */
const K_POS: [number, 0 | 1][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1],
]

export const REP_LABEL = ['Ⅰ', 'Ⅱ', 'Ⅲ'] as const

export type PlotStatus = 'ok' | 'missing' | 'outlier'

export interface Plot {
  no: number
  rep: number // 1..3
  block: number // 물리 블록 1..7
  k: number // 블록 안 위치 1..6
  row: number // 1..9
  col: number // 1..14
  entry: number
  /** 관측값. null = 결측. 이상치는 원래 값 그대로 */
  values: Record<TraitKey, number | null>
  status: Record<TraitKey, PlotStatus>
}

// ---------------- 결측·이상치·메모 상수 ----------------

interface Issue {
  plot: number
  trait: TraitKey
  kind: 'missing' | 'outlier'
  value?: number
  reason?: string
}

export const ISSUES: Issue[] = [
  { plot: 110, trait: 'yield', kind: 'outlier', value: 248.0, reason: '허용 범위(300~800 kg/10a) 미만 — 메모: 참새 피해' },
  { plot: 225, trait: 'culm', kind: 'outlier', value: 148, reason: '허용 범위(55~120 cm) 초과 — 자릿수 오기 의심' },
  { plot: 332, trait: 'yield', kind: 'outlier', value: 812.0, reason: '허용 범위(300~800 kg/10a) 초과 — 입력 오류 의심' },
  { plot: 131, trait: 'yield', kind: 'missing' },
  { plot: 211, trait: 'yield', kind: 'missing' },
  { plot: 211, trait: 'culm', kind: 'missing' },
  { plot: 224, trait: 'heading', kind: 'missing' },
  { plot: 318, trait: 'yield', kind: 'missing' },
  { plot: 328, trait: 'culm', kind: 'missing' },
]

export const INITIAL_MEMOS: Record<number, string> = {
  110: '참새 피해 심함 — 방조망 설치 지연(9/2)',
  131: '건조장에서 시료 봉투 분실',
  204: '잎도열병 경미(9/5 관찰)',
  211: '8월 집중호우로 침수·도복, 수확 불가(배수 불량 구역)',
  224: '출수기 조사 누락(8/12~8/14 조사 공백)',
  307: '생육 균일',
  318: '벼멸구 피해(호퍼번)로 고사, 수확 불가',
  328: '간장 조사 누락',
}

// ---------------- 형질값 생성 ----------------

const REP_EFFECT = [6, 0, -6]
const ANCHOR: Record<number, [number, number, number]> = {
  1: [-14, 124, 95],
  11: [16, 111, 76],
  13: [34, 118, 84],
  28: [28, 119, 88],
  41: [0, 117, 86], // 명세 -24에서 조정: 수량 지수를 명세 범위(85~120)에 맞춤(도메인 검토 M1)
  42: [10, 119, 81],
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 공간 경향(원척도 kg): 동→서 비옥도 기울기 + 배수 불량 저수량 구역(중심 5행 4열 = 구 211) */
const spatial = (row: number, col: number) =>
  -12 + (24 * (col - 1)) / 13 - 70 * Math.exp(-((row - 5) ** 2 + (col - 4) ** 2) / (2 * 1.3 ** 2))

function build(): Plot[] {
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
          block: b,
          k,
          row,
          col,
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
  for (const is of ISSUES) {
    const p = byNo.get(is.plot)!
    p.status[is.trait] = is.kind
  }

  // 수량 정규화: 수량이 관측되고 이상치가 아닌 구(121구)의 평균·표본 SD를 목표값에 맞춘다
  const O = plots.filter(p => p.status.yield === 'ok')
  const m = O.reduce((s, p) => s + p.raw, 0) / O.length
  const s = Math.sqrt(O.reduce((acc, p) => acc + (p.raw - m) ** 2, 0) / (O.length - 1))
  for (const p of plots) p.values.yield = YIELD_TARGET.mean + (YIELD_TARGET.sd * (p.raw - m)) / s

  for (const is of ISSUES) {
    const p = byNo.get(is.plot)!
    p.values[is.trait] = is.kind === 'missing' ? null : is.value!
  }
  return plots.map(({ raw: _raw, ...rest }) => rest)
}

export const PLOTS: Plot[] = build()
export const PLOT_BY_NO = new Map(PLOTS.map(p => [p.no, p]))
export const PLOT_AT: Plot[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => PLOTS.find(p => p.row === r + 1 && p.col === c + 1)!),
)
export const PLOTS_BY_ENTRY = new Map<number, Plot[]>()
for (const p of PLOTS) {
  const list = PLOTS_BY_ENTRY.get(p.entry) ?? []
  list.push(p)
  PLOTS_BY_ENTRY.set(p.entry, list)
}

export const issueFor = (plot: number, trait: TraitKey) => ISSUES.find(i => i.plot === plot && i.trait === trait)

// ---------------- 통계 ----------------

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const sd = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

/** 정상 관측값(결측·이상치 제외) */
export const normalValues = (trait: TraitKey, plots: Plot[] = PLOTS) =>
  plots.filter(p => p.status[trait] === 'ok').map(p => p.values[trait] as number)

export interface LineStat {
  entry: number
  name: string
  check: CheckRole | null
  plots: number[]
  mean: Record<TraitKey, number | null>
  yieldReps: number
  issues: number
  yieldIndex: number | null
}

function lineStats(): LineStat[] {
  const base = ENTRIES.map(e => {
    const ps = PLOTS_BY_ENTRY.get(e.no)!
    const m = {} as Record<TraitKey, number | null>
    for (const t of TRAIT_KEYS) {
      const v = normalValues(t, ps)
      m[t] = v.length ? mean(v) : null
    }
    return {
      entry: e.no,
      name: e.name,
      check: e.check,
      plots: ps.map(p => p.no),
      mean: m,
      yieldReps: normalValues('yield', ps).length,
      issues: ps.reduce((n, p) => n + TRAIT_KEYS.filter(t => p.status[t] !== 'ok').length, 0),
      yieldIndex: null as number | null,
    }
  })
  const std = base.find(b => b.entry === STANDARD_CHECK)!.mean.yield!
  for (const b of base) b.yieldIndex = b.mean.yield === null ? null : (b.mean.yield / std) * 100
  return base
}
export const LINE_STATS: LineStat[] = lineStats()
export const LINE_STAT_BY_ENTRY = new Map(LINE_STATS.map(l => [l.entry, l]))

/** 공간 경향: 잔차(y − 계통 평균)의 3×3 이동 평균(정상 관측 구만, 유효 이웃 3개 미만이면 null) */
function trends(): Record<TraitKey, Map<number, number | null>> {
  const out = {} as Record<TraitKey, Map<number, number | null>>
  for (const t of TRAIT_KEYS) {
    const resid = new Map<number, number>()
    for (const p of PLOTS) {
      const lm = LINE_STAT_BY_ENTRY.get(p.entry)!.mean[t]
      if (p.status[t] === 'ok' && lm !== null) resid.set(p.no, (p.values[t] as number) - lm)
    }
    const map = new Map<number, number | null>()
    for (const p of PLOTS) {
      const rs: number[] = []
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const q = PLOT_AT[p.row - 1 + dr]?.[p.col - 1 + dc]
          if (q && resid.has(q.no)) rs.push(resid.get(q.no)!)
        }
      map.set(p.no, rs.length >= 3 ? mean(rs) : null)
    }
    out[t] = map
  }
  return out
}
export const TRENDS = trends()

export interface Summary {
  plots: number
  linePlots: number
  checkPlots: number
  observed: number
  expected: number
  completion: number
  traitObserved: Record<TraitKey, number>
  yieldMean: number
  yieldSd: number
  yieldCv: number
  yieldN: number
  missingCount: number
  missingPlots: number
  outlierCount: number
  outlierPlots: number
  missingByTrait: Record<TraitKey, number>
  outlierByTrait: Record<TraitKey, number>
}

function summarize(): Summary {
  const traitObserved = {} as Record<TraitKey, number>
  const missingByTrait = {} as Record<TraitKey, number>
  const outlierByTrait = {} as Record<TraitKey, number>
  for (const t of TRAIT_KEYS) {
    traitObserved[t] = PLOTS.filter(p => p.values[t] !== null).length
    missingByTrait[t] = PLOTS.filter(p => p.status[t] === 'missing').length
    outlierByTrait[t] = PLOTS.filter(p => p.status[t] === 'outlier').length
  }
  const observed = TRAIT_KEYS.reduce((n, t) => n + traitObserved[t], 0)
  const y = normalValues('yield')
  const ym = mean(y)
  const ys = sd(y)
  const checkPlots = PLOTS.filter(p => ENTRY_BY_NO.get(p.entry)!.check).length
  return {
    plots: PLOTS.length,
    linePlots: PLOTS.length - checkPlots,
    checkPlots,
    observed,
    expected: PLOTS.length * TRAIT_KEYS.length,
    completion: observed / (PLOTS.length * TRAIT_KEYS.length),
    traitObserved,
    yieldMean: ym,
    yieldSd: ys,
    yieldCv: (ys / ym) * 100,
    yieldN: y.length,
    missingCount: TRAIT_KEYS.reduce((n, t) => n + missingByTrait[t], 0),
    missingPlots: PLOTS.filter(p => TRAIT_KEYS.some(t => p.status[t] === 'missing')).length,
    outlierCount: TRAIT_KEYS.reduce((n, t) => n + outlierByTrait[t], 0),
    outlierPlots: PLOTS.filter(p => TRAIT_KEYS.some(t => p.status[t] === 'outlier')).length,
    missingByTrait,
    outlierByTrait,
  }
}
export const SUMMARY = summarize()

/** 형질별 정상 관측 최소·최대(색 척도 범위) */
export const TRAIT_EXTENT = Object.fromEntries(
  TRAIT_KEYS.map(t => {
    const v = normalValues(t)
    return [t, [Math.min(...v), Math.max(...v)] as [number, number]]
  }),
) as Record<TraitKey, [number, number]>

export const TREND_EXTENT = Object.fromEntries(
  TRAIT_KEYS.map(t => {
    const v = Array.from(TRENDS[t].values()).filter((x): x is number => x !== null)
    return [t, Math.max(...v.map(Math.abs))]
  }),
) as Record<TraitKey, number>

// ---------------- 보조 함수 ----------------

export const lineLabel = (entry: number) => ENTRY_BY_NO.get(entry)!.name

/** 출수 일수 → 날짜(YYYY-MM-DD) */
export function headingDate(days: number): string {
  const d = new Date(`${SOWING}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 구당 백미 환산 무게(kg) = 쌀 수량(kg/10a, 백미 기준) × 구 면적(m²) / 1000. 실측 정조 무게가 아니다 */
export const plotHarvestKg = (yieldKg10a: number) => (yieldKg10a * PLOT_AREA_M2) / 1000

export const normalizeQuery = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export function searchEntries(q: string): Entry[] {
  const n = normalizeQuery(q)
  if (!n) return []
  return ENTRIES.filter(e => normalizeQuery(e.name).includes(n))
}

// ---------------- 개발 모드 검산 ----------------

if (import.meta.env?.DEV) {
  // 각 반복에 1~42가 한 번씩
  for (let r = 1; r <= REPS; r++) {
    const set = new Set(PLOTS.filter(p => p.rep === r).map(p => p.entry))
    console.assert(set.size === 42, `반복 ${r}의 처리 수가 42가 아님`)
  }
  // 두 처리가 같은 불완전 블록에 두 번 이상 함께 들어가지 않음
  const pairs = new Set<string>()
  let dup = 0
  for (let r = 1; r <= REPS; r++)
    for (let b = 1; b <= BLOCKS; b++) {
      const es = PLOTS.filter(p => p.rep === r && p.block === b).map(p => p.entry)
      for (let i = 0; i < es.length; i++)
        for (let j = i + 1; j < es.length; j++) {
          const key = [es[i], es[j]].sort((x, y) => x! - y!).join('|')
          if (pairs.has(key)) dup++
          pairs.add(key)
        }
    }
  console.assert(dup === 0, `같은 블록에 두 번 이상 함께 들어간 처리 쌍 ${dup}개`)
  // 범위 이상치 = 정확히 상수 3건
  let outOfRange = 0
  for (const p of PLOTS)
    for (const t of TRAIT_KEYS) {
      const v = p.values[t]
      const [lo, hi] = TRAITS[t].range
      if (v !== null && (v < lo || v > hi)) outOfRange++
    }
  console.assert(outOfRange === 3, `범위 이상치 ${outOfRange}건(기대 3건)`)
  // 배수 불량 구역: 구 211(5행 4열) 주변 3×3(4~6행, 3~5열)의 수량 공간 경향이 모두 음수
  const nonNegative: number[] = []
  for (let row = 4; row <= 6; row++)
    for (let col = 3; col <= 5; col++) {
      const q = PLOT_AT[row - 1]![col - 1]!
      const tv = TRENDS.yield.get(q.no)
      if (tv == null || tv >= 0) nonNegative.push(q.no)
    }
  console.assert(PLOT_AT[4]![3]!.no === 211, '5행 4열이 구 211이 아님')
  console.assert(nonNegative.length === 0, `구 211 주변 3×3 수량 공간 경향 음수가 아닌 구: ${nonNegative.join(', ')}`)
}
