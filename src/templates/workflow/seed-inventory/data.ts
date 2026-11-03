/**
 * 종자 재고·분양 — 목업 데이터와 순수 계산 함수.
 * 명세: docs/specs/seed-inventory.md (기준일 2026-10-23, 시드 20261023)
 * 실제 API로 바꿀 때는 BASE_LOTS·REQUESTS를 응답으로 바꾸고 아래 계산 함수(derive·evalRequest·…)는 그대로 쓴다.
 * 모든 계통명·기관명·수치는 가상 목업이다.
 */
import { createRng } from '@/lib/rng'

// ---------------------------------------------------------------- 상수

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const TEST_GRAINS = 200
export const GERM_PASS = 85
export const GERM_FAIL = 80
export const RETEST_MONTHS = { pass: 12, caution: 6 } as const
export const DUE_SOON_DAYS = 30
/** 사용 여유(추정): 재검사 기한이 필요일 + 이 일수 안에 끝나면 파종 전에 기한이 지날 수 있어 출고 전 재검사를 권장 */
export const USE_MARGIN_DAYS = 30
export const MIN_HOLD = {
  check: 2000,
  cand: 3000,
  met: 500,
  parent: 100,
  ayt: 600,
  f1: 10,
} as const
export const HULL_RATIO = 0.8
export const MILL_RATIO = 0.736
export const AYT_RETAIN = 0.1
export const PLOT_AREA_M2 = 6.3
export const F1_SOW = 24
export const F1_TGW_FACTOR = 0.9
export const F1_SOW_DATE: Record<1 | 2, string> = {
  1: '2026-09-09',
  2: '2026-10-08',
}
export const SAVE_DELAY_MS = 600

/** 저장·검사 조건(화면 문구용, 추정) */
export const STORAGE = { tempC: 4, rh: 35 } as const
export const GERM_TEST = { tempC: 25, days: 14, reps: 2, perRep: 100 } as const
export const DORMANCY = { tempC: 50, days: 5 } as const
export const F1_CHECK_PLANTS = 4
export const AYT_RESULT_DATE = '2026-11-04'
export const PAGE_SIZE = 20
/** 용도별 표준 출고량(추정). MET = 지역 × 반복 × 구당, AYT = 반복 × 구당 */
export const STD_OUT = {
  cross: 10,
  met: { sites: 8, reps: 3, perPlot: 25, total: 600 },
  ayt: { reps: 3, perPlot: 30, total: 90 },
  external: { min: 30, max: 100 },
  dnaGrains: 20,
  /** 교배 립 환산에 쓰는 대표 천립중(정조) g */
  refTgw: 26.8,
} as const

export type Cat = keyof typeof MIN_HOLD
export const CATS: Cat[] = ['check', 'cand', 'met', 'parent', 'ayt', 'f1']
export const CAT_LABEL: Record<Cat, string> = {
  check: '대비 품종',
  cand: '출원 후보',
  met: 'MET',
  parent: '부모 후보',
  ayt: 'AYT',
  f1: 'F1',
}

export type Unit = 'g' | '립'
export type Use = '교배' | 'MET 파종' | 'AYT 파종' | '외부 분양' | '유전체 분석 시료'

// ---------------------------------------------------------------- 날짜 보조(UTC)

