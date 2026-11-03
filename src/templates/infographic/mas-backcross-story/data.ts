/**
 * MAS 여교배(MABC) 사례 — 가람솔 + Pi9(공여친 YR20-1108)
 * 명세: docs/specs/mas-backcross-story.md 「목업 데이터 생성 규칙」을 그대로 옮겼다.
 * 난수 소비 순서(마커 위치 → BC1F1 → BC2F1 → BC3F1 → BC3F2)를 바꾸면 모든 실행값이 달라진다.
 * 실제 데이터로 바꿀 때는 generate()를 칩·KASP 판독 결과(세대별 개체 유전형) 로더로 교체하고 export 형태를 유지한다.
 */
import { createRng } from '@/lib/rng'
import { ORGANISMS } from '@/lib/genomics'

export const AS_OF = '2026-10-23'
export const SEED = 20262865 // 프로그램 공통 시드 20261023 + 1842(명세 근거 참고)
/** 벼 염색체 12개 길이(Mb, IRGSP-1.0 근사) — 공통 `ORGANISMS.rice`에서 가져온다 */
export const CHR_LEN_MB: readonly number[] = ORGANISMS.rice!.chromosomes.map(c => c.lengthMb)
export const GENOME_MB = CHR_LEN_MB.reduce((a, b) => a + b, 0) // 373.0
export const CHR_MAX_MB = Math.max(...CHR_LEN_MB) // 43.3
export const CM_PER_MB = 4.0 // 추정
export const CHIP_MARKERS_QC = 4820 // program-baseline 6K 칩 마커 QC 후
export const KASP_PANEL = 16 // program-baseline KASP 16마커 패널(Pi9 마커 포함)
export const TAT = { kasp: 7, chip: 14 } // KASP = genotyping-lab-ops TAT 목표, 6K = 외부 위탁 계약 TAT(분석실 목표 14일과 같음, 추정)
// 파종 후 일수(명세 가정): kaspDay = sampleDay + kaspPrep + TAT.kasp, chipLag = chipPrep + TAT.chip
export const SAMPLE_TIMING = { sampleDay: 14, kaspPrep: 7, kaspDay: 28, chipPrep: 7, chipLag: 21, crossDay: 76 }
export const N_POLY = 1523 // 양친 다형성(추정)
export const POLY_PCT = (N_POLY / CHIP_MARKERS_QC) * 100 // 31.6
export const POLY_SPACING_KB = (GENOME_MB / N_POLY) * 1000 // 244.9
export const TARGET = { gene: 'Pi9', chr: 6, mb: 10.4 } // program-baseline 유전자 위치
export const FLANK = { left: 9.6, right: 11.2, leftName: 'Pi9-F1', rightName: 'Pi9-F2' } // 추가 KASP
export const FLANK_DIST_MB = Math.round((TARGET.mb - FLANK.left) * 100) / 100 // 0.8
export const FLANK_DIST_CM = FLANK_DIST_MB * CM_PER_MB // 3.2
export const RECURRENT = { name: '가람솔', line: 'YR07-0231', heading: 117, culm: 80, blast: 5 } // variety-profile
export const DONOR = { name: 'YR20-1108', group: 'C', heading: 124, culm: 95, blast: 1 } // crossing-record·kinship-heatmap(blast 추정)
export const CROSS = { id: 'BC24-03', pedigree: '가람솔*4/YR20-1108', crossedAt: '2024-08-12' }
export const INSTITUTE = '○○연구원 벼 디지털육종 프로그램(가상)'

export type GenName = 'F1' | 'BC1F1' | 'BC2F1' | 'BC3F1' | 'BC3F2'
type Step = { gen: GenName; n: number; kind: 'f1' | 'bc' | 'self'; rule?: 'either' | 'both' }
export const PLAN: Step[] = [
  { gen: 'F1', n: 12, kind: 'f1' },
  { gen: 'BC1F1', n: 376, kind: 'bc', rule: 'either' }, // KASP 4플레이트 × 94
  { gen: 'BC2F1', n: 282, kind: 'bc', rule: 'both' }, // 3플레이트
  { gen: 'BC3F1', n: 188, kind: 'bc', rule: 'both' }, // 2플레이트
  { gen: 'BC3F2', n: 188, kind: 'self', rule: 'both' }, // 2플레이트
]
export const N_FINAL_LINES = 3
export const THEORY_RPG: Record<Exclude<GenName, 'F1'>, number> = { BC1F1: 75, BC2F1: 87.5, BC3F1: 93.75, BC3F2: 93.75 }
export const theoryBc = (t: number) => (1 - 0.5 ** (t + 1)) * 100 // BC6 → 99.21875

