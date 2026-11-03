// 계통도 탐색기 목업 데이터 — 명세 docs/specs/pedigree-explorer.md
// 시드 20261023은 규약상 기재만 한다. 난수를 쓰지 않는다: 아래 「계보 상수」 24개체가 전부이고,
// 공조계수·루프·기여율·계통도 인스턴스는 모두 아래 함수로 계산한다(하드코딩 금지).
// 실제 API로 바꿀 때는 PEDIGREE 배열만 계보 DB 응답으로 교체하면 된다.

export const SEED = 20261023
export const BASE_DATE = '2026-10-23'
export const DEFAULT_ROOT = 'YR19-0083'
export const DEFAULT_DEPTH: Depth = 4

export type Depth = 3 | 4 | 5
/** V 품종 · L 계통 · G 도입 유전자원 · B 기초 계통(부모 기록 없음) */
export type Kind = 'V' | 'L' | 'G' | 'B'

export const KIND_LABEL: Record<Kind, string> = {
  V: '품종',
  L: '계통',
  G: '도입 유전자원',
  B: '기초 계통',
}
/** 연도의 뜻: V·L 교배, G 도입, B 육성 */
export const YEAR_LABEL: Record<Kind, string> = {
  V: '교배',
  L: '교배',
  G: '도입',
  B: '육성',
}

export interface PedNode {
  id: string
  name: string | null
  kind: Kind
  dam: string | null
  sire: string | null
  year: number
  trait: string
  genes: string[]
  /** 쌀 수량 GEBV(kg/10a, 2026-10 GBLUP 재추정, 훈련 집단 평균 0 기준). null = 유전형 없음 */
  gebv: number | null
  r2: number | null
  filing: string | null
}

const n = (
  id: string,
  name: string | null,
  kind: Kind,
  dam: string | null,
  sire: string | null,
  year: number,
  trait: string,
  genes: string[],
  gebv: number | null,
  r2: number | null,
  filing: string | null = null,
): PedNode => ({
  id,
  name,
  kind,
  dam,
  sire,
  year,
  trait,
  genes,
  gebv,
  r2,
  filing,
})

// ---------------- 계보 상수(명세 표 그대로) ----------------
export const PEDIGREE: PedNode[] = [
  n('YR86-0112', null, 'B', null, null, 1986, '기초 계통 · 중만생(계보 기록 없음)', ['sd1'], null, null),
  n('YR88-0047', null, 'B', null, null, 1988, '기초 계통 · 밥맛(계보 기록 없음)', [], null, null),
  n('YR93-0208', null, 'L', 'YR86-0112', 'YR88-0047', 1993, '중만생 계통', ['sd1'], null, null),
  n('YR95-0061', null, 'B', null, null, 1995, '기초 계통 · 다수성(계보 기록 없음)', ['sd1'], -49.1, 0.3),
  n('YR96-0140', null, 'B', null, null, 1996, '기초 계통 · 내도복(계보 기록 없음)', ['sd1'], -46.3, 0.31),
  n('GR-0147', null, 'G', null, null, 1998, '도열병 저항성 공여(도입)', ['Pi-ta', 'Pib'], -63.8, 0.33),
  n('GR-0233', null, 'G', null, null, 2001, '흰잎마름병 저항성 공여(도입)', ['Xa21'], -71.5, 0.3),
  n('GR-0312', null, 'G', null, null, 2002, '대립·다수성(도입)', [], -38.2, 0.34),
  n('GR-0405', null, 'G', null, null, 2004, '내냉성(도입)', [], -29.6, 0.36),
  n('GR-0544', null, 'G', null, null, 2005, '단간·내도복(도입)', ['sd1'], -52.0, 0.32),
  n('YR99-0275', null, 'L', 'YR93-0208', 'YR95-0061', 1999, '중만생 다수성 계통', ['sd1'], -33.7, 0.42),
  n('YR01-0388', null, 'L', 'YR95-0061', 'YR96-0140', 2001, '중생 내도복 계통', ['sd1'], -28.4, 0.45),
  n('YR03-0516', null, 'L', 'YR93-0208', 'YR96-0140', 2003, '조생 밥맛 계통', ['sd1'], -36.9, 0.4),
  n('YR05-0337', null, 'L', 'YR95-0061', 'GR-0312', 2005, '중만생 다수성 계통', ['sd1'], -24.1, 0.44),
  n('YR10-0866', null, 'L', 'GR-0405', 'GR-0544', 2010, '내냉·내도복 계통', ['sd1'], -15.3, 0.47),
  n('YR07-0231', '가람솔', 'V', 'YR99-0275', 'YR01-0388', 2007, '중만생 다수성 · 대비 품종', ['sd1'], -2.4, 0.74, '2019 출원 · 2020 등록'),
  n('YR08-1042', '청여울', 'V', 'YR01-0388', 'GR-0147', 2008, '도열병 저항성', ['Pi-ta', 'Pib', 'sd1'], -17.8, 0.71, '2020 출원 · 2022 등록'),
  n('YR10-1193', '솔빛나래', 'V', 'YR03-0516', 'GR-0233', 2010, '흰잎마름병 저항성', ['Xa21', 'sd1'], -22.6, 0.69, '2022 출원 · 2024 등록'),
  n('YR13-0819', '온새미로', 'V', 'YR05-0337', 'GR-0405', 2013, '중만생 다수성', [], 11.6, 0.73, '2023 출원 · 2025 등록'),
  n('YR14-0472', '늘솔찬', 'V', 'YR08-1042', 'YR10-1193', 2014, '도열병·흰잎마름병 복합 저항성', ['Pi-ta', 'Pib', 'Xa21', 'sd1'], -8.9, 0.72, '2024 출원 · 2026 등록'),
  n('YR16-0158', '해솔가온', 'V', 'YR13-0819', 'YR10-0866', 2016, '중생 다수성', ['sd1'], 26.7, 0.66, '2025 출원 · 재배심사 중'),
  n('YR19-0083', '별하랑', 'V', 'YR07-0231', 'YR14-0472', 2019, '다수성(GS 선발 계통)', ['Pi-ta', 'Pib', 'sd1'], 36.4, 0.68, '2026-06-09 출원'),
  n('YR22-0412', null, 'L', 'YR19-0083', 'YR16-0158', 2022, '중만생 다수성 · 2026 부모 후보 1위', ['Pi-ta', 'sd1'], 52.4, 0.58),
  n('YR22-0415', null, 'L', 'YR19-0083', 'YR16-0158', 2022, '중만생 다수성 · YR22-0412 형제 계통', ['Pi-ta', 'sd1'], 49.8, 0.55),
]