const parse = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number]
  return { y, m, dd }
}
export const addDays = (d: string, n: number) => {
  const { y, m, dd } = parse(d)
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10)
}
/** UTC 날짜의 월만 더한다(2026-03-27 + 6 → 2026-09-27) */
export const addMonths = (d: string, n: number) => {
  const { y, m, dd } = parse(d)
  return new Date(Date.UTC(y, m - 1 + n, dd)).toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => {
  const A = parse(a)
  const B = parse(b)
  return Math.round((Date.UTC(B.y, B.m - 1, B.dd) - Date.UTC(A.y, A.m - 1, A.dd)) / 86400000)
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const round1 = (x: number) => Math.round(x * 10) / 10

// ---------------------------------------------------------------- 다른 템플릿 실행값 복사(import 금지)

/** cross-planner CANDIDATES 60계통(정의 순서 그대로): 이름·그룹·가계 */
export const CANDIDATES =
  `YR22-0412 A F01|YR22-0415 A F01|YR21-0877 A F05|YR23-0136 A F09|YR22-0263 B F12|YR21-0594 B F12|YR20-1108 C F18|YR19-0731 C F19|YR23-6127 A F01|YR20-8715 A F02|YR23-9089 A F02|YR21-6913 A F02|YR23-1849 A F03|YR20-9960 A F03|YR21-1679 A F03|YR20-2163 A F04|YR23-6302 A F04|YR23-9707 A F04|YR22-7411 A F05|YR19-7937 A F05|YR22-2589 A F06|YR22-8678 A F06|YR21-3638 A F06|YR22-4728 A F07|YR22-3861 A F07|YR23-6269 A F07|YR21-5157 A F08|YR21-8380 A F08|YR21-8692 A F08|YR21-4266 A F09|YR22-0536 A F09|YR21-7243 A F10|YR20-5737 A F10|YR20-0301 A F10|YR20-5543 B F11|YR20-2388 B F11|YR22-7628 B F11|YR19-7011 B F12|YR20-0962 B F13|YR19-5010 B F13|YR21-2005 B F13|YR22-6348 B F14|YR21-8806 B F14|YR22-6163 B F14|YR21-1575 B F15|YR21-3833 B F15|YR19-7090 B F15|YR21-7615 B F16|YR21-1017 B F16|YR20-6987 B F16|YR21-5004 B F17|YR19-6821 B F17|YR23-5617 C F20|YR23-2191 C F21|YR20-0174 C F22|YR23-2035 C F23|YR19-0003 C F24|YR20-0315 C F25|YR22-7121 C F26|YR21-2709 C F27`
    .split('|')
    .map(s => {
      const [name, group, family] = s.split(' ') as [string, string, string]
      return { name, group, family }
    })

export const PARENTS_2ND = [
  'YR22-0412',
  'YR22-0415',
  'YR21-0877',
  'YR23-0136',
  'YR22-0263',
  'YR21-0594',
  'YR20-1108',
  'YR19-0731',
  'YR21-8380',
  'YR22-8678',
  'YR22-6348',
  'YR23-5617',
  'YR20-0962',
  'YR21-7243',
]
export const PARENTS_1ST = PARENTS_2ND.slice(0, 6)
export const AYT_PARENTS = ['YR20-1108', 'YR22-0263', 'YR22-0412', 'YR23-0136']
/** 대비 품종. 천립중(정조) = phenotype-entry 처리 41·42 현미 천립중 ÷ 0.80 */
export const CHECKS = [
  { id: 'YR07-0231', name: '가람솔', tgw: 27.3 },
  { id: 'YR13-0819', name: '온새미로', tgw: 27.1 },
]
export const MET_LINES = [
  'YR19-0118',
  'YR20-0342',
  'YR20-0527',
  'YR20-0815',
  'YR19-0256',
  'YR19-0477',
  'YR19-0902',
  'YR20-0163',
  'YR20-0691',
  'YR20-1024',
  'YR20-1236',
  'YR21-0108',
  'YR21-0335',
  'YR21-0419',
  'YR21-0652',
  'YR21-0786',
  'YR21-0943',
  'YR21-1150',
]
export const APP_CANDS = MET_LINES.slice(0, 3)
/** 출원 예정(YR19-0118, program-baseline) */
export const APP_FILING = '2026-12'

/** field-trial-layout 처리 1~40 순서: [계통, 천립중(정조) g, 반입량 g] */
export const AYT_LOTS: [string, number, number][] = [
  ['YR20-1108', 28.3, 1380],
  ['YR21-0347', 27.9, 1360],
  ['YR21-0592', 27.3, 1400],
  ['YR21-0618', 26.1, 1570],
  ['YR21-0773', 26.2, 930],
  ['YR21-0915', 26.6, 1270],
  ['YR21-1046', 27.7, 1360],
  ['YR21-1182', 28, 1540],
  ['YR22-0094', 26.9, 1440],
  ['YR22-0158', 28, 1400],
  ['YR22-0263', 27.7, 1450],
  ['YR22-0331', 28.1, 1380],
  ['YR22-0412', 27.3, 1540],
  ['YR22-0487', 27.4, 1480],
  ['YR22-0526', 27.7, 1390],
  ['YR22-0649', 29.1, 1510],
  ['YR22-0705', 28, 1520],
  ['YR22-0768', 26.8, 1330],
  ['YR22-0832', 27.9, 890],
  ['YR22-0901', 28.2, 1460],
  ['YR22-0957', 28.5, 1400],
  ['YR22-1023', 26.3, 1440],
  ['YR22-1104', 26.1, 1460],
  ['YR22-1176', 29.5, 1560],
  ['YR22-1239', 26.9, 1310],
  ['YR23-0047', 26.9, 1520],
  ['YR23-0112', 26.6, 1010],
  ['YR23-0136', 27.6, 1600],
  ['YR23-0205', 27, 1180],
  ['YR23-0271', 26.5, 1550],
  ['YR23-0318', 27, 1410],
  ['YR23-0384', 26.5, 1540],
  ['YR23-0446', 26.8, 1280],
  ['YR23-0503', 27.3, 1370],
  ['YR23-0569', 26.2, 1320],
  ['YR23-0620', 28.1, 1450],
  ['YR23-0688', 25.4, 1420],
  ['YR23-0741', 25.9, 1510],
  ['YR23-0815', 26.8, 1390],
  ['YR23-0872', 26.2, 1600],
]
/** 반입량이 작은 AYT 계통의 결측 구 사유(phenotype-entry) */
const AYT_MEMO: Record<string, string> = {
  'YR21-0773': '구 318 벼멸구 고사로 수확 불가 — 반입량이 적다',
  'YR22-0832': '구 131 시료 분실 — 반입량이 적다',
  'YR23-0112': '구 211 침수·도복으로 수확 불가 — 반입량이 적다',
}

type F1Status = 'confirmed' | 'suspect' | 'pending'
/** crossing-record 기본 상태 조합표: [조합 ID, 모본, 수확일, 결실 립수(null = 미입력), 진위 묶음, 진위 상태] */
export const F1_LOTS: [string, string, string, number | null, 1 | 2, F1Status][] = [
  ['CR26-301', 'YR21-0594', '2026-08-29', 86, 1, 'confirmed'],
  ['CR26-302', 'YR22-6348', '2026-08-29', 17, 1, 'confirmed'],
  ['CR26-303', 'YR21-0594', '2026-08-30', 89, 1, 'confirmed'],
  ['CR26-304', 'YR22-6348', '2026-08-30', 59, 1, 'confirmed'],
  ['CR26-305', 'YR20-0962', '2026-09-01', 86, 1, 'confirmed'],
  ['CR26-306', 'YR20-0962', '2026-09-01', 67, 1, 'confirmed'],
  ['CR26-307', 'YR22-0263', '2026-09-03', 63, 1, 'confirmed'],
  ['CR26-308', 'YR22-0263', '2026-09-03', 86, 1, 'confirmed'],
  ['CR26-309', 'YR23-5617', '2026-09-03', 83, 1, 'confirmed'],
  ['CR26-310', 'YR19-0731', '2026-09-04', 48, 1, 'confirmed'],
  ['CR26-311', 'YR19-0731', '2026-09-04', 110, 1, 'confirmed'],
  ['CR26-312', 'YR23-5617', '2026-09-04', 74, 1, 'confirmed'],
  ['CR26-313', 'YR21-8380', '2026-09-06', 76, 1, 'confirmed'],
  ['CR26-314', 'YR21-8380', '2026-09-06', 48, 1, 'confirmed'],
  ['CR26-315', 'YR22-0415', '2026-09-07', 215, 1, 'suspect'],
  ['CR26-316', 'YR22-0415', '2026-09-07', 50, 1, 'confirmed'],
  ['CR26-317', 'YR21-7243', '2026-09-09', 76, 2, 'pending'],
  ['CR26-318', 'YR22-0412', '2026-09-10', 42, 2, 'pending'],
  ['CR26-319', 'YR22-0412', '2026-09-10', null, 2, 'pending'],
  ['CR26-320', 'YR23-0136', '2026-09-10', 97, 2, 'pending'],
  ['CR26-321', 'YR22-8678', '2026-09-11', 27, 2, 'pending'],
  ['CR26-322', 'YR21-0877', '2026-09-12', 84, 2, 'pending'],
  ['CR26-323', 'YR21-0877', '2026-09-12', null, 2, 'pending'],
  ['CR26-324', 'YR20-1108', '2026-09-15', 83, 2, 'pending'],
]
const F1_SUSPECT_NOTE = 'KSP-2609-09 진위 검정 자식 3/4'

// ---------------------------------------------------------------- 타입

export interface GermTest {
  /** 치상일(2025 이전은 판정일과 같다). 200립 차감을 이 날짜에 기록 */
  date: string
  resultDate: string
  /** null = 판정 전(검사 중) */
  germ: number | null
}
export type EventKind = 'test' | 'out' | 'sow'
export interface LedgerEvent {
  date: string
  kind: EventKind
  g?: number
  grains?: number
  req?: string
  use?: Use
  note?: string
}
export interface Lot {
  id: string
  line: string
  /** 표 구분 칩용 로트 구분 */
  cat: Cat
  harvestYear: number
  source: string
  gen: string
  intakeDate: string | null
  /** g(정조) 또는 립(F1). null = 입고 대기(립수 미입력) */
  intake: number | null
  unit: Unit
  /** 천립중(정조) g */
  tgw: number
  storage: 1 | 2
  shelf: number
  box: string
  barcode: string
  tests: GermTest[]
  events: LedgerEvent[]
  memo?: string
  f1Status?: F1Status
  female?: string
}
export interface LineDef {
  id: string
  name?: string
  cats: Cat[]
  group?: string
  family?: string
}

// ---------------------------------------------------------------- 생성

const crossYear = (id: string) => 2000 + Number(id.slice(2, 4))
const genLabel = (id: string, hy: number) => `F${6 + (hy - crossYear(id) - 2)}`

const LINE_DEFS = new Map<string, LineDef>()
const addLine = (id: string, cat: Cat, extra: Partial<LineDef> = {}) => {
  const ex = LINE_DEFS.get(id)
  if (ex) {
    if (!ex.cats.includes(cat)) ex.cats.push(cat)
  } else LINE_DEFS.set(id, { id, cats: [cat], ...extra })
}

/** 2026 MET 1년차 세트(2024 코호트, AYT 2025 → MET 2026~2027) 20계통: [계통, 천립중(정조) g, 2025 AYT 보존 반입 g, 발아 2025-10-27, 발아 2026-03-16, 2026 채종포 반입 g, 발아 2026-10-07]
 *  정리 회차 5 A3(분석가 확정 상수, 별도 시드로 한 번 뽑아 고정 — 템플릿 난수 순서 불변). breeding-pipeline-flow MET_Y1_2024 = 20 */
export const MET_Y1_LOTS: [string, number, number, number, number, number, number][] = [
  ['YR21-0126', 27.6, 1480, 95, 93, 1730, 92],
  ['YR21-0258', 26.5, 1570, 93, 93, 2230, 95],
  ['YR21-0384', 26.9, 1530, 93, 91, 1680, 94],
  ['YR21-0461', 27.1, 1550, 92, 95, 2380, 94],
  ['YR21-0529', 28, 1350, 95, 94, 2070, 92],
  ['YR21-0663', 28, 1270, 93, 94, 2260, 91],
  ['YR21-0741', 28, 1390, 95, 94, 1790, 92],
  ['YR21-0858', 27.6, 1590, 97, 93, 2260, 93],
  ['YR21-0996', 27.1, 1470, 92, 95, 2180, 96],
  ['YR21-1073', 26.8, 1270, 94, 96, 1940, 94],
  ['YR22-0037', 26.8, 1380, 95, 96, 2200, 93],
  ['YR22-0119', 26.8, 1530, 93, 93, 2430, 96],
  ['YR22-0205', 25.4, 1260, 96, 93, 1970, 93],
  ['YR22-0298', 27.6, 1300, 98, 90, 2370, 94],
  ['YR22-0367', 26.5, 1530, 99, 92, 1910, 95],
  ['YR22-0443', 27.5, 1350, 95, 91, 1650, 93],
  ['YR22-0581', 26, 1530, 94, 91, 2490, 93],
  ['YR22-0612', 25.9, 1320, 97, 90, 2260, 94],
  ['YR22-0736', 28.1, 1250, 95, 90, 2480, 97],
  ['YR22-0874', 25.4, 1470, 96, 89, 2250, 96],
]

function generateLots(): Lot[] {
  const rng = createRng(SEED)
  const lots: Lot[] = []
  let seq25 = 0
  let seq26 = 0
  const byKey = new Map<string, Lot>()
  type NewLot = Omit<Lot, 'id' | 'events' | 'tests' | 'shelf' | 'box' | 'barcode'>
  const newLot = (o: NewLot, key: string) => {
    const n = o.harvestYear === 2025 ? ++seq25 : ++seq26
    const lot: Lot = {
      id: `L${String(o.harvestYear).slice(2)}-${String(n).padStart(3, '0')}`,
      events: [],
      tests: [],
      shelf: 0,
      box: '',
      barcode: '',
      ...o,
    }
    lots.push(lot)
    byKey.set(key, lot)
    return lot
  }
  const test = (lot: Lot, date: string, germ: number | null, resultDate = date) => {
    lot.tests.push({ date, resultDate, germ })
    lot.events.push({
      date,
      kind: 'test',
      grains: TEST_GRAINS,
      note: germ == null ? `발아 검사 치상(판정 예정 ${resultDate})` : `발아 검사 ${germ}%`,
    })
  }
  const out = (lot: Lot, date: string, req: string, use: Use, q: { g?: number; grains?: number }, note: string) => lot.events.push({ date, kind: 'out', req, use, ...q, note })

  for (const c of CHECKS) addLine(c.id, 'check', { name: c.name })
  for (const id of MET_LINES) addLine(id, APP_CANDS.includes(id) ? 'cand' : 'met')

  // ① 부모 후보 60 — CANDIDATES 순서
  const parentDraw = CANDIDATES.map(p => {
    const d: {
      intake: number
      tgw: number
      t0: string
      g0: number
      t1?: string
      g1?: number
    } = {
      intake: rng.int(15, 60) * 10,
      tgw: round1(clamp(rng.normal(26.8, 1.0), 24.5, 29.5)),
      t0: addDays('2025-11-17', rng.int(0, 74)),
      g0: Math.round(clamp(rng.normal(93, 2.5), 86, 99)),
    }
    if (PARENTS_2ND.includes(p.name)) {
      d.t1 = addDays('2026-03-23', rng.int(0, 4))
      d.g1 = Math.round(clamp(rng.normal(92, 2.5), 86, 99))
    }
    return d
  })
  // ② MET 18 — MET_LINES 순서
  const metDraw = MET_LINES.map(() => ({
    tgw: round1(clamp(rng.normal(26.8, 1.0), 24.5, 29.5)),
    in25: rng.int(140, 220) * 10,
    g25a: Math.round(clamp(rng.normal(95, 1.5), 90, 99)),
    g25b: Math.round(clamp(rng.normal(93, 2), 87, 99)),
    in26: rng.int(150, 250) * 10,
    g26: Math.round(clamp(rng.normal(94, 2), 88, 99)),
  }))
  // 심은 시나리오: 난수를 모두 뽑은 뒤 덮어쓴다(난수 순서 유지)
  const P_OVR: Record<string, Partial<(typeof parentDraw)[number]>> = {
    'YR21-0877': { intake: 40 },
    'YR22-8678': { g1: 83 },
    'YR19-0003': { g0: 78 },
    'YR20-0315': { g0: 84 },
  }
  const M_OVR: Record<string, Partial<(typeof metDraw)[number]>> = {
    'YR21-0419': { g26: 83 },
  }
  const CHECK_FIX: Record<string, { g25a: number; g25b: number; g26: number }> = {
    'YR07-0231': { g25a: 96, g25b: 95, g26: 96 },
    'YR13-0819': { g25a: 95, g25b: 94, g26: 95 },
  }
  const SEED_FARM = '본장 채종포 C-1'

  // L25: 대비 2 → MET 18 → 부모 후보 60
  for (const c of CHECKS) {
    const f = CHECK_FIX[c.id]!
    const L = newLot(
      {
        line: c.id,
        cat: 'check',
        harvestYear: 2025,
        source: SEED_FARM,
        gen: '기본식물',
        intakeDate: '2025-10-01',
        intake: 6000,
        unit: 'g',
        tgw: c.tgw,
        storage: 1,
      },
      `${c.id}|2025`,
    )
    test(L, '2025-10-20', f.g25a)
    test(L, '2026-03-16', f.g25b)
  }
  MET_LINES.forEach((id, i) => {
    const d = { ...metDraw[i]!, ...M_OVR[id] }
    const cand = APP_CANDS.includes(id)
    const L = newLot(
      {
        line: id,
        cat: cand ? 'cand' : 'met',
        harvestYear: 2025,
        source: SEED_FARM,
        gen: genLabel(id, 2025),
        intakeDate: '2025-10-01',
        intake: cand ? 3000 : d.in25,
        unit: 'g',
        tgw: d.tgw,
        storage: 1,
      },
      `${id}|2025`,
    )
    test(L, '2025-10-20', d.g25a)
    test(L, '2026-03-16', d.g25b)
  })
  CANDIDATES.forEach((p, i) => {
    addLine(p.name, 'parent', { group: p.group, family: p.family })
    const def = LINE_DEFS.get(p.name)!
    def.group = p.group
    def.family = p.family
    const d = { ...parentDraw[i]!, ...P_OVR[p.name] }
    const L = newLot(
      {
        line: p.name,
        cat: 'parent',
        harvestYear: 2025,
        source: AYT_PARENTS.includes(p.name) ? '2025 PYT 포장 A-2' : '2025 관찰 포장 B-1',
        gen: genLabel(p.name, 2025),
        intakeDate: '2025-10-27',
        intake: d.intake,
        unit: 'g',
        tgw: d.tgw,
        storage: 1,
      },
      `${p.name}|2025`,
    )
    test(L, d.t0, d.g0)
    if (d.t1 && d.g1 != null) test(L, d.t1, d.g1)
  })
  // L26: 대비 2 → MET 18 → AYT 40 → F1 24
  for (const c of CHECKS) {
    const L = newLot(
      {
        line: c.id,
        cat: 'check',
        harvestYear: 2026,
        source: SEED_FARM,
        gen: '기본식물',
        intakeDate: '2026-10-02',
        intake: 8000,
        unit: 'g',
        tgw: c.tgw,
        storage: 2,
      },
      `${c.id}|2026`,
    )
    test(L, '2026-10-07', CHECK_FIX[c.id]!.g26, '2026-10-21')
  }
  MET_LINES.forEach((id, i) => {
    const d = { ...metDraw[i]!, ...M_OVR[id] }
    const cand = APP_CANDS.includes(id)
    const L = newLot(
      {
        line: id,
        cat: cand ? 'cand' : 'met',
        harvestYear: 2026,
        source: SEED_FARM,
        gen: genLabel(id, 2026),
        intakeDate: '2026-10-02',
        intake: cand ? 5000 : d.in26,
        unit: 'g',
        tgw: d.tgw,
        storage: 2,
      },
      `${id}|2026`,
    )
    test(L, '2026-10-07', d.g26, '2026-10-21')
    if (M_OVR[id]) L.memo = '수확 전 강우로 수발아 일부(추정)'
  })
  for (const [name, tgw, retained] of AYT_LOTS) {
    addLine(name, 'ayt')
    const L = newLot(
      {
        line: name,
        cat: 'ayt',
        harvestYear: 2026,
        source: '2026 AYT 시험포장 A-3',
        gen: genLabel(name, 2026),
        intakeDate: '2026-10-19',
        intake: retained,
        unit: 'g',
        tgw,
        storage: 2,
        memo: AYT_MEMO[name],
      },
      `${name}|2026A`,
    )
    test(L, '2026-10-21', null, AYT_RESULT_DATE)
  }
  for (const [id, female, harvest, seeds, batch, f1s] of F1_LOTS) {
    addLine(id, 'f1')
    const ftgw = round1(byKey.get(`${female}|2025`)!.tgw * F1_TGW_FACTOR)
    const L = newLot(
      {
        line: id,
        cat: 'f1',
        harvestYear: 2026,
        source: '교배 망실 포장(2026 2차 교배)',
        gen: 'F1',
        intakeDate: seeds == null ? null : addDays(harvest, 1),
        intake: seeds,
        unit: '립',
        tgw: ftgw,
        storage: 2,
        f1Status: f1s,
        female,
        memo: f1s === 'suspect' ? F1_SUSPECT_NOTE : seeds == null ? '교배 실적 기록에서 결실 립수 미입력' : undefined,
      },
      id,
    )
    if (seeds != null) {
      const n = Math.min(F1_SOW, seeds)
      L.events.push({
        date: F1_SOW_DATE[batch],
        kind: 'sow',
        grains: n,
        note: `온실 F1 파종(진위 검정 ${F1_CHECK_PLANTS} + 육성 ${n - F1_CHECK_PLANTS}주)`,
      })
    }
  }
  // L25(이어 번호): MET 1년차 세트 20 — 2025 AYT 수확 보존 종자
  for (const [id, tgw, in25, g25a, g25b] of MET_Y1_LOTS) {
    addLine(id, 'met')
    const L = newLot({ line: id, cat: 'met', harvestYear: 2025, source: '2025 AYT 시험포장 A-3', gen: genLabel(id, 2025), intakeDate: '2025-10-20', intake: in25, unit: 'g', tgw, storage: 1 }, `${id}|2025`)
    test(L, '2025-10-27', g25a)
    test(L, '2026-03-16', g25b)
  }
  // L26(이어 번호): MET 1년차 세트 20 — 2026 본장 채종포 C-1(2027 2년차 파종용)
  for (const [id, tgw, , , , in26, g26] of MET_Y1_LOTS) {
    const L = newLot({ line: id, cat: 'met', harvestYear: 2026, source: SEED_FARM, gen: genLabel(id, 2026), intakeDate: '2026-10-02', intake: in26, unit: 'g', tgw, storage: 2 }, `${id}|2026`)
    test(L, '2026-10-07', g26, '2026-10-21')
  }
  // 지난 출고 이력(모두 출고 완료)
  const L25 = (id: string) => byKey.get(`${id}|2025`)!
  const checkIds = CHECKS.map(c => c.id)
  for (const n of PARENTS_1ST) out(L25(n), '2026-02-02', 'RQ26-002', '교배', { g: 10 }, '2026 1차 교배(온실)')
  for (const n of PARENTS_2ND) out(L25(n), '2026-04-06', 'RQ26-009', '교배', { g: 10 }, '2026 2차 교배포(하계)')
  for (const id of [...checkIds, ...MET_LINES]) out(L25(id), '2026-04-08', 'RQ26-010', 'MET 파종', { g: 600 }, `2026 MET 2년차 세트(완료 세트 ${MET_LINES.length} + 대비 ${CHECKS.length}, ${STD_OUT.met.sites}개 지역 × ${STD_OUT.met.reps}반복)`)
  for (const [id] of MET_Y1_LOTS) out(L25(id), '2026-04-08', 'RQ26-010', 'MET 파종', { g: 600 }, `2026 MET 1년차 세트(2024 코호트 ${MET_Y1_LOTS.length}계통, ${STD_OUT.met.sites}개 지역 × ${STD_OUT.met.reps}반복)`)
  for (const id of [...AYT_PARENTS, ...checkIds]) out(L25(id), '2026-04-20', 'RQ26-013', 'AYT 파종', { g: 90 }, '2026 AYT 시험포장 A-3(3반복)')
  for (const p of CANDIDATES) out(L25(p.name), '2026-09-25', 'RQ26-038', '유전체 분석 시료', { grains: 20 }, 'GBS-2611-01 부모 후보 60')
  for (const id of [...APP_CANDS, ...checkIds]) out(L25(id), '2026-10-14', 'RQ26-041', '유전체 분석 시료', { grains: 20 }, '품종 식별 DNA 프로파일(KASP ID 마커)')
  for (const L of lots) L.events.sort((a, b) => a.date.localeCompare(b.date))

  // 보관 위치(난수 없음)
  for (const s of [1, 2] as const) {
    let box = 0
    let inBox = 0
    let bin = 0
    let f1box = 0
    let f1in = 0
    for (const L of lots.filter(l => l.storage === s)) {
      if (L.unit === '립') {
        if (f1in === 0) f1box++
        f1in = (f1in + 1) % 12
        L.shelf = 10
        L.box = `B${String(f1box).padStart(2, '0')}`
      } else if ((L.intake ?? 0) >= 3000) {
        bin++
        L.shelf = 9
        L.box = `T${String(bin).padStart(2, '0')}`
      } else {
        if (inBox === 0) box++
        inBox = (inBox + 1) % 10
        L.shelf = Math.ceil(box / 6)
        L.box = `B${String(((box - 1) % 6) + 1).padStart(2, '0')}`
      }
      L.barcode = `S${s}-R${String(L.shelf).padStart(2, '0')}-${L.box}`
    }
  }
  return lots
}

export const BASE_LOTS: Lot[] = generateLots()
export const LINES: ReadonlyMap<string, LineDef> = LINE_DEFS

export function lineLabel(id: string): string {
  const d = LINES.get(id)
  return d?.name ? `${d.name}(${id})` : id
}
export function lineShort(id: string): string {
  return LINES.get(id)?.name ?? id
}

// ---------------------------------------------------------------- 요청

export type ReqStatus = 'pending' | 'approved' | 'shipped' | 'rejected'
export const REQ_STATUS_LABEL: Record<ReqStatus, string> = {
  pending: '승인 대기',
  approved: '승인·출고 대기',
  shipped: '출고 완료',
  rejected: '반려',
}
export const REQ_STATUS_RANK: Record<ReqStatus, number> = {
  pending: 0,
  approved: 1,
  shipped: 2,
  rejected: 3,
}
export interface ReqItem {
  line: string
  qty: number
  unit: Unit
  /** 사용자가 고른 로트(없으면 자동 제안) */
  lotOverride?: string
  excluded?: boolean
}
export interface Req {
  id: string
  date: string
  requester: string
  external?: boolean
  use: Use
  purpose: string
  need: string
  status: ReqStatus
  approved?: string
  shipped?: string
  rejected?: string
  rejectReason?: string
  mta?: 'signed' | 'pending'
  mtaDate?: string
  items: ReqItem[]
}
export const REJECT_REASONS = ['재고 부족', '발아 불합격 — 재증식 후 재요청', '출원 전 계통', 'MTA 미체결', '기타'] as const

const items = (lines: string[], qty: number, unit: Unit): ReqItem[] => lines.map(line => ({ line, qty, unit }))
const CHECK_IDS = CHECKS.map(c => c.id)

export const REQUESTS: Req[] = [
  {
    id: 'RQ26-038',
    date: '2026-09-24',
    requester: '유전체팀 정민호',
    use: '유전체 분석 시료',
    purpose: 'GBS-2611-01 부모 후보 60계통 잎 시료',
    need: '2026-09-25',
    status: 'shipped',
    approved: '2026-09-24',
    shipped: '2026-09-25',
    items: items(
      CANDIDATES.map(c => c.name),
      20,
      '립',
    ),
  },
  {
    id: 'RQ26-041',
    date: '2026-10-13',
    requester: '유전체팀 정민호',
    use: '유전체 분석 시료',
    purpose: '출원 후보 품종 식별 DNA 프로파일(KASP ID 마커)',
    need: '2026-10-14',
    status: 'shipped',
    approved: '2026-10-13',
    shipped: '2026-10-14',
    items: items([...APP_CANDS, ...CHECK_IDS], 20, '립'),
  },
  {
    id: 'RQ26-042',
    date: '2026-10-15',
    requester: '그린씨앗(주) 육종연구소',
    external: true,
    use: '외부 분양',
    purpose: '도열병 저항성 평가용',
    need: '2026-11-30',
    status: 'rejected',
    rejected: '2026-10-16',
    rejectReason: `출원 전 계통 — 품종보호 출원(${APP_FILING} 예정) 전 외부 분양 불가`,
    items: items(['YR19-0118'], 50, 'g'),
  },
  {
    id: 'RQ26-043',
    date: '2026-10-19',
    requester: '중부도 농업기술원 작물연구과',
    external: true,
    use: '외부 분양',
    purpose: '2027 지역 실증 시험 대비 품종',
    mta: 'signed',
    mtaDate: '2026-10-21',
    need: '2026-10-27',
    status: 'approved',
    approved: '2026-10-21',
    items: items(['YR07-0231'], 100, 'g'),
  },
  {
    id: 'RQ26-044',
    date: '2026-10-20',
    requester: '육종1팀 한지수',
    use: '교배',
    purpose: '2027 1차 교배(온실) 부모 — cross-planner 추천 5조합 + 재교배 3조합(CR26-302·315·321)',
    need: '2026-11-02',
    status: 'pending',
    items: items(['YR22-0412', 'YR22-0415', 'YR21-0877', 'YR23-0136', 'YR22-0263', 'YR21-0594', 'YR22-6348', 'YR22-8678', 'YR20-1108'], 10, 'g'),
  },
  {
    id: 'RQ26-045',
    date: '2026-10-21',
    requester: '시험연구팀 강도윤',
    use: 'MET 파종',
    purpose: '2027 지역 적응 확인 시험(출원 후보 3 + 대비 2, 8개 지역 × 3반복)',
    need: '2027-03-15',
    status: 'pending',
    items: items([...APP_CANDS, ...CHECK_IDS], 600, 'g'),
  },
  {
    id: 'RQ26-046',
    date: '2026-10-22',
    requester: '한빛대학교 식물분자육종 연구실',
    external: true,
    use: '외부 분양',
    purpose: 'Pi9 저항성 공여친 — 도열병 레이스 반응 연구',
    mta: 'pending',
    need: '2026-11-20',
    status: 'pending',
    items: items(['YR20-1108'], 30, 'g'),
  },
  {
    id: 'RQ26-047',
    date: '2026-10-22',
    requester: '품질팀 윤다온',
    use: '유전체 분석 시료',
    purpose: '저아밀로스(Wx) KASP 양성 대조',
    need: '2026-10-28',
    status: 'pending',
    items: items(['YR22-0263', 'YR22-6348'], 20, '립'),
  },
  {
    id: 'RQ26-048',
    date: '2026-10-23',
    requester: '육종2팀 오세린',
    use: '교배',
    purpose: '2027 1차 교배 추가 — 저항성 공여(Pib)',
    need: '2026-11-02',
    status: 'pending',
    items: items(['YR19-0003'], 10, 'g'),
  },
]

export interface InvState {
  lots: Lot[]
  requests: Req[]
}
export const INITIAL_STATE: InvState = { lots: BASE_LOTS, requests: REQUESTS }

// ---------------------------------------------------------------- 파생 계산

export const eventG = (lot: Lot, e: LedgerEvent) => e.g ?? ((e.grains ?? 0) * lot.tgw) / 1000

/** 재고 = 반입량 − Σ차감. g 로트는 g, F1은 립. 입고 대기는 null */
export function balance(lot: Lot): number | null {
  if (lot.intake == null) return null
  if (lot.unit === '립') return lot.intake - lot.events.reduce((a, e) => a + (e.kind === 'test' ? 0 : (e.grains ?? 0)), 0)
  return lot.intake - lot.events.reduce((a, e) => a + eventG(lot, e), 0)
}

export type GermGrade = 'pass' | 'caution' | 'fail' | 'testing' | 'exempt'
export type DueState = 'overdue' | 'soon' | 'ok'
export interface GermInfo {
  state: GermGrade
  last?: GermTest
  due?: string
  dueState?: DueState
  /** 검사 중일 때 판정 예정일 */
  expect?: string
}
export const GERM_LABEL: Record<GermGrade, string> = {
  pass: '합격',
  caution: '주의',
  fail: '불합격',
  testing: '검사 중',
  exempt: '검사 제외',
}

export function germInfo(lot: Lot): GermInfo {
  if (lot.unit === '립') return { state: 'exempt' }
  const done = lot.tests.filter(t => t.germ != null)
  const last = done[done.length - 1]
  const pending = lot.tests.find(t => t.germ == null)
  if (pending) return { state: 'testing', expect: pending.resultDate, last }
  if (!last || last.germ == null) return { state: 'testing' }
  if (last.germ < GERM_FAIL) return { state: 'fail', last }
  const grade = last.germ >= GERM_PASS ? 'pass' : 'caution'
  const due = addMonths(last.resultDate, RETEST_MONTHS[grade])
  const dueState: DueState = due < AS_OF ? 'overdue' : due <= addDays(AS_OF, DUE_SOON_DAYS) ? 'soon' : 'ok'
  return { state: grade, last, due, dueState }
}

export type LotStatus = 'ok' | 'fail' | 'empty' | 'hold' | 'awaiting'
export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  ok: '사용 가능',
  fail: '발아 불합격',
  empty: '소진',
  hold: '사용 보류',
  awaiting: '입고 대기',
}

export function lotStatus(lot: Lot, bal = balance(lot), germ = germInfo(lot)): LotStatus {
  if (lot.intake == null) return 'awaiting'
  if (lot.f1Status === 'suspect') return 'hold'
  if ((bal ?? 0) <= 0) return 'empty'
  if (germ.state === 'fail') return 'fail'
  return 'ok'
}

export interface LineInfo extends LineDef {
  lots: Lot[]
  min: number
  /** 최소 보유량을 정한 구분(두 구분이면 큰 값) */
  minCat: Cat
  unit: Unit
  avail: number
  below: boolean
  awaiting: boolean
  hold: boolean
}
export interface LotRow {
  lot: Lot
  bal: number | null
  germ: GermInfo
  status: LotStatus
}
export interface Derived {
  rows: LotRow[]
  row: (id: string) => LotRow
  lines: Map<string, LineInfo>
}

export function derive(s: InvState): Derived {
  const rows: LotRow[] = s.lots.map(lot => {
    const bal = balance(lot)
    const germ = germInfo(lot)
    return { lot, bal, germ, status: lotStatus(lot, bal, germ) }
  })
  const byId = new Map(rows.map(r => [r.lot.id, r]))
  const byLine = new Map<string, LotRow[]>()
  for (const r of rows) {
    const a = byLine.get(r.lot.line)
    if (a) a.push(r)
    else byLine.set(r.lot.line, [r])
  }
  const lines = new Map<string, LineInfo>()
  for (const def of LINES.values()) {
    const ls = byLine.get(def.id) ?? []
    let minCat: Cat = def.cats[0]!
    for (const c of def.cats) if (MIN_HOLD[c] > MIN_HOLD[minCat]) minCat = c
    const avail = ls.filter(r => r.status === 'ok').reduce((a, r) => a + (r.bal ?? 0), 0)
    const awaiting = ls.some(r => r.status === 'awaiting')
    const hold = ls.some(r => r.status === 'hold')
    lines.set(def.id, {
      ...def,
      lots: ls.map(r => r.lot),
      min: MIN_HOLD[minCat],
      minCat,
      unit: def.cats.includes('f1') ? '립' : 'g',
      avail,
      below: !awaiting && !hold && avail < MIN_HOLD[minCat],
      awaiting,
      hold,
    })
  }
  return { rows, row: id => byId.get(id)!, lines }
}

// ---------------------------------------------------------------- 요청 점검

export type BlockCode = 'short' | 'fail' | 'none' | 'unreleased' | 'invalidQty'
export type WarnCode = 'caution' | 'overdue' | 'untested' | 'failDna' | 'belowMinAfter' | 'dueBeforeUse'
export const WARN_LABEL: Record<WarnCode, string> = {
  caution: '발아 주의',
  overdue: '재검사 기한 지남',
  untested: '발아 검사 전',
  failDna: '발아 불합격(시료 용도 허용)',
  belowMinAfter: '출고 후 최소 보유량 미달',
  dueBeforeUse: '사용 전 재검사 기한 도래',
}
export interface ItemEval {
  item: ReqItem
  lot?: LotRow
  /** 선택 가능한 로트(사용 가능, 시료 용도는 불합격 포함) */
  options: LotRow[]
  need: number | null
  after: number | null
  blocks: BlockCode[]
  warns: WarnCode[]
  /** 요청 필요일(경고 문구용) */
  reqNeed: string
  lineAvail: number
  min: number
}
export interface ReqEval {
  items: ItemEval[]
  active: ItemEval[]
  mtaBlock: boolean
  blockCount: number
  warnCount: number
  blocked: boolean
}

const fifo = (a: LotRow, b: LotRow) => a.lot.harvestYear - b.lot.harvestYear || a.lot.id.localeCompare(b.lot.id)
export const toG = (lot: Lot, it: Pick<ReqItem, 'qty' | 'unit'>) => (it.unit === 'g' ? it.qty : (it.qty * lot.tgw) / 1000)

export function evalItem(d: Derived, req: Req, it: ReqItem): ItemEval {
  const ln = d.lines.get(it.line)!
  const all = (ln.lots.map(l => d.row(l.id)) ?? []).sort(fifo)
  const dna = req.use === '유전체 분석 시료'
  const options = all.filter(r => r.status === 'ok' || (dna && r.status === 'fail'))
  const blocks: BlockCode[] = []
  const warns: WarnCode[] = []
  if (req.external && APP_CANDS.includes(it.line)) blocks.push('unreleased')
  const validQty = Number.isInteger(it.qty) && it.qty >= 1
  if (!validQty) blocks.push('invalidQty')
  let lot: LotRow | undefined
  const enough = (r: LotRow) => (r.bal ?? 0) >= toG(r.lot, it)
  const override = it.lotOverride ? options.find(r => r.lot.id === it.lotOverride) : undefined
  if (override) {
    lot = override
    if (validQty && !enough(lot)) blocks.push('short')
    if (lot.germ.state === 'testing') warns.push('untested')
  } else {
    const tested = options.filter(r => r.germ.state === 'pass' || r.germ.state === 'caution' || r.germ.state === 'fail')
    lot = tested.find(enough)
    if (!lot) {
      lot = options.filter(r => r.germ.state === 'testing').find(enough)
      if (lot) warns.push('untested')
    }
    if (!lot) {
      if (options.length) {
        lot = [...options].sort((a, b) => (b.bal ?? 0) - (a.bal ?? 0))[0]
        if (validQty) blocks.push('short')
      } else if (all.some(r => r.status === 'fail')) {
        lot = all.find(r => r.status === 'fail')
        blocks.push('fail')
      } else blocks.push('none')
    }
  }
  if (lot) {
    if (lot.germ.state === 'caution') warns.push('caution')
    if (lot.germ.dueState === 'overdue') warns.push('overdue')
    else if (!dna && (lot.germ.state === 'pass' || lot.germ.state === 'caution') && lot.germ.due && lot.germ.due < addDays(req.need, USE_MARGIN_DAYS)) warns.push('dueBeforeUse')
    if (lot.germ.state === 'fail' && dna) warns.push('failDna')
    if (!blocks.length && lot.germ.state !== 'fail' && ln.avail - toG(lot.lot, it) < ln.min) warns.push('belowMinAfter')
  }
  const need = lot && validQty ? toG(lot.lot, it) : null
  return {
    item: it,
    lot,
    options,
    need,
    after: lot && need != null ? (lot.bal ?? 0) - need : null,
    blocks,
    warns,
    reqNeed: req.need,
    lineAvail: ln.avail,
    min: ln.min,
  }
}

export function evalRequest(d: Derived, req: Req): ReqEval {
  const evals = req.items.map(it => evalItem(d, req, it))
  const active = evals.filter(e => !e.item.excluded)
  const mtaBlock = !!req.external && req.mta !== 'signed'
  const blockCount = active.reduce((a, e) => a + e.blocks.length, 0) + (mtaBlock ? 1 : 0) + (active.length === 0 ? 1 : 0)
  const warnCount = active.reduce((a, e) => a + e.warns.length, 0)
  return {
    items: evals,
    active,
    mtaBlock,
    blockCount,
    warnCount,
    blocked: blockCount > 0,
  }
}

/** 요청 상태가 열려 있는지(점검 대상) */
export const isOpen = (r: Req) => r.status === 'pending' || r.status === 'approved'

// ---------------------------------------------------------------- 상태 전이(순수)

const replaceReq = (s: InvState, id: string, f: (r: Req) => Req): InvState => ({
  ...s,
  requests: s.requests.map(r => (r.id === id ? f(r) : r)),
})

export function updateItem(s: InvState, reqId: string, line: string, patch: Partial<ReqItem>): InvState {
  return replaceReq(s, reqId, r => ({
    ...r,
    items: r.items.map(it => (it.line === line ? { ...it, ...patch } : it)),
  }))
}
export function setMta(s: InvState, reqId: string, signed: boolean): InvState {
  return replaceReq(s, reqId, r => ({
    ...r,
    mta: signed ? 'signed' : 'pending',
    mtaDate: signed ? AS_OF : undefined,
  }))
}
export function approve(s: InvState, reqId: string): InvState {
  return replaceReq(s, reqId, r => ({
    ...r,
    status: 'approved',
    approved: AS_OF,
  }))
}
export function cancelApproval(s: InvState, reqId: string): InvState {
  return replaceReq(s, reqId, r => ({
    ...r,
    status: 'pending',
    approved: undefined,
  }))
}
export function reject(s: InvState, reqId: string, reason: string): InvState {
  return replaceReq(s, reqId, r => ({
    ...r,
    status: 'rejected',
    rejected: AS_OF,
    rejectReason: reason,
  }))
}
export interface ShipResult {
  state: InvState
  shipped: {
    line: string
    lot: string
    qty: number
    unit: Unit
    after: number
  }[]
  belowLines: string[]
}
/** 출고: 품목별 제안 로트에서 차감하고 원장에 출고 행을 추가한다. 차단이 있으면 null */
export function ship(s: InvState, reqId: string): ShipResult | null {
  const req = s.requests.find(r => r.id === reqId)!
  const d = derive(s)
  const ev = evalRequest(d, req)
  if (ev.blocked) return null
  const add = new Map<string, LedgerEvent[]>()
  for (const e of ev.active) {
    const id = e.lot!.lot.id
    const ev2: LedgerEvent = {
      date: AS_OF,
      kind: 'out',
      req: req.id,
      use: req.use,
      note: req.purpose,
      ...(e.item.unit === 'g' ? { g: e.item.qty } : { grains: e.item.qty }),
    }
    add.set(id, [...(add.get(id) ?? []), ev2])
  }
  const lots = s.lots.map(l => (add.has(l.id) ? { ...l, events: [...l.events, ...add.get(l.id)!] } : l))
  const next: InvState = {
    lots,
    requests: s.requests.map(r => (r.id === reqId ? { ...r, status: 'shipped' as const, shipped: AS_OF } : r)),
  }
  const d2 = derive(next)
  const shipped = ev.active.map(e => ({
    line: e.item.line,
    lot: e.lot!.lot.id,
    qty: e.item.qty,
    unit: e.item.unit,
    after: d2.row(e.lot!.lot.id).bal ?? 0,
  }))
  const belowLines = [...new Set(ev.active.map(e => e.item.line))].filter(l => d2.lines.get(l)!.below)
  return { state: next, shipped, belowLines }
}

// ---------------------------------------------------------------- 요약·경보

export function summarize(s: InvState, d: Derived) {
  const open = s.requests.filter(isOpen)
  const evals = new Map(open.map(r => [r.id, evalRequest(d, r)]))
  const pending = s.requests.filter(r => r.status === 'pending')
  const lineList = [...d.lines.values()]
  const below = lineList.filter(l => l.below)
  const gLots = d.rows.filter(r => r.lot.unit === 'g')
  const f1Lots = d.rows.filter(r => r.lot.unit === '립' && r.bal != null)
  const germCount = (g: GermGrade) => d.rows.filter(r => r.germ.state === g).length
  return {
    pending: pending.length,
    blocked: open.filter(r => evals.get(r.id)!.blocked).length,
    approved: s.requests.filter(r => r.status === 'approved').length,
    octShipped: s.requests.filter(r => r.shipped?.startsWith(AS_OF.slice(0, 7))).length,
    below: below.length,
    belowByCat: CATS.map(c => ({
      cat: c,
      n: below.filter(l => l.minCat === c).length,
    })).filter(x => x.n > 0),
    holdLines: lineList.filter(l => l.hold).length,
    awaitingLines: lineList.filter(l => l.awaiting).length,
    overdue: d.rows.filter(r => r.germ.dueState === 'overdue').length,
    soon: d.rows.filter(r => r.germ.dueState === 'soon').length,
    germ: {
      pass: germCount('pass'),
      caution: germCount('caution'),
      fail: germCount('fail'),
      testing: germCount('testing'),
      exempt: germCount('exempt'),
    },
    totalG: gLots.reduce((a, r) => a + (r.bal ?? 0), 0),
    lots: d.rows.length,
    f1Grains: f1Lots.reduce((a, r) => a + (r.bal ?? 0), 0),
    f1Hold: f1Lots.filter(r => r.status === 'hold').reduce((a, r) => a + (r.bal ?? 0), 0),
    evals,
  }
}

/** "경보만" = 최소 보유량 미달 계통의 로트 + 재검사 기한 지남·30일 이내 + 불합격·주의 + 보류·소진·입고 대기 */
export function isAlarmLot(d: Derived, r: LotRow): boolean {
  return (
    !!d.lines.get(r.lot.line)?.below ||
    r.germ.dueState === 'overdue' ||
    r.germ.dueState === 'soon' ||
    r.germ.state === 'fail' ||
    r.germ.state === 'caution' ||
    r.status === 'hold' ||
    r.status === 'empty' ||
    r.status === 'awaiting'
  )
}

// ---------------------------------------------------------------- 표시 보조

/** 재고 g: 100 g 이상 정수(쉼표), 미만 소수 1자리. 원값에서 한 번만 반올림 */
export function gDigits(g: number) {
  return Math.abs(g) >= 100 ? 0 : 1
}
/** g → 립(정수 반올림 한 번) */
export const toGrains = (g: number, tgw: number) => Math.round((g / tgw) * 1000)
/** 표의 날짜: 기준 연도면 MM-DD, 아니면 YYYY-MM-DD */
export const tableDate = (d: string) => (d.slice(0, 4) === AS_OF.slice(0, 4) ? d.slice(5) : d)
/** 최소 보유량 미달 경보 문구에 쓰는 다음 증식 연도 */
export const NEXT_YEAR = Number(AS_OF.slice(0, 4)) + 1

// ---------------------------------------------------------------- DEV 검산

if (import.meta.env.DEV) {
  const A = (cond: boolean, msg: string) => console.assert(cond, `[검산] seed-inventory: ${msg}`)
  const near = (a: number, b: number, tol = 0.001) => Math.abs(a - b) <= tol
  const d = derive(INITIAL_STATE)
  const lots = INITIAL_STATE.lots
  A(STD_OUT.met.sites * STD_OUT.met.reps * STD_OUT.met.perPlot <= STD_OUT.met.total && STD_OUT.ayt.reps * STD_OUT.ayt.perPlot === STD_OUT.ayt.total, '표준 출고량 구성 불일치')
  A(lots.length === 204, `로트 수 ${lots.length} ≠ 204`)
  A(lots.filter(l => l.harvestYear === 2025).length === 100, '2025 로트 ≠ 100')
  const catN = CATS.map(c => lots.filter(l => l.cat === c).length).join('/')
  A(catN === '4/6/70/60/40/24', `구분별 로트 ${catN} ≠ 4/6/70/60/40/24`)
  A(LINES.size === 160, `관리 대상 ${LINES.size} ≠ 160`)
  const y1Lots = lots.filter(l => MET_Y1_LOTS.some(([id]) => id === l.line)).length
  A(y1Lots === MET_Y1_LOTS.length * 2 && y1Lots === 40, `MET 1년차 세트 로트 ${y1Lots} ≠ 40`)
  const rq010 = lots.flatMap(l => l.events.filter(e => e.kind === 'out' && e.req === 'RQ26-010').map(e => ({ y1: MET_Y1_LOTS.some(([id]) => id === l.line), g: e.g ?? 0 })))
  const rq010Y1 = rq010.filter(e => e.y1).reduce((a, e) => a + e.g, 0)
  const rq010All = rq010.reduce((a, e) => a + e.g, 0)
  A(rq010.length === 40 && rq010Y1 === MET_Y1_LOTS.length * STD_OUT.met.total && rq010All === 24000, `RQ26-010 출고 ${rq010.length}계통 ${rq010All} g(1년차 세트 ${rq010Y1} g) ≠ 40계통 24,000 g(1년차 12,000 g)`)
  const sm = summarize(INITIAL_STATE, d)
  A(near(sm.totalG, 232133.446), `재고 합 ${sm.totalG} ≠ 232,133.446 g`)
  const f1In = lots.filter(l => l.unit === '립').reduce((a, l) => a + (l.intake ?? 0), 0)
  const f1Sown = lots.filter(l => l.unit === '립').reduce((a, l) => a + l.events.reduce((x, e) => x + (e.grains ?? 0), 0), 0)
  A(f1In === 1666 && f1Sown === 521 && sm.f1Grains === 1145 && sm.f1Hold === 191, `F1 립 ${f1In}/${f1Sown}/${sm.f1Grains}/${sm.f1Hold} ≠ 1666/521/1145/191`)
  const g = sm.germ
  A(`${g.pass}/${g.caution}/${g.fail}/${g.testing}/${g.exempt}` === '136/3/1/40/24', `발아 판정 ${g.pass}/${g.caution}/${g.fail}/${g.testing}/${g.exempt} ≠ 136/3/1/40/24`)
  A(sm.overdue === 2 && sm.soon === 4, `기한 지남 ${sm.overdue}·30일 이내 ${sm.soon} ≠ 2·4`)
  const belowIds = [...d.lines.values()]
    .filter(l => l.below)
    .map(l => l.id)
    .join(',')
  A(belowIds === 'YR21-0877,YR19-0003,CR26-302,CR26-321', `최소 보유량 미달 ${belowIds}`)
  A(sm.pending === 5 && sm.approved === 1 && sm.blocked === 3 && sm.octShipped === 1, `요청 승인 대기 ${sm.pending}·승인 ${sm.approved}·차단 ${sm.blocked}·10월 ${sm.octShipped} ≠ 5·1·3·1`)
  A(near(d.row('L25-001').bal!, 5298.534), `L25-001 재고 ${d.row('L25-001').bal} ≠ 5,298.534`)
  A(near(d.row('L25-023').bal!, 9.374), `L25-023 재고 ${d.row('L25-023').bal} ≠ 9.374`)
  A(toGrains(9.374, d.row('L25-023').lot.tgw) === 371, 'L25-023 립 환산 ≠ 371')
  {
    const e0877 = evalRequest(d, INITIAL_STATE.requests.find(r => r.id === 'RQ26-044')!).items.find(e => e.item.line === 'YR21-0877')!
    const short = (e0877.need ?? 0) - (e0877.lot?.bal ?? 0)
    A(e0877.blocks.includes('short') && short.toFixed(1) === '0.6', `RQ26-044 YR21-0877 부족 ${short.toFixed(1)} g ≠ 0.6 g`)
  }
  {
    const reqOf = (id: string) => INITIAL_STATE.requests.find(r => r.id === id)!
    const e45 = evalRequest(d, reqOf('RQ26-045'))
    A(e45.warnCount === 5 && e45.blockCount === 0 && e45.active.every(e => e.warns.length === 1 && e.warns[0] === 'dueBeforeUse'), `RQ26-045 경고 5(모두 사용 전 재검사 기한 도래)·차단 0 기대, 실제 경고 ${e45.warnCount}·차단 ${e45.blockCount}`)
    const e44 = evalRequest(d, reqOf('RQ26-044'))
    A(e44.warnCount === 2, `RQ26-044 경고 2 기대, 실제 ${e44.warnCount}`)
    const s45 = updateItem(INITIAL_STATE, 'RQ26-045', 'YR19-0118', { lotOverride: 'L26-003' })
    const i118 = evalRequest(derive(s45), s45.requests.find(r => r.id === 'RQ26-045')!).items.find(e => e.item.line === 'YR19-0118')!
    A(i118.warns.length === 0 && i118.after != null && Math.round(i118.after) === 4395, `RQ26-045 YR19-0118 → L26-003: 경고 해제·출고 후 4,395 g 기대, 실제 경고 ${i118.warns.length}·${i118.after}`)
  }
  A(d.row('L26-033').lot.tgw === 27.3 && d.row('L26-033').lot.line === 'YR22-0412', 'L26-033 천립중 ≠ 27.3')
  A(d.rows.filter(r => isAlarmLot(d, r)).length === 14, '경보만 로트 ≠ 14')
  A(
    d.rows.every(r => r.bal == null || r.bal >= -1e-9),
    '음수 재고 로트가 있다',
  )
  A(
    lots.every(l => {
      const first = l.tests.find(t => t.germ != null)?.resultDate
      return !first || l.events.filter(e => e.kind === 'out').every(e => e.date >= first)
    }),
    '첫 판정일보다 이른 출고가 있다',
  )
  // 시연 1·2
  const r1 = ship(INITIAL_STATE, 'RQ26-043')
  A(!!r1 && near(derive(r1.state).row('L25-001').bal!, 5198.534), 'RQ26-043 출고 후 L25-001 ≠ 5,198.534')
  if (r1) {
    let s2 = updateItem(r1.state, 'RQ26-044', 'YR21-0877', { qty: 9 })
    const e44 = evalRequest(
      derive(s2),
      s2.requests.find(r => r.id === 'RQ26-044')!,
    )
    A(!e44.blocked && e44.items.find(e => e.item.line === 'YR21-0877')!.warns.includes('belowMinAfter'), 'YR21-0877 9 g: 차단 해제·출고 후 미달 경고 아님')
    s2 = approve(s2, 'RQ26-044')
    const r2 = ship(s2, 'RQ26-044')
    if (r2) {
      const d2 = derive(r2.state)
      const s3 = summarize(r2.state, d2)
      A(near(d2.row('L25-023').bal!, 0.374), `시연 2 L25-023 ${d2.row('L25-023').bal} ≠ 0.374`)
      A(near(s3.totalG, 231944.446), `시연 2 재고 합 ${s3.totalG} ≠ 231,944.446`)
      A(s3.pending === 4 && s3.blocked === 2 && s3.octShipped === 3 && s3.below === 4, `시연 2 요약 ${s3.pending}·${s3.blocked}·${s3.octShipped}·${s3.below} ≠ 4·2·3·4`)
      A(r2.shipped.reduce((a, x) => a + x.qty, 0) === 89 && r2.belowLines.join() === 'YR21-0877', '시연 2 출고 89 g·미달 YR21-0877 아님')
    } else A(false, '시연 2 출고가 차단됐다')
  }
}
