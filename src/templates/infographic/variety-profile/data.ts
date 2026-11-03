/**
 * 신품종 소개 카드('별하랑') 데이터.
 * 명세: docs/specs/variety-profile.md (시드 20261023, 난수 미사용 — 모든 값이 확정 상수)
 *
 * 지수·차·판정·평균·권역 평균·보유 수·개발 기간·단축 연수·GEBV 순위 비율은 아래 상수에서 계산한다(하드코딩 금지).
 * 실제 데이터로 바꿀 때는 이 파일의 export 형태만 유지하면 화면 문구와 막대가 자동으로 다시 계산된다.
 *
 * program-overview·digital-breeding-process와 공유하는 값은 템플릿 간 결합을 피하려고 복제했다.
 * 출처: src/templates/kpi/program-overview/data.ts (MU, 출원 목록 R1·R10·R15, R[2022], SIGMA_A[2022], 파이프라인 2022)
 *       src/templates/infographic/digital-breeding-process/data.ts (TOTAL.conventional 11.0, TOTAL.digital 6.7)
 */

import { ORGANISMS } from '@/lib/genomics'

export const AS_OF = '2026-10-23'
/** 기준 평균 μ(kg/10a). program-overview MU — 대비 품종 2년 평균과 같게 맞춤(목업 단순화) */
export const MU = 560

export const VARIETY = {
  name: '별하랑',
  line: 'YR19-0083',
  crossYear: 2019,
  filedAt: '2026-06-09', // program-overview R15
  cross: { female: '가람솔', male: 'YR14-0472', maleName: '늘솔찬' }, // R1 × R10
  maturity: '중만생',
  type: '멥쌀',
  status: '출원',
  institute: '○○연구원 벼 디지털육종 프로그램(가상)',
} as const

/** 대비 품종. program-overview R1 */
export const CHECK = { name: '가람솔', line: 'YR07-0231', note: '중만생 다수성 · 모본' } as const

/** digital-breeding-process TOTAL.conventional / TOTAL.digital */
export const CONVENTIONAL_YEARS = 11.0
export const DIGITAL_DESIGN_YEARS = 6.7

/** 개발 기간 = 출원 연도 − 교배 연도(program-overview 정의) */
export const devYears = Number(VARIETY.filedAt.slice(0, 4)) - VARIETY.crossYear // 7
export const savedYears = Math.round((CONVENTIONAL_YEARS - devYears) * 10) / 10 // 4.0

/** 성적 출처 */
export const TRIAL = { years: [2024, 2025] as const, sites: 8, reps: 3, sowing: '4월 20일', transplant: '5월 하순' }

/* ───────── 형질 성적 ───────── */

export type Dir = 'higher' | 'lower' | 'neutral'
export type TraitKey = 'yield' | 'heading' | 'culm' | 'tgw' | 'blast' | 'taste'

export interface Trait {
  key: TraitKey
  label: string
  unit: string
  v: number
  c: number
  lsd: number
  dir: Dir
  /** 비율 척도 형질만 지수(%)를 계산한다 */
  ratio: boolean
  /** [v > c일 때, v < c일 때] 판정 문구 */
  words: readonly [string, string]
  /** 값 표기 자릿수 */
  digits: number
  /** 행 아래 보조 설명 */
  hint?: string
  date?: { v: string; c: string }
}

