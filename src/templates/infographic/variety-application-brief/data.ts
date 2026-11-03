/**
 * 신품종 출원 요약서 — 출원 예정 계통 YR19-0118(가칭 '들솔미')의 품종보호 출원 근거를 모은 A4 한 장.
 * 시드 20261023 · 난수를 쓰지 않는다. 모든 값은 아래 상수이고 차·지수·판정·허용 이형주·마커 차이·순위 등은 계산한다.
 * 다른 템플릿의 값은 복제하고 출처를 주석으로 단다(템플릿끼리 import하지 않는다).
 * 명세: docs/specs/variety-application-brief.md
 */
import { MET_ZONE_BY_KEY, MET_ZONES, type MetZoneKey } from '@/charts'
import { formatFixed, formatSigned } from '@/lib/format'
import { KASP_ALLELE_DIRECTION_NOTE, KASP_KIND, KASP_MARKERS, isKaspIdMarker } from '@/lib/genomics'
import { binomAcceptMax } from '@/lib/stats'

export const SEED = 20261023 // 명세 시드(난수 미사용, 기록용)
export const AS_OF = '2026-10-23'

/* ───────── 대상 계통 ───────── */
export const LINE = {
  id: 'YR19-0118',
  provisionalName: '들솔미',
  crossYear: 2019,
  crossSeason: '2019 하계',
  filingMonth: '2026-12',
  cross: {
    female: { id: 'YR13-0819', name: '온새미로', note: '중만생 다수성 · 2025 등록' },
    male: { id: 'YR14-0472', name: '늘솔찬', note: '도열병·흰잎마름병 복합 저항성 · 2026 등록' },
  },
  type: '멥쌀',
  maturity: '중생',
  institute: '○○연구원 벼 디지털육종 프로그램(가상)',
  nameDecision: '2026-11', // 품종 선정 심의·명칭 확정(월만, 추정)
} as const

/** 화면 표기: 가칭 '들솔미' (YR19-0118) */
export const LINE_LABEL = `가칭 '${LINE.provisionalName}' (${LINE.id})`

export const CHECK = { id: 'YR07-0231', name: '가람솔' } // MET 대비 품종
export const DUS_REF = { id: 'YR13-0819', name: '온새미로' } // DUS 대조 품종(가장 유사한 품종)

/* ───────── MET 2025~2026(met-gxe-stability data.ts 원 실행값, 2026-10-23 분석) ───────── */
export const TRIAL = { years: [2025, 2026] as const, sites: 8, reps: 3, nTest: 18, nCheck: 2 }
export const MET = {
  mean: 596.75625,
  checkMean: 559.9979166666668,
  lsd: 15.747757140365533,
  yearMeans: [595.7458333333333, 597.7666666666668],
  checkYearMeans: [568.0041666666667, 551.9916666666667],
  rank: 1,
  nGenotypes: 20,
  nTest: 18,
  asv: 0.8996917448688038,
  asvRank: 1,
  asvMean: 5.3789671421792296,
  wPct: 3.606196850317105,
  wRank: 7,
  wRule: 5,
  b: 0.8701400733078645,
  seB: 0.12586738858511723,
  megaEvidence: { k: 4, n: 10 }, // 중부 평야지 10개 환경 중 실측 1위 4회(이천 2025, 화성·이천·예산 2026)
  zoneWinners: { south: 'YR20-0342', north: 'YR20-0527' } as Partial<Record<MetZoneKey, string>>,
}

