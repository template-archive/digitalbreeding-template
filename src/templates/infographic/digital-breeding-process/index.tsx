import { Fragment, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { formatNumber } from '@/lib/format'
import {
  AS_OF,
  BASIS,
  GAIN_RATIO,
  REALIZED,
  REALIZED_RATIO,
  GS_START_YEAR,
  L,
  LINE_SEL_PCT,
  MU,
  NEW_STAGE_ADDED,
  PARAMS,
  SAVED,
  SAVED_PCT,
  SHORTEST_ACTUAL_YEARS,
  STAGES,
  TOTAL,
  TRAIN_N,
  dG,
  dGpct,
} from './data'
import { DurationTimeline, TIMELINE_W } from './components/DurationTimeline'
import { FlowCard } from './components/FlowCard'
import { Button, CanvasSectionTitle, MobileSummary, ScaledCanvas, u } from '@/design-system'

export const meta: TemplateMeta = {
  slug: 'digital-breeding-process',
  category: 'infographic',
  title: '디지털육종 프로세스',
  description: '유전체 선발과 속성세대진전(RGA)으로 벼 품종 개발 기간이 어느 단계에서 얼마나 줄었는지 한 장으로 보여 주는 16:9 인포그래픽',
  tags: ['인포그래픽', '벼', '디지털육종', '유전체 선발', '세대 간격', '속성세대진전', '홍보'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const PAD_X = 56
const CARD_GAP = 24
const CARD_W = (1920 - PAD_X * 2 - CARD_GAP * 6) / 7
/** 하한 16 논리 px가 11px 이상이 되는 배율(16 × 0.6875 = 11). 1440px 화면에서는 잘리지 않는다 */
const MIN_SCALE = 0.6875

const f1 = (v: number) => v.toFixed(1)
const f2 = (v: number) => v.toFixed(2)
const P = PARAMS.digital

/* ───────── A. 머리: 표제 라벨 → 큰 표제(결론) → 부제, 오른쪽에 기간 비교 도식 ───────── */
function TitleBand() {
  return (
    <header className="grid" style={{ gridTemplateColumns: `1fr ${u(TIMELINE_W)}`, gap: u(36) }}>
      <div className="flex min-w-0 flex-col justify-center" style={{ gap: u(12) }}>
        <p className="font-semibold text-muted" style={{ fontSize: u(18), lineHeight: 1.2 }}>
          디지털육종 프로세스 · ○○연구원 벼 디지털육종 프로그램(가상)
        </p>
        <h1 className="font-extrabold text-text" style={{ fontSize: u(52), lineHeight: 1.14, letterSpacing: '-0.02em' }}>
          벼 품종 하나를
          <br />
          <span style={{ color: 'var(--color-accent)' }}>{f1(SAVED)}년</span> 더 빨리 만들 수 있습니다
          <span className="font-semibold text-muted" style={{ fontSize: u(24), letterSpacing: 0 }}>
            (설계값)
          </span>
        </h1>
        <p className="text-muted" style={{ fontSize: u(19), lineHeight: 1.35 }}>
          유전체 선발(GS, {GS_START_YEAR}년 도입)과 속성세대진전(RGA)으로
          <br />
          벼(<i>Oryza sativa</i>) · 쌀 수량 기준 · {BASIS.digital}년 공정
        </p>
      </div>
      <TimelineFigure />
    </header>
  )
}

/** 머리 오른쪽 도식: 전통·디지털 기간 비교 */
function TimelineFigure() {
  return (
    <figure aria-label="품종 개발 기간 비교 타임라인" className="flex min-w-0 flex-col" style={{ gap: u(6) }}>
      <figcaption className="flex items-baseline justify-between" style={{ gap: u(16) }}>
        <span className="font-bold text-text" style={{ fontSize: u(20), lineHeight: 1.25 }}>
          개발 기간 비교{' '}
          <span className="font-normal text-muted" style={{ fontSize: u(16) }}>
            · 빗금 = 전통 · 점선 L = 세대 간격 · 신규 단계 ③④ +{f1(NEW_STAGE_ADDED)}년 포함
          </span>
        </span>
        <span className="shrink-0 rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums" style={{ fontSize: u(17), padding: `${u(4)} ${u(12)}` }}>
          기준일 {AS_OF}
        </span>
      </figcaption>
      <DurationTimeline />
    </figure>
  )
}

/* ───────── B. 핵심 숫자 띠 ───────── */
function BigStat({ label, before, after, unit, sub, primary = false }: { label: string; before?: string; after: string; unit: string; sub: ReactNode; primary?: boolean }) {
  return (
    <section
      className={`flex min-w-0 flex-col border ${primary ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface'}`}
      style={{ padding: `${u(12)} ${u(20)}`, borderRadius: u(12), borderWidth: u(1.5), gap: u(6) }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: u(8) }}>
        <h2 className="font-bold text-text" style={{ fontSize: u(20), lineHeight: 1.2 }}>
          {label}
        </h2>
        <span className="whitespace-nowrap text-muted" style={{ fontSize: u(16) }}>
          {before ? `전통 ${BASIS.conventional} → 디지털 ${BASIS.digital}` : `디지털 ${BASIS.digital}`}
        </span>
      </div>
      <div className="flex items-baseline whitespace-nowrap tabular-nums" style={{ gap: u(10) }}>
        {before && (
          <>
            <span className="font-bold text-muted" style={{ fontSize: u(primary ? 34 : 28) }}>
              {before}
            </span>
            <span aria-label="에서" className="text-muted" style={{ fontSize: u(primary ? 28 : 24) }}>
              →
            </span>
          </>
        )}
        <span className="font-extrabold" style={{ fontSize: u(primary ? 60 : 50), lineHeight: 1.05, color: 'var(--color-accent)', letterSpacing: '-0.02em' }}>
          {after}
        </span>
        <span className="font-bold text-text" style={{ fontSize: u(primary ? 28 : 22) }}>
          {unit}
        </span>
      </div>
      <p className="text-text" style={{ fontSize: u(17), lineHeight: 1.3 }}>
        {sub}
      </p>
    </section>
  )
}

function KeyNumbers() {
  return (
    <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr 1.22fr 1.26fr', gap: u(20) }}>
      <BigStat
        primary
        label="품종 개발 기간(교배 → 품종 출원)"
        before={f1(TOTAL.conventional)}
        after={f1(TOTAL.digital)}
        unit="년"
        sub={
          <>
            <b className="text-positive">{f1(SAVED)}년 단축 · −{f1(SAVED_PCT)}%</b>
            <span className="text-muted"> · 디지털 기간은 공정 설계값(예상)</span>
          </>
        }
      />
      <BigStat
        label="세대 간격(L)"
        before={f1(L.conventional)}
        after={f1(L.digital)}
        unit="년"
        sub={
          <>
            <b className="text-positive">{f1(L.conventional - L.digital)}년 단축</b>
            <span className="text-muted"> · 교배→부모 선발</span>
          </>
        }
      />
      <BigStat
        label="예측 정확도(r)"
        after={f2(P.r)}
        unit=""
        sub={<span className="text-muted">GBLUP · 훈련 집단 {formatNumber(TRAIN_N)}계통 · 전통 표현형 선발 {f2(PARAMS.conventional.r)}</span>}
      />
      <BigStat
        label="연간 유전적 개량량(ΔG)"
        before={f2(dGpct('conventional'))}
        after={f2(dGpct('digital'))}
        unit="%/년"
        sub={
          <>
            <b className="text-positive">{f1(GAIN_RATIO)}배(예측)</b>
            <span className="text-muted"> · 쌀 수량 기준</span>
          </>
        }
      />
    </div>
  )
}

/* ───────── C. 흐름도 ───────── */
function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 24 40" style={{ width: u(CARD_GAP), height: u(40), alignSelf: 'center', flex: 'none' }}>
      <path d="M6 6 L18 20 L6 34" style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    </svg>
  )
}