export type Iv = [number, number]
export type Hap = Iv[][]
export type Ind = [Hap, Hap]
export type DoseFn = (ind: Ind, c: number, x: number) => number

export interface ChipPlant {
  id: string
  rpg: number
}
export interface SelectedPlant extends ChipPlant {
  ind: Ind
}
export interface GenResult {
  gen: GenName
  n: number
  carriers: number
  recL: number | null
  recR: number | null
  chip: ChipPlant[]
  selected: SelectedPlant[]
}

export function generate(seed = SEED) {
  const rng = createRng(seed)
  // 1) 다형성 SNP: 길이 비례 최대 잔여 배분(동률은 염색체 번호 순), 위치 = round(next()·len·1000)/1000, 정렬
  const raw = CHR_LEN_MB.map(l => (N_POLY * l) / GENOME_MB)
  const cnt = raw.map(Math.floor)
  const rest = N_POLY - cnt.reduce((a, b) => a + b, 0)
  raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, rest)
    .forEach(([, i]) => cnt[i]++)
  const markers = CHR_LEN_MB.map((l, c) => {
    const xs: number[] = []
    for (let k = 0; k < cnt[c]; k++) xs.push(Math.round(rng.next() * l * 1000) / 1000)
    return xs.sort((a, b) => a - b)
  })
  const poisson = (lam: number) => {
    const e = Math.exp(-lam)
    let k = 0
    let p = 1
    do {
      k++
      p *= rng.next()
    } while (p > e)
    return k - 1
  }
  const R_HAP: Hap = CHR_LEN_MB.map(() => [])
  const D_HAP: Hap = CHR_LEN_MB.map(l => [[0, l]])
  const clip = (ivs: Iv[], a: number, b: number): Iv[] =>
    ivs.filter(([s, e]) => e > a && s < b).map(([s, e]) => [Math.max(s, a), Math.min(e, b)] as Iv)
  const merge = (ivs: Iv[]): Iv[] => {
    const out: Iv[] = []
    for (const iv of ivs) {
      const last = out[out.length - 1]
      if (last && Math.abs(last[1] - iv[0]) < 1e-12) last[1] = iv[1]
      else out.push([iv[0], iv[1]])
    }
    return out
  }
  // 감수분열: 염색체마다 교차 수 ~ Poisson(길이(M) = len × 4.0 / 100), 위치 균등 → 정렬, 시작 가닥 next() < 0.5 ? 0 : 1
  const meiosis = (ind: Ind): Hap =>
    CHR_LEN_MB.map((l, c) => {
      const k = poisson((l * CM_PER_MB) / 100)
      const xs: number[] = []
      for (let j = 0; j < k; j++) xs.push(rng.next() * l)
      xs.sort((a, b) => a - b)
      let strand = rng.next() < 0.5 ? 0 : 1
      const b = [0, ...xs, l]
      const out: Iv[] = []
      for (let j = 0; j < b.length - 1; j++) {
        out.push(...clip(ind[strand][c], b[j], b[j + 1]))
        strand = 1 - strand
      }
      return merge(out)
    })
  const has = (ivs: Iv[], x: number) => ivs.some(([s, e]) => x >= s && x < e)
  const dose: DoseFn = (ind, c, x) => (has(ind[0][c], x) ? 1 : 0) + (has(ind[1][c], x) ? 1 : 0) // 공여친 대립유전자 수
  const rpg = (ind: Ind) => {
    let d = 0
    markers.forEach((xs, c) => xs.forEach(x => (d += dose(ind, c, x))))
    return (1 - d / (2 * N_POLY)) * 100
  }
  const tc = TARGET.chr - 1

  const gens: GenResult[] = []
  let parent: Ind = [D_HAP, R_HAP] // F1
  for (const step of PLAN) {
    if (step.kind === 'f1') {
      gens.push({ gen: step.gen, n: step.n, carriers: step.n, recL: null, recR: null, chip: [], selected: [] })
      continue
    }
    const plants: { id: string; ind: Ind; rpg: number }[] = []
    for (let i = 0; i < step.n; i++) {
      const ind: Ind = step.kind === 'self' ? [meiosis(parent), meiosis(parent)] : [meiosis(parent), R_HAP]
      plants.push({ id: `${step.gen}-${String(i + 1).padStart(3, '0')}`, ind, rpg: NaN })
    }
    const want = step.kind === 'self' ? 2 : 1 // 전경: BC 이형, 자식 세대 공여친형 동형
    const carriers = plants.filter(p => dose(p.ind, tc, TARGET.mb) === want)
    const isRL = (p: { ind: Ind }) => dose(p.ind, tc, FLANK.left) === 0
    const isRR = (p: { ind: Ind }) => dose(p.ind, tc, FLANK.right) === 0
    const pool = carriers.filter(p => (step.rule === 'either' ? isRL(p) || isRR(p) : isRL(p) && isRR(p))) // 재조합 → 6K 대상
    if (pool.length === 0) throw new Error(`[검산] [mas-backcross-story] ${step.gen} 재조합 개체 0`)
    for (const p of pool) p.rpg = rpg(p.ind)
    const ranked = pool.slice().sort((a, b) => b.rpg - a.rpg || (a.id < b.id ? -1 : 1))
    const selected = ranked.slice(0, step.kind === 'self' ? N_FINAL_LINES : 1)
    gens.push({
      gen: step.gen,
      n: step.n,
      carriers: carriers.length,
      recL: carriers.filter(isRL).length,
      recR: carriers.filter(isRR).length,
      chip: pool.map(p => ({ id: p.id, rpg: p.rpg })),
      selected: selected.map(p => ({ id: p.id, rpg: p.rpg, ind: p.ind })),
    })
    parent = selected[0].ind
  }
  return { markers, gens, dose, rpg }
}

