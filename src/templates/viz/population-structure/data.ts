/**
 * 집단 구조 분석 목업 데이터 — YR 다양성 패널 412계통의 PCA 고유벡터와 ADMIXTURE Q(K = 2~6).
 * 생성 규칙은 명세(docs/specs/population-structure.md)를 그대로 옮겼다. 호출 순서를 바꾸면 값이 바뀐다.
 * 실제 데이터로 바꿀 때: LINES(계통별 PC·Q·소속)와 아래 상수(PVE·CV 오차·SNP 수)만 교체하면 화면은 그대로 동작한다.
 */
import { createRng } from '@/lib/rng'

// ───────────────────────── 상수(목업 설정값) ─────────────────────────

export const SEED = 20261023
export const N = 412
export const TOTAL_SNPS = 36420
export const PRUNED_SNPS = 9184
/** PC1~PC10 설명 분산(%) — 목업 설정값 */
export const PVE = [21.4, 7.9, 4.6, 1.9, 1.6, 1.4, 1.3, 1.2, 1.1, 1.0] as const
/** GWAS 모형(MLM)에 넣은 PC 수 — gwas-manhattan과 같음 */
export const GWAS_PCS = 3
export const CV_ERROR: Record<KValue, number> = { 2: 0.5124, 3: 0.4871, 4: 0.4689, 5: 0.4712, 6: 0.4768 }
export const BEST_K: KValue = 4
/** K = 4에서 최대 Q가 이 값 이상이면 그 집단, 미만이면 혼합형 */
export const Q_ASSIGN = 0.7

export const ANALYSIS = {
  panel: 'YR 다양성 패널',
  organism: '벼',
  analyzedAt: '2026-10-20',
  baseDate: '2026-10-23',
  ldPrune: '창 50 SNP, 이동 5, r² > 0.2 제거',
  model: 'MLM(PC 3개 + GRM)',
} as const

export const pveCum = (k: number) => Math.round(PVE.slice(0, k).reduce((a, b) => a + b, 0) * 10) / 10

// ───────────────────────── 타입 ─────────────────────────

export type KValue = 2 | 3 | 4 | 5 | 6
export const K_VALUES: KValue[] = [2, 3, 4, 5, 6]
export type PureGroup = 'TEJ' | 'TRJ' | 'IND' | 'AUS'
export type GroupKey = PureGroup | 'ADM'
export type Origin = 'YR' | 'YRG'

/** 성분 색 키 — K가 바뀌어도 같은 계열 색을 유지하기 위한 이름(index.tsx가 팔레트에 연결) */
export type ComponentColor = 'jap' | 'tejImport' | 'trj' | 'ind' | 'indImport' | 'aus'

export interface Line {
  id: string
  /** 품종명(앵커만) */
  name: string | null
  origin: Origin
  /** K = 4 소속(최대 Q ≥ 0.70) 또는 혼합형 */
  group: GroupKey
  /** K = 4 최대 성분 인덱스(0 TEJ, 1 TRJ, 2 IND, 3 AUS) */
  dom: number
  maxQ: number
  /** PC1~PC3 고유벡터 값 */
  pc: [number, number, number]
  /** K별 Q(천분율 정수, 행 합 1000) */
  qm: Record<KValue, number[]>
  anchor: boolean
  /** 앵커 비고(저항성 공여 등) */
  note?: string
}

export interface GroupDef {
  key: GroupKey
  label: string
  short: string
  desc: string
}

export const PURE_GROUPS: PureGroup[] = ['TEJ', 'TRJ', 'IND', 'AUS']
export const GROUP_ORDER: GroupKey[] = ['TEJ', 'TRJ', 'IND', 'AUS', 'ADM']
export const GROUPS: Record<GroupKey, GroupDef> = {
  TEJ: { key: 'TEJ', label: '온대 자포니카', short: 'TEJ', desc: '국내 육성 품종·계통 중심, 중부 평야지 적응형' },
  TRJ: { key: 'TRJ', label: '열대 자포니카', short: 'TRJ', desc: '도입 유전자원, 대립·장간형' },
  IND: { key: 'IND', label: '인디카', short: 'IND', desc: '통일형 육성 계통(YR)과 도입 인디카' },
  AUS: { key: 'AUS', label: '아우스', short: 'AUS', desc: '도입 유전자원, 가뭄·병 저항성 공여원' },
  ADM: { key: 'ADM', label: '혼합형', short: 'ADM', desc: '최대 Q < 0.70. 자포니카 × 인디카 교잡 육성 계통과 저항성 공여 계통 포함' },
}

