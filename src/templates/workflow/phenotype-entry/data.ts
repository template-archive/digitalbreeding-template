import { createRng } from '@/lib/rng'

/*
 * 표현형 데이터 입력 목업. 명세: docs/specs/phenotype-entry.md
 * 1~5단계(배치·출수기·간장·쌀 수량·결측·이상치·메모)는 workflow/field-trial-layout data.ts를 그대로 복사했다
 * (템플릿 간 import 금지). 6단계(수장·주당 이삭수·현미 천립중)는 같은 rng를 이어서 쓴다.
 * 진척률·검증 집계(70.8%, 오류 1, 경고 7 …)는 하드코딩하지 않고 칸 상태에서 계산한다.
 * 실제 API로 바꿀 때는 PLOTS(구 배치)·SAVED(서버 값)·DRAFT(로컬 초안)·REMOTE(원격 변경)만 교체한다.
 */

export const SEED = 20261023
export const AS_OF = '2026-10-23'
export const SOWING = '2026-04-22'
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

export const SESSION = {
  savedAt: '10:28', // 본인 마지막 저장
  sessionAt: '10:30', // 세션 시작
  draftAt: '10:41', // 로컬 초안 자동 임시 저장
  nextSavedAt: '10:42', // 목업 저장 시각(고정 표시)
}

// ---------------- 형질 ----------------

export type TraitKey = 'heading' | 'culm' | 'panicle' | 'panicles' | 'yield' | 'tgw'

export interface TraitDef {
  key: TraitKey
  label: string
  short: string
  unit: string
  /** 표시·입력 자릿수(0 = 정수 형질, 소수 입력은 오류) */
  digits: 0 | 1
  /** 불가능 값 경계(밖이면 오류) — 추정 */
  hard: [number, number]
  /** 허용 범위(밖이면 경고) — 추정 */
  soft: [number, number]
  /** 반복 간 편차 기준 D — 추정 */
  dev: number
  phase: string
}

export const TRAITS: Record<TraitKey, TraitDef> = {
  heading: { key: 'heading', label: '출수기', short: '출수기', unit: '일', digits: 0, hard: [60, 180], soft: [95, 135], dev: 6, phase: '8월 현장 조사' },
  culm: { key: 'culm', label: '간장', short: '간장', unit: 'cm', digits: 0, hard: [20, 200], soft: [55, 120], dev: 12, phase: '9월 현장 조사' },
  panicle: { key: 'panicle', label: '수장', short: '수장', unit: 'cm', digits: 1, hard: [5, 40], soft: [15, 28], dev: 2.5, phase: '표본주 실내 조사' },
  panicles: { key: 'panicles', label: '주당 이삭수', short: '이삭수', unit: '개/주', digits: 1, hard: [1, 60], soft: [8, 25], dev: 4, phase: '표본주 실내 조사' },
  yield: { key: 'yield', label: '쌀 수량', short: '쌀 수량', unit: 'kg/10a', digits: 1, hard: [0, 1200], soft: [300, 800], dev: 120, phase: '수확·도정 후(백미 기준)' },
  tgw: { key: 'tgw', label: '현미 천립중', short: '천립중', unit: 'g', digits: 1, hard: [5, 50], soft: [18, 30], dev: 1.5, phase: '건조·제현 후' },
}
/** 열 순서 = 조사 시기 순서(야장 순서) */
export const TRAIT_KEYS: TraitKey[] = ['heading', 'culm', 'panicle', 'panicles', 'yield', 'tgw']

// ---------------- 처리(entry) — field-trial-layout 복사 ----------------

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
export const CHECK_LABEL: Record<CheckRole, string> = { standard: '표준 대비', 'high-yield': '다수성 대비' }

/** 배치표: LAYOUT[행-1][열-1] = 처리 번호 */
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

/** 블록 안 위치 k(1..6) → (행 오프셋, 왼/오른 열). 뱀형 순서 */
const K_POS: [number, 0 | 1][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1],
]