export interface Segment {
  chr: number
  start: number
  end: number
  dose: number
  nMarkers: number
}

// 6K + KASP 판독 공여친 단편(그래픽 유전형): Chr06에는 FLANK.left·TARGET.mb·FLANK.right 위치를 마커로 끼워 넣는다.
// 같은 dose가 이어지는 구간, 경계 = 이웃 마커 중점(첫·끝 마커면 염색체 끝)
export function inferSegments(markers: number[][], ind: Ind, dose: DoseFn): Segment[] {
  const segs: Segment[] = []
  markers.forEach((xs0, c) => {
    const xs = c === TARGET.chr - 1 ? [...xs0, FLANK.left, TARGET.mb, FLANK.right].sort((a, b) => a - b) : xs0
    const ds = xs.map(x => dose(ind, c, x))
    let j = 0
    while (j < xs.length) {
      if (ds[j] === 0) {
        j++
        continue
      }
      let k = j
      while (k + 1 < xs.length && ds[k + 1] === ds[j]) k++
      const start = j === 0 ? 0 : (xs[j - 1] + xs[j]) / 2
      const end = k === xs.length - 1 ? CHR_LEN_MB[c] : (xs[k] + xs[k + 1]) / 2
      segs.push({ chr: c + 1, start, end, dose: ds[j], nMarkers: k - j + 1 })
      j = k + 1
    }
  })
  return segs
}

export const MABC = generate() // 모듈 로드 시 1회(약 1,000개체 × 12염색체, 수십 ms)
export const FINAL = MABC.gens[MABC.gens.length - 1].selected[0] // BC3F2-053
export const lineName = (id: string) => `${CROSS.id}-${id.slice(-3)}` // BC24-03-053
export const FINAL_LINE = lineName(FINAL.id)

// 상수(이 템플릿에서 다시 모의하지 않음 — 명세 검산 모의값)
export const DRAG_EXPECTED = { bc3: 13.5669, bc6: 7.9039, reps: 20000 } // Mb, Chr06 31.2 Mb, Pi9 10.4, 4.0 cM/Mb
export const CONVENTIONAL = { generations: 8, monthsPerGen: 6, label: 'BC6F2' } // 추정
export const SCHEDULE: { gen: string; sow: string | null; seed: string | null; note?: string }[] = [
  { gen: '교배', sow: null, seed: '2024-09-20', note: '2024-08-12 교배' },
  { gen: 'F1', sow: '2024-09-25', seed: '2025-01-10' },
  { gen: 'BC1F1', sow: '2025-01-15', seed: '2025-05-08' },
  { gen: 'BC2F1', sow: '2025-05-12', seed: '2025-08-25' },
  { gen: 'BC3F1', sow: '2025-08-28', seed: '2025-12-15' },
  { gen: 'BC3F2', sow: '2025-12-20', seed: '2026-04-10' },
  { gen: 'BC3F3', sow: '2026-04-22', seed: null, note: '관찰 포장, 결과 정리 2026-10-15' },
]
export const VERIFY_DONE = '2026-10-15'
export const monthsBetween = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7))
export const LINES_SECURED = '2026-04-10'
export const MABC_MONTHS = monthsBetween(CROSS.crossedAt, LINES_SECURED) // 20
export const MABC_GENS = PLAN.length // 5
export const CONV_MONTHS = CONVENTIONAL.generations * CONVENTIONAL.monthsPerGen // 48
export const SAVED = { gens: CONVENTIONAL.generations - MABC_GENS, months: CONV_MONTHS - MABC_MONTHS } // 3, 28
export const MONTHS_PER_GEN = MABC_MONTHS / MABC_GENS // 4.0
export const SAVED_SPLIT = {
  genCount: SAVED.gens * MONTHS_PER_GEN,
  pace: CONVENTIONAL.generations * (CONVENTIONAL.monthsPerGen - MONTHS_PER_GEN),
} // 12, 16
export const VERIFY_2026 = {
  // 2026 관찰 포장(BC3F3), 파종 2026-04-22, 비반복
  final: { blast: 1, heading: 117, culm: 81 },
  recurrent: { blast: RECURRENT.blast, heading: RECURRENT.heading, culm: RECURRENT.culm },
  donor: { blast: DONOR.blast, heading: DONOR.heading, culm: DONOR.culm },
}
export const AYT_YEAR = 2027

