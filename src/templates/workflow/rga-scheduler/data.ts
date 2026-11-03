// 속성세대진전(RGA) 일정 — 목업 데이터와 일정 계산 규칙
// 명세: docs/specs/rga-scheduler.md 「목업 데이터 생성 규칙」. 모든 값은 가상 기관의 추정 목업이다.
// 난수는 쓰지 않는다(일정은 규칙으로 계산). 시드는 라이브러리 관례로 상수만 둔다.

export const SEED = 20261023

// ---------------------------------------------------------------- 날짜 유틸(UTC 기준 ISO 문자열)

const DAY = 86_400_000
const toNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / DAY
}
const fromNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
export const addDays = (iso: string, n: number) => fromNum(toNum(iso) + n)
/** b − a(일) */
export const diffDays = (a: string, b: string) => toNum(b) - toNum(a)

/** YYYY-MM-DD 형식이고 실제로 있는 날짜인지 */
export function parseIso(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

export const AS_OF = '2026-10-23'
const AS_OF_YEAR = AS_OF.slice(0, 4)
/** 기준일과 같은 해면 MM-DD, 아니면 YYYY-MM-DD */
export const fmtD = (iso: string) => (iso.startsWith(`${AS_OF_YEAR}-`) ? iso.slice(5) : iso)
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
export const weekday = (iso: string) => WEEKDAY[new Date(toNum(iso) * DAY).getUTCDay()]!
/** 기준일부터 남은 일수(D-n) */
export const dDay = (iso: string) => diffDays(AS_OF, iso)

// ---------------------------------------------------------------- 상수

/** 간트 창(양끝 포함) */
export const WIN = { from: '2026-07-01', to: '2027-08-31' } as const
export const WIN_DAYS = diffDays(WIN.from, WIN.to) + 1
/** 충돌 검사 범위 */
export const CHECK_END = '2028-03-31'
/** 일별 점유 배열 시작(주별 점유 첫 월요일) */
export const WEEK_FROM = '2026-06-29'

export const BEDS = ['A01', 'A02', 'A03', 'A04', 'A05', 'B01', 'B02', 'B03', 'B04', 'B05'] as const
export type BedId = (typeof BEDS)[number]
export const HOUSES: { id: string; label: string; beds: BedId[] }[] = [
  { id: 'A', label: 'A동', beds: ['A01', 'A02', 'A03', 'A04', 'A05'] },
  { id: 'B', label: 'B동', beds: ['B01', 'B02', 'B03', 'B04', 'B05'] },
]
export const BED_CAP = 500
export const TOTAL_CAP = BED_CAP * BEDS.length
export const TRAYS_PER_BED = 10
export const CELLS_PER_TRAY = 50
export const CLEAN = 3
export const SAMPLE_DAS = 18
export const DAYLENGTH_H = 10

export type MethodKey = 'standard' | 'embryo'
export const METHOD: Record<MethodKey, { label: string; toHeading: number; headToHarvest: number; harvestToSow: number }> = {
  standard: { label: '조기 수확', toHeading: 62, headToHarvest: 24, harvestToSow: 9 },
  embryo: { label: '배아 배양', toHeading: 62, headToHarvest: 14, harvestToSow: 9 },
}
export const genDays = (m: MethodKey) => METHOD[m].toHeading + METHOD[m].headToHarvest + METHOD[m].harvestToSow
export const GEN_DAYS = genDays('standard')
export const GEN_PER_YEAR = 365 / GEN_DAYS
export const GEN_PER_YEAR_EMBRYO = 365 / genDays('embryo')
/** F1 파종 → F6 종자 준비(F1~F5 재배 5세대) */
export const SSD_GENS = 5
export const F1_TO_F6_DAYS = SSD_GENS * GEN_DAYS
export const F1_TO_F6_YEARS = F1_TO_F6_DAYS / 365
/** 세대 간격 L 설계값(디지털 공정, 계산하지 않고 표기) — digital-breeding-process `L.digital` */
export const L_DESIGN = 2.2
export const L_PARTS: [string, number][] = [
  ['교배', 0.5],
  ['속성세대진전', 1.3],
  ['유전형 분석', 0.1],
  ['GEBV 예측', 0.1],
  ['선발', 0.2],
]
export const LINES_PER_CROSS = 5
export const F1_PER_CROSS = 4
export const DEADLINE_GS: Record<2027 | 2028, string> = { 2027: '2027-03-19', 2028: '2028-03-17' }
/** 2027 6K 캠페인 첫 접수(추정) − 동결건조 3일 = 마감 */
export const GS_INTAKE_2027 = '2027-03-22'
export const FREEZE_DRY_DAYS = 3
export const CROSS27 = { start: '2027-06-07', end: '2027-07-09', earlyHarvest: 28, stagger: [0, 7, 14] }
export const POT_CELLS = 10
export const POTS_PER_SOWING = 2
export const MAINT: { bed: BedId; from: string; to: string; label: string }[] = [{ bed: 'B05', from: '2026-11-16', to: '2026-11-27', label: '보광 LED 교체' }]
export const DEADLINE_CAUTION = 14
export const STORAGE_CAUTION = 60
export const SAVE_DELAY_MS = 600

// ---------------------------------------------------------------- 묶음

export type CohortKey = 'CR25' | 'CR26' | 'PARENT'
export const COHORT_LABEL: Record<CohortKey, string> = { CR25: 'CR25 코호트', CR26: 'CR26 코호트', PARENT: '교배 부모' }
/** 범주형 팔레트 인덱스(0부터). CSS 변수 --viz-cat-{i+1}, 차트 theme.categorical[i] */
export const COHORT_CAT: Record<CohortKey, number> = { CR25: 0, CR26: 2, PARENT: 3 }
export const cohortVar = (c: CohortKey) => `var(--viz-cat-${COHORT_CAT[c] + 1})`

export interface Kasp {
  id: string
  summary: string
  items: string[]
}
export interface Batch {
  id: string
  cohort: 'CR25' | 'CR26'
  crosses: [number, number]
  round: string
  bed: BedId
  f1Sow: string
  gs: 2027 | 2028
  f1Crosses: number
  ssdCrosses: number
  f2Note?: string
  kasp?: Kasp
}

const crossId = (cohort: string, n: number) => `${cohort}-${String(n).padStart(3, '0')}`
export const crossRange = (b: Batch) => `${crossId(b.cohort, b.crosses[0])}~${String(b.crosses[1]).padStart(3, '0')}`

/** crossing-record 실행값: CR26-315 KASP 4주 중 자식 3주, CR26-312 F1-3 1주 자식 */
export const CR26_315_SELF = 3
const R26_4_F1 = 16
const R26_4_SSD = 15
const R26_5_F1 = 8

const base = (id: string, cohort: 'CR25' | 'CR26', from: number, to: number, round: string, bed: BedId, f1Sow: string, gs: 2027 | 2028): Batch => ({
  id,
  cohort,
  crosses: [from, to],
  round,
  bed,
  f1Sow,
  gs,
  f1Crosses: to - from + 1,
  ssdCrosses: to - from + 1,
})

export const BATCHES: Batch[] = [
  base('R25-1', 'CR25', 1, 100, '2025 1차(온실)', 'A01', '2025-07-14', 2027),
  base('R25-2', 'CR25', 101, 200, '2025 1차', 'A02', '2025-07-28', 2027),
  base('R25-3', 'CR25', 201, 300, '2025 1차', 'A03', '2025-08-11', 2027),
  base('R25-4', 'CR25', 301, 400, '2025 2차(교배포)', 'A04', '2025-09-15', 2027),
  base('R26-1', 'CR26', 1, 100, '2026 1차(온실)', 'A05', '2026-07-13', 2028),
  base('R26-2', 'CR26', 101, 200, '2026 1차', 'B01', '2026-07-27', 2028),
  base('R26-3', 'CR26', 201, 300, '2026 1차', 'B02', '2026-08-10', 2028),
  {
    ...base('R26-4', 'CR26', 301, 316, '2026 2차 1묶음', 'B03', '2026-09-09', 2028),
    f1Crosses: R26_4_F1,
    ssdCrosses: R26_4_SSD,
    f2Note: `${R26_4_SSD}조합 ${R26_4_SSD * LINES_PER_CROSS}계통 · CR26-315 제외`,
    kasp: {
      id: 'KSP-2609-09',
      summary: `결과 09-30 · ${R26_4_F1}조합 중 ${R26_4_SSD}조합 F1 확인`,
      items: [
        `CR26-315 자식 의심(KASP ${F1_PER_CROSS}주 중 ${CR26_315_SELF}주) · F2 진입 제외, 2027년 1차 재교배(P27-B)`,
        `CR26-312 F1-3 자식 판정 · 이 개체의 F2 종자는 거두지 않음(나머지 ${F1_PER_CROSS - 1}주에서 수확)`,
      ],
    },
  },
  {
    ...base('R26-5', 'CR26', 317, 324, '2026 2차 2묶음', 'B03', '2026-10-08', 2028),
    f1Crosses: R26_5_F1,
    ssdCrosses: R26_5_F1,
    f2Note: `${R26_5_F1}조합 ${R26_5_F1 * LINES_PER_CROSS}계통 · KASP 11-03 후 확정`,
    kasp: {
      id: 'KSP-2611-01',
      summary: '잎 채취 10-26 · 결과 11-03 예정',
      items: ['자식 개체는 F2 진입 전에 제거'],
    },
  },
]
export const BATCH_BY_ID = new Map(BATCHES.map(b => [b.id, b]))

// ---------------------------------------------------------------- 교배 부모

export interface ParentSow {
  name: string
  heading: number
  sow1: string
  sow3: string
}
export interface ParentBlock {
  id: string
  bed: BedId
  label: string
  from: string
  /** 교배 시작일(막대에서 생육 → 교배·등숙 경계) */
  crossStart: string
  until: string
  cells: number
  done: boolean
  parents?: ParentSow[]
}

const P27_DEF: { id: string; bed: BedId; label: string; parents: [string, number][] }[] = [
  {
    id: 'P27-A',
    bed: 'B04',
    label: '2027 1차 교배 부모(cross-planner 추천 5조합)',
    parents: [
      ['YR21-0877', 120],
      ['YR23-0136', 119],
      ['YR22-0412', 118],
      ['YR22-0415', 116],
      ['YR22-0263', 111],
      ['YR21-0594', 107],
    ],
  },
  {
    id: 'P27-B',
    bed: 'B05',
    label: '2027 1차 재교배 부모(CR26-302·315·321)',
    parents: [
      ['YR20-1108', 124],
      ['YR22-8678', 119],
      ['YR22-6348', 107],
    ],
  },
]
const lastStagger = CROSS27.stagger[CROSS27.stagger.length - 1]!
export const P27: ParentBlock[] = P27_DEF.map(p => {
  const sows = p.parents.map(([name, heading]) => ({ name, heading, sow1: addDays(CROSS27.start, -heading), sow3: addDays(CROSS27.start, -heading + lastStagger) }))
  return {
    id: p.id,
    bed: p.bed,
    label: p.label,
    parents: sows,
    crossStart: CROSS27.start,
    from: sows.reduce((a, s) => (s.sow1 < a ? s.sow1 : a), '9999-12-31'),
    until: addDays(addDays(CROSS27.end, CROSS27.earlyHarvest), CLEAN),
    cells: p.parents.length * CROSS27.stagger.length * POTS_PER_SOWING * POT_CELLS,
    done: false,
  }
})
export const P26: ParentBlock[] = [
  { id: 'P26-A', bed: 'B04', label: '2026 1차 교배 부모', crossStart: '2026-06-07', from: '2026-02-07', until: addDays(addDays('2026-07-09', CROSS27.earlyHarvest), CLEAN), cells: 360, done: true },
  { id: 'P26-B', bed: 'B05', label: '2026 1차 교배 부모', crossStart: '2026-06-07', from: '2026-02-03', until: addDays(addDays('2026-07-09', CROSS27.earlyHarvest), CLEAN), cells: 180, done: true },
]
export const PARENTS: ParentBlock[] = [...P26, ...P27]
export const P27_ALL = P27.flatMap(p => p.parents!)
export const P27_FIRST = P27_ALL.reduce((a, s) => (s.sow1 < a.sow1 ? s : a))
/** 부모 파종일 일장 미보정 각주(명세 J·G). 월·분할 횟수는 상수에서 만든다 */
export const P27_DAYLENGTH_NOTE = `2027 교배 부모 파종일은 포장 출수 일수로 역산했고 온실 자연 일장(${Number(P27_FIRST.sow1.slice(5, 7))}월 파종이라 낮이 짧은 쪽)에 따른 출수 변화는 보정하지 않았습니다(추정, ${CROSS27.stagger.length}회 분할 파종으로 개화기를 넓힘).`
export const P27_BEDS = P27.map(p => p.bed)

// ---------------------------------------------------------------- 세대 일정

export interface Gen {
  g: number
  sow: string
  heading: string
  harvest: string
  /** 다음 세대 종자 준비일 */
  ready: string
  /** 베드 점유 마지막 날(포함) = 수확 + 정리 3일 */
  until: string
  bed: BedId
  method: MethodKey
  cells: number
  /** F6 GS 1차 잎 채취일 */
  sample: string | null
}
export interface Override {
  gen: number
  sow: string
  bed: BedId
  method: MethodKey
}
export type Overrides = Partial<Record<string, Override>>

export function schedule(b: Batch, ov?: Override | null): Gen[] {
  const gens: Gen[] = []
  let sow = b.f1Sow
  let bed = b.bed
  let method: MethodKey = 'standard'
  for (let g = 1; g <= 6; g++) {
    if (ov && ov.gen === g) {
      sow = ov.sow
      bed = ov.bed
      method = ov.method
    }
    const M = METHOD[method]
    const heading = addDays(sow, M.toHeading)
    const harvest = addDays(heading, M.headToHarvest)
    const ready = addDays(harvest, M.harvestToSow)
    gens.push({
      g,
      sow,
      heading,
      harvest,
      ready,
      until: addDays(harvest, CLEAN),
      bed,
      method,
      cells: g === 1 ? b.f1Crosses * F1_PER_CROSS : b.ssdCrosses * LINES_PER_CROSS,
      sample: g === 6 ? addDays(sow, SAMPLE_DAS) : null,
    })
    sow = ready
  }
  return gens
}

/** 편집 대상 세대 = 저장 전 기본 일정에서 파종일 > 기준일인 첫 세대 */
export const EDIT_GEN: Record<string, number> = Object.fromEntries(BATCHES.map(b => [b.id, schedule(b).find(x => x.sow > AS_OF)!.g]))

// ---------------------------------------------------------------- 점유·충돌

export interface Interval {
  owner: string
  cohort: CohortKey
  g: number
  bed: BedId
  from: string
  to: string
  cells: number
}

const OCC_DAYS = diffDays(WEEK_FROM, CHECK_END) + 1

export interface Plan {
  scheds: Map<string, Gen[]>
  iv: Interval[]
  /** 베드별 일별 셀(0 = WEEK_FROM) */
  occ: Record<BedId, Int32Array>
  conflicts: ConflictRun[]
}
export interface ConflictRun {
  bed: BedId
  from: string
  to: string
  maxCells: number
  maint: boolean
  owners: string[]
}

export const dayIndex = (iso: string) => diffDays(WEEK_FROM, iso)
export const cellsAt = (plan: Plan, bed: BedId, iso: string) => {
  const i = dayIndex(iso)
  return i >= 0 && i < OCC_DAYS ? plan.occ[bed][i]! : 0
}
export const maintOn = (bed: BedId, iso: string) => MAINT.find(m => m.bed === bed && m.from <= iso && iso <= m.to)

export function buildPlan(ov: Overrides): Plan {
  const scheds = new Map(BATCHES.map(b => [b.id, schedule(b, ov[b.id])]))
  const iv: Interval[] = []
  for (const b of BATCHES) for (const x of scheds.get(b.id)!) iv.push({ owner: b.id, cohort: b.cohort, g: x.g, bed: x.bed, from: x.sow, to: x.until, cells: x.cells })
  for (const p of PARENTS) iv.push({ owner: p.id, cohort: 'PARENT', g: 0, bed: p.bed, from: p.from, to: p.until, cells: p.cells })
  const occ = Object.fromEntries(BEDS.map(bed => [bed, new Int32Array(OCC_DAYS)])) as Record<BedId, Int32Array>
  for (const x of iv) {
    const a = Math.max(0, dayIndex(x.from))
    const z = Math.min(OCC_DAYS - 1, dayIndex(x.to))
    const arr = occ[x.bed]
    for (let i = a; i <= z; i++) arr[i]! += x.cells
  }
  const plan: Plan = { scheds, iv, occ, conflicts: [] }
  plan.conflicts = findConflicts(plan)
  return plan
}

function findConflicts(plan: Plan): ConflictRun[] {
  const out: ConflictRun[] = []
  const start = dayIndex(WIN.from)
  for (const bed of BEDS) {
    const arr = plan.occ[bed]
    let run: ConflictRun | null = null
    for (let i = start; i < OCC_DAYS; i++) {
      const d = addDays(WEEK_FROM, i)
      const c = arr[i]!
      const m = !!maintOn(bed, d)
      const bad = c > BED_CAP || (m && c > 0)
      if (bad && !run) run = { bed, from: d, to: d, maxCells: c, maint: m, owners: [] }
      else if (bad && run) {
        run.to = d
        run.maxCells = Math.max(run.maxCells, c)
        run.maint ||= m
      } else if (!bad && run) {
        out.push(run)
        run = null
      }
    }
    if (run) out.push(run)
  }
  for (const r of out) r.owners = [...new Set(plan.iv.filter(x => x.bed === r.bed && x.from <= r.to && r.from <= x.to).map(x => x.owner))]
  return out
}

/** 기준일 포함 90일 평균 셀 점유율(%) */
export function avgOccupancy(plan: Plan, days = 90): number {
  let s = 0
  for (let i = 0; i < days; i++) {
    const d = addDays(AS_OF, i)
    for (const bed of BEDS) s += cellsAt(plan, bed, d)
  }
  return (100 * s) / days / TOTAL_CAP
}

export interface WeekPoint {
  date: string
  byCohort: Record<CohortKey, number>
  total: number
  emptyBeds: number
}
export function weekly(plan: Plan): WeekPoint[] {
  const out: WeekPoint[] = []
  for (let d = WEEK_FROM; d <= WIN.to; d = addDays(d, 7)) {
    const byCohort: Record<CohortKey, number> = { CR25: 0, CR26: 0, PARENT: 0 }
    for (const x of plan.iv) if (x.from <= d && d <= x.to) byCohort[x.cohort] += x.cells
    out.push({ date: d, byCohort, total: byCohort.CR25 + byCohort.CR26 + byCohort.PARENT, emptyBeds: BEDS.filter(bed => cellsAt(plan, bed, d) === 0).length })
  }
  return out
}

export interface EmptyRun {
  from: string
  to: string
  days: number
  /** 앞뒤가 모두 점유된 짧은 빈 기간(세대 교체) */
  turnover: boolean
  /** 끝이 창 끝(열린 구간) */
  open: boolean
  maint?: (typeof MAINT)[number]
}
/** 기준일 이후 ~ 창 끝의 빈 기간(5일 이상) */
export function emptyRuns(plan: Plan, bed: BedId): EmptyRun[] {
  const out: EmptyRun[] = []
  let from: string | null = null
  const push = (to: string, open: boolean) => {
    const days = diffDays(from!, to) + 1
    if (days >= 5) {
      const m = MAINT.find(mm => mm.bed === bed && mm.from <= to && from! <= mm.to)
      const startsOccupied = from! > AS_OF
      out.push({ from: from!, to, days, open, turnover: startsOccupied && !open && days <= 9, maint: m })
    }
    from = null
  }
  for (let d = AS_OF; d <= WIN.to; d = addDays(d, 1)) {
    const c = cellsAt(plan, bed, d)
    if (c === 0 && from === null) from = d
    else if (c > 0 && from !== null) push(addDays(d, -1), false)
  }
  if (from !== null) push(WIN.to, true)
  return out
}

// ---------------------------------------------------------------- 묶음 상태

export type StageKey = 'veg' | 'ripen' | 'harvest' | 'seed'
export const STAGE_LABEL: Record<StageKey, string> = { veg: '영양 생장', ripen: '등숙', harvest: '수확', seed: '종자 준비(휴면 타파)' }

export function currentGen(gens: Gen[]): Gen {
  return gens.filter(x => x.sow <= AS_OF).at(-1)!
}
export function stageOf(gens: Gen[]): { gen: Gen; stage: StageKey; label: string } {
  const gen = currentGen(gens)
  const stage: StageKey = AS_OF < gen.heading ? 'veg' : AS_OF < gen.harvest ? 'ripen' : AS_OF === gen.harvest ? 'harvest' : 'seed'
  const label = stage === 'harvest' ? `F${gen.g} 수확 ${fmtD(gen.harvest)}` : stage === 'seed' ? `F${gen.g} 종자 준비` : `F${gen.g} ${STAGE_LABEL[stage]}`
  return { gen, stage, label }
}
export function nextTask(gens: Gen[]): { date: string; label: string } {
  const ev: { date: string; label: string }[] = []
  for (const x of gens) {
    ev.push({ date: x.sow, label: `F${x.g} 파종` }, { date: x.heading, label: `F${x.g} 출수` }, { date: x.harvest, label: `F${x.g} 수확` })
    if (x.sample) ev.push({ date: x.sample, label: 'F6 잎 채취(GS)' })
  }
  const next = ev.filter(e => e.date > AS_OF).sort((a, b) => a.date.localeCompare(b.date))[0]!
  return { date: next.date, label: `${next.label} ${fmtD(next.date)}` }
}

export type DeadlineStatus = 'ok' | 'caution' | 'late'
export function deadlineOf(b: Batch, gens: Gen[]): { deadline: string; sample: string; slack: number; status: DeadlineStatus; f6Ready: string; f1ToF6: number } {
  const deadline = DEADLINE_GS[b.gs]
  const sample = gens[5]!.sample!
  const slack = diffDays(sample, deadline)
  const status: DeadlineStatus = slack < 0 ? 'late' : slack <= DEADLINE_CAUTION ? 'caution' : 'ok'
  const f6Ready = gens[4]!.ready
  return { deadline, sample, slack, status, f6Ready, f1ToF6: diffDays(b.f1Sow, f6Ready) }
}
export const DEADLINE_LABEL: Record<DeadlineStatus, string> = { ok: '충족', caution: '주의', late: '지연' }
export const DEADLINE_TONE: Record<DeadlineStatus, 'positive' | 'warning' | 'negative'> = { ok: 'positive', caution: 'warning', late: 'negative' }

// ---------------------------------------------------------------- 편집·검증

export interface Draft {
  sowText: string
  bed: BedId
  method: MethodKey
}
export type Drafts = Partial<Record<string, Draft>>

/** 저장된 일정에서 편집 폼 초기값 */
export function draftFromSaved(b: Batch, savedGens: Gen[]): Draft {
  const x = savedGens[EDIT_GEN[b.id]! - 1]!
  return { sowText: x.sow, bed: x.bed, method: x.method }
}
export const sameDraft = (a: Draft, b: Draft) => a.sowText.trim() === b.sowText.trim() && a.bed === b.bed && a.method === b.method

/** 초안 → 일정 계산용 override(날짜 형식 오류면 null = 저장된 일정 유지) */
export function overrideOf(b: Batch, d: Draft): Override | null {
  const sow = parseIso(d.sowText)
  return sow ? { gen: EDIT_GEN[b.id]!, sow, bed: d.bed, method: d.method } : null
}

export interface Validation {
  format?: string
  early?: string
  capacity?: string
  maint?: string
  runs: ConflictRun[]
  deadline: ReturnType<typeof deadlineOf>
  deadlineMsg?: string
  storage?: string
}

export function validate(b: Batch, d: Draft, plan: Plan): Validation {
  const gens = plan.scheds.get(b.id)!
  const g = EDIT_GEN[b.id]!
  const out: Validation = { runs: [], deadline: deadlineOf(b, gens) }
  const sow = parseIso(d.sowText)
  if (!sow) out.format = 'YYYY-MM-DD 형식의 올바른 날짜를 입력하세요'
  const prev = g > 1 ? gens[g - 2]! : null
  if (sow && prev && sow < prev.ready) {
    out.early = `종자 준비일 ${prev.ready} 이전에는 파종할 수 없습니다(F${prev.g} 수확 ${fmtD(prev.harvest)} + 휴면 타파·최아 ${METHOD[prev.method].harvestToSow}일)`
  }
  if (sow && prev) {
    const stored = diffDays(prev.ready, sow)
    if (stored > STORAGE_CAUTION) out.storage = `종자 보관 ${stored}일 — 발아력 확인 권장`
  }
  out.runs = plan.conflicts.filter(r => r.owners.includes(b.id))
  const maintRun = out.runs.find(r => r.maint)
  if (maintRun) {
    const m = MAINT.find(mm => mm.bed === maintRun.bed && mm.from <= maintRun.to && maintRun.from <= mm.to)!
    out.maint = `${maintRun.bed} 정비 기간(${fmtD(m.from)}~${fmtD(m.to)}, ${m.label})과 겹칩니다`
  }
  const capRun = out.runs.find(r => r.maxCells > BED_CAP)
  if (capRun) {
    const others = plan.iv.filter(x => x.bed === capRun.bed && x.owner !== b.id && x.from <= capRun.from && capRun.from <= x.to)
    const othersText = others.map(x => `${x.owner} ${x.cells}셀`).join(', ')
    out.capacity = `${capRun.bed} 수용량 초과 · ${capRun.from}~${capRun.to} ${capRun.maxCells}/${BED_CAP}셀${othersText ? `(${othersText}과 겹침)` : ''} · 충돌 ${out.runs.length}구간`
  }
  const dl = out.deadline
  if (dl.status === 'late') out.deadlineMsg = `GS 1차 시료 채취 마감 ${dl.deadline}보다 ${-dl.slack}일 늦습니다(잎 채취 ${dl.sample})`
  else if (dl.status === 'caution') out.deadlineMsg = `마감 여유 ${dl.slack}일`
  return out
}
export const hasError = (v: Validation) => !!(v.format || v.early || v.capacity || v.maint)
export const hasWarning = (v: Validation) => v.deadline.status !== 'ok'

/** 베드 옵션 표시: 그 날짜에 이 묶음을 뺀 남은 셀 */
export function remainingAt(plan: Plan, ownerId: string, bed: BedId, iso: string): number {
  const used = plan.iv.filter(x => x.bed === bed && x.owner !== ownerId && x.from <= iso && iso <= x.to).reduce((a, x) => a + x.cells, 0)
  return BED_CAP - used
}

// ---------------------------------------------------------------- 요약(KPI·경보, 저장된 일정 기준)

export interface AlertRow {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  description?: string
  batch?: string
  bed?: BedId
}

export function summarize(plan: Plan) {
  const today = BEDS.map(bed => ({ bed, cells: cellsAt(plan, bed, AS_OF) }))
  const occupiedBeds = today.filter(t => t.cells > 0).length
  const cells = today.reduce((a, t) => a + t.cells, 0)
  const emptyBeds = today.filter(t => t.cells === 0).map(t => t.bed)
  const deadlines = BATCHES.map(b => ({ b, ...deadlineOf(b, plan.scheds.get(b.id)!) }))
  const gs27 = deadlines.filter(x => x.b.gs === 2027)
  const minGs27 = gs27.reduce((a, x) => (x.slack < a.slack ? x : a))
  const parentConflicts = plan.conflicts.filter(r => P27_BEDS.includes(r.bed))
  const alerts: AlertRow[] = []
  for (const r of plan.conflicts) {
    alerts.push({
      id: `conflict-${r.bed}-${r.from}`,
      level: 'critical',
      title: r.maint ? `${r.bed} 정비 기간 겹침` : `${r.bed} 수용량 초과 ${r.maxCells}/${BED_CAP}셀`,
      description: `${r.from}~${r.to} · ${r.owners.join(', ')}`,
      bed: r.bed,
    })
  }
  for (const x of deadlines.filter(x => x.status === 'late'))
    alerts.push({ id: `late-${x.b.id}`, level: 'critical', title: `${x.b.id} GS 1차 시료 채취 ${-x.slack}일 지연`, description: `잎 채취 ${x.sample} · 마감 ${x.deadline}`, batch: x.b.id })
  for (const x of deadlines.filter(x => x.status === 'caution'))
    alerts.push({ id: `caution-${x.b.id}`, level: 'warning', title: `${x.b.id} GS 1차 시료 채취 마감 여유 ${x.slack}일`, description: `잎 채취 ${x.sample} · 마감 ${x.deadline}`, batch: x.b.id })
  for (const b of BATCHES.filter(b => b.id === 'R26-5')) {
    const f2 = plan.scheds.get(b.id)![1]!.sow
    alerts.push({
      id: `kasp-${b.id}`,
      level: 'warning',
      title: `${b.id}(${crossRange(b)}) F1 진위 확인 전`,
      description: `잎 채취 10-26, KASP 결과 11-03 예정 · 자식 개체는 F2 진입(${fmtD(f2)}) 전에 제거`,
      batch: b.id,
    })
  }
  alerts.push(
    { id: 'cr26-315', level: 'info', title: `CR26-315 자식 의심(KASP ${F1_PER_CROSS}주 중 ${CR26_315_SELF}주)`, description: 'F2 진입 제외, 2027년 1차 재교배(P27-B)', batch: 'R26-4' },
    { id: 'cr26-312', level: 'info', title: 'CR26-312 F1-3 자식 판정', description: '이 개체의 F2 종자는 거두지 않음', batch: 'R26-4' },
    ...MAINT.map(m => ({ id: `maint-${m.bed}`, level: 'info' as const, title: `${m.bed} 정비 ${fmtD(m.from)}~${fmtD(m.to)}`, description: m.label, bed: m.bed })),
  )
  return {
    today,
    occupiedBeds,
    cells,
    emptyBeds,
    avg90: avgOccupancy(plan),
    deadlines,
    gs27: {
      total: gs27.length,
      ok: gs27.filter(x => x.status === 'ok').length,
      late: gs27.filter(x => x.status === 'late').length,
      caution: gs27.filter(x => x.status === 'caution').length,
      min: minGs27,
      lines: gs27.reduce((a, x) => a + x.b.ssdCrosses * LINES_PER_CROSS, 0),
    },
    parentConflicts,
    alerts,
  }
}
export type Summary = ReturnType<typeof summarize>

export const BASE_PLAN = buildPlan({})

/** 간트에 그릴 세대 막대(창과 겹치는 것) 개수 */
export const barsInWindow = (plan: Plan) => [...plan.scheds.values()].reduce((a, gens) => a + gens.filter(x => x.until >= WIN.from && x.sow <= WIN.to).length, 0)

// ---------------------------------------------------------------- DEV 검산(명세 수용 기준·검산 기록)

if (import.meta.env.DEV) {
  const s = summarize(BASE_PLAN)
  const eq = (got: unknown, want: unknown, what: string) => console.assert(got === want, `[검산] ${what}: ${String(got)} ≠ 기대 ${String(want)}`)
  eq(GEN_DAYS, 95, '세대당 일수(표준)')
  eq(genDays('embryo'), 85, '세대당 일수(배아 배양)')
  eq(GEN_PER_YEAR.toFixed(1), '3.8', '연간 세대 수')
  eq(F1_TO_F6_DAYS, 475, 'F1→F6 종자 일수')
  eq(F1_TO_F6_YEARS.toFixed(1), '1.3', 'F1→F6 종자 연수')
  eq(L_PARTS.reduce((a, [, v]) => a + v, 0).toFixed(1), L_DESIGN.toFixed(1), '세대 간격 L 구성 합')
  eq(s.occupiedBeds, 8, '기준일 점유 베드')
  eq(s.cells, 3396, '기준일 점유 셀')
  eq(s.emptyBeds.join('·'), 'B04·B05', '빈 베드')
  eq(s.avg90.toFixed(1), '67.6', '향후 90일 평균 셀 점유율')
  eq(s.deadlines.map(x => x.slack).join(','), '120,106,92,57,120,106,92,62,33', 'GS 1차 여유')
  eq(s.gs27.ok, 4, '2027 GS 충족 묶음')
  eq(s.gs27.lines, 2000, '2027 GS 계통 수')
  eq(BASE_PLAN.conflicts.length, 0, '기본 상태 충돌')
  eq(barsInWindow(BASE_PLAN), 35, '창 안 세대 막대')
  eq(P27_FIRST.sow1, '2027-02-03', '교배 부모 첫 파종')
  eq(P27_FIRST.name, 'YR20-1108', '교배 부모 첫 파종 계통')
  console.assert(P27_DAYLENGTH_NOTE.includes('2월 파종') && P27_DAYLENGTH_NOTE.includes('3회 분할'), `[검산] 부모 일장 각주: ${P27_DAYLENGTH_NOTE}`)
  eq(dDay(P27_FIRST.sow1), 103, '교배 부모 D-day')
  eq(dDay(DEADLINE_GS[2027]), 147, 'GS 마감 D-day')
  eq(P27_ALL.length, 9, '부모 계통 수')
  eq(P27.map(p => `${p.from}/${p.until}/${p.cells}`).join(' '), '2027-02-07/2027-08-09/360 2027-02-03/2027-08-09/180', '부모 묶음')
  eq(addDays(GS_INTAKE_2027, -FREEZE_DRY_DAYS), DEADLINE_GS[2027], 'GS 마감 역산')
  const wk = weekly(BASE_PLAN)
  eq(wk.length, 62, '주별 점수')
  const mx = wk.reduce((a, w) => (w.total > a.total ? w : a))
  const mn = wk.reduce((a, w) => (w.total < a.total ? w : a))
  eq(`${mx.date} ${mx.total}`, '2027-02-08 3655', '주별 최대')
  eq(`${mn.date} ${mn.total}`, '2027-08-23 1115', '주별 최소')
  const r254 = BASE_PLAN.scheds.get('R25-4')!
  eq(r254[4]!.ready, '2027-01-03', 'R25-4 F6 종자 준비')
  const r264 = BASE_PLAN.scheds.get('R26-4')!
  eq(`${r264[1]!.sow} ${r264[4]!.ready}`, '2026-12-13 2027-12-28', 'R26-4 F2·F6 종자')
  eq(['R26-1', 'R26-2', 'R26-3', 'R26-4', 'R26-5'].map(id => BASE_PLAN.scheds.get(id)![1]!.sow).join(','), '2026-10-16,2026-10-30,2026-11-13,2026-12-13,2027-01-11', 'CR26 F2 진입일')
  eq(emptyRuns(BASE_PLAN, 'B03').length, 0, 'B03 빈 기간 없음')
  eq(s.alerts.map(a => a.level).join(','), 'warning,info,info,info', '기본 경보 구성')
  // 시나리오
  const sc = (id: string, d: Draft) => {
    const b = BATCH_BY_ID.get(id)!
    const plan = buildPlan({ [id]: overrideOf(b, d) ?? undefined })
    return { plan, v: validate(b, d, plan) }
  }
  const a05 = sc('R26-4', { sowText: '2026-12-13', bed: 'A05', method: 'standard' })
  eq(a05.v.runs.length, 9, 'R26-4→A05 충돌 구간')
  eq(a05.v.capacity, 'A05 수용량 초과 · 2026-12-13~2027-01-13 575/500셀(R26-1 500셀과 겹침) · 충돌 9구간', 'R26-4→A05 문구')
  const b05 = sc('R26-2', { sowText: '2026-10-30', bed: 'B05', method: 'standard' })
  eq(b05.v.maint, 'B05 정비 기간(11-16~11-27, 보광 LED 교체)과 겹칩니다', 'R26-2→B05 정비 문구')
  eq(b05.v.runs.length, 3, 'R26-2→B05 충돌 구간')
  const late = sc('R25-4', { sowText: '2027-03-05', bed: 'A04', method: 'standard' })
  eq(`${late.v.deadline.sample} ${late.v.deadline.slack}`, '2027-03-23 -4', 'R25-4 F6 03-05 잎 채취·여유')
  eq(late.v.runs.length, 0, 'R25-4 F6 03-05 충돌')
  eq(avgOccupancy(late.plan).toFixed(1), '65.6', 'R25-4 저장 후 90일 평균')
  const emb = sc('R26-5', { sowText: '2027-01-11', bed: 'B03', method: 'embryo' })
  eq(`${emb.v.deadline.f6Ready} ${emb.v.deadline.f1ToF6} ${emb.v.deadline.sample} ${emb.v.deadline.slack}`, '2027-12-17 435 2028-01-04 73', 'R26-5 배아 배양')
  eq((emb.v.deadline.f1ToF6 / 365).toFixed(1), '1.2', 'R26-5 배아 배양 F1→F6 연수(상세 패널)')
  const early = sc('R26-4', { sowText: '2026-12-05', bed: 'B03', method: 'standard' })
  eq(early.v.early, '종자 준비일 2026-12-13 이전에는 파종할 수 없습니다(F1 수확 12-04 + 휴면 타파·최아 9일)', 'R26-4 이른 파종 문구')
}
