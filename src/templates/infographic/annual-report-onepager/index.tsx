import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, CanvasSectionTitle, ScaledCanvas, u } from '@/design-system'
import {
  ACH,
  APPS,
  AS_OF,
  AYT_2024,
  AYT_MET_PASS,
  AYT_MET_TARGET_PASS,
  BASE,
  BYEOL,
  CONVENTIONAL_YEARS,
  DG_DELTA,
  DG_TARGET_PCT,
  DIGITAL_DESIGN_YEARS,
  FILED,
  GAIN_RATIO,
  REALIZED,
  REALIZED_RATIO,
  GS_START,
  GS_YEAR_NO,
  I,
  INSTITUTE,
  L,
  LAB,
  LAB_ANNUAL_PCT,
  LAB_PREV_PCT,
  L_DELTA,
  MET_IDX,
  MU,
  PIPELINE,
  PIPELINE_TARGET,
  PREV,
  QC_6K_PCT,
  R,
  REGISTERED,
  R_DELTA,
  SIGMA_A,
  TARGET_2026,
  TAT_DELTA,
  TRAIN_DELTA,
  TRAIN_DELTA_PCT,
  TRAIN_N,
  YEAR,
  byeolDiff,
  byeolIndex,
  dG,
  dGpct,
  devYears,
  f1,
  f2,
  fmt,
  savedYears,
} from './data'
import { MilestoneTimeline } from './components/MilestoneTimeline'
import { Pipeline } from './components/Pipeline'
import { TrendChart } from './components/TrendChart'
import { Change, Shortfall } from './components/ui'