export interface Site {
  site: string
  zone: MetZoneKey
  v: number
  c: number
  rank: number
  top: string
}
export const SITES: Site[] = [
  { site: '경기 화성', zone: 'central', v: 639.4833333333333, c: 593.8166666666666, rank: 1, top: 'YR19-0118' },
  { site: '경기 이천', zone: 'central', v: 598.9166666666666, c: 557.9666666666667, rank: 1, top: 'YR19-0118' },
  { site: '충남 당진', zone: 'central', v: 610.2833333333333, c: 582.3833333333334, rank: 5, top: 'YR20-0815' },
  { site: '충남 예산', zone: 'central', v: 637.3833333333334, c: 590.2666666666667, rank: 2, top: 'YR20-0815' },
  { site: '충북 청주', zone: 'central', v: 574.6166666666667, c: 546.2, rank: 3, top: 'YR20-0527' },
  { site: '전북 김제', zone: 'south', v: 620.6833333333334, c: 597.0333333333333, rank: 4, top: 'YR20-0342' },
  { site: '경남 밀양', zone: 'south', v: 545.7166666666667, c: 495.84999999999997, rank: 2, top: 'YR20-0342' },
  { site: '강원 철원', zone: 'north', v: 546.9666666666667, c: 516.4666666666667, rank: 4, top: 'YR20-0527' },
]
export const ZONES = MET_ZONES
/** 메가 환경 승자 권역(지수 최대 권역이 아님 — 남부 106.7 > 중부 106.6) */
export const RECOMMENDED_ZONE: MetZoneKey = 'central'
export const ZONE_AREA: Record<MetZoneKey, string> = { central: '경기·충남·충북 평야', south: '전북·경남 평야', north: '강원 철원' }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
export const siteIndex = (s: Site) => (s.v / s.c) * 100
export const siteChange = (s: Site) => siteIndex(s) - 100
export const sitesOf = (z: MetZoneKey) => SITES.filter(s => s.zone === z)
/** 권역 지수 = 권역 지역 평균끼리 나눔(지수의 평균 아님) */
export const zoneIndex = (z: MetZoneKey) => {
  const ss = sitesOf(z)
  return (mean(ss.map(s => s.v)) / mean(ss.map(s => s.c))) * 100
}
/** 지역이 하나뿐인 권역은 "중북부지(철원)"처럼 지역 이름을 붙인다(met-gxe와 같은 표기) */
export const zoneLabel = (z: MetZoneKey) => {
  const ss = sitesOf(z)
  return ss.length === 1 ? `${MET_ZONE_BY_KEY[z].label}(${ss[0]!.site.split(' ')[1]})` : MET_ZONE_BY_KEY[z].label
}
export const sitesAbove100 = SITES.filter(s => siteIndex(s) > 100).length

export const metIndex = (MET.mean / MET.checkMean) * 100
export const metDiff = MET.mean - MET.checkMean
export const yearIndex = MET.yearMeans.map((v, i) => (v / MET.checkYearMeans[i]!) * 100)

/* ───────── 주요 특성(MET 2025~2026, 8개 지역 × 2년 평균, 대비 가람솔) ───────── */
export const SOW_DATE = { m: 4, d: 20 } // 출수 일수 기준 파종일
const HULL = 0.8 // 제현율(seed-inventory HULL_RATIO)
export const SEED_TGW = { line: 25.3, check: 27.3, dusRef: 27.1 } // seed-inventory 정조 천립중(g)

