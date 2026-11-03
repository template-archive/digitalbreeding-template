/**
 * 연간 성과 원페이저 — 데이터
 *
 * 이 화면은 난수를 쓰지 않는다. 같은 가상 프로그램(program-baseline)의 2026년 사실을 다른 템플릿에서 모아
 * 한 장으로 요약하므로, 다른 템플릿 상수를 여기에 복제하고(템플릿 간 import 금지) 출처를 주석으로 남긴다.
 * 파생 값(ΔG·목표·달성률·배율·증감·단계 수 비·진급률·x 위치·개발 기간)은 모두 상수에서 계산한다.
 * 실제 서비스에서는 이 파일의 export 형태를 유지한 채 성과 집계 API 응답으로 바꾸면 된다.
 */
import { formatNumber } from '@/lib/format'

/** 명세 시드(난수 미사용, 프로그램 공통 시드 기록용) */
export const SEED = 20261023

// ───────── 출처: kpi/program-overview/data.ts ─────────
export const AS_OF = '2026-10-23'
export const YEAR = 2026
export const PREV = 2025
export const BASE = 2019
export const GS_START = 2022
/** 기준 평균 수량(대비 품종 가람솔), 쌀 수량 kg/10a */
export const MU = 560
export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const
export type Year = (typeof YEARS)[number]

/** 선발 강도 i */
export const I: Record<Year, number> = { 2019: 1.4, 2020: 1.4, 2021: 1.4, 2022: 1.755, 2023: 1.755, 2024: 1.755, 2025: 1.755, 2026: 1.755 }
/** 예측 정확도 r(쌀 수량) */
export const R: Record<Year, number> = { 2019: 0.45, 2020: 0.45, 2021: 0.45, 2022: 0.46, 2023: 0.5, 2024: 0.53, 2025: 0.55, 2026: 0.57 }
/** 상가적 유전 표준편차 σA(kg/10a) */
export const SIGMA_A: Record<Year, number> = { 2019: 30.0, 2020: 29.7, 2021: 29.6, 2022: 29.3, 2023: 29.0, 2024: 28.8, 2025: 28.5, 2026: 28.2 }
/** 세대 간격 L(년) */
export const L: Record<Year, number> = { 2019: 4.5, 2020: 4.5, 2021: 4.4, 2022: 3.2, 2023: 2.8, 2024: 2.5, 2025: 2.3, 2026: 2.2 }
/** 2026 목표(I_T, R_T, L_T) */
export const TARGET_2026 = { i: 1.755, r: 0.58, L: 2.1 }
/** 훈련 집단(유전형+표현형 보유 계통) */
export const TRAIN_N = { 2025: 1560, 2026: 1850 }

export const STAGES = [
  { abbr: '후보', name: '세대 진전 후보' },
  { abbr: 'GS 1차', name: '계통 선발(GS 1차)' },
  { abbr: 'PYT', name: '예비 생산력 검정(PYT)' },
  { abbr: 'AYT', name: '생산력 검정(AYT)' },
  { abbr: 'MET', name: '지역 적응 시험(MET)' },
  { abbr: '출원 후보', name: '품종 출원 후보' },
] as const
export const PIPELINE = [2000, 600, 120, 40, 18, 3] as const
export const PIPELINE_TARGET = [2000, 600, 120, 40, 25, 3] as const
/** MET 단계 인덱스 */
export const MET_IDX = 4

export const APPS = { filed: 1, target: 3, regs: 1, planned: { line: 'YR19-0118', month: 12 } }
export const FILED = { name: '별하랑', line: 'YR19-0083', filedAt: '2026-06-09', crossYear: 2019, cross: '가람솔 / 늘솔찬' }
export const REGISTERED = { name: '늘솔찬', line: 'YR14-0472', filedYear: 2024, trait: '도열병·흰잎마름병 복합 저항성' }

// ───────── 출처: infographic/digital-breeding-process/data.ts (TOTAL) ─────────
export const CONVENTIONAL_YEARS = 11.0
export const DIGITAL_DESIGN_YEARS = 6.7