export const meta: TemplateMeta = {
  slug: 'annual-report-onepager',
  category: 'infographic',
  title: '연간 성과 원페이저',
  description: '2026년 벼 디지털육종 프로그램이 얼마나 성과를 냈고(연간 유전적 개량량), 무엇을 내놓았으며, 무엇이 모자란지 A4 한 장으로 요약한 기관 보고용 인포그래픽',
  tags: ['인포그래픽', '벼', '연간 성과', '성과 보고', '연간 유전적 개량량', '파이프라인', 'A4 인쇄'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const W = 1240
const H = 1754
const PAD_X = 48
const INNER = W - PAD_X * 2 // 1144

const DG_PCT = dGpct(YEAR)
const DG_ABS = dG(YEAR)
const AS_OF_BADGE = `${AS_OF} 기준 · 잠정`
const mmdd = (iso: string) => iso.slice(5)
/** 머리 오른쪽 ΔG 추이 도식 폭(논리 px) */
const CHART_W = 504
/** 하한 15 논리 px가 11px 이상이 되는 배율(15 × 0.74 = 11.1) */
const MIN_SCALE = 0.74

/* ───────── 핵심 수치(카드·모바일 요약 공통) ───────── */
interface KeyStat {
  label: string
  value: ReactNode
  unit: string
  sub1?: ReactNode
  sub2?: ReactNode
  /** 모바일 요약용 짧은 보조 문구 */
  mobileSub: string
  primary?: boolean
  /** 캔버스 카드에 올리지 않고 요약에만 둔다(캔버스는 대표 성과 「유전체 분석 역량」에 합침) */
  summaryOnly?: boolean
}

/** 구절이 중간에서 끊기지 않게 묶는다(보조 줄이 "대비 / 93.8%"로 갈라지지 않게) */
const Keep = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>

const KEY_STATS: KeyStat[] = [
  {
    label: '연간 유전적 개량량(ΔG)',
    value: f2(DG_PCT),
    unit: '%/년',
    primary: true,
    sub1: (
      <>
        {f1(DG_ABS)} kg/10a/년 · <Keep>목표 {f2(DG_TARGET_PCT)}%/년 <span className="text-muted">대비 {f1(ACH.dg)}%</span></Keep>
      </>
    ),
    sub2: (
      <>
        전년 {f2(dGpct(PREV))} <Change good={DG_DELTA > 0}>▲{f2(DG_DELTA)}%p</Change>
      </>
    ),
    mobileSub: `목표 ${f2(DG_TARGET_PCT)} 대비 ${f1(ACH.dg)}% · ${BASE} 대비 ${f1(GAIN_RATIO)}배(예측)`,
  },
  {
    label: '예측 정확도(r)',
    value: f2(R[YEAR]),
    unit: '',
    sub1: (
      <>
        쌀 수량 · GBLUP · <Keep>목표 {f2(TARGET_2026.r)} <span className="text-muted">대비 {f1(ACH.r)}%</span></Keep>
      </>
    ),
    sub2: (
      <>
        전년 {f2(R[PREV])} <Change good={R_DELTA > 0}>▲{f2(R_DELTA)}</Change>
      </>
    ),
    mobileSub: `목표 ${f2(TARGET_2026.r)} 대비 ${f1(ACH.r)}%`,
  },
  {
    label: '세대 간격(L)',
    value: f1(L[YEAR]),
    unit: '년',
    sub1: (
      <>
        낮을수록 좋음 · <Keep>목표 {f1(TARGET_2026.L)}년 <span className="text-muted">대비 {f1(ACH.l)}%</span></Keep>
      </>
    ),
    sub2: (
      <>
        전년 {f1(L[PREV])} <Change good={L_DELTA < 0}>▼{f1(Math.abs(L_DELTA))}년(개선)</Change> · <Keep>{BASE} {f1(L[BASE])}년</Keep>
      </>
    ),
    mobileSub: `낮을수록 좋음 · 목표 ${f1(TARGET_2026.L)}년 대비 ${f1(ACH.l)}%`,
  },
  {
    label: '신품종 출원·등록',
    value: (
      <>
        <span className="font-bold text-text" style={{ fontSize: '0.42em' }}>
          출원{' '}
        </span>
        {APPS.filed}
        <span className="font-bold text-text" style={{ fontSize: '0.42em' }}>
          {' '}· 등록{' '}
        </span>
        {APPS.regs}
      </>
    ),
    unit: '건',
    sub1: (
      <>
        출원 {FILED.name}({mmdd(FILED.filedAt)}) · 등록 {REGISTERED.name}
      </>
    ),
    sub2: (
      <>
        <span className="text-muted">
          출원 목표 {APPS.target}건 대비 {APPS.filed}건
        </span>{' '}
        · {APPS.planned.month}월 1건 예정
      </>
    ),
    mobileSub: `출원 ${FILED.name} · 등록 ${REGISTERED.name} · 출원 목표 ${APPS.target}건`,
  },
  {
    label: '유전형 분석',
    summaryOnly: true,
    value: fmt(LAB.ytd),
    unit: '샘플',
    mobileSub: `1~10월 누계 · 연 목표의 ${f1(LAB_ANNUAL_PCT)}%`,
  },
  {
    label: '훈련 집단',
    summaryOnly: true,
    value: fmt(TRAIN_N[YEAR]),
    unit: '계통',
    mobileSub: `전년 ${fmt(TRAIN_N[PREV])} ▲${fmt(TRAIN_DELTA)}`,
  },
]

/* ───────── A. 머리: 표제 라벨 → 큰 표제(결론) → 부제, 오른쪽에 ΔG 추이 ───────── */
function Header() {
  return (
    <header className="grid" style={{ gridTemplateColumns: `1fr ${u(CHART_W)}`, gap: u(28) }}>
      <div className="flex min-w-0 flex-col" style={{ gap: u(12) }}>
        <p className="font-semibold text-muted" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          {YEAR} 벼 디지털육종 연간 성과 · {INSTITUTE}
        </p>
        <h1 className="font-extrabold text-text" style={{ fontSize: u(40), lineHeight: 1.16, letterSpacing: '-0.02em' }}>
          연간 유전적 개량량 <span className="text-accent tabular-nums">{f2(DG_PCT)}%/년</span>
          <br />
          유전체 선발(GS) 도입 전({BASE})의
          <br />
          <span className="text-accent tabular-nums">{f1(GAIN_RATIO)}배</span>
          <span className="font-semibold text-muted" style={{ fontSize: u(20), letterSpacing: 0 }}>
            (예측) · 실현 {f1(REALIZED_RATIO)}배
          </span>
        </h1>
        <p className="text-text" style={{ fontSize: u(17), lineHeight: 1.35 }}>
          벼(<i>Oryza sativa</i>) · 쌀 수량(kg/10a, 백미) 기준 · GS 도입 {GS_YEAR_NO}년 차
          <br />
          <span className="font-semibold">
            신품종 {FILED.name} 출원 · {REGISTERED.name} 등록 · 유전형 분석 {fmt(LAB.ytd)}샘플(1~10월)
          </span>
        </p>
      </div>
      <figure aria-label={`연간 유전적 개량량 추이: ${BASE}년 ${f2(dGpct(BASE))}%/년에서 ${YEAR}년 ${f2(DG_PCT)}%/년(잠정), 목표 ${f2(DG_TARGET_PCT)}%/년`} className="flex min-w-0 flex-col" style={{ gap: u(6) }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: `${u(4)} ${u(10)}` }}>
          <span className="rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums whitespace-nowrap" style={{ fontSize: u(16), padding: `${u(4)} ${u(10)}` }}>
            {AS_OF_BADGE}
          </span>
          <span className="text-muted" style={{ fontSize: u(15) }}>
            10/24 이후 실적 미포함 · 연말에 확정
          </span>
        </div>
        <figcaption className="font-bold text-text" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          연간 유전적 개량량(ΔG) 추이
          <span className="font-normal text-muted" style={{ fontSize: u(15) }}>
            {' '}
            · 기준 평균 {MU} kg/10a 대비
          </span>
        </figcaption>
        <TrendChart width={CHART_W} height={196} />
      </figure>
    </header>
  )
}

/* ───────── B. 핵심 수치 4개(유전형 분석·훈련 집단은 대표 성과로) ───────── */
function StatCard({ s }: { s: KeyStat }) {
  return (
    <section
      className={`flex min-w-0 flex-col border ${s.primary ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}
      style={{ padding: `${u(12)} ${u(16)}`, borderRadius: u(12), borderWidth: u(s.primary ? 2.5 : 1.5), gap: u(6) }}
    >
      <h2 className="font-bold text-text" style={{ fontSize: u(17), lineHeight: 1.2 }}>
        {s.label}
      </h2>
      <div className="flex items-baseline tabular-nums" style={{ gap: u(6) }}>
        <span className={`font-extrabold whitespace-nowrap ${s.primary ? 'text-accent' : 'text-text'}`} style={{ fontSize: u(s.primary ? 60 : 50), lineHeight: 1.05, letterSpacing: '-0.025em' }}>
          {s.value}
        </span>
        {s.unit && (
          <span className="font-bold text-text" style={{ fontSize: u(20) }}>
            {s.unit}
          </span>
        )}
      </div>
      <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.35, marginTop: 'auto' }}>
        {s.sub1}
      </p>
      <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.35 }}>
        {s.sub2}
      </p>
    </section>
  )
}

function KeyStats() {
  return (
    <section aria-label="핵심 수치">
      <div className="grid" style={{ gridTemplateColumns: '1.28fr 1fr 1fr 1.14fr', gap: u(12) }}>
        {KEY_STATS.filter(s => !s.summaryOnly).map(s => (
          <StatCard key={s.label} s={s} />
        ))}
      </div>
    </section>
  )
}

/* ───────── C. 2019 → 2026 요인 변화(배율은 표제에만 둔다) ───────── */
function FactorStrip() {
  const items: { label: string; from: string; to: string; unit?: string; note?: string }[] = [
    { label: '연간 유전적 개량량(ΔG)', from: f2(dGpct(BASE)), to: f2(DG_PCT), unit: '%/년' },
    { label: '세대 간격(L)', from: f1(L[BASE]), to: f1(L[YEAR]), unit: '년' },
    { label: '선발 강도(i)', from: I[BASE].toFixed(2), to: I[YEAR].toFixed(3) },
    { label: '예측 정확도(r)', from: f2(R[BASE]), to: f2(R[YEAR]) },
    { label: '품종 개발 기간', from: f1(CONVENTIONAL_YEARS), to: f1(DIGITAL_DESIGN_YEARS), unit: '년', note: '전통 → 디지털 설계값' },
  ]
  return (
    <section aria-label="요인 변화">
      <CanvasSectionTitle title="무엇이 달라졌나" sub={`${BASE} → ${YEAR} 요인 변화 · ${YEAR}는 잠정`} />
      <dl className="grid border-y border-border" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 1.1fr', borderBlockWidth: u(1.5) }}>
        {items.map((it, i) => (
          <div key={it.label} className={i > 0 ? 'border-l border-border' : undefined} style={{ padding: `${u(7)} ${u(12)}`, borderLeftWidth: i > 0 ? u(1.5) : undefined }}>
            <dt className="font-semibold text-muted" style={{ fontSize: u(15), lineHeight: 1.25 }}>
              {it.label}
            </dt>
            <dd className="font-bold text-text tabular-nums whitespace-nowrap" style={{ fontSize: u(21), lineHeight: 1.3 }}>
              <span className="font-semibold text-muted" style={{ fontSize: u(17) }}>
                {it.from} →{' '}
              </span>
              {it.to}
              {it.unit && <span style={{ fontSize: u(15), marginLeft: u(3) }}>{it.unit}</span>}
            </dd>
            {it.note && (
              <dd className="text-muted" style={{ fontSize: u(15), lineHeight: 1.25 }}>
                {it.note}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ───────── E. 마일스톤 ───────── */
function MilestoneSection() {
  return (
    <section aria-label="2026 마일스톤">
      <CanvasSectionTitle
        title={`${YEAR} 마일스톤`}
        sub="①~⑦ 실적 · ⑧ 예정(점선)"
        right={<>①②④ 날짜는 월만 표기 · 굵은 테두리 = 올해 대표 성과</>}
      />
      <MilestoneTimeline width={INNER} />
    </section>
  )
}

/* ───────── F. 파이프라인 ───────── */
function PipelineSection() {
  return (
    <section aria-label="2026 파이프라인">
      <CanvasSectionTitle title="육종 파이프라인" right={`${YEAR} 단계별 계통 수(MET = 그해 완료 세트) · 화살표 = 같은 해 단계 수 비`} />
      <Pipeline />
    </section>
  )
}

/* ───────── G. 대표 성과 ───────── */
function Feature({ title, big, bigUnit, accent, children }: { title: string; big: string; bigUnit: string; accent?: boolean; children: ReactNode }) {
  return (
    <article
      className={`flex min-w-0 flex-col border ${accent ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}
      style={{ padding: `${u(10)} ${u(16)}`, borderRadius: u(12), borderWidth: u(accent ? 2.5 : 1.5), gap: u(2) }}
    >
      <h3 className="font-bold text-text" style={{ fontSize: u(17), lineHeight: 1.2 }}>
        {title}
      </h3>
      <div className="flex items-baseline tabular-nums" style={{ gap: u(6) }}>
        <span className={`font-extrabold ${accent ? 'text-accent' : 'text-text'}`} style={{ fontSize: u(36), lineHeight: 1.1 }}>
          {big}
        </span>
        <span className="font-bold text-text" style={{ fontSize: u(18) }}>
          {bigUnit}
        </span>
      </div>
      <div className="text-text" style={{ fontSize: u(16), lineHeight: 1.35 }}>
        {children}
      </div>
    </article>
  )
}

function Highlights() {
  return (
    <section aria-label="대표 성과">
      <CanvasSectionTitle title="대표 성과" />
      <div className="grid" style={{ gridTemplateColumns: '1.28fr 0.78fr 1.3fr', gap: u(12) }}>
        <Feature accent title={`신품종 '${FILED.name}' 출원`} big={`${devYears}년`} bigUnit="만에 출원">
          <p className="text-muted tabular-nums">
            {FILED.line} · {FILED.filedAt} 출원 · {FILED.cross} 교배({FILED.crossYear})
          </p>
          <p>
            쌀 수량 <b>{BYEOL.yield} kg/10a</b>(대비 {BYEOL.checkName} {f1(byeolIndex)}%, +{byeolDiff}) · 재배 적지 {BYEOL.zone}({f1(BYEOL.zoneIndex)}%)
          </p>
          <p>
            도열병 저항성 유전자 <i>{BYEOL.genes[0]}</i>·<i>{BYEOL.genes[1]}</i> · <Change good>전통 {f1(CONVENTIONAL_YEARS)}년보다 {f1(savedYears)}년 짧음</Change>
          </p>
        </Feature>
        <Feature title={`'${REGISTERED.name}' 품종 등록`} big={`${APPS.regs}건`} bigUnit="등록">
          <p className="text-muted tabular-nums">
            {REGISTERED.line} · {REGISTERED.filedYear} 출원 → {YEAR} 등록
          </p>
          <p>
            {REGISTERED.trait} · {FILED.name}의 부본(<i>{BYEOL.genes[0]}</i>·<i>{BYEOL.genes[1]}</i> 공여)
          </p>
        </Feature>
        <Feature title="유전체 분석 역량" big={fmt(LAB.ytd)} bigUnit="샘플 유전형 분석">
          <p className="text-muted tabular-nums">
            1~10월 누계(10/23) · 전 플랫폼 · 연 목표 {fmt(LAB.annualTarget)}의 {f1(LAB_ANNUAL_PCT)}%
          </p>
          <p>
            전년 동기 {fmt(LAB.prevYtd)} <Change good={LAB_PREV_PCT > 0}>▲{f1(LAB_PREV_PCT)}%</Change>
          </p>
          <p>
            훈련 집단 <b>{fmt(TRAIN_N[YEAR])}계통</b>(유전형+표현형 보유 · GBLUP 학습) · 전년 {fmt(TRAIN_N[PREV])} <Change good={TRAIN_DELTA > 0}>▲{fmt(TRAIN_DELTA)}(+{f1(TRAIN_DELTA_PCT)}%)</Change>
          </p>
          <p>
            6K SNP 칩 {fmt(LAB.n6K)}샘플(1~10월 누계) · 평균 콜레이트 {f1(LAB.callRate6K)}% · 1차 품질 관리(QC) 통과율 {f1(QC_6K_PCT)}%
          </p>
          <p>
            처리 소요 시간(TAT) 전년 {LAB.prevTat6K}일 → {LAB.tat6K}일 <Change good={TAT_DELTA < 0}>▼{Math.abs(TAT_DELTA)}일</Change>
          </p>
        </Feature>
      </div>
    </section>
  )
}

/* ───────── H. 남은 과제 ───────── */
/** 굵은 강조. 글자 크기를 명시해 뷰포트 전환 뒤 컨테이너 단위 상속이 어긋나는 문제를 피한다 */
function B({ children }: { children: ReactNode }) {
  return (
    <b className="font-bold" style={{ fontSize: u(16) }}>
      {children}
    </b>
  )
}

function Tasks() {
  const items: ReactNode[] = [
    <>
      신품종 출원 <B>{APPS.filed}/{APPS.target}건</B> — {APPS.planned.month}월 {APPS.planned.line} 출원 시 {APPS.filed + 1}/{APPS.target}건
    </>,
    <>
      지역 적응 시험 완료 <B>{PIPELINE[MET_IDX]}/{PIPELINE_TARGET[MET_IDX]}계통({f1(ACH.met)}%)</B> — {YEAR - 2} 생산력 검정(AYT) {AYT_2024}계통 중 {f1(AYT_MET_PASS)}% 진급(목표 {f1(AYT_MET_TARGET_PASS)}%)
    </>,
    <>
      연간 유전적 개량량 <B>목표 대비 {f1(ACH.dg)}%</B> — 예측 정확도({f2(R[YEAR])}/{f2(TARGET_2026.r)})·세대 간격({f1(L[YEAR])}/{f1(TARGET_2026.L)}년) 목표 미달
    </>,
  ]
  return (
    <section aria-label="남은 과제" className="grid items-center border border-border bg-surface" style={{ gridTemplateColumns: `${u(130)} 1fr`, gap: u(16), padding: `${u(10)} ${u(16)}`, borderRadius: u(10), borderWidth: u(1.5) }}>
      <h3 className="font-extrabold text-warning" style={{ fontSize: u(21) }}>
        남은 과제
      </h3>
      <ol className="text-text" style={{ fontSize: u(16), lineHeight: 1.45 }}>
        {items.map((it, i) => (
          <li key={i} className="flex items-baseline" style={{ gap: u(8) }}>
            <Shortfall>{i + 1}</Shortfall>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ───────── I. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const NOTES: ReactNode[] = [
  <>모든 수치는 가상 기관의 목업 데이터이며 실제 성적이 아닙니다. 기관명·품종명·계통명은 가상입니다.</>,
  <>
    {YEAR}년 값은 {AS_OF} 기준 잠정치입니다. ΔG = i · r · σA / L({I[YEAR]} × {f2(R[YEAR])} × {f1(SIGMA_A[YEAR])} / {f1(L[YEAR])} = {f1(DG_ABS)} kg/10a/년; i = 선발 강도, σA = 상가적 유전 표준편차), %/년은 기준 평균 {MU} kg/10a 대비. 예측 정확도: 쌀 수량, GBLUP(유전체 최적 선형 불편 예측), 5-fold × 10회 교차 검증. GS 도입 {GS_START}년. 배율 {f1(GAIN_RATIO)}배는 이 식으로 계산한 예측 ΔG의 비({YEAR}/{BASE})이고, 실현 배율 {f1(REALIZED_RATIO)}배는 코호트 GEBV 실현 추세 기울기의 비(전통 {BASE}~{GS_START - 1} {f1(REALIZED.conventional)} → GS {GS_START - 1}~{YEAR} {f1(REALIZED.gs)} kg/10a/년)입니다.
  </>,
  <>
    {FILED.name} 개발 기간 {devYears}년은 GS 도입 과도기 계통의 실제 출원 사례이며, 현재 디지털 공정 설계값은 {f1(DIGITAL_DESIGN_YEARS)}년, 전통 공정은 {f1(CONVENTIONAL_YEARS)}년입니다. 쌀 수량은 MET {BYEOL.metYears[0]}~{BYEOL.metYears[1]}, {BYEOL.metSites}개 지역 × {BYEOL.metYears.length}년 평균.
  </>,
]

function Footnotes() {
  return (
    <footer className="border-t border-border text-muted" style={{ fontSize: u(15), lineHeight: 1.4, paddingTop: u(6), borderTopWidth: u(1.5) }}>
      {NOTES.map((n, i) => (
        <p key={i}>※ {n}</p>
      ))}
    </footer>
  )
}

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 핵심 요약(인쇄 제외) ─────────
 * 제목 줄에 기준일 배지가 있고 숫자 24px + 단위 span 구조라 공통 MobileSummary 대신 로컬 요약을 ScaledCanvas summary로 넘긴다 */
function LocalSummary() {
  return (
    <section data-print-hide="" aria-label="핵심 요약" className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-extrabold text-text">
          {YEAR} 벼 디지털육종 연간 성과
        </h2>
        <span className="rounded border border-border bg-surface-2 px-1.5 text-[14px] font-semibold text-text">{AS_OF_BADGE}</span>
      </div>
      <p className="mt-1 break-keep text-[14px] font-semibold leading-snug text-text">
        연간 유전적 개량량 {f2(DG_PCT)}%/년, GS 도입 전({BASE})의 {f1(GAIN_RATIO)}배(예측) · 실현 {f1(REALIZED_RATIO)}배
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {KEY_STATS.map(s => (
          <div key={s.label} className={`rounded-md border p-2 ${s.primary ? 'border-accent bg-accent/5' : 'border-border'}`}>
            <dt className="text-[14px] font-semibold leading-tight text-muted">{s.label}</dt>
            <dd className="mt-0.5">
              <span className={`text-[24px] font-extrabold leading-none tabular-nums ${s.primary ? 'text-accent' : 'text-text'}`}>{s.value}</span>
              {s.unit && <span className="ml-1 text-[14px] font-bold text-text">{s.unit}</span>}
              <span className="mt-1 block text-[14px] leading-snug text-text">{s.mobileSub}</span>
            </dd>
          </div>
        ))}
      </dl>
      <ul className="mt-2 space-y-1 border-t border-border pt-2 text-[12px] leading-relaxed text-muted" aria-label="각주">
        {NOTES.map((n, i) => (
          <li key={i} className="break-keep">
            ※ {n}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Template() {
  const label = `${YEAR} 벼 디지털육종 연간 성과(${AS_OF} 기준 잠정): 연간 유전적 개량량 ${f2(DG_PCT)}%/년(${BASE}년의 ${f1(GAIN_RATIO)}배(예측) · 실현 ${f1(REALIZED_RATIO)}배, 목표 대비 ${f1(ACH.dg)}%), 예측 정확도 ${f2(R[YEAR])}, 세대 간격 ${f1(L[YEAR])}년, 신품종 ${FILED.name} 출원·${REGISTERED.name} 등록, 유전형 분석 ${fmt(LAB.ytd)}샘플`
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas width={W} height={H} print="a4-portrait" minScale={MIN_SCALE} ariaLabel={label} className="bg-bg text-text" summary={<LocalSummary />}>
        <div className="absolute inset-0 flex flex-col justify-between break-keep [&>*]:flex-none" style={{ padding: `${u(30)} ${u(PAD_X)} ${u(22)}` }}>
          <Header />
          <KeyStats />
          <FactorStrip />
          <MilestoneSection />
          <PipelineSection />
          <Highlights />
          <Tasks />
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}