export type TraitDir = 'higher' | 'lower' | 'neutral'
export interface Trait {
  key: 'yield' | 'heading' | 'culm' | 'tgw' | 'blast' | 'taste'
  label: string
  unit: string
  v: number
  c: number
  lsd: number
  dir: TraitDir
  ratio: boolean
  /** [큰 쪽, 작은 쪽] 판정어 */
  words: [string, string]
  digits: number
  note: string
}
export const TRAITS: Trait[] = [
  { key: 'yield', label: '쌀 수량', unit: 'kg/10a', v: MET.mean, c: MET.checkMean, lsd: MET.lsd, dir: 'higher', ratio: true, words: ['많음', '적음'], digits: 1, note: '백미 · 높을수록 좋음' },
  { key: 'heading', label: '출수기', unit: '일', v: 112, c: 117, lsd: 1, dir: 'neutral', ratio: false, words: ['늦음', '빠름'], digits: 0, note: `${SOW_DATE.m}월 ${SOW_DATE.d}일 파종 기준` },
  { key: 'culm', label: '간장', unit: 'cm', v: 83, c: 80, lsd: 3, dir: 'lower', ratio: true, words: ['김', '짧음'], digits: 0, note: '낮을수록 좋음' },
  { key: 'tgw', label: '현미 천립중', unit: 'g', v: SEED_TGW.line * HULL, c: SEED_TGW.check * HULL, lsd: 0.4, dir: 'neutral', ratio: true, words: ['무거움', '가벼움'], digits: 1, note: '현미 = 정조 × 0.8' },
  { key: 'blast', label: '잎도열병 발병 지수', unit: '점', v: 3, c: 5, lsd: 1, dir: 'lower', ratio: false, words: ['저항성 약함', '저항성 강함'], digits: 0, note: '낮을수록 저항성 · 0~3 저항성' },
  { key: 'taste', label: '밥맛(식미치)', unit: '점', v: 74, c: 71, lsd: 2.5, dir: 'higher', ratio: false, words: ['좋음', '나쁨'], digits: 0, note: '높을수록 좋음' },
]
export const traitOf = (k: Trait['key']) => TRAITS.find(t => t.key === k)!
export const traitDiff = (t: Trait) => t.v - t.c
export const traitIndex = (t: Trait) => (t.ratio ? (t.v / t.c) * 100 : null)
export const isDifferent = (t: Trait) => Math.abs(t.v - t.c) > t.lsd
export const verdict = (t: Trait) => (isDifferent(t) ? (t.v > t.c ? t.words[0] : t.words[1]) : '비슷')
/** 판정 톤: 좋은 방향 positive, 나쁜 방향 negative, 중립 형질 info, 비슷 muted */
export function verdictTone(t: Trait): 'positive' | 'negative' | 'info' | 'muted' {
  if (!isDifferent(t)) return 'muted'
  if (t.dir === 'neutral') return 'info'
  const up = t.v > t.c
  return (t.dir === 'higher') === up ? 'positive' : 'negative'
}
export const blastClass = (s: number) => (s <= 3 ? '저항성' : s <= 6 ? '중도 저항성' : '감수성')
/** 파종일 + n일 → "8월 10일"(Date.UTC 계산) */
export function headingDate(days: number, year = 2026) {
  const d = new Date(Date.UTC(year, SOW_DATE.m - 1, SOW_DATE.d) + days * 86400000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

/* ───────── 구별성(DUS) 예비 조사 ───────── */
export const DUS_SURVEY = { place: '본장 채종포 C-1', years: [2025, 2026] as const, reps: 2, plantsPerRep: 200 } // seed-inventory SEED_FARM
export interface DusRow {
  label: string
  upov: number | null
  kind: 'measured' | 'visual' | 'kasp'
  y: [number, number] | [string, string]
  c: [number, number] | [string, string]
  lsd1?: number
  unit?: string
  digits?: number
  words?: [string, string]
}
export const DUS: DusRow[] = [
  { label: '출수기', upov: 12, kind: 'measured', y: [113, 111], c: [120, 118], lsd1: 2.0, unit: '일', digits: 0, words: ['늦음', '빠름'] },
  { label: '간장', upov: 17, kind: 'measured', y: [84, 83], c: [85, 84], lsd1: 3.2, unit: 'cm', digits: 0 },
  { label: '이삭 길이', upov: 24, kind: 'measured', y: [21.6, 21.9], c: [21.2, 21.0], lsd1: 1.1, unit: 'cm', digits: 1 },
  { label: '주당 이삭 수', upov: 21, kind: 'measured', y: [16.8, 17.2], c: [15.6, 15.9], lsd1: 1.6, unit: '개', digits: 1 },
  { label: '천립중(정조)', upov: 38, kind: 'measured', y: [25.4, 25.2], c: [27.2, 27.0], lsd1: 0.6, unit: 'g', digits: 1, words: ['무거움', '가벼움'] },
  { label: '영 끝 색', upov: 25, kind: 'visual', y: ['백색', '백색'], c: ['백색', '백색'] },
  { label: '아밀로스(Wx 대립유전자형)', upov: null, kind: 'kasp', y: ['Wxᵇ(멥쌀)', 'Wxᵇ(멥쌀)'], c: ['Wxᵇ(멥쌀)', 'Wxᵇ(멥쌀)'] },
]
export const dusDiffs = (r: DusRow): [number, number] | null =>
  r.kind === 'measured' ? [(r.y[0] as number) - (r.c[0] as number), (r.y[1] as number) - (r.c[1] as number)] : null
/** measured: 두 해 모두 |차| > LSD(1%)이고 부호 같음. visual·kasp: 두 해 모두 값이 다르면 차이 */
export function isDistinct(r: DusRow) {
  const d = dusDiffs(r)
  if (d) return d.every(x => Math.abs(x) > r.lsd1!) && Math.sign(d[0]) === Math.sign(d[1])
  return r.y[0] !== r.c[0] && r.y[1] !== r.c[1]
}
export const dusDirection = (r: DusRow) => {
  const d = dusDiffs(r)
  return d && r.words ? (d[0] > 0 ? r.words[0] : r.words[1]) : null
}
export const DISTINCT_ROWS = DUS.filter(isDistinct)
export const nDistinct = DISTINCT_ROWS.length

/* ───────── 균일성·안정성(UPOV TG/16/9 4.2.6: 계통 품종 모집단 기준 0.1%, 수용 확률 95% 이상) ───────── */
export const UNIFORMITY = {
  plantsPerYear: DUS_SURVEY.reps * DUS_SURVEY.plantsPerRep, // 400
  popStd: 0.001,
  acceptProb: 0.95,
  offTypes: { 2025: 1, 2026: 0 } as Record<number, number>,
  offTypeNote: { 2025: '출수 지연 1주' } as Record<number, string>,
}
/** 허용 이형주 = P(X ≤ k) ≥ 수용 확률인 최소 k(공통 @/lib/stats binomAcceptMax) */
export const allowedOffTypes = binomAcceptMax(UNIFORMITY.plantsPerYear, UNIFORMITY.popStd, UNIFORMITY.acceptProb)
export const uniformByYear = DUS_SURVEY.years.map(y => ({ year: y, off: UNIFORMITY.offTypes[y]!, ok: UNIFORMITY.offTypes[y]! <= allowedOffTypes, note: UNIFORMITY.offTypeNote[y] }))
export const isUniform = uniformByYear.every(r => r.ok)
/** 안정성: 구별 형질이 두 해 모두 distinct(방향 같음) && 두 해 모두 균일 */
export const isStable = nDistinct >= 1 && DISTINCT_ROWS.every(isDistinct) && isUniform

/* ───────── KASP 16마커(crossing-record MARKERS 순서, 0 = AA, 2 = BB) ───────── */
export { KASP_MARKERS, KASP_KIND } // 공통 @/lib/genomics(패널 순서·형질 설명)
export const isIdMarker = isKaspIdMarker
export const KASP: Record<string, (0 | 2)[]> = {
  //            Pi9 Pita Pib Pigm Xa21 xa5 Bph18 Wx Hd1 sd1 GS3 ID02 ID04 ID07 ID09 ID11
  'YR19-0118': [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 2],
  'YR13-0819': [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0], // 온새미로(모본·DUS 대조)
  'YR14-0472': [0, 2, 2, 0, 2, 0, 0, 0, 0, 2, 2, 0, 2, 0, 2, 2], // 늘솔찬(부본)
  'YR07-0231': [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 0], // 가람솔(MET 대비)
}
export const KASP_COLUMNS = [
  { id: LINE.id, name: LINE.id, role: `가칭 '${LINE.provisionalName}'` },
  { id: LINE.cross.female.id, name: LINE.cross.female.name, role: '모본 · 대조' },
  { id: LINE.cross.male.id, name: LINE.cross.male.name, role: '부본 · 기존 분석값' },
  { id: CHECK.id, name: CHECK.name, role: 'MET 대비' },
]
export const KASP_DISTINCT_MIN = 2 // 마커 구별 기준(내부, 추정)
export const KASP_STATUS = { sourceNote: 'MET 진입 확인 분석(2025-03, 추정)', recheck: { shipped: '2026-10-14', req: 'RQ26-041', state: '결과 대기' } }
export const ALLELE_DIRECTION_NOTE = KASP_ALLELE_DIRECTION_NOTE
export const gt = (v: 0 | 2) => (v === 2 ? 'BB' : 'AA')
export const markerDiff = (id: string) => KASP_MARKERS.filter((_, i) => KASP[id]![i] !== KASP[LINE.id]![i])
export const bbCount = (id: string) => KASP[id]!.filter(v => v === 2).length
export const parentage = (() => {
  const y = KASP[LINE.id]!
  const f = KASP[LINE.cross.female.id]!
  const m = KASP[LINE.cross.male.id]!
  let match = 0
  const fromFemale: string[] = []
  const fromMale: string[] = []
  KASP_MARKERS.forEach((mk, i) => {
    if (y[i] === f[i] || y[i] === m[i]) match++
    if (f[i] !== m[i]) (y[i] === f[i] ? fromFemale : fromMale).push(mk)
  })
  return { match, total: KASP_MARKERS.length, polymorphic: fromFemale.length + fromMale.length, fromFemale, fromMale }
})()

/* ───────── GS 1차(2023) — program-overview R[2023], SIGMA_A[2023], TRAIN_N[2023], PIPELINE[2023] ───────── */
export const GS2023 = { year: 2023, r: 0.5, sigmaA: 29.0, trainN: 950, candidates: 1900, selected: 540, gebv: 28.6, chip: '6K SNP 칩', model: 'GBLUP' }
/** 표준 정규 누적분포(Abramowitz–Stegun 26.2.17, 오차 < 7.5e-8) */
export function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const tail = (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) * poly
  return x >= 0 ? 1 - tail : tail
}
export const gsRank = Math.round(GS2023.candidates * (1 - normCdf(GS2023.gebv / (GS2023.r * GS2023.sigmaA))))
export const gsRankPct = (gsRank / GS2023.candidates) * 100
export const COHORT_2023 = [1900, 540, 110, 38, 18, 3, 1] // breeding-pipeline-flow cohortCounts(2023)

/* ───────── 육성 경위(타임라인, 연 소수 근사) ───────── */
const yearFrac = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const start = Date.UTC(y, 0, 1)
  const days = (Date.UTC(y + 1, 0, 1) - start) / 86400000
  return y + (Date.UTC(y, m - 1, d) - start) / 86400000 / days
}
export const AS_OF_T = yearFrac(AS_OF)
export const FILING_T = yearFrac(`${LINE.filingMonth}-15`) // 표시 위치(월 중순, annual-report MILESTONES ⑧과 같음)

