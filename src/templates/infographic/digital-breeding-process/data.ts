/**
 * 디지털육종 프로세스 인포그래픽 데이터.
 * 명세: docs/specs/digital-breeding-process.md (시드 20261023, 난수 미사용)
 *
 * 모든 값은 가상 프로그램의 목업 상수다. 합계·단축·단축률·세대 간격(L)·ΔG·배율·평균 GEBV는
 * 아래 상수에서 계산한다(하드코딩 금지). 실제 데이터로 바꿀 때는 이 파일의 export 형태만 유지하면 된다.
 *
 * program-overview와 공유하는 값은 템플릿 간 결합을 피하려고 복제했다.
 * 출처: src/templates/kpi/program-overview/data.ts (MU, R, I, SIGMA_A, L, TRAIN_N, PIPELINE[2026])
 */
import { formatNumber } from '@/lib/format'

export type Track = 'conventional' | 'digital'

/** 기준 평균 μ (kg/10a). program-overview MU */
export const MU = 560
/** 비교 기준 연도: 전통 = 2019(GS 도입 전), 디지털 = 2026 공정 설계값 */
export const BASIS = { conventional: 2019, digital: 2026 } as const
export const GS_START_YEAR = 2022
export const AS_OF = '2026-10-23'

/** 선발 강도 i, 정확도 r, 상가적 유전 표준편차 σA. program-overview 2019·2026 */
export const PARAMS: Record<Track, { i: number; p: number; r: number; sigmaA: number }> = {
  conventional: { i: 1.4, p: 20, r: 0.45, sigmaA: 30.0 },
  digital: { i: 1.755, p: 10, r: 0.57, sigmaA: 28.2 },
}

// 선발 단계
export const CROSSES = 400
export const LINES_PER_CROSS = 5
export const CANDIDATES = CROSSES * LINES_PER_CROSS // 2,000
export const SELECTED = 600 // 상위 30.0%
export const I_LINE_SEL = 1.159 // p = 30% 정규 절단 강도
export const LINE_SEL_PCT = (SELECTED / CANDIDATES) * 100 // 30.0

// 유전형 분석
export const GENOTYPING = { samples: 2000, chip: '6K SNP 칩', markersUsed: 4820, callRateMean: 98.9, callRateMin: 95, qcPass: 1930, tatDays: 14 }
export const QC_PASS_PCT = (GENOTYPING.qcPass / GENOTYPING.samples) * 100 // 96.5

export const TRAIN_N = 1850
export const TRIALS = { pyt: 120, ayt: 40, met: 18, metSites: 8, metYears: { conventional: 3, digital: 2 } }
export const CANDIDATES_FOR_RELEASE = 3
export const APPLICATIONS_2026 = { filed: 1, asOf: AS_OF, planned: 1, plannedMonth: 12 }
/** 실제 최단 출원 사례(도입 과도기 계통, program-overview R15: 2019 교배 → 2026 출원) */
export const SHORTEST_ACTUAL_YEARS = 7
export const PIPELINE_2026 = [CANDIDATES, SELECTED, TRIALS.pyt, TRIALS.ayt, TRIALS.met, CANDIDATES_FOR_RELEASE]

/** 세대 진전 속도: F2~F6 = 5세대 ÷ 세대 진전 기간 */
export const GEN_RATE: Record<Track, number> = { conventional: 5 / 3.0, digital: 5 / 1.3 } // 1.67, 3.85 → toFixed(1)

const r1 = (v: number) => Math.round(v * 10) / 10
const n0 = (v: number) => formatNumber(v, { digits: 0 })
const f1 = (v: number) => v.toFixed(1)

/** 선발 계통 평균 GEBV = i₃₀% × r × σA (kg/10a, 집단 평균 0 기준) */
export const MEAN_GEBV_SELECTED = I_LINE_SEL * PARAMS.digital.r * PARAMS.digital.sigmaA // 18.63

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Stage {
  id: StageId
  name: string
  /** 짧은 이름(타임라인 범례용) */
  short: string
  /** 년, null = 전통 공정에 해당 없음 */
  conventional: number | null
  /** 년 */
  digital: number
  /** 세대 간격(L)에 포함 */
  inCycle: boolean
  /** 디지털 신규 단계 */
  isNew: boolean
  /** 디지털 기간 보조 표기 */
  digitalNote: string
  digitalDesc: string
  conventionalDesc: string
  kpi: { value: string; label: string; sub: string[] }
}