export const REP_LABEL = ['Ⅰ', 'Ⅱ', 'Ⅲ'] as const

interface Issue {
  plot: number
  trait: 'yield' | 'heading' | 'culm'
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

export const MEMOS: Record<number, string> = {
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
const round1 = (v: number) => Math.round(v * 10) / 10

/** 공간 경향(원척도 kg): 동→서 비옥도 기울기 + 배수 불량 저수량 구역(중심 5행 4열 = 구 211) */
const spatial = (row: number, col: number) =>
  -12 + (24 * (col - 1)) / 13 - 70 * Math.exp(-((row - 5) ** 2 + (col - 4) ** 2) / (2 * 1.3 ** 2))

// ---------------- 구(plot) ----------------

export interface Plot {
  no: number
  rep: number // 1..3
  block: number // 반복 안 불완전 블록 1..7
  k: number
  row: number
  col: number
  entry: number
  /** 생성값(실제 조사값에 해당). 결측 = 'NA', 이상치는 상수 값 */
  truth: Record<TraitKey, CellValue>
}

/** 칸 값: 숫자, 결측 'NA', 또는 숫자로 읽을 수 없는 입력 원문(형식 오류) */
export type CellValue = number | 'NA' | { raw: string }

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

  interface Work {
    no: number
    rep: number
    block: number
    k: number
    row: number
    col: number
    entry: number
    S: number
    raw: number
    heading: number
    culm: number
    yield: number
    yieldStatus: 'ok' | 'missing' | 'outlier'
  }
  const ws: Work[] = []
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
        ws.push({
          no: r * 100 + (b - 1) * BLOCK_SIZE + k,
          rep: r,
          block: b,
          k,
          row,
          col,
          entry,
          S,
          raw,
          heading: Math.round(clamp(H[entry]! + eH, 104, 128)),
          culm: Math.round(clamp(C[entry]! + 0.08 * S + eC, 66, 104)),
          yield: raw,
          yieldStatus: 'ok',
        })
      }
    }
  }
  ws.sort((a, b) => a.no - b.no)
  const byNo = new Map(ws.map(w => [w.no, w]))
  for (const is of ISSUES) if (is.trait === 'yield') byNo.get(is.plot)!.yieldStatus = is.kind

  // 수량 정규화: 정상 121구의 평균·표본 SD를 목표값에 맞춘 뒤 소수 1자리로 반올림(입력 정밀도 = 저장 정밀도)
  const O = ws.filter(w => w.yieldStatus === 'ok')
  const m = O.reduce((s, w) => s + w.raw, 0) / O.length
  const s = Math.sqrt(O.reduce((acc, w) => acc + (w.raw - m) ** 2, 0) / (O.length - 1))
  for (const w of ws) w.yield = round1(YIELD_TARGET.mean + (YIELD_TARGET.sd * (w.raw - m)) / s)

  // 6단계: 수량구성요소(같은 rng 계속)
  const PL: number[] = []
  const NP: number[] = []
  const TW: number[] = []
  for (let e = 1; e <= 42; e++) PL[e] = clamp(rng.normal(20.4, 1.2), 17.5, 23.5)
  for (let e = 1; e <= 42; e++) NP[e] = clamp(rng.normal(15.0, 1.4), 11.5, 18.5)
  for (let e = 1; e <= 42; e++) TW[e] = clamp(rng.normal(22.0, 0.9), 20.0, 24.5)

  const plots: Plot[] = ws.map(w => {
    const e = w.entry
    const ePL = rng.normal(0, 0.5)
    const eNP = rng.normal(0, 0.9)
    const eTW = rng.normal(0, 0.25)
    return {
      no: w.no,
      rep: w.rep,
      block: w.block,
      k: w.k,
      row: w.row,
      col: w.col,
      entry: e,
      truth: {
        heading: w.heading,
        culm: w.culm,
        yield: w.yield,
        panicle: round1(clamp(PL[e]! + 0.04 * (C[e]! - 83) + ePL, 16, 25)),
        panicles: round1(clamp(NP[e]! + 0.03 * w.S + eNP, 10, 21)),
        tgw: round1(clamp(TW[e]! - 0.12 * (NP[e]! - 15) + eTW, 19.5, 25.5)),
      },
    }
  })
  const pByNo = new Map(plots.map(p => [p.no, p]))
  for (const is of ISSUES) pByNo.get(is.plot)!.truth[is.trait] = is.kind === 'missing' ? 'NA' : is.value!
  return plots
}

