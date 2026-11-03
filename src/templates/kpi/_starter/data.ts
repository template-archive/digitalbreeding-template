import { createRng } from '@/lib/rng'

// 기반 검증용 목업. 시드를 바꾸면 화면이 바뀐다.
const rng = createRng(20261023)

export const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i)

/** 벼 수량 형질의 연도별 평균 육종가(kg/10a, 2017년 기준 편차) — 전통 선발 vs 유전체 선발 */
function trend(slope: number, noise: number) {
  let level = 0
  return YEARS.map((_, i) => {
    if (i > 0) level += slope + rng.normal(0, noise)
    return Number(level.toFixed(1))
  })
}

export const conventional = trend(3.1, 1.2)
/** 유전체 선발을 도입한 연도 인덱스(2021) */
export const GS_START = 4

/** 2021년 유전체 선발 도입 이후 경로(도입 전은 null) */
export const genomic: (number | null)[] = (() => {
  let level = conventional[GS_START]!
  return YEARS.map((_, i) => {
    if (i < GS_START) return null
    if (i > GS_START) level += 5.4 + rng.normal(0, 1.1)
    return Number(level.toFixed(1))
  })
})()

const gainPerYear = (series: (number | null)[], from: number) => {
  const vals = series.slice(from).filter((v): v is number => v !== null)
  return (vals[vals.length - 1]! - vals[0]!) / (vals.length - 1)
}

export const kpis = {
  geneticGain: {
    value: Number(gainPerYear(genomic, GS_START).toFixed(1)),
    previous: Number(gainPerYear(conventional, 0).toFixed(1)),
    spark: genomic.slice(GS_START).map(v => v ?? 0),
  },
  accuracy: {
    value: 0.71,
    previous: 0.66,
    target: 0.75,
    spark: [0.58, 0.61, 0.63, 0.66, 0.68, 0.71],
  },
  generationInterval: {
    value: 3.2,
    previous: 4.0,
    target: 3.0,
    spark: [5.5, 5.1, 4.6, 4.0, 3.6, 3.2],
  },
}

// ---- 공통 컴포넌트 점검용(2026-10-30): 넓은 표·격자·단계·경보 목록 목업 ----

/** 시험 계통 표(넓은 열 → 좁은 화면 가로 스크롤 안내·열 숨김 확인) */
export interface CheckLine {
  id: string
  group: string
  heading: number
  height: number
  yield: number
  index: number
  verdict: '진급' | '보류' | '탈락'
}
export const CHECK_LINES: CheckLine[] = Array.from({ length: 6 }, (_, i) => {
  const y = 540 + Math.round(rng.normal(30, 18))
  return {
    id: `YR24-${String(101 + i * 37).padStart(4, '0')}`,
    group: i % 2 ? 'B 다수성' : 'A 고품질',
    heading: 108 + rng.int(-4, 6),
    height: 78 + rng.int(-6, 8),
    yield: y,
    index: Number(((y / 560) * 100).toFixed(1)),
    verdict: y >= 575 ? '진급' : y >= 555 ? '보류' : '탈락',
  }
})

/** 5단계 업무 흐름(768px 축약 확인) */
export const CHECK_STEPS = [
  { id: 'sow', label: '파종·이앙', description: '04-22 / 05-20 · 126구', done: true },
  { id: 'survey', label: '출수 조사', description: '08-04 / 08-28 · 125/126구', done: true },
  { id: 'harvest', label: '수확', description: '10-02 / 10-15', done: true },
  { id: 'qc', label: '자료 검토', description: '검토 9건' },
  { id: 'report', label: '보고', description: '11-06 예정', enabled: false },
] as const