export const STAGES: Stage[] = [
  {
    id: 1,
    name: '교배',
    short: '교배',
    conventional: 0.5,
    digital: 0.5,
    inCycle: true,
    isNew: false,
    digitalNote: '약 6개월',
    digitalDesc: `부모 조합 ${n0(CROSSES)}개, F1 채종`,
    conventionalDesc: '같음',
    kpi: { value: n0(CROSSES), label: '교배 조합/년', sub: ['F1 채종', '약 6개월'] },
  },
  {
    id: 2,
    name: '세대 진전(속성세대진전)',
    short: '세대 진전',
    conventional: 3.0,
    digital: 1.3,
    inCycle: true,
    isNew: false,
    digitalNote: `약 16개월, 연 ${f1(GEN_RATE.digital)}세대`,
    digitalDesc: '단일(短日) 처리 온실에서 F2~F6, 단립계통법(SSD)',
    conventionalDesc: `포장 1작 + 동계 온실 세대 진전, 연 ${f1(GEN_RATE.conventional)}세대`,
    kpi: {
      value: f1(GEN_RATE.digital),
      label: '세대/년',
      sub: [`전통 ${f1(GEN_RATE.conventional)}세대/년`, 'F2~F6', `${n0(CANDIDATES)}계통 확보`],
    },
  },
  {
    id: 3,
    name: '유전형 분석',
    short: '유전형 분석',
    conventional: null,
    digital: 0.1,
    inCycle: true,
    isNew: true,
    digitalNote: `약 5주(분석실 TAT ${GENOTYPING.tatDays}일 포함)`,
    digitalDesc: `F6 ${n0(CANDIDATES)}계통 잎 시료 → ${GENOTYPING.chip}`,
    conventionalDesc: '해당 없음',
    kpi: {
      value: n0(GENOTYPING.samples),
      label: '분석 샘플/년',
      sub: [GENOTYPING.chip, `평균 콜레이트 ${f1(GENOTYPING.callRateMean)}%`, `QC 통과율 ${f1(QC_PASS_PCT)}%`, `TAT ${GENOTYPING.tatDays}일`],
    },
  },
  {
    id: 4,
    name: 'GEBV 예측',
    short: 'GEBV 예측',
    conventional: null,
    digital: 0.1,
    inCycle: true,
    isNew: true,
    digitalNote: '약 5주(모델 재학습·검토 포함)',
    digitalDesc: `훈련 집단 ${n0(TRAIN_N)}계통, GBLUP`,
    conventionalDesc: '해당 없음',
    kpi: {
      value: PARAMS.digital.r.toFixed(2),
      label: '예측 정확도(r)',
      sub: ['GBLUP', `훈련 집단 ${n0(TRAIN_N)}계통`, `마커 ${n0(GENOTYPING.markersUsed)}개`],
    },
  },
  {
    id: 5,
    name: '선발',
    short: '선발',
    conventional: 1.0,
    digital: 0.2,
    inCycle: true,
    isNew: false,
    digitalNote: '약 2.5개월',
    digitalDesc: `GEBV 상위 ${f1(LINE_SEL_PCT)}% ${n0(SELECTED)}계통 → 시험, 상위 ${PARAMS.digital.p}% → 다음 교배 부모`,
    conventionalDesc: '계통 관찰 포장에서 1작기 표현형 선발',
    kpi: {
      value: n0(SELECTED),
      label: `선발 계통(상위 ${f1(LINE_SEL_PCT)}%)`,
      sub: [`평균 GEBV +${f1(MEAN_GEBV_SELECTED)} kg/10a(후보 평균 대비)`, `상위 ${PARAMS.digital.p}%는 다음 교배 부모로`],
    },
  },
  {
    id: 6,
    name: '생산력·지역 적응 시험',
    short: '생산력·지역 시험',
    conventional: 6.0,
    digital: 4.0,
    inCycle: false,
    isNew: false,
    digitalNote: `PYT 1 + AYT 1 + MET ${TRIALS.metYears.digital}년`,
    digitalDesc: `선발 ${n0(SELECTED)}계통 관찰 후 ${TRIALS.pyt}계통 PYT 진입 → ${TRIALS.ayt} → ${TRIALS.met}계통, 다환경 GEBV로 MET 1년 단축`,
    conventionalDesc: `PYT 1 + AYT 2 + MET ${TRIALS.metYears.conventional}년`,
    kpi: {
      value: n0(TRIALS.met),
      label: '지역 적응 시험 계통',
      sub: [`선발 ${n0(SELECTED)} → PYT ${TRIALS.pyt} → AYT ${TRIALS.ayt} → MET ${TRIALS.met}`, `${TRIALS.metSites}개 지역 × ${TRIALS.metYears.digital}년`],
    },
  },
  {
    id: 7,
    name: '품종 출원',
    short: '품종 출원',
    conventional: 0.5,
    digital: 0.5,
    inCycle: false,
    isNew: false,
    digitalNote: '약 6개월',
    digitalDesc: `출원 후보 ${CANDIDATES_FOR_RELEASE}계통, 품종 선정 심의 → 품종보호 출원`,
    conventionalDesc: '같음',
    kpi: {
      value: n0(CANDIDATES_FOR_RELEASE),
      label: '출원 후보 계통',
      sub: [`2026년 출원 ${APPLICATIONS_2026.filed}건(10/23 기준)`, `${APPLICATIONS_2026.plannedMonth}월 ${APPLICATIONS_2026.planned}건 예정`],
    },
  },
]