export interface Milestone {
  n: number
  period: string
  stage: string
  detail: string
  gen?: string
  count?: string
  start: number
  end?: number
  planned?: boolean
}
export const TIMELINE: Milestone[] = [
  { n: 1, period: LINE.crossSeason, stage: '교배', detail: `${LINE.cross.female.id}(현 ${LINE.cross.female.name}) × ${LINE.cross.male.id}(현 ${LINE.cross.male.name}), F1 채종`, start: 2019.55 },
  { n: 2, period: '2019 동계 ~ 2022 동계', stage: '세대 진전', detail: '포장 하계 + 온실 동계 연 2세대, 단립계통법(SSD), 작기 7회', gen: 'F1~F7', start: 2019.85, end: 2022.95 },
  { n: 3, period: '2023 봄', stage: '유전형 분석 · GS 1차', detail: `${GS2023.chip}, ${GS2023.model}`, count: `${COHORT_2023[0]} → ${COHORT_2023[1]}`, start: 2023.2 },
  { n: 4, period: '2023', stage: 'PYT', detail: `계통명 ${LINE.id} 부여`, gen: 'F8', count: String(COHORT_2023[2]), start: 2023.35, end: 2024 },
  { n: 5, period: '2024', stage: 'AYT', detail: `대비 품종 ${CHECK.name}`, gen: 'F9', count: String(COHORT_2023[3]), start: 2024, end: 2025 },
  { n: 6, period: '2025~2026', stage: 'MET', detail: '8개 지역 × 2년 × 3반복', gen: 'F10~F11', count: String(COHORT_2023[4]), start: 2025, end: AS_OF_T },
  { n: 7, period: AS_OF, stage: 'MET 분석 · 출원 후보 선정', detail: '출원 후보 3계통 중 출원 예정', count: `${COHORT_2023[5]} → ${COHORT_2023[6]}`, start: AS_OF_T },
  { n: 8, period: `${LINE.filingMonth}(예정)`, stage: '품종보호 출원', detail: '', start: FILING_T, planned: true },
  { n: 9, period: '2027~2028(예정)', stage: '재배심사', detail: '국립종자원, 2작기', start: 2027, end: 2029, planned: true },
  { n: 10, period: '2029(예정, 추정)', stage: '품종보호 등록', detail: '', start: 2029.3, planned: true },
]
export const devYears = Number(LINE.filingMonth.slice(0, 4)) - LINE.crossYear // 7