export const PLOTS: Plot[] = build()
export const PLOT_BY_NO = new Map(PLOTS.map(p => [p.no, p]))
export const PLOTS_BY_ENTRY = new Map<number, Plot[]>()
for (const p of PLOTS) {
  const list = PLOTS_BY_ENTRY.get(p.entry) ?? []
  list.push(p)
  PLOTS_BY_ENTRY.set(p.entry, list)
}
export const TOTAL_CELLS = PLOTS.length * TRAIT_KEYS.length

export const cellKey = (plot: number, trait: TraitKey) => `${plot}|${trait}`
export const parseKey = (k: string) => {
  const [p, t] = k.split('|')
  return { plot: Number(p), trait: t as TraitKey }
}

// ---------------- 서버 저장값·로컬 초안·원격 변경 ----------------

export type CellMap = Record<string, CellValue>

function buildSaved(): CellMap {
  const out: CellMap = {}
  for (const p of PLOTS) {
    for (const t of ['heading', 'culm', 'yield'] as const) out[cellKey(p.no, t)] = p.truth[t]
    if (p.no <= 142 || (p.no >= 201 && p.no <= 221)) {
      out[cellKey(p.no, 'panicle')] = p.truth.panicle
      out[cellKey(p.no, 'panicles')] = p.truth.panicles
    }
    if (p.no <= 124) out[cellKey(p.no, 'tgw')] = p.truth.tgw
  }
  // 수확 불가·시료 분실 구: 저장 범위 안이면 수량구성요소도 결측
  for (const n of [131, 211, 318])
    for (const t of ['panicle', 'panicles', 'tgw'] as const) if (out[cellKey(n, t)] !== undefined) out[cellKey(n, t)] = 'NA'
  return out
}
export const SAVED: CellMap = buildSaved()

function buildDraft(): CellMap {
  const out: CellMap = {}
  for (const n of [222, 223, 224]) {
    const p = PLOT_BY_NO.get(n)!
    out[cellKey(n, 'panicle')] = p.truth.panicle
    out[cellKey(n, 'panicles')] = p.truth.panicles
  }
  // 소수점 누락: 생성값 19.7 → 197
  out[cellKey(225, 'panicle')] = Math.round((PLOT_BY_NO.get(225)!.truth.panicle as number) * 10)
  return out
}
export const DRAFT: CellMap = buildDraft()

export interface RemoteChange {
  value: number
  by: string
  at: string
}
export const REMOTE: Record<string, RemoteChange> = {
  '222|panicle': { value: 18.8, by: '이서진', at: '10:37' },
  '222|panicles': { value: 14.3, by: '이서진', at: '10:37' },
}

export const INITIAL_ACTIVE = { plot: 225, trait: 'panicle' as TraitKey }

// ---------------- 입력 해석 ----------------

/** 입력 문자열 → 칸 값. undefined = 빈칸 */
export function parseInput(text: string, trait: TraitKey): CellValue | undefined {
  const s = text.trim()
  if (!s) return undefined
  if (/^(na|n\/a|\.|-)$/i.test(s)) return 'NA'
  const n = Number(s.replace(/,/g, ''))
  if (!Number.isFinite(n) || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s.replace(/,/g, ''))) return { raw: s }
  return TRAITS[trait].digits === 1 ? round1(n) : n
}

/** 칸 값 → 편집 문자열(쉼표 없음) */
export function editText(v: CellValue | undefined): string {
  if (v === undefined) return ''
  if (v === 'NA') return 'NA'
  if (typeof v === 'object') return v.raw
  return String(v)
}