const sum = (k: Track, f: (s: Stage) => boolean = () => true) => r1(STAGES.filter(f).reduce((a, s) => a + (s[k] ?? 0), 0))

/** 품종 개발 기간(년): 11.0, 6.7 */
export const TOTAL: Record<Track, number> = { conventional: sum('conventional'), digital: sum('digital') }
/** 단축(년): 4.3 */
export const SAVED = r1(TOTAL.conventional - TOTAL.digital)
/** 단축률(%): 39.09 → 반올림 전 값으로 계산 */
export const SAVED_PCT = ((TOTAL.conventional - TOTAL.digital) / TOTAL.conventional) * 100
/** 세대 간격 L(년) = ①~⑤ 합: 4.5, 2.2 */
export const L: Record<Track, number> = {
  conventional: sum('conventional', s => s.inCycle),
  digital: sum('digital', s => s.inCycle),
}
/** 단계 단축(년). 신규 단계는 음수(기간 추가) */
export const stageSaved = (s: Stage) => (s.conventional == null ? -s.digital : r1(s.conventional - s.digital))
export const stageSavedPct = (s: Stage) => (s.conventional == null ? null : ((s.conventional - s.digital) / s.conventional) * 100)

/** ΔG = i · r · σA / L (kg/10a/년): 4.20, 12.82 */
export const dG = (k: Track) => (PARAMS[k].i * PARAMS[k].r * PARAMS[k].sigmaA) / L[k]
/** ΔG %/년 = ΔG / μ × 100: 0.75, 2.29 */
export const dGpct = (k: Track) => (dG(k) / MU) * 100
/** 예측 배율: 3.053 → "3.1배(예측)" */
export const GAIN_RATIO = dG('digital') / dG('conventional')

// ───────── 출처: kpi/genetic-gain-tracker periodStats(쌀 수량, 2019~2026) — 실현 유전적 추세 기울기 ─────────
// 원 실행값(2026-10-26 정리 회차 2 재실행, REALIZATION_BIAS 0.90). 전통 = 2019~2021 코호트, GS = 2021~2026 코호트
export const REALIZED = { conventional: 3.439753, gs: 9.097399 } as const // kg/10a/년 → "3.4", "9.1"
/** 실현 배율 2.644783 → "2.6배". 예측 배율 GAIN_RATIO와 함께 보인다(사용자 결정 2026-10-26) */
export const REALIZED_RATIO = REALIZED.gs / REALIZED.conventional

/** 신규 단계로 늘어난 기간(년): 0.2 */
export const NEW_STAGE_ADDED = r1(STAGES.filter(s => s.isNew).reduce((a, s) => a + s.digital, 0))


// ───────── DEV 검산(정리 회차 2: ΔG 배율 표기) ─────────
if (import.meta.env.DEV) {
  const T = '[검산] [digital-breeding-process]'
  console.assert(GAIN_RATIO.toFixed(1) === '3.1' && REALIZED_RATIO.toFixed(1) === '2.6', `${T} 예측/실현 배율 ${GAIN_RATIO.toFixed(3)}/${REALIZED_RATIO.toFixed(3)}, 기대 3.1/2.6`)
}