/* ───────── 출원 일정 ───────── */
export type ScheduleState = 'done' | 'asof' | 'planned'
export interface ScheduleItem {
  date: string
  state: ScheduleState
  label: string
  /** 규모·근거·출처(작은 글씨) */
  detail: string
}
/** 출원 일정(날짜 순). 품종 선정 심의(2026-11)는 2027 MET 진급 심사회의와 별개 회의다 */
export const SCHEDULE: ScheduleItem[] = [
  { date: '2026-10-14', state: 'done', label: '출원 서류용 KASP 재확인 시료 출고', detail: '5품종·계통 × 20립 · RQ26-041' },
  { date: '2026-10-16', state: 'done', label: '외부 분양 요청 반려(신규성 유지)', detail: '"출원 전 계통" · RQ26-042' },
  { date: AS_OF, state: 'asof', label: 'MET 2년 분석 완료 · 출원 후보 3계통 선정', detail: `후보 ${COHORT_2023[5]} → 출원 예정 ${COHORT_2023[6]}` },
  { date: LINE.nameDecision, state: 'planned', label: '품종 선정 심의 · 품종 명칭 확정', detail: '추정 · 진급 심사회의와 별개' },
  { date: LINE.filingMonth, state: 'planned', label: '품종보호 출원 · 품종 명칭 등록 출원', detail: '일자 미확정' },
  { date: '2027-03-15', state: 'planned', label: '2027 지역 적응 확인 시험 종자 필요일', detail: '후보 3 + 대비 2 × 600 g · RQ26-045 승인 대기' },
  { date: '2027~2028', state: 'planned', label: '재배심사(국립종자원, 2작기)', detail: '별하랑과 같은 주기' },
  { date: '2029', state: 'planned', label: '품종보호 등록', detail: '추정 · 별하랑과 같은 주기' },
]