export const TRAITS: readonly Trait[] = [
  { key: 'yield', label: '쌀 수량', unit: 'kg/10a', v: 605, c: 560, lsd: 18, dir: 'higher', ratio: true, words: ['많음', '적음'], digits: 0, hint: '높을수록 좋음' },
  {
    key: 'heading', label: '출수기', unit: '일', v: 118, c: 117, lsd: 1, dir: 'neutral', ratio: false, words: ['늦음', '빠름'], digits: 0,
    hint: '파종(4월 20일) 후 일수', date: { v: '8월 16일', c: '8월 15일' },
  },
  { key: 'culm', label: '간장', unit: 'cm', v: 76, c: 80, lsd: 3, dir: 'lower', ratio: true, words: ['김', '짧음'], digits: 0, hint: '짧을수록 도복에 강함' },
  { key: 'tgw', label: '천립중', unit: 'g', v: 23.1, c: 22.0, lsd: 0.4, dir: 'neutral', ratio: true, words: ['무거움', '가벼움'], digits: 1, hint: '현미 1,000립 무게' },
  { key: 'blast', label: '잎도열병 발병 지수', unit: '점', v: 2, c: 5, lsd: 1, dir: 'lower', ratio: false, words: ['약함', '강함'], digits: 0, hint: '0~9 · 낮을수록 저항성' },
  { key: 'taste', label: '식미치', unit: '점', v: 72, c: 71, lsd: 2.5, dir: 'higher', ratio: false, words: ['좋음', '나쁨'], digits: 0, hint: '식미계 점수' },
]

export const traitOf = (k: TraitKey) => TRAITS.find(t => t.key === k)!

/** 차(부동소수점 정리) */
export const diff = (t: Trait) => Math.round((t.v - t.c) * 10) / 10
/** 지수(대비 = 100). 비율 척도가 아니면 null */
export const index = (t: Trait) => (t.ratio ? (t.v / t.c) * 100 : null)
/** 증감(%). 0 = 대비 품종 */
export const changePct = (t: Trait) => (t.ratio ? (t.v / t.c - 1) * 100 : null)
/** |차| > LSD이면 방향 문구, 아니면 "비슷" */
export const verdict = (t: Trait) => (Math.abs(t.v - t.c) > t.lsd ? (t.v > t.c ? t.words[0] : t.words[1]) : '비슷')
/** 판정이 육종 목표 방향으로 유리한지(아이콘 색용). neutral 형질은 정보성 */
export const verdictTone = (t: Trait): 'good' | 'bad' | 'info' | 'same' => {
  if (verdict(t) === '비슷') return 'same'
  if (t.dir === 'neutral') return 'info'
  const better = t.dir === 'higher' ? t.v > t.c : t.v < t.c
  return better ? 'good' : 'bad'
}
/** 잎도열병 등급(0~3 저항성, 4~6 중도 저항성, 7~9 감수성 — 이 템플릿 분류, 추정) */
export const blastClass = (s: number) => (s <= 3 ? '저항성' : s <= 6 ? '중도 저항성' : '감수성')
export const BLAST_BANDS = [
  { from: 0, to: 3, label: '저항성' },
  { from: 4, to: 6, label: '중도' },
  { from: 7, to: 9, label: '감수성' },
] as const

/* ───────── 연차별 수량 ───────── */

export const YIELD_BY_YEAR = [
  { year: 2024, v: 598, c: 552 },
  { year: 2025, v: 612, c: 568 },
] as const
export const yearIndex = (y: (typeof YIELD_BY_YEAR)[number]) => (y.v / y.c) * 100 // 108.33, 107.75

/* ───────── 지역 적응 시험 지역별 성적 ───────── */

export type Zone = '중부 평야지' | '남부 평야지' | '중북부지'
export const ZONES: readonly Zone[] = ['중부 평야지', '남부 평야지', '중북부지']
export const ZONE_INFO: Record<Zone, { area: string; note: string }> = {
  '중부 평야지': { area: '경기·충남·충북 평야', note: '재배 적지' },
  '남부 평야지': { area: '전북·경남 평야', note: '재배 가능' },
  중북부지: { area: '강원 철원', note: '부적지' },
}

export interface Site {
  site: string
  zone: Zone
  v: number
  c: number
}

export const SITES: readonly Site[] = [
  { site: '경기 화성', zone: '중부 평야지', v: 645, c: 575 },
  { site: '경기 이천', zone: '중부 평야지', v: 630, c: 565 },
  { site: '충남 당진', zone: '중부 평야지', v: 648, c: 580 },
  { site: '충남 예산', zone: '중부 평야지', v: 636, c: 570 },
  { site: '충북 청주', zone: '중부 평야지', v: 619, c: 560 },
  { site: '전북 김제', zone: '남부 평야지', v: 588, c: 570 },
  { site: '경남 밀양', zone: '남부 평야지', v: 562, c: 540 },
  { site: '강원 철원', zone: '중북부지', v: 512, c: 520 },
]