/** K별 성분 이름과 색 키(순서 = Q 열 순서) */
export const K_COMPONENTS: Record<KValue, { label: string; color: ComponentColor }[]> = {
  2: [
    { label: '자포니카형', color: 'jap' },
    { label: '인디카형', color: 'ind' },
  ],
  3: [
    { label: '자포니카형', color: 'jap' },
    { label: '인디카', color: 'ind' },
    { label: '아우스', color: 'aus' },
  ],
  4: [
    { label: '온대 자포니카', color: 'jap' },
    { label: '열대 자포니카', color: 'trj' },
    { label: '인디카', color: 'ind' },
    { label: '아우스', color: 'aus' },
  ],
  5: [
    { label: '온대 자포니카-국내 육성', color: 'jap' },
    { label: '온대 자포니카-도입', color: 'tejImport' },
    { label: '열대 자포니카', color: 'trj' },
    { label: '인디카', color: 'ind' },
    { label: '아우스', color: 'aus' },
  ],
  6: [
    { label: '온대 자포니카-국내 육성', color: 'jap' },
    { label: '온대 자포니카-도입', color: 'tejImport' },
    { label: '열대 자포니카', color: 'trj' },
    { label: '인디카-통일형', color: 'ind' },
    { label: '인디카-도입', color: 'indImport' },
    { label: '아우스', color: 'aus' },
  ],
}

// ───────────────────────── 생성 ─────────────────────────

const C = [
  [1.0, 0.7, 0.05],
  [0.75, -0.95, -0.05],
  [-1.05, 0.05, 0.55],
  [-0.85, -0.05, -1.1],
] as const
const NOISE = 0.1
/**
 * 소수 성분 가중. 같은 계열(자포니카 0·1 / 인디카형 2·3)이면 3.
 * 예외(2026-10-26 정리 회차): YR 인디카(통일형, 인디카 × 자포니카 교배 유래)는 온대 자포니카(TEJ) 가중 AFF_YR_IND_TEJ, 나머지 1.
 * 2026-10-26 정리 회차 2: TEJ 가중 3 → 6, YR 인디카의 주 성분 폭 MAIN_SPREAD_YR_IND 0.30 → 0.50(자포니카 유입 폭이 큰 통일형).
 * 결과 YR 인디카 38계통 평균 Q4 = 0.036 / 0.013 / 0.938 / 0.013. 집단별 계통 수와 대표 계통(집합)은 그대로.
 */
export const AFF_YR_IND_TEJ = 6
/** 주 성분 main = 1 − spread · Beta(1, 6). 기본 0.30, YR 인디카(통일형)만 0.50(2026-10-26 정리 회차 2) */
export const MAIN_SPREAD = 0.3
export const MAIN_SPREAD_YR_IND = 0.5
const AFF = (g: number, j: number, origin: Origin) =>
  g === 2 && origin === 'YR' ? (j === 0 ? AFF_YR_IND_TEJ : 1) : (g < 2) === (j < 2) ? 3 : 1
const RESERVED = [
  'YR07-0231', 'YR13-0819', 'YR14-0472', 'YR19-0083', 'YR20-1108', 'YR19-0731',
  'YR22-0412', 'YR22-0415', 'YR21-0877', 'YR23-0136', 'YR22-0263', 'YR21-0594',
]

/** 반올림 합 오차를 최대 성분(동률이면 앞)에 몰아 행 합을 1000으로 맞춘다 */
function toMilli(q: number[]): number[] {
  const m = q.map(x => Math.round(x * 1000))
  const d = 1000 - m.reduce((a, b) => a + b, 0)
  let im = 0
  m.forEach((x, i) => {
    if (x > m[im]!) im = i
  })
  m[im] = m[im]! + d
  return m
}

const pad = (v: number, n: number) => String(v).padStart(n, '0')

interface Draft {
  id: string
  name: string | null
  origin: Origin
  q4m: number[]
  s: number
  t: number
  anchor: boolean
  note?: string
  raw: number[]
}