/* ───────── 종자 보유(seed-inventory BASE_LOTS, 정조 g, 2026-10-23) ───────── */
export const SEED_LOTS = [
  { id: 'L25-003', harvest: 2025, gen: 'F10', bal: 2389.374, germ: 95 },
  { id: 'L26-003', harvest: 2026, gen: 'F11', bal: 4994.94, germ: 94 },
]
export const MIN_HOLD_CAND = 3000 // seed-inventory MIN_HOLD.cand
export const seedTotal = SEED_LOTS.reduce((a, l) => a + l.bal, 0)

/* ───────── 품종보호 요건 점검(계산) ───────── */
export type ReqState = 'ok' | 'progress'
export const REQUIREMENTS: { key: string; label: string; state: ReqState; reason: string }[] = [
  { key: 'novelty', label: '신규성', state: 'ok', reason: `외부 양도·분양 없음 — 출원 전 분양 요청 반려(RQ26-042, ${SCHEDULE[1]!.date.slice(5)})` },
  { key: 'distinct', label: '구별성', state: nDistinct >= 1 ? 'ok' : 'progress', reason: `명확한 차이 ${nDistinct}형질(${DISTINCT_ROWS.map(r => r.label.replace(/\(.*\)/, '')).join('·')})` },
  { key: 'uniform', label: '균일성', state: isUniform ? 'ok' : 'progress', reason: `이형주 ≤ 허용 ${allowedOffTypes}주(${uniformByYear.length}년)` },
  { key: 'stable', label: '안정성', state: isStable ? 'ok' : 'progress', reason: `${DUS_SURVEY.years.length}년 특성 재현` },
  { key: 'name', label: '품종 명칭', state: 'progress', reason: `가칭 '${LINE.provisionalName}' — ${LINE.nameDecision} 확정 예정` },
]

/* ───────── 표시 문자열(한 번만 반올림) ───────── */
export const f1 = (v: number) => formatFixed(v, 1)
export const s1 = (v: number) => formatSigned(v, 1)