// ───────── 출처: infographic/variety-profile/data.ts ─────────
export const INSTITUTE = '○○연구원 벼 디지털육종 프로그램(가상)'
export const BYEOL = {
  yield: 605,
  check: 560,
  checkName: '가람솔',
  zone: '중부 평야지',
  zoneIndex: 111.5,
  genes: ['Pi-ta', 'Pib'],
  metYears: [2024, 2025],
  metSites: 8,
}

// ───────── 출처: viz/gebv-selection/data.ts (N) — 2027 교배 부모 선발(파이프라인 GS 1차 600과 다른 선발) ─────────
export const PARENT_POOL = 600
export const PARENT_SELECTED = 60 // p = 10%

// ───────── 출처: kpi/genotyping-lab-ops/data.ts ─────────
export const LAB = { ytd: 10742, annualTarget: 12000, prevYtd: 9612, n6K: 2000, qc6K: 1930, callRate6K: 98.9, tat6K: 14, prevTat6K: 16 }

// ───────── 출처: kpi/genetic-gain-tracker periodStats(쌀 수량, 2019~2026) — 실현 유전적 추세 기울기 ─────────
// 원 실행값(2026-10-26 정리 회차 2 재실행, REALIZATION_BIAS 0.90). 전통 = 2019~2021 코호트, GS = 2021~2026 코호트
export const REALIZED = { conventional: 3.439753, gs: 9.097399 } as const // kg/10a/년 → "3.4", "9.1"
/** 실현 배율 2.644783 → "2.6배". 예측 배율 GAIN_RATIO와 함께 보인다(사용자 결정 2026-10-26) */
export const REALIZED_RATIO = REALIZED.gs / REALIZED.conventional

// ───────── 계산 ─────────
export const dG = (y: Year) => (I[y] * R[y] * SIGMA_A[y]) / L[y] // 2026: 12.82
export const dGpct = (y: Year) => (dG(y) / MU) * 100 // 2026: 2.29, 2025: 2.14, 2019: 0.75
export const DG_TARGET = (TARGET_2026.i * TARGET_2026.r * SIGMA_A[2026]) / TARGET_2026.L // 13.67
export const DG_TARGET_PCT = (DG_TARGET / MU) * 100 // 2.44
export const ACH = {
  dg: (dG(2026) / DG_TARGET) * 100, // 93.8
  r: (R[2026] / TARGET_2026.r) * 100, // 98.3
  l: (TARGET_2026.L / L[2026]) * 100, // 95.5 (낮을수록 좋음: 목표/실적)
  apps: (APPS.filed / APPS.target) * 100, // 33.3
  met: (PIPELINE[MET_IDX] / PIPELINE_TARGET[MET_IDX]) * 100, // 72.0
}
export const GAIN_RATIO = dG(2026) / dG(2019) // 3.053 → "3.1배(예측)"
export const DG_DELTA = dGpct(2026) - dGpct(2025) // 0.154 → "▲0.15%p"
export const R_DELTA = R[2026] - R[2025] // 0.02
export const L_DELTA = L[2026] - L[2025] // −0.1 → "▼0.1년(개선)"
export const TRAIN_DELTA = TRAIN_N[2026] - TRAIN_N[2025] // 290
export const TRAIN_DELTA_PCT = (TRAIN_DELTA / TRAIN_N[2025]) * 100 // 18.6
export const PASS = PIPELINE.map((n, i) => (i === 0 ? null : (n / PIPELINE[i - 1]) * 100)) // –, 30.0, 20.0, 33.3, 45.0, 16.7
/** 2024 생산력 검정(AYT) 계통 수 — 2026 MET 완료 세트의 출처 코호트(program-overview `PIPELINE[2024][3]`) */
export const AYT_2024 = 38
/** 2026 포장의 MET 1년차 세트 계통 수(2025 AYT 코호트, 2026~2027; breeding-pipeline-flow `MET_Y1_2024`) */
export const MET_Y1_2026 = 20
/** 코호트 진급률: 2026 MET 완료 세트 / 2024 AYT (program-baseline 「MET 세트 정의」) */
export const AYT_MET_PASS = (PIPELINE[MET_IDX] / AYT_2024) * 100 // 47.4
/** 목표 진급률: MET 목표 / 2024 AYT */
export const AYT_MET_TARGET_PASS = (PIPELINE_TARGET[MET_IDX] / AYT_2024) * 100 // 65.8
/** 2026 MET 포장 계통 수 = 2년차(완료 세트) + 1년차 */
export const MET_FIELD_2026 = PIPELINE[MET_IDX] + MET_Y1_2026 // 38
export const LAB_ANNUAL_PCT = (LAB.ytd / LAB.annualTarget) * 100 // 89.5
export const LAB_PREV_PCT = ((LAB.ytd - LAB.prevYtd) / LAB.prevYtd) * 100 // 11.8
export const QC_6K_PCT = (LAB.qc6K / LAB.n6K) * 100 // 96.5
export const TAT_DELTA = LAB.tat6K - LAB.prevTat6K // −2
export const devYears = Number(FILED.filedAt.slice(0, 4)) - FILED.crossYear // 7
export const savedYears = Math.round((CONVENTIONAL_YEARS - devYears) * 10) / 10 // 4.0
export const byeolIndex = (BYEOL.yield / BYEOL.check) * 100 // 108.0
export const byeolDiff = BYEOL.yield - BYEOL.check // +45
export const GS_YEAR_NO = YEAR - GS_START + 1 // 5