export const NODES: Record<string, PedNode> = Object.fromEntries(PEDIGREE.map(p => [p.id, p]))
export const KIND_ORDER: Kind[] = ['V', 'L', 'G', 'B']

/** 보유 유전자 조사 좌위(유리형). 품종 상세에서 빈 목록은 '이 4좌위 비보유'로 표시 */
export const GENE_PANEL = ['Pi-ta', 'Pib', 'Xa21', 'sd1'] as const

export const NO_GENO_REASON = '유전형 없음(종자 미보존)'
/** 품종(V)은 다년·다지역 표현형(MET)이 훈련 집단에 들어가 신뢰도가 카탈로그 범위(0.1~0.6)를 넘는다 */
export const hasPheno = (p: PedNode) => p.kind === 'V'

/** 개체 하나의 짧은 표시 이름: 품종명이 있으면 품종명, 없으면 계통명 */
export const label = (id: string) => NODES[id]?.name ?? id
/** Purdy 표기 교배 조합 "가람솔/늘솔찬" */
export const purdy = (p: PedNode) => (p.dam && p.sire ? `${label(p.dam)}/${label(p.sire)}` : null)

// ---------------- 추가 사실(program-baseline · cross-planner 앵커) ----------------
export const EXTRA: Record<string, { rows: { k: string; v: string }[]; gebvHistory?: { k: string; v: string }[] }> = {
  'YR19-0083': {
    rows: [
      {
        k: '쌀 수량',
        v: '605 kg/10a · 가람솔 대비 108.0% (MET 2024~2025, 8개 지역 × 2년)',
      },
    ],
    gebvHistory: [
      {
        k: '2022 선발 당시',
        v: '+31.5 kg/10a · 1,800계통 중 18위(당시 GS 1차 모델)',
      },
      { k: '2026-10 재추정', v: '+36.4 kg/10a · r² 0.68(GBLUP 재추정)' },
    ],
  },
  'YR22-0412': {
    rows: [
      { k: '출수기', v: '118일' },
      { k: '간장', v: '84 cm' },
    ],
  },
  'YR22-0415': {
    rows: [
      { k: '출수기', v: '116일' },
      { k: '간장', v: '86 cm' },
    ],
  },
}
/** 형제 계통 쌍(공조계수는 f()로 계산해 0.52를 확인) */
export const SIBLING: Record<string, string> = {
  'YR22-0412': 'YR22-0415',
  'YR22-0415': 'YR22-0412',
}