/* ───────── DEV 검산 ───────── */
if (import.meta.env.DEV) {
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
  // ① 지역 8곳 평균 = MET 평균
  console.assert(near(mean(SITES.map(s => s.v)), MET.mean) && near(mean(SITES.map(s => s.c)), MET.checkMean), '[검산] 지역 8곳 평균이 MET.mean·checkMean과 다름')
  // ② 연도 평균의 평균 = MET 평균
  console.assert(near(mean(MET.yearMeans), MET.mean) && near(mean(MET.checkYearMeans), MET.checkMean), '[검산] 연도 평균의 평균이 MET.mean과 다름')
  // ③ 형질 판정
  const vs = TRAITS.map(verdict).join(',')
  console.assert(vs === '많음,빠름,비슷,가벼움,저항성 강함,좋음', `[검산] 형질 판정 ${vs} ≠ 많음,빠름,비슷,가벼움,저항성 강함,좋음`)
  // ④ DUS 명확한 차이 = 출수기·천립중(정조)
  console.assert(DISTINCT_ROWS.map(r => r.label).join(',') === '출수기,천립중(정조)', '[검산] DUS 명확한 차이가 출수기·천립중(정조)이 아님')
  // ⑤ 허용 이형주 = 2
  console.assert(allowedOffTypes === 2, `[검산] 허용 이형주 ${allowedOffTypes} ≠ 2`)
  // ⑥ 마커 차이 5·6·7, 친자 일치 16/16(모본형 6 · 부본형 5)
  const md = [LINE.cross.female.id, LINE.cross.male.id, CHECK.id].map(id => markerDiff(id).length).join(',')
  console.assert(md === '5,6,7', `[검산] 마커 차이 ${md} ≠ 5,6,7`)
  console.assert(parentage.match === 16 && parentage.fromFemale.length === 6 && parentage.fromMale.length === 5, '[검산] 친자 일치 16/16(모본형 6 · 부본형 5)과 다름')
  console.assert(KASP_MARKERS.filter((_, i) => KASP[LINE.id]![i] === 2).join(',') === 'Pib,ID02,ID04,ID11', '[검산] YR19-0118 BB 마커가 Pib·ID02·ID04·ID11이 아님')
  // ⑦ GEBV 순위 46
  console.assert(gsRank === 46 && f1(gsRankPct) === '2.4', `[검산] GS 순위 ${gsRank}(상위 ${f1(gsRankPct)}%) ≠ 46위(2.4%)`)
  // ⑧ 개발 기간 7년
  console.assert(devYears === 7, `[검산] 개발 기간 ${devYears} ≠ 7`)
  // ⑨ 표시 문자열
  const site = (n: string) => SITES.find(s => s.site.endsWith(n))!
  const shown = [
    f1(metIndex), s1(metDiff), s1(site('이천').v - site('이천').c), f1(site('밀양').c), s1(site('김제').v - site('김제').c),
    f1(yearIndex[0]!), f1(yearIndex[1]!), f1(zoneIndex('central')), f1(zoneIndex('south')), f1(zoneIndex('north')),
  ].join(' ')
  console.assert(shown === '106.6 +36.8 +40.9 495.9 +23.7 104.9 108.3 106.6 106.7 105.9', `[검산] 표시 문자열 ${shown}`)
  // ⑩ DUS 2년 평균 = 다른 템플릿 상수
  const tgwRow = DUS.find(r => r.upov === 38)!
  const headRow = DUS.find(r => r.upov === 12)!
  console.assert(near(mean(tgwRow.y as number[]), SEED_TGW.line, 1e-9) && near(mean(tgwRow.c as number[]), SEED_TGW.dusRef, 1e-9), '[검산] DUS 천립중(정조) 2년 평균이 seed-inventory tgw와 다름')
  console.assert(mean(headRow.y as number[]) === traitOf('heading').v, '[검산] DUS 출수 2년 평균이 MET 출수 일수와 다름')
  console.assert(headingDate(112) === '8월 10일' && headingDate(117) === '8월 15일', '[검산] 출수일 환산이 8월 10일·8월 15일이 아님')
  console.assert(sitesAbove100 === SITES.length, '[검산] 지역 지수가 모두 100 초과가 아님')
  console.assert(formatFixed(seedTotal, 0) === '7,384', '[검산] 종자 합계가 7,384 g이 아님')
}