function generate(): Line[] {
  const rng = createRng(SEED)

  // 1) 생성 목록(순서 고정, 406계통)
  type Spec = { g: number | 'ADM'; origin: Origin; pair?: [number, number] }
  const spec: Spec[] = []
  const push = (n: number, g: number | 'ADM', origin: Origin, pair?: [number, number]) => {
    for (let i = 0; i < n; i++) spec.push({ g, origin, pair })
  }
  push(116, 0, 'YR'); push(56, 0, 'YRG'); push(54, 1, 'YRG'); push(38, 2, 'YR'); push(74, 2, 'YRG'); push(30, 3, 'YRG')
  push(14, 'ADM', 'YR', [0, 2]); push(4, 'ADM', 'YR', [0, 1])
  push(4, 'ADM', 'YRG', [0, 2]); push(6, 'ADM', 'YRG', [0, 1]); push(6, 'ADM', 'YRG', [2, 3]); push(4, 'ADM', 'YRG', [1, 2])

  // 2) Q4, s, t
  const drafts: Draft[] = spec.map(sp => {
    const q = [0, 0, 0, 0]
    if (sp.g !== 'ADM') {
      const g = sp.g
      const main = 1 - (g === 2 && sp.origin === 'YR' ? MAIN_SPREAD_YR_IND : MAIN_SPREAD) * rng.beta(1, 6)
      const others = [0, 1, 2, 3].filter(j => j !== g)
      const w = others.map(j => -Math.log(1 - rng.next()) * AFF(g, j, sp.origin))
      const sw = w.reduce((a, b) => a + b, 0)
      q[g] = main
      others.forEach((j, k) => (q[j] = ((1 - main) * w[k]!) / sw))
    } else {
      const [g1, g2] = sp.pair!
      const q1 = 0.4 + 0.28 * rng.next()
      const q2 = (1 - q1) * (0.8 + 0.15 * rng.next())
      const r = 1 - q1 - q2
      const others = [0, 1, 2, 3].filter(j => j !== g1 && j !== g2)
      const w = others.map(() => -Math.log(1 - rng.next()))
      const sw = w[0]! + w[1]!
      q[g1] = q1
      q[g2] = q2
      others.forEach((j, k) => (q[j] = (r * w[k]!) / sw))
    }
    const s = sp.origin === 'YR' ? 1 - 0.25 * rng.beta(1, 4) : 0.25 * rng.beta(1, 4)
    const t = sp.origin === 'YR' ? 1 - 0.25 * rng.beta(1, 4) : 0.25 * rng.beta(1, 4)
    return { id: '', name: null, origin: sp.origin, q4m: toMilli(q), s, t, anchor: false, raw: [] }
  })

  // 3) 이름: YR 계통 → YRG 번호
  const used = new Set(RESERVED)
  for (const d of drafts) {
    if (d.origin !== 'YR') continue
    let id: string
    do {
      id = `YR${pad(rng.int(5, 18), 2)}-${pad(rng.int(1, 1999), 4)}`
    } while (used.has(id))
    used.add(id)
    d.id = id
  }
  const yrg = drafts.filter(d => d.origin === 'YRG')
  const perm = rng.shuffle(yrg.map((_, i) => i + 1))
  yrg.forEach((d, i) => (d.id = `YRG-${pad(perm[i]!, 4)}`))

  // 4) 앵커 6계통(고정값)
  const anchors: [string, string | null, number[], number, number, string][] = [
    ['YR07-0231', '가람솔', [970, 20, 10, 0], 0.96, 0.9, '대비 품종, 중만생 다수성'],
    ['YR13-0819', '온새미로', [910, 30, 60, 0], 0.94, 0.8, '다수성 대비 품종'],
    ['YR14-0472', '늘솔찬', [790, 30, 180, 0], 0.93, 0.2, '도열병 복합 저항성(Pi-ta·Pib 공여)'],
    ['YR19-0083', '별하랑', [880, 25, 95, 0], 0.95, 0.24, '교배: 가람솔 / 늘솔찬 — K = 4 Q는 두 부모 평균과 같음'],
    ['YR20-1108', null, [610, 30, 360, 0], 0.9, 0.15, 'Pi9 공여'],
    ['YR19-0731', null, [560, 0, 410, 30], 0.9, 0.1, 'Pigm 공여'],
  ]
  for (const [id, name, q4m, s, t, note] of anchors) drafts.push({ id, name, origin: 'YR', q4m, s, t, anchor: true, note, raw: [] })

  // 5) PC 원점수
  for (const d of drafts) {
    const z = [rng.normal(0, NOISE), rng.normal(0, NOISE), rng.normal(0, NOISE)]
    d.raw = [0, 1, 2].map(k => d.q4m.reduce((a, m, c) => a + (m / 1000) * C[c]![k]!, 0) + z[k]!)
  }

  // 6) 판정·K별 Q
  const lines: Line[] = drafts.map(d => {
    const [a, b, c, e] = d.q4m as [number, number, number, number]
    const mx = Math.max(a, b, c, e)
    const dom = d.q4m.indexOf(mx)
    const tD = Math.round(a * d.s)
    const iT = Math.round(c * d.t)
    return {
      id: d.id,
      name: d.name,
      origin: d.origin,
      group: mx >= Q_ASSIGN * 1000 ? PURE_GROUPS[dom]! : 'ADM',
      dom,
      maxQ: mx / 1000,
      pc: [0, 0, 0],
      qm: { 2: [a + b, c + e], 3: [a + b, c, e], 4: [a, b, c, e], 5: [tD, a - tD, b, c, e], 6: [tD, a - tD, b, iT, c - iT, e] },
      anchor: d.anchor,
      note: d.note,
    }
  })

  // 7) PCA 후처리: 중심화 → 그람-슈미트 → 제곱합 1, 부호 고정
  const n = drafts.length
  const cols = [0, 1, 2].map(k => drafts.map(d => d.raw[k]!))
  const dot = (x: number[], y: number[]) => x.reduce((acc, v, i) => acc + v * y[i]!, 0)
  for (const col of cols) {
    const m = col.reduce((a, b) => a + b, 0) / n
    for (let i = 0; i < n; i++) col[i] = col[i]! - m
  }
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < k; j++) {
      const p = dot(cols[k]!, cols[j]!)
      for (let i = 0; i < n; i++) cols[k]![i] = cols[k]![i]! - p * cols[j]![i]!
    }
    const norm = Math.sqrt(dot(cols[k]!, cols[k]!))
    for (let i = 0; i < n; i++) cols[k]![i] = cols[k]![i]! / norm
  }
  const signRef: PureGroup[] = ['TEJ', 'TEJ', 'IND']
  for (let k = 0; k < 3; k++) {
    const ix = lines.map((l, i) => (l.group === signRef[k] ? i : -1)).filter(i => i >= 0)
    const mean = ix.reduce((a, i) => a + cols[k]![i]!, 0) / ix.length
    if (mean < 0) for (let i = 0; i < n; i++) cols[k]![i] = -cols[k]![i]!
  }
  lines.forEach((l, i) => (l.pc = [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!]))
  return lines
}