/* ───────── 화면용 파생값 ───────── */

export type BcGen = Exclude<GenName, 'F1'>
export interface GenSummary {
  gen: BcGen
  n: number
  carriers: number
  recL: number
  recR: number
  rec: number
  chipN: number
  chipMean: number
  chip: ChipPlant[]
  selected: SelectedPlant[]
  best: SelectedPlant
  donorPct: number
  segCount: number
  segments: Segment[]
  theory: number
}

export const GENS: GenSummary[] = MABC.gens
  .filter(g => g.gen !== 'F1')
  .map(g => {
    const gen = g.gen as BcGen
    const best = g.selected[0]
    const segments = inferSegments(MABC.markers, best.ind, MABC.dose)
    return {
      gen,
      n: g.n,
      carriers: g.carriers,
      recL: g.recL ?? 0,
      recR: g.recR ?? 0,
      rec: g.chip.length,
      chipN: g.chip.length,
      chipMean: g.chip.reduce((a, p) => a + p.rpg, 0) / g.chip.length,
      chip: g.chip,
      selected: g.selected,
      best,
      donorPct: 100 - best.rpg,
      segCount: segments.length,
      segments,
      theory: THEORY_RPG[gen],
    }
  })
export const genOf = (gen: BcGen) => GENS.find(g => g.gen === gen)!
export const F1_N = MABC.gens[0].n
export const PARENT_SAMPLES = 2

export const KASP_TOTAL = PLAN.reduce((a, s) => a + s.n, 0) // 1,046
export const CHIP_TOTAL = GENS.reduce((a, g) => a + g.chipN, 0) // 151
export const CHIP_SAMPLES = CHIP_TOTAL + PARENT_SAMPLES // 153

export const FINAL_SEGMENTS = inferSegments(MABC.markers, FINAL.ind, MABC.dose)
export const TARGET_SEG = FINAL_SEGMENTS.find(s => s.chr === TARGET.chr && s.start <= TARGET.mb && s.end >= TARGET.mb)!
export const TARGET_SEG_MB = TARGET_SEG.end - TARGET_SEG.start // 1.2255
export const RESIDUAL_SEGS = FINAL_SEGMENTS.filter(s => s !== TARGET_SEG)
export const FLANK_SPAN_MB = FLANK.right - FLANK.left // 1.6
export const BC6_THEORY = theoryBc(6) // 99.21875

/** 점 그래프 지터: 난수 소비 순서를 건드리지 않도록 index 기반 저불일치 수열(황금비)로 결정 */
export const jitter = (i: number) => ((i * 0.6180339887) % 1) - 0.5

/** 표시 자릿수: 원값에서 한 번만 반올림 */
export const f1 = (v: number) => v.toFixed(1)
export const fmtMb = (v: number) => v.toFixed(1)
export const chrLabel = (c: number) => `Chr${String(c).padStart(2, '0')}`