const mean = (a: readonly number[]) => a.reduce((s, x) => s + x, 0) / a.length
export const siteIndex = (s: Site) => (s.v / s.c) * 100
export const siteChange = (s: Site) => siteIndex(s) - 100
/** 권역 평균 수량끼리 나눈 지수(지수의 평균이 아님). 중부 111.51, 남부 103.60, 중북부 98.46 */
export const zoneIndex = (z: Zone) => {
  const xs = SITES.filter(s => s.zone === z)
  return (mean(xs.map(s => s.v)) / mean(xs.map(s => s.c))) * 100
}
export const zoneSiteCount = (z: Zone) => SITES.filter(s => s.zone === z).length
/** 지수 최고 권역(계산) */
export const RECOMMENDED_ZONE: Zone = [...ZONES].sort((a, b) => zoneIndex(b) - zoneIndex(a))[0]
/** 지수 100 미만 권역 */
export const UNSUITED_ZONES = ZONES.filter(z => zoneIndex(z) < 100)
export const sitesAbove100 = SITES.filter(s => siteIndex(s) >= 100).length // 7

export const siteMeanV = mean(SITES.map(s => s.v)) // 605
export const siteMeanC = mean(SITES.map(s => s.c)) // 560

/* ───────── 보유 유전자·마커 ───────── */

/** 벼 염색체 길이(Mb), organisms.md IRGSP-1.0 근사 */
/** 벼 염색체 12개 길이(Mb, IRGSP-1.0 근사) — 공통 `ORGANISMS.rice`에서 가져온다 */
export const CHR_LEN_MB: readonly number[] = ORGANISMS.rice!.chromosomes.map(c => c.lengthMb)

export interface Gene {
  gene: string
  trait: string
  chr: number
  mb: number
  /** 보유 수 집계 대상(Wx는 대립유전자형만 표시) */
  counted: boolean
  v?: boolean
  c?: boolean
  allele?: string
  origin: string | null
}

/** 유전자 이름은 실제, 품종별 보유 여부는 가상. 위치는 IRGSP-1.0 근사(추정) */
export const GENES: readonly Gene[] = [
  { gene: 'Pi-ta', trait: '도열병 저항성', chr: 12, mb: 10.6, counted: true, v: true, c: false, origin: '부본 YR14-0472' },
  { gene: 'Pib', trait: '도열병 저항성', chr: 2, mb: 35.1, counted: true, v: true, c: false, origin: '부본 YR14-0472' },
  { gene: 'Pi9', trait: '도열병 저항성', chr: 6, mb: 10.4, counted: true, v: false, c: false, origin: null },
  { gene: 'Xa21', trait: '흰잎마름병 저항성', chr: 11, mb: 21.0, counted: true, v: false, c: false, origin: null },
  { gene: 'sd1', trait: '반왜성(도복 저항)', chr: 1, mb: 38.4, counted: true, v: true, c: true, origin: '양친 공통' },
  { gene: 'Wx', trait: '아밀로스(찰/메)', chr: 6, mb: 1.8, counted: false, allele: 'Wxᵇ(멥쌀형)', origin: '양친 공통' },
]
export const heldCount = (k: 'v' | 'c') => GENES.filter(g => g.counted && g[k]).length // 3, 1
export const countedTotal = GENES.filter(g => g.counted).length // 5
/** 별하랑이 보유한 도열병 저항성 유전자 */
export const blastGenesHeld = GENES.filter(g => g.counted && g.v && g.trait === '도열병 저항성').map(g => g.gene) // Pi-ta, Pib

/* ───────── GS 선발 당시(program-overview 2022) ───────── */