/** ⑤ → ① 재순환 화살표와 ΔG 식 */
function RecycleLoop() {
  const cx = (i: number) => i * (CARD_W + CARD_GAP) + CARD_W / 2
  const x1 = cx(0)
  const x5 = cx(4)
  const W = 1920 - PAD_X * 2
  const yLine = 22
  const formula = `ΔG = i · r · σA / L = ${P.i.toFixed(3)} × ${f2(P.r)} × ${f1(P.sigmaA)} / ${f1(L.digital)} = ${f1(dG('digital'))} kg/10a/년(${f2(dGpct('digital'))}%/년)`
  return (
    <div className="relative" style={{ height: u(66) }}>
      <svg aria-hidden viewBox={`0 0 ${W} 66`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <marker id="dbp-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--color-accent)' }} />
          </marker>
        </defs>
        <path
          d={`M${x5} 0 V${yLine - 8} Q${x5} ${yLine} ${x5 - 8} ${yLine} H${x1 + 8} Q${x1} ${yLine} ${x1} ${yLine - 8} V4`}
          markerEnd="url(#dbp-arrow)"
          style={{ fill: 'none', stroke: 'var(--color-accent)', strokeWidth: 3 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ left: u(x1), width: u(x5 - x1), top: u(yLine - 15) }}>
        <span className="bg-bg font-bold whitespace-nowrap" style={{ fontSize: u(20), lineHeight: 1.5, padding: `0 ${u(12)}`, color: 'var(--color-accent)' }}>
          ↺ 재순환 육종 사이클 = 세대 간격(L) {f1(L.digital)}년 · 전통 {f1(L.conventional)}년
        </span>
        <span className="tabular-nums whitespace-nowrap text-text" style={{ fontSize: u(18), lineHeight: 1.4, marginTop: u(4) }}>
          {formula}
        </span>
      </div>
      <p className="absolute text-muted" style={{ left: u(cx(5) - CARD_W / 2), width: u(CARD_W * 2 + CARD_GAP), top: u(10), fontSize: u(16), lineHeight: 1.4 }}>
        상위 {P.p}% 계통(선발 강도 i = {P.i.toFixed(3)})을 다음 교배 부모로 되돌려 ①~⑤를 반복합니다. ⑥⑦은 품종화 경로입니다.
      </p>
    </div>
  )
}

function ProcessFlow() {
  return (
    <section aria-label="7단계 흐름도">
      <CanvasSectionTitle
        title="7단계 흐름"
        size={24}
        gapBelow={8}
        sub={<span style={{ fontSize: u(17) }}>· 큰 숫자 = 디지털 기간, 작은 글씨 = 전통 기간</span>}
        right={<span style={{ fontSize: u(16) }}>GEBV 유전체 추정 육종가 · SNP 단일 염기 다형성 · TAT 처리 소요 시간 · PYT 예비 생산력 검정 · AYT 생산력 검정 · MET 지역 적응 시험</span>}
      />
      <div className="flex" style={{ height: u(322) }}>
        {STAGES.map((s, i) => (
          <Fragment key={s.id}>
            {i > 0 && <Chevron />}
            <div style={{ width: u(CARD_W), flex: 'none' }}>
              <FlowCard stage={s} />
            </div>
          </Fragment>
        ))}
      </div>
      <RecycleLoop />
    </section>
  )
}

/* ───────── E. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const NOTES: ReactNode[] = [
  <>
    모든 수치는 가상 기관의 목업 데이터이며 실제 성적이 아닙니다. 디지털 공정 기간 {f1(TOTAL.digital)}년은 {BASIS.digital}년 공정 설계값(예상)이며, 이 공정을 처음부터 적용한 계통은 아직 출원 전입니다(실제 최단 출원 사례는 도입 과도기 계통으로 {SHORTEST_ACTUAL_YEARS}년). 전통 공정은 {BASIS.conventional}년 기준.
  </>,
  <>
    예측 정확도: 쌀 수량, GBLUP, 5-fold × 10회 교차 검증. ΔG %/년은 기준 평균 {MU} kg/10a 대비. i = 선발 강도, σA = 상가적 유전 표준편차(kg/10a), SSD = 단립계통법. 계통 선발(상위 {f1(LINE_SEL_PCT)}%)과 부모 재순환 선발(상위 {P.p}%)은 다른 선발입니다. ΔG와 배율 {f1(GAIN_RATIO)}배는 구성 요소(i · r · σA / L)로 계산한 예측값이며, 코호트 GEBV로 본 실현 추세 기준 배율은 {f1(REALIZED_RATIO)}배(전통 {f1(REALIZED.conventional)} → GS {f1(REALIZED.gs)} kg/10a/년)입니다.
  </>,
  <>속성세대진전 세대 수 근거: IRRI SpeedFlower(연 4~5세대). 기관명·품종명은 가상이며 실존 품종·기관과 관계없습니다.</>,
]

function Footnotes() {
  return (
    <footer className="border-t border-border text-muted" style={{ fontSize: u(16), lineHeight: 1.4, paddingTop: u(8), borderTopWidth: u(1.5) }}>
      {NOTES.map((n, i) => (
        <p key={i}>※ {n}</p>
      ))}
    </footer>
  )
}

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 요약(인쇄 제외) ───────── */
/** 요약 카드 값: 전통 값은 작은 회색, 디지털 값만 크게(conventional-vs-digital 요약 규격과 같음) */
function FromTo({ from, to }: { from: string; to: string }) {
  return (
    <>
      <span className="whitespace-nowrap text-[15px] font-bold text-muted">{from} →</span> <span className="whitespace-nowrap">{to}</span>
    </>
  )
}

function Summary() {
  // conventional-vs-digital 요약 규격: 값 = 전 → 후, 보조 줄 = 단위(굵게) + 보조 문구(muted)
  const cards = [
    { key: 'dev', label: '품종 개발 기간(교배 → 출원)', value: <FromTo from={f1(TOTAL.conventional)} to={f1(TOTAL.digital)} />, unit: '년', sub: `${f1(SAVED)}년 단축 · 설계값`, primary: true },
    { key: 'L', label: '세대 간격(L)', value: <FromTo from={f1(L.conventional)} to={f1(L.digital)} />, unit: '년', sub: `${f1(L.conventional - L.digital)}년 단축` },
    { key: 'r', label: '예측 정확도(r)', value: f2(P.r), unit: '', sub: `GBLUP · 전통(표현형 선발) ${f2(PARAMS.conventional.r)}` },
    { key: 'dg', label: '연간 유전적 개량량(ΔG)', value: <FromTo from={f2(dGpct('conventional'))} to={f2(dGpct('digital'))} />, unit: '%/년', sub: `${f1(GAIN_RATIO)}배(예측)` },
  ]
  return (
    <div className="flex flex-col gap-2">
      <MobileSummary
      title={`벼 디지털육종 프로세스 · 전통 ${BASIS.conventional} vs 디지털 ${BASIS.digital}`}
      items={cards.map(s => ({
        key: s.key,
        label: s.label,
        value: s.value,
        primary: s.primary,
        detail: (
          <>
            {s.unit && <span className="mr-1 text-[14px] font-bold text-text">{s.unit}</span>}
            {/* 보조 문구는 한 덩어리로 다음 줄에 붙되, 칸보다 길면 낱말 단위로 줄바꿈(390 2열 칸에서 'GBLUP · 전통(표현형 선발) 0.45'가 칸 밖으로 나가지 않게) */}
            <span className="inline-block break-keep text-[14px] text-muted">{s.unit ? `· ${s.sub}` : s.sub}</span>
          </>
        ),
      }))}
      footer={
        <>
          유전체 선발(GS)과 속성세대진전(RGA)으로 벼 품종 하나를 {f1(SAVED)}년 더 빨리 만들 수 있습니다(설계값)
        </>
      }
      />
      <ul className="space-y-1 text-[12px] leading-relaxed text-muted" aria-label="각주">
        {NOTES.map((n, i) => (
          <li key={i} className="break-keep">
            ※ {n}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Template() {
  const label = `디지털육종 프로세스 인포그래픽. 벼 품종 개발 기간이 전통 ${f1(TOTAL.conventional)}년에서 디지털 ${f1(TOTAL.digital)}년으로 ${f1(SAVED)}년(${f1(SAVED_PCT)}%) 짧아지고, 세대 간격은 ${f1(L.conventional)}년에서 ${f1(L.digital)}년, 연간 유전적 개량량은 ${f2(dGpct('conventional'))}에서 ${f2(dGpct('digital'))}%/년으로 ${f1(GAIN_RATIO)}배(예측) · 실현 ${f1(REALIZED_RATIO)}배로 커집니다.`
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas ariaLabel={label} print="a4-landscape" minScale={MIN_SCALE} className="bg-bg text-text" summary={<Summary />}>
        <div className="absolute inset-0 flex flex-col justify-between break-keep [&>*]:flex-none" style={{ padding: `${u(28)} ${u(PAD_X)} ${u(22)}` }}>
          <TitleBand />
          <KeyNumbers />
          <ProcessFlow />
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}