/* ───────── DEV 검산 ───────── */
if (import.meta.env.DEV) {
  const T = '[검산] [mas-backcross-story]'
  const a = (cond: boolean, msg: string) => console.assert(cond, `${T} ${msg}`)
  const markerCounts = MABC.markers.map(m => m.length)
  a(markerCounts.reduce((x, y) => x + y, 0) === 1523, `마커 수 합 ${markerCounts.reduce((x, y) => x + y, 0)} ≠ 1,523`)
  a(markerCounts.join(',') === '177,147,149,145,122,127,121,116,94,95,118,112', `염색체별 마커 수 ${markerCounts.join(',')}`)
  const expect: Record<BcGen, [number, number, number, number]> = {
    BC1F1: [196, 3, 7, 10],
    BC2F1: [144, 5, 144, 5],
    BC3F1: [98, 98, 98, 98],
    BC3F2: [38, 38, 38, 38],
  }
  for (const g of GENS) {
    const got = [g.carriers, g.recL, g.recR, g.chipN]
    a(got.join(',') === expect[g.gen].join(','), `${g.gen} (보인자, 왼쪽, 오른쪽, 6K) = (${got.join(', ')}) ≠ (${expect[g.gen].join(', ')})`)
  }
  const selExpect = 'BC1F1-078 80.0|BC2F1-258 90.8|BC3F1-141 98.4|BC3F2-053 99.3|BC3F2-172 99.1|BC3F2-112 99.1'
  const selGot = GENS.flatMap(g => g.selected.map(s => `${s.id} ${f1(s.rpg)}`)).join('|')
  a(selGot === selExpect, `선발 id·RPG ${selGot}`)
  const meanGot = GENS.map(g => f1(g.chipMean)).join(',')
  a(meanGot === '74.5,87.9,95.5,98.0', `6K 평균 ${meanGot}`)
  const donorGot = GENS.map(g => f1(g.donorPct)).join(',')
  a(donorGot === '20.0,9.2,1.6,0.7', `공여친 비율 ${donorGot}`)
  a(KASP_TOTAL === 1046, `KASP 합 ${KASP_TOTAL}`)
  a(CHIP_TOTAL === 151, `6K 합 ${CHIP_TOTAL}`)
  a(FINAL.id === 'BC3F2-053' && FINAL_LINE === 'BC24-03-053', `최종 계통 ${FINAL_LINE}`)
  a(FINAL_SEGMENTS.length === 2, `최종 단편 수 ${FINAL_SEGMENTS.length}`)
  const r = RESIDUAL_SEGS[0]
  a(!!r && r.chr === 5 && r.dose === 1 && fmtMb(r.end - r.start) === '2.2', `잔여 단편 ${r ? `${r.chr} ${r.dose} ${r.end - r.start}` : '없음'}`)
  a(
    TARGET_SEG.dose === 2 && fmtMb(TARGET_SEG_MB) === '1.2' && Math.abs(TARGET_SEG.start - 9.851) < 1e-9 && Math.abs(TARGET_SEG.end - 11.0765) < 1e-9,
    `표적 단편 ${TARGET_SEG.start}~${TARGET_SEG.end} dose ${TARGET_SEG.dose}`,
  )
  a(MABC_MONTHS === 20, `MABC 기간 ${MABC_MONTHS}`)
  a(SAVED.gens === 3 && SAVED.months === 28, `단축 ${SAVED.gens}세대 ${SAVED.months}개월`)
  a(SAVED_SPLIT.genCount === 12 && SAVED_SPLIT.pace === 16, `단축 분해 ${SAVED_SPLIT.genCount} + ${SAVED_SPLIT.pace}`)
  a(SAVED_SPLIT.genCount + SAVED_SPLIT.pace === SAVED.months, '단축 분해 합 ≠ 단축 개월')
  a(f1(BC6_THEORY) === '99.2', `BC6 이론 ${BC6_THEORY}`)
  a(FINAL.rpg >= BC6_THEORY, `최종 RPG ${FINAL.rpg} < BC6 이론 ${BC6_THEORY}`)
  a(f1(POLY_PCT) === '31.6' && f1(POLY_SPACING_KB) === '244.9', `다형성 비율 ${POLY_PCT} · 간격 ${POLY_SPACING_KB}`)
  a(FLANK_DIST_MB === 0.8 && Math.abs(FLANK_DIST_CM - 3.2) < 1e-9, `측면 마커 거리 ${FLANK_DIST_MB} Mb ${FLANK_DIST_CM} cM`)
  a(MONTHS_PER_GEN === 4, `세대당 ${MONTHS_PER_GEN}개월`)
  const st = SAMPLE_TIMING
  a(st.sampleDay + st.kaspPrep + TAT.kasp === st.kaspDay, `KASP 일수 ${st.sampleDay} + ${st.kaspPrep} + ${TAT.kasp} ≠ ${st.kaspDay}`)
  a(st.chipPrep + TAT.chip === st.chipLag, `6K 일수 ${st.chipPrep} + ${TAT.chip} ≠ ${st.chipLag}`)
}