export const sameValue = (a: CellValue | undefined, b: CellValue | undefined) => {
  if (a === undefined || b === undefined) return a === b
  if (typeof a === 'object' || typeof b === 'object') return typeof a === 'object' && typeof b === 'object' && a.raw === b.raw
  return a === b
}

// ---------------- 검증 ----------------

export type CellStatus = 'ok' | 'range' | 'dev' | 'error' | 'missing' | 'empty'

export interface CellCheck {
  status: CellStatus
  /** 기준 범위를 숫자로 밝힌 사유 */
  reason?: string
  /** 짧은 태그(불가능 값/범위 밖/반복 편차/형식 오류) */
  tag?: string
  /** 반복 편차 계산: 다른 반복 정상 칸 평균과 차이 */
  otherMean?: number
  diff?: number
}

const fmtRange = (r: [number, number], unit: string) => `${r[0].toLocaleString('ko-KR')}~${r[1].toLocaleString('ko-KR')} ${unit}`

function checkSingle(v: CellValue | undefined, trait: TraitKey): CellCheck {
  const T = TRAITS[trait]
  if (v === undefined) return { status: 'empty' }
  if (v === 'NA') return { status: 'missing' }
  if (typeof v === 'object') return { status: 'error', tag: '형식 오류', reason: `숫자가 아님("${v.raw}") — 숫자 또는 결측 NA를 입력하세요` }
  if (T.digits === 0 && !Number.isInteger(v)) return { status: 'error', tag: '형식 오류', reason: `정수만 입력(${T.label}는 ${T.unit} 단위 정수)` }
  if (v < T.hard[0] || v > T.hard[1]) {
    const tenth = v / 10
    const hint = tenth >= T.soft[0] && tenth <= T.soft[1] ? ` — 소수점 누락 의심(${round1(tenth)}?)` : ''
    return { status: 'error', tag: '불가능 값', reason: `불가능 값(${fmtRange(T.hard, T.unit)} 밖)${hint}` }
  }
  if (v < T.soft[0] || v > T.soft[1]) {
    const hint = v > T.soft[1] ? ' — 자릿수 오기 의심' : ' — 피해 여부·구 메모 확인'
    return { status: 'range', tag: '범위 밖', reason: `허용 범위(${fmtRange(T.soft, T.unit)}) 밖${hint}` }
  }
  return { status: 'ok' }
}

export type CheckMap = Map<string, CellCheck>

/**
 * 전 칸 검증. 반복 간 편차: 정상 칸 x와 같은 처리 다른 반복의 정상 칸(범위 밖·오류·결측 제외) 평균 m의 차이가 D를 넘으면 경고.
 * 다른 반복 정상 칸이 1개 이상일 때만 계산한다.
 */
export function validateAll(values: CellMap): CheckMap {
  const out: CheckMap = new Map()
  for (const p of PLOTS) for (const t of TRAIT_KEYS) out.set(cellKey(p.no, t), checkSingle(values[cellKey(p.no, t)], t))
  const devs: [string, CellCheck][] = []
  for (const p of PLOTS)
    for (const t of TRAIT_KEYS) {
      const k = cellKey(p.no, t)
      if (out.get(k)!.status !== 'ok') continue
      const others = PLOTS_BY_ENTRY.get(p.entry)!
        .filter(q => q.no !== p.no && out.get(cellKey(q.no, t))!.status === 'ok')
        .map(q => values[cellKey(q.no, t)] as number)
      if (!others.length) continue
      const m = others.reduce((a, b) => a + b, 0) / others.length
      const x = values[k] as number
      const d = x - m
      if (Math.abs(d) > TRAITS[t].dev) {
        const T = TRAITS[t]
        devs.push([
          k,
          {
            status: 'dev',
            tag: '반복 편차',
            otherMean: m,
            diff: d,
            reason: `반복 간 편차 — 다른 반복 평균(${m.toFixed(1)} ${T.unit})과의 차이 ${Math.abs(d).toFixed(1)}, 기준 ±${T.dev} ${T.unit} 초과`,
          },
        ])
      }
    }
  for (const [k, c] of devs) out.set(k, c)
  return out
}