// ---------------- 공조계수 ----------------
const order = (id: string) => NODES[id]!.year * 10000 + Number(id.slice(-4))
const memo = new Map<string, number>()

/** 계보 기대 공조계수(자식성 근교계 COP). f(X,X)=1, 기초 개체끼리 0 */
export function coancestry(x: string, y: string): number {
  if (x === y) return 1
  const key = x < y ? `${x}|${y}` : `${y}|${x}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  let [a, b] = order(x) >= order(y) ? [x, y] : [y, x]
  if (!NODES[a]!.dam) [a, b] = [b, a]
  const A = NODES[a]!
  const v = A.dam && A.sire ? 0.5 * (coancestry(A.dam, b) + coancestry(A.sire, b)) : 0
  memo.set(key, v)
  return v
}

export const fParents = (r: string): number | null => {
  const p = NODES[r]!
  return p.dam && p.sire ? coancestry(p.dam, p.sire) : null
}
/** F7 고정 계통 가정: F₇ = 1 − (1 − f)·(½)⁶ */
export const fFixed = (r: string): number | null => {
  const f = fParents(r)
  return f === null ? null : 1 - (1 - f) * 0.5 ** 6
}

// 근연 등급 판정(kinLevel)·배지(KinBadge)는 공통 규칙: @/lib/genomics, @/design-system

// ---------------- 계통도 인스턴스(경로 펼침) ----------------
export interface Instance {
  id: string
  g: number
  /** 'D'=모본, 'S'=부본. 루트는 '' */
  path: string
  truncated: boolean
  /** 세로 위치(잎 순번 단위). 내부 노드는 자식 잎들의 가운데 */
  y: number
}

export function instances(root: string, D: Depth): { out: Instance[]; leaves: number; rootY: number } {
  const out: Instance[] = []
  let leaves = 0
  const go = (id: string, g: number, path: string): number => {
    const p = NODES[id]!
    const truncated = g === D && !!p.dam
    const idx = out.length
    if (g > 0) out.push({ id, g, path, truncated, y: 0 })
    let y: number
    if (g === D || !p.dam || !p.sire) {
      y = leaves++
    } else {
      const y1 = go(p.dam, g + 1, path + 'D')
      const y2 = go(p.sire, g + 1, path + 'S')
      y = (y1 + y2) / 2
    }
    if (g > 0) out[idx]!.y = y
    return y
  }
  const rootY = go(root, 0, '')
  return { out, leaves, rootY }
}

// ---------------- 근연 루프 ----------------
export interface LoopPair {
  /** 모본 쪽 경로 [모본, …, A] */
  a: string[]
  b: string[]
  n: number
  gen: number
  /** 계통도 인스턴스 키(경로 문자열) — 강조용. 각 키는 그 인스턴스로 들어오는 간선도 뜻한다 */
  keysA: string[]
  keysB: string[]
}
export interface Loop {
  ancestor: string
  contrib: number
  pairs: LoopPair[]
  /** 경로쌍 중 가장 얕은 세대 */
  minGen: number
}

interface UpPath {
  ids: string[]
  keys: string[]
}
function upPaths(start: string, startKey: string): UpPath[] {
  const res: UpPath[] = []
  const go = (ids: string[], keys: string[]) => {
    res.push({ ids, keys })
    const p = NODES[ids[ids.length - 1]!]!
    if (p.dam && p.sire) {
      const k = keys[keys.length - 1]!
      go([...ids, p.dam], [...keys, k + 'D'])
      go([...ids, p.sire], [...keys, k + 'S'])
    }
  }
  go([start], [startKey])
  return res
}

const loopMemo = new Map<string, Loop[]>()
export function loops(root: string): Loop[] {
  const hit = loopMemo.get(root)
  if (hit) return hit
  const p = NODES[root]!
  if (!p.dam || !p.sire) {
    loopMemo.set(root, [])
    return []
  }
  const pa = upPaths(p.dam, 'D')
  const pb = upPaths(p.sire, 'S')
  const by = new Map<string, Loop>()
  for (const a of pa) {
    for (const b of pb) {
      const A = a.ids[a.ids.length - 1]!
      if (A !== b.ids[b.ids.length - 1]) continue
      const restA = new Set(a.ids.slice(0, -1))
      if (b.ids.slice(0, -1).some(x => restA.has(x))) continue
      const nn = a.ids.length - 1 + (b.ids.length - 1)
      const gen = Math.max(a.ids.length, b.ids.length)
      const l = by.get(A) ?? {
        ancestor: A,
        contrib: 0,
        pairs: [],
        minGen: Infinity,
      }
      l.contrib += 0.5 ** nn
      l.pairs.push({
        a: a.ids,
        b: b.ids,
        n: nn,
        gen,
        keysA: a.keys,
        keysB: b.keys,
      })
      l.minGen = Math.min(l.minGen, gen)
      by.set(A, l)
    }
  }
  const res = [...by.values()].sort((x, y) => y.contrib - x.contrib || (x.ancestor < y.ancestor ? -1 : 1))
  loopMemo.set(root, res)
  return res
}
export const isLoopVisible = (l: Loop, D: Depth) => l.pairs.some(p => p.gen <= D)

/**
 * 루프 강조 대상: 경로쌍 끝 인스턴스(last(keysA), last(keysB)) → 루프 번호(0부터).
 * 개체 ID가 아니라 인스턴스 path 키로 칠한다. 루프 조상이어도 경로쌍에 들지 않는 인스턴스는 빠진다.
 */
export function loopEndKeys(ls: Loop[]): Map<string, number> {
  const m = new Map<string, number>()
  ls.forEach((l, i) => {
    for (const p of l.pairs) {
      m.set(p.keysA[p.keysA.length - 1]!, i)
      m.set(p.keysB[p.keysB.length - 1]!, i)
    }
  })
  return m
}

// ---------------- 조상 기여율 ----------------
export interface Contribution {
  id: string
  share: number
  foundation: boolean
}
export function contributions(root: string): Contribution[] {
  const m = new Map<string, number>()
  const go = (id: string, w: number) => {
    m.set(id, (m.get(id) ?? 0) + w)
    const p = NODES[id]!
    if (p.dam && p.sire) {
      go(p.dam, w / 2)
      go(p.sire, w / 2)
    }
  }
  go(root, 1)
  m.delete(root)
  return [...m.entries()].map(([id, share]) => ({ id, share, foundation: !NODES[id]!.dam })).sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1))
}

/** 계보의 최대 세대 깊이(기준 계통 = 0) */
export function maxDepth(root: string): number {
  const p = NODES[root]!
  return p.dam && p.sire ? 1 + Math.max(maxDepth(p.dam), maxDepth(p.sire)) : 0
}

// ---------------- DEV 검산(명세 수용 기준·검산 기록) ----------------
if (import.meta.env.DEV) {
  const eq = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol
  const A = (cond: boolean, msg: string) => console.assert(cond, `[검산] ${msg}`)

  A(PEDIGREE.length === 24, `개체 수 ${PEDIGREE.length} ≠ 24`)
  A(NODES['YR13-0819']!.genes.length === 0, '온새미로(YR13-0819) 보유 유전자가 비어 있지 않음(sd1 삭제, 정리 회차 5 A2)')
  A(PEDIGREE.filter(p => p.genes.includes('sd1')).length === 18, `sd1 보유 개체 ${PEDIGREE.filter(p => p.genes.includes('sd1')).length} ≠ 18`)
  A(
    PEDIGREE.every(p => !p.dam || !p.sire || p.genes.every(g => NODES[p.dam!]!.genes.includes(g) || NODES[p.sire!]!.genes.includes(g))),
    '부모 어느 쪽에도 없는 보유 유전자가 있음',
  )
  A(eq(fParents('YR19-0083')!, 0.21875), `별하랑 부모 간 f ${fParents('YR19-0083')} ≠ 0.21875`)
  A(eq(fFixed('YR19-0083')!, 1 - 0.78125 / 64), '별하랑 F7 ≠ 0.98779')
  A(eq(fParents('YR07-0231')!, 0.25) && eq(fParents('YR16-0158')!, 0.25), '가람솔·해솔가온 f ≠ 0.25')
  A(eq(fParents('YR14-0472')!, 0.0625), '늘솔찬 f ≠ 0.0625')
  A(eq(fParents('YR22-0412')!, 0.0390625), 'YR22-0412 f ≠ 0.0390625')
  A(eq(coancestry('YR22-0412', 'YR22-0415'), 0.51953125), '형제 계통 f ≠ 0.5195')
  for (const p of PEDIGREE) {
    const f = fParents(p.id)
    const ls = loops(p.id)
    const sum = ls.reduce((s, l) => s + l.contrib, 0)
    if (f !== null) A(eq(sum, f, 1e-12), `${p.id} 루프 기여 합 ${sum} ≠ f ${f}`)
    if (f === null) continue
    const found = contributions(p.id)
      .filter(c => c.foundation)
      .reduce((s, c) => s + c.share, 0)
    A(eq(found, 1), `${p.id} 기초 조상 기여율 합 ${found} ≠ 1`)
    // 일관성: 연도·유전자·중간 부모값
    const dam = NODES[p.dam!]!
    const sire = NODES[p.sire!]!
    A(p.year > dam.year && p.year > sire.year, `${p.id} 연도 역전`)
    A(
      p.genes.every(g => dam.genes.includes(g) || sire.genes.includes(g)),
      `${p.id} 부모에 없는 유전자`,
    )
    if (p.gebv !== null && dam.gebv !== null && sire.gebv !== null) A(Math.abs(p.gebv - (dam.gebv + sire.gebv) / 2) <= 70.5, `${p.id} |GEBV − 중간 부모값| > 2.5σA`)
  }
  const ls = loops('YR19-0083')
  A(
    ls.map(l => `${l.ancestor}:${l.contrib.toFixed(4)}`).join(',') === 'YR01-0388:0.1250,YR93-0208:0.0313,YR95-0061:0.0313,YR96-0140:0.0313',
    `별하랑 루프 목록 ${ls.map(l => l.ancestor).join(',')}`,
  )
  const cnt = (r: string, D: Depth) => instances(r, D).out.length
  A(cnt('YR19-0083', 3) === 14 && cnt('YR19-0083', 4) === 20 && cnt('YR19-0083', 5) === 22, '별하랑 인스턴스 14/20/22 아님')
  A(cnt('YR22-0412', 3) === 14 && cnt('YR22-0412', 4) === 24 && cnt('YR22-0412', 5) === 30, 'YR22-0412 인스턴스 14/24/30 아님')
  const d4 = instances('YR19-0083', 4).out
  A(d4.filter(i => i.truncated).length === 1 && d4.find(i => i.truncated)?.path === 'SSDD', '별하랑 D4 ＋상위 1개(SSDD) 아님')
  A(new Set(d4.map(i => i.id)).size === 14, '별하랑 D4 고유 개체 14 아님')
  A(ls.filter(l => isLoopVisible(l, 3)).length === 1 && ls.filter(l => isLoopVisible(l, 4)).length === 4, '별하랑 표시 루프 1/4 아님')
  // 루프 강조 인스턴스: 기본 화면(D4)에서 정확히 8개, DSD·SDDS는 제외(회색 ×3만).
  // 명세 수용 기준의 ① 'SD'는 청여울 자리다. 늘솔찬→청여울→YR01-0388은 SDD(n 1+2 = 3, 기여 0.125)
  const ends = loopEndKeys(ls)
  const d4Paths = new Set(d4.map(i => i.path))
  const lit = [...ends.keys()].filter(k => d4Paths.has(k)).sort()
  A(
    lit.join(',') === ['DS', 'SDD', 'DDD', 'SSDD', 'DDS', 'SDDD', 'DSS', 'SSDS'].sort().join(','),
    `별하랑 D4 루프 강조 인스턴스 ${lit.length}개(${lit.join(',')}) ≠ 8개`,
  )
  A(!ends.has('DSD') && !ends.has('SDDS'), '별하랑 DSD·SDDS가 루프 강조됨(경로쌍 아님)')
  A(
    d4.find(i => i.path === 'DSD')?.id === 'YR95-0061' && d4.find(i => i.path === 'SDDS')?.id === 'YR96-0140',
    '별하랑 DSD=YR95-0061, SDDS=YR96-0140 아님',
  )
  const l22 = loops('YR22-0412')
  A(l22.length === 1 && l22[0]!.ancestor === 'YR95-0061' && l22[0]!.pairs.length === 3, 'YR22-0412 루프 YR95-0061 경로쌍 3개 아님')
  const found = contributions('YR19-0083')
    .filter(c => c.foundation)
    .map(c => `${c.id}:${(c.share * 100).toFixed(1)}`)
    .join(',')
  A(found === 'YR95-0061:31.3,YR96-0140:25.0,GR-0147:12.5,GR-0233:12.5,YR86-0112:9.4,YR88-0047:9.4', `별하랑 기초 조상 기여율 ${found}`)
}