/** 연중 위치(0~1). UTC로 계산해 시간대에 따라 하루 밀리지 않게 한다 */
export const xOf = (iso: string) =>
  (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(YEAR, 0, 1)) / 864e5 / 365
export const AS_OF_X = xOf(AS_OF) // 0.8082

// ───────── 표시 도우미 ─────────
export const fmt = (v: number) => formatNumber(v)
export const f1 = (v: number) => v.toFixed(1)
export const f2 = (v: number) => v.toFixed(2)

// ───────── 마일스톤(①②④의 월은 이 템플릿의 추정) ─────────
export interface Milestone {
  n: number
  date: string
  label: string
  approx?: boolean
  highlight?: boolean
  planned?: boolean
  title: string
  note: string
}

export const MILESTONES: Milestone[] = [
  { n: 1, date: '2026-02-15', label: '2월', approx: true, title: 'GS 예측 모델 재학습', note: `훈련 집단 ${fmt(TRAIN_N[2026])}계통(전년 ${fmt(TRAIN_N[2025])}), GBLUP, 쌀 수량 r ${f2(R[2026])}` },
  { n: 2, date: '2026-03-15', label: '3월', approx: true, title: `${REGISTERED.name} 품종 등록`, note: `${REGISTERED.trait}, ${REGISTERED.filedYear} 출원` },
  { n: 3, date: '2026-04-22', label: '04-22', title: '생산력 검정(AYT) 파종', note: `시험포장 A-3, ${PIPELINE[3]}계통 + 대비 2, 반복 3, 126구` },
  { n: 4, date: '2026-05-15', label: '5월', approx: true, title: '지역 적응 시험(MET) 이앙', note: `${MET_FIELD_2026}계통(2년차 ${PIPELINE[MET_IDX]} · 1년차 ${MET_Y1_2026}), ${BYEOL.metSites}개 지역` },
  { n: 5, date: '2026-06-09', label: '06-09', highlight: true, title: `${FILED.name} 품종보호 출원`, note: `${FILED.crossYear} 교배 → ${devYears}년, 쌀 수량 대비 ${f1(byeolIndex)}%` },
  { n: 6, date: '2026-10-20', label: '10-20', title: '전장 유전체 연관 분석(GWAS)', note: 'YR 다양성 패널 412계통, 36,420 단일 염기 다형성(SNP)' },
  { n: 7, date: '2026-10-22', label: '10-22', title: `2027 교배 부모 후보 ${PARENT_SELECTED}계통 선발`, note: `유전체 추정 육종가(GEBV) 상위 10%(${PARENT_POOL} → ${PARENT_SELECTED}), 유전체 관계 행렬(GRM) 계산` },
  { n: 8, date: '2026-12-15', label: '12월(예정)', approx: true, planned: true, title: '신품종 출원 예정', note: APPS.planned.line },
]