/** 단독 검증(외부 노출용) */
export const checkValue = checkSingle

export const normalizeQuery = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export const blockLabel = (p: Plot) => `B${p.block}`
export const lineName = (p: Plot) => ENTRY_BY_NO.get(p.entry)!.name

// ---------------- 개발 모드 검산 ----------------

if (import.meta.env?.DEV) {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = (xs: number[]) => {
    const m = mean(xs)
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
  }
  const outlierYield = new Set([110, 332])
  const ys = PLOTS.filter(p => typeof p.truth.yield === 'number' && !outlierYield.has(p.no)).map(p => p.truth.yield as number)
  console.assert(ys.length === 121, `[검산] 수량 정상 구 ${ys.length}(기대 121)`)
  console.assert(Math.abs(mean(ys) - 561.4) <= 0.05, `[검산] 수량 정상 평균 ${mean(ys).toFixed(3)}(기대 561.4 ± 0.05)`)
  console.assert(Math.abs(sd(ys) - 49.2) <= 0.05, `[검산] 수량 정상 SD ${sd(ys).toFixed(3)}(기대 49.2 ± 0.05)`)
  const p114 = PLOT_BY_NO.get(114)!
  console.assert(p114.entry === 13 && p114.truth.yield === 605.9 && p114.truth.heading === 117 && p114.truth.culm === 82, `[검산] 구 114 = 처리 ${p114.entry}, 수량 ${String(p114.truth.yield)}, 출수기 ${String(p114.truth.heading)}, 간장 ${String(p114.truth.culm)}(기대 13 · 605.9 · 117 · 82)`)
  console.assert(PLOT_BY_NO.get(118)!.entry === 41, '[검산] 구 118이 가람솔(처리 41)이 아님')

  const values: CellMap = { ...SAVED, ...DRAFT }
  const checks = validateAll(values)
  const cnt: Record<CellStatus, number> = { ok: 0, range: 0, dev: 0, error: 0, missing: 0, empty: 0 }
  for (const c of checks.values()) cnt[c.status]++
  const exp: Record<CellStatus, number> = { ok: 517, range: 3, dev: 4, error: 1, missing: 10, empty: 221 }
  for (const s of Object.keys(exp) as CellStatus[]) console.assert(cnt[s] === exp[s], `[검산] 기본 상태 ${s} ${cnt[s]}칸(기대 ${exp[s]})`)
  const filled = Object.keys(values).length
  console.assert(filled === 535, `[검산] 비어 있지 않은 칸 ${filled}(기대 535)`)
  console.assert(Object.keys(SAVED).length === 528, `[검산] 저장 칸 ${Object.keys(SAVED).length}(기대 528)`)
  console.assert(Object.keys(DRAFT).length === 7, `[검산] 미저장 ${Object.keys(DRAFT).length}(기대 7)`)
  const devKeys = [...checks].filter(([, c]) => c.status === 'dev').map(([k]) => k).sort().join(',')
  console.assert(devKeys === '130|yield,208|yield,210|yield,325|yield', `[검산] 편차 칸 ${devKeys}(기대 130·208·210·325 쌀 수량)`)
  // 6단계 생성값은 모두 허용 범위 안 → 생성 단계 범위 밖은 field-trial-layout 상수 3건뿐
  let genOut = 0
  for (const p of PLOTS)
    for (const t of TRAIT_KEYS) {
      const v = p.truth[t]
      if (typeof v === 'number' && (v < TRAITS[t].soft[0] || v > TRAITS[t].soft[1])) genOut++
    }
  console.assert(genOut === 3, `[검산] 생성값 범위 밖 ${genOut}칸(기대 3)`)
  console.assert(DRAFT['225|panicle'] === 197, `[검산] 초안 225 수장 ${String(DRAFT['225|panicle'])}(기대 197)`)
}