export const LINES: Line[] = generate()
export const LINE_BY_ID = new Map(LINES.map(l => [l.id, l]))

// ───────────────────────── 파생 값 ─────────────────────────

/** 기본 정렬: 집단 순 → (혼합형은 주 성분 순) → 최대 Q 내림차순 → ID 오름차순 */
export function compareDefault(a: Line, b: Line): number {
  const ga = GROUP_ORDER.indexOf(a.group)
  const gb = GROUP_ORDER.indexOf(b.group)
  if (ga !== gb) return ga - gb
  if (a.group === 'ADM' && a.dom !== b.dom) return a.dom - b.dom
  if (a.maxQ !== b.maxQ) return b.maxQ - a.maxQ
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const DEFAULT_ORDER: Line[] = LINES.slice().sort(compareDefault)
export const PC1_ORDER: Line[] = LINES.slice().sort((a, b) => a.pc[0] - b.pc[0])

export type SortMode = 'group' | 'pc1' | 'selected'
export function orderLines(mode: SortMode, selected: ReadonlySet<string>): Line[] {
  if (mode === 'pc1') return PC1_ORDER
  if (mode === 'selected' && selected.size > 0) {
    return [...DEFAULT_ORDER.filter(l => selected.has(l.id)), ...DEFAULT_ORDER.filter(l => !selected.has(l.id))]
  }
  return DEFAULT_ORDER
}

/** 계통 표시명: "별하랑 (YR19-0083)" 또는 ID */
export const lineLabel = (l: Line) => (l.name ? `${l.name} (${l.id})` : l.id)

export interface GroupSummary {
  key: GroupKey
  count: number
  share: number
  /** 자기 집단 Q 평균(혼합형은 최대 Q 평균) */
  meanQ: number
  yr: number
  yrg: number
  reps: Line[]
}

function summarize(): GroupSummary[] {
  return GROUP_ORDER.map(key => {
    const members = LINES.filter(l => l.group === key)
    const meanQ = members.reduce((a, l) => a + l.maxQ, 0) / members.length
    let reps: Line[]
    if (key === 'ADM') {
      reps = members.filter(l => l.anchor).sort((a, b) => b.maxQ - a.maxQ)
    } else {
      const byQ = (a: Line, b: Line) => (b.maxQ !== a.maxQ ? b.maxQ - a.maxQ : a.id < b.id ? -1 : 1)
      reps = [...members.filter(l => l.anchor).sort(byQ), ...members.filter(l => !l.anchor).sort(byQ)].slice(0, 3)
    }
    return {
      key,
      count: members.length,
      share: members.length / LINES.length,
      meanQ,
      yr: members.filter(l => l.origin === 'YR').length,
      yrg: members.filter(l => l.origin === 'YRG').length,
      reps,
    }
  })
}

export const SUMMARY: GroupSummary[] = summarize()
export const SUMMARY_BY_KEY = Object.fromEntries(SUMMARY.map(s => [s.key, s])) as Record<GroupKey, GroupSummary>
export const ADM_COUNT = SUMMARY_BY_KEY.ADM.count

/** 패널 평균 성분 비율(K별) */
export function panelMeans(k: KValue): number[] {
  const out = new Array(k).fill(0) as number[]
  for (const l of LINES) l.qm[k].forEach((m, i) => (out[i] = out[i]! + m))
  return out.map(v => v / 1000 / LINES.length)
}

/** PC 축 범위(고유벡터 값 범위를 0.02 단위로 넓힘) — 브러시 좌표 변환에 같은 값을 쓴다 */
export const PC_RANGE: [number, number][] = [0, 1, 2].map(k => {
  const vals = LINES.map(l => l.pc[k]!)
  const lo = Math.floor((Math.min(...vals) - 0.004) / 0.02) * 0.02
  const hi = Math.ceil((Math.max(...vals) + 0.004) / 0.02) * 0.02
  return [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100] as [number, number]
})

// ───────────────────────── DEV 검산 ─────────────────────────

if (import.meta.env.DEV) {
  const ok = (cond: boolean, msg: string) => console.assert(cond, `[검산] ${msg}`)
  const near = (a: number, b: number, eps = 5e-4) => Math.abs(a - b) <= eps
  ok(LINES.length === N, `계통 수 ${LINES.length} ≠ 412`)
  ok(new Set(LINES.map(l => l.id)).size === N, 'ID가 고유하지 않음')
  const randomIds = LINES.filter(l => !l.anchor).map(l => l.id)
  ok(randomIds.every(id => /^YR(0[5-9]|1[0-8])-\d{4}$/.test(id) || /^YRG-\d{4}$/.test(id)), '무작위 계통 이름 형식 위반')
  ok(randomIds.every(id => !RESERVED.includes(id)), 'baseline 이름이 무작위 계통에 쓰임')

  const expect: Record<GroupKey, [number, number, number, number]> = {
    TEJ: [176, 0.955, 120, 56], TRJ: [54, 0.945, 0, 54], IND: [112, 0.94846, 38, 74], AUS: [30, 0.968, 0, 30], ADM: [40, 0.564, 20, 20],
  }
  for (const s of SUMMARY) {
    const [cnt, mq, yr, yrg] = expect[s.key]
    ok(s.count === cnt && s.yr === yr && s.yrg === yrg, `${s.key} 계통 수/육성/도입 ${s.count}/${s.yr}/${s.yrg} ≠ ${cnt}/${yr}/${yrg}`)
    ok(near(s.meanQ, mq), `${s.key} 평균 소속 계수 ${s.meanQ.toFixed(3)} ≠ ${mq}`)
  }
  const pure = LINES.filter(l => l.group !== 'ADM')
  const adm = LINES.filter(l => l.group === 'ADM')
  ok(near(Math.min(...pure.map(l => l.maxQ)), 0.79), '소속 계통 최대 Q 최솟값 ≠ 0.790')
  ok(near(Math.min(...adm.map(l => l.maxQ)), 0.463) && near(Math.max(...adm.map(l => l.maxQ)), 0.673), '혼합형 최대 Q 범위 ≠ 0.463~0.673')

  for (const k of K_VALUES) {
    ok(LINES.every(l => l.qm[k].length === k && l.qm[k].reduce((a, b) => a + b, 0) === 1000 && l.qm[k].every(v => v >= 0)), `K=${k} Q 행 합 1.000·음수 없음 위반`)
  }
  const pm = panelMeans(4).map(v => v.toFixed(3)).join('/')
  ok(pm === '0.460/0.154/0.296/0.089', `K=4 패널 평균 성분 ${pm}`)

  for (let k = 0; k < 3; k++) {
    const col = LINES.map(l => l.pc[k]!)
    ok(Math.abs(col.reduce((a, b) => a + b, 0)) < 1e-9, `PC${k + 1} 열 합 ≠ 0`)
    ok(near(col.reduce((a, b) => a + b * b, 0), 1, 1e-9), `PC${k + 1} 제곱합 ≠ 1`)
  }
  const aus3 = LINES.filter(l => l.group === 'AUS').map(l => l.pc[2])
  const other3 = LINES.filter(l => l.group !== 'AUS').map(l => l.pc[2])
  ok(near(Math.min(...aus3), -0.1824, 6e-5) && near(Math.max(...aus3), -0.1284, 6e-5), `아우스 PC3 범위 ${Math.min(...aus3).toFixed(4)}~${Math.max(...aus3).toFixed(4)}`)
  ok(near(Math.min(...other3), -0.0571, 6e-5), `아우스 외 PC3 최솟값 ${Math.min(...other3).toFixed(4)} ≠ −0.0571`)
  const yrInd = LINES.filter(l => !l.anchor && l.origin === 'YR' && l.group === 'IND')
  const yrIndMean = [0, 1, 2, 3].map(k => yrInd.reduce((a, l) => a + l.qm[4][k]!, 0) / yrInd.length / 1000)
  ok(yrInd.length === 38 && yrIndMean.map(v => v.toFixed(3)).join('/') === '0.036/0.013/0.938/0.013' && yrIndMean[0]! > yrIndMean[3]!, `YR 인디카(통일형) 평균 Q4 ${yrIndMean.map(v => v.toFixed(3)).join('/')} (기대 0.036/0.013/0.938/0.013, TEJ > AUS)`)
  const indQ = LINES.filter(l => l.group === 'IND').map(l => l.maxQ)
  ok(near(Math.min(...indQ), 0.824) && near(Math.max(...indQ), 1), `인디카 최대 Q 범위 ${Math.min(...indQ).toFixed(3)}~${Math.max(...indQ).toFixed(3)} (기대 0.824~1.000)`)

  const left = LINES.filter(l => l.pc[0] < 0)
  const cnt = (g: GroupKey) => left.filter(l => l.group === g).length
  ok(left.length === 162 && cnt('IND') === 112 && cnt('AUS') === 30 && cnt('ADM') === 20, `PC1 < 0 브러시 ${left.length}(IND ${cnt('IND')}, AUS ${cnt('AUS')}, ADM ${cnt('ADM')}) ≠ 162(112, 30, 20)`)

  const q = (id: string) => LINE_BY_ID.get(id)!.qm[4]
  const [ga, ns, bh] = [q('YR07-0231'), q('YR14-0472'), q('YR19-0083')]
  ok(bh.every((v, i) => v * 2 === ga[i]! + ns[i]!) && bh.join('/') === '880/25/95/0', '별하랑 Q ≠ 가람솔·늘솔찬 평균')

  const minK = K_VALUES.reduce((a, b) => (CV_ERROR[b] < CV_ERROR[a] ? b : a))
  ok(minK === BEST_K && CV_ERROR[minK] === 0.4689, 'CV 오차 최소가 K=4·0.4689가 아님')
  ok(pveCum(3) === 33.9 && pveCum(10) === 43.4, 'PVE 누적 ≠ 33.9/43.4')

  const reps = (g: GroupKey) => SUMMARY_BY_KEY[g].reps.map(l => l.id).join(' · ')
  ok(reps('TEJ') === 'YR07-0231 · YR13-0819 · YR19-0083', `온대 자포니카 대표 ${reps('TEJ')}`)
  ok(reps('TRJ') === 'YRG-0149 · YRG-0065 · YRG-0103', `열대 자포니카 대표 ${reps('TRJ')}`)
  ok(reps('IND') === 'YR07-1078 · YRG-0014 · YR10-0886', `인디카 대표 ${reps('IND')}`)
  ok(reps('AUS') === 'YRG-0202 · YRG-0129 · YRG-0133', `아우스 대표 ${reps('AUS')}`)
  ok(reps('ADM') === 'YR20-1108 · YR19-0731', `혼합형 대표 ${reps('ADM')}`)
  ok(DEFAULT_ORDER.slice(0, 5).map(l => l.id).join(',') === 'YR10-0963,YR15-1301,YRG-0108,YRG-0118,YR07-1534', '기본 정렬 첫 5계통 불일치')
}