/** 마커 쌓기 단계: 앞 마커와 7일 이내면 한 단 위로 */
export const MILESTONE_LEVELS: number[] = MILESTONES.reduce<number[]>((acc, m, i) => {
  if (i === 0) return [0]
  const gapDays = (xOf(m.date) - xOf(MILESTONES[i - 1].date)) * 365
  acc.push(gapDays <= 7 ? acc[i - 1] + 1 : 0)
  return acc
}, [])

// ───────── DEV 검산 ─────────
if (import.meta.env?.DEV) {
  const T = '[검산] [annual-report-onepager]'
  console.assert(dGpct(2026).toFixed(2) === '2.29', `${T} ΔG 2026 %/년 ${dGpct(2026).toFixed(3)} ≠ 2.29`)
  console.assert(dG(2026).toFixed(1) === '12.8', `${T} ΔG 2026 kg/10a/년 ${dG(2026).toFixed(2)} ≠ 12.8`)
  console.assert(DG_TARGET_PCT.toFixed(2) === '2.44', `${T} ΔG 목표 ${DG_TARGET_PCT.toFixed(3)} ≠ 2.44`)
  console.assert(GAIN_RATIO.toFixed(1) === '3.1', `${T} ΔG 배율 ${GAIN_RATIO.toFixed(3)} ≠ 3.1`)
  console.assert(REALIZED_RATIO.toFixed(1) === '2.6', `${T} 실현 배율 ${REALIZED_RATIO.toFixed(3)} ≠ 2.6`)
  console.assert(ACH.dg.toFixed(1) === '93.8', `${T} ΔG 달성률 ${ACH.dg.toFixed(2)} ≠ 93.8`)
  console.assert(ACH.met === 72, `${T} MET 달성률 ${ACH.met} ≠ 72`)
  console.assert(devYears === 7, `${T} 별하랑 개발 기간 ${devYears} ≠ 7`)
  console.assert(byeolIndex.toFixed(1) === '108.0', `${T} 별하랑 수량 지수 ${byeolIndex.toFixed(2)} ≠ 108.0`)
  const trend = YEARS.map(y => dGpct(y).toFixed(2)).join(',')
  console.assert(trend === '0.75,0.74,0.76,1.32,1.62,1.91,2.14,2.29', `${T} ΔG 추이 ${trend}`)
  const pass = PASS.slice(1).map(p => p!.toFixed(1)).join(',')
  console.assert(pass === '30.0,20.0,33.3,45.0,16.7', `${T} 같은 해 단계 수 비 ${pass}`)
  console.assert(f1(AYT_MET_PASS) === '47.4', `${T} 코호트 진급률 ${AYT_MET_PASS.toFixed(3)} ≠ 47.4`)
  console.assert(f1(AYT_MET_TARGET_PASS) === '65.8', `${T} 목표 진급률 ${AYT_MET_TARGET_PASS.toFixed(3)} ≠ 65.8`)
  console.assert(MET_FIELD_2026 === 38, `${T} MET 포장 계통 ${MET_FIELD_2026} ≠ 38`)
  const sorted = MILESTONES.every((m, i) => i === 0 || m.date > MILESTONES[i - 1].date)
  console.assert(sorted, `${T} 마일스톤 날짜가 오름차순이 아님`)
  const pastOk = MILESTONES.every(m => (m.planned ? m.date > AS_OF : m.date <= AS_OF))
  console.assert(pastOk, `${T} 실적 마일스톤이 기준일 이후이거나 예정 항목이 기준일 이전임`)
  console.assert(PARENT_SELECTED / PARENT_POOL === 0.1, `${T} 부모 선발 비율 ${PARENT_SELECTED}/${PARENT_POOL} ≠ 10%`)
  console.assert(LAB_ANNUAL_PCT.toFixed(1) === '89.5' && LAB_PREV_PCT.toFixed(1) === '11.8', `${T} 분석실 진도 ${LAB_ANNUAL_PCT.toFixed(2)}/${LAB_PREV_PCT.toFixed(2)}`)
}