export const GS2022 = { year: 2022, r: 0.46, sigmaA: 29.3, candidates: 1800, selected: 480, gebv: 31.5, rank: 18, chip: '6K SNP 칩', model: 'GBLUP' } as const
export const gebvZ = GS2022.gebv / (GS2022.r * GS2022.sigmaA) // 2.337
export const rankPct = (GS2022.rank / GS2022.candidates) * 100 // 1.0

/* ───────── 개발 이력 ───────── */

export interface Milestone {
  n: number
  /** 연 소수(2019.5 = 2019년 중반) */
  start: number
  end?: number
  period: string
  label: string
  note: string
  planned?: boolean
}

/** 2026-06-09 → 연 소수 */
const ymd = (s: string) => {
  const d = new Date(`${s}T00:00:00`)
  const y = d.getFullYear()
  const start = new Date(`${y}-01-01T00:00:00`).getTime()
  const end = new Date(`${y + 1}-01-01T00:00:00`).getTime()
  return y + (d.getTime() - start) / (end - start)
}
export const FILED_T = ymd(VARIETY.filedAt) // 2026.44
export const AS_OF_T = ymd(AS_OF) // 2026.81

export const TIMELINE: readonly Milestone[] = [
  { n: 1, start: 2019.55, period: '2019 하계', label: '교배', note: `${VARIETY.cross.female} / ${VARIETY.cross.male} 교배, F1 채종` },
  { n: 2, start: 2019.85, end: 2022.0, period: '2019 동계 ~ 2021 동계', label: '세대 진전', note: '포장 하계 + 온실 동계 세대 진전(연 2세대), 단립계통법(SSD) F1~F5(작기 5회)' },
  {
    n: 3, start: 2022.25, period: '2022 봄', label: '유전형 분석·GS 1차 선발',
    note: `${GS2022.chip}, ${GS2022.model}(GS 도입 첫해, r ${GS2022.r.toFixed(2)}). F5 1,800계통 → 480계통 선발`,
  },
  { n: 4, start: 2022.4, end: 2022.95, period: '2022', label: 'PYT', note: `계통명 ${VARIETY.line} 부여, F6` },
  { n: 5, start: 2023.3, end: 2023.95, period: '2023', label: 'AYT', note: `대비 품종 ${CHECK.name}` },
  { n: 6, start: 2024.3, end: 2025.9, period: '2024~2025', label: 'MET', note: '8개 지역 × 2년' },
  { n: 7, start: 2025.95, period: '2025 동계', label: '품종 선정 심의', note: `품종명 '${VARIETY.name}' 확정` },
  { n: 8, start: FILED_T, period: VARIETY.filedAt, label: '품종보호 출원', note: `개발 ${devYears}년(${VARIETY.crossYear} → ${VARIETY.filedAt.slice(0, 4)})` },
  { n: 9, start: 2027.05, end: 2028.95, period: '2027~2028(예정)', label: '재배심사', note: '기준일 이후 계획', planned: true },
]

/* ───────── 개발 모드 검산 ───────── */

if (import.meta.env?.DEV) {
  const y = traitOf('yield')
  const ok = (cond: boolean, msg: string) => {
    if (!cond) console.warn(`[검산] [variety-profile] 검산 실패: ${msg}`)
  }
  ok(siteMeanV === y.v && siteMeanC === y.c, '지역 8곳 평균 ≠ 형질 표 수량')
  ok(mean(YIELD_BY_YEAR.map(r => r.v)) === y.v && mean(YIELD_BY_YEAR.map(r => r.c)) === y.c, '연도 평균 ≠ 형질 표 수량')
  ok(y.c === MU, '대비 수량 ≠ 기준 평균 μ')
  ok(devYears === 7, '개발 기간 ≠ 7년')
  ok(GENES.every(g => g.mb < CHR_LEN_MB[g.chr - 1]), '유전자 위치가 염색체 길이를 넘음')
  ok(RECOMMENDED_ZONE === '중부 평야지', '재배 적지 계산 결과가 명세와 다름')
}
