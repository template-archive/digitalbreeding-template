import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, CanvasSectionTitle, MobileSummary, ScaledCanvas, u } from '@/design-system'
import { formatSigned } from '@/lib/format'
import {
  ANNUAL_COST_EOK,
  AS_OF,
  BASIS,
  CHIP_USD,
  CONTRIB,
  COST,
  COST_PER_GAIN,
  COST_PER_GAIN_PCT,
  COST_PER_GAIN_REALIZED,
  COST_PER_GAIN_REALIZED_PCT,
  COST_RATIO,
  DELTA_DG,
  DEV_SAVED,
  DEV_YEARS,
  DG,
  DG_PCT,
  FACTORS,
  GAIN_RATIO,
  GS_START_YEAR,
  I,
  L,
  MU,
  ORG,
  PER_LINE,
  R,
  REALIZED,
  REALIZED_RATIO,
  SHARE,
  SHARE_ROUNDED_SUM,
  SHORTEST_ACTUAL_YEARS,
  SIGMA_A,
  WATERFALL,
  type Factor,
} from './data'
import { ContrastTable } from './components/ContrastTable'
import { Waterfall } from './components/Waterfall'
import { CONV_FILL, DIGI_FILL, f1, f2, fmtI, int } from './components/shared'

export const meta: TemplateMeta = {
  slug: 'conventional-vs-digital',
  category: 'infographic',
  title: '전통 육종 vs 디지털육종',
  description: `벼 쌀 수량 기준으로 전통 육종과 디지털육종을 지표별로 맞대고, 연간 유전적 개량량이 ${f1(GAIN_RATIO)}배(예측) · 실현 ${f1(REALIZED_RATIO)}배로 커지는 이유를 ΔG 구성 요소 기여로 보여 주는 16:9 인포그래픽`,
  tags: ['인포그래픽', '벼', '디지털육종', '유전체 선발', '유전적 개량량', 'LMDI', '비용', '정책 브리핑'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const PAD_X = 56
/** 왼쪽 열(표제 + 대비 표)·오른쪽 열(도식 + 비용) 폭 */
const LEFT_W = 1100
const RIGHT_W = 680
/** 하한 16 논리 px가 11px 이상이 되는 배율(16 × 0.6875 = 11). 1440px 화면에서는 잘리지 않는다 */
const MIN_SCALE = 0.6875
const c = BASIS.conventional
const d = BASIS.digital
const FACTOR_NAME: Record<Factor, string> = { i: '선발 강도(i)', r: '선발 정확도(r)', sigmaA: '상가적 유전 표준편차(σA)', L: '세대 간격(L) 단축' }
const share = (f: Factor) => `${f1(SHARE[f])}%`

/* ───────── A. 제목 띠 ───────── */
function Swatch({ fill }: { fill: string }) {
  return <span aria-hidden className="inline-block" style={{ width: u(30), height: u(16), borderRadius: u(3), background: fill, boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-text-muted) 55%, transparent)' }} />
}

function TitleBand() {
  return (
    <header className="flex flex-col" style={{ gap: u(8) }}>
      <p className="font-semibold text-muted" style={{ fontSize: u(18), lineHeight: 1.2 }}>
        전통 육종 vs 디지털육종 · {ORG}
      </p>
      <h1 className="font-extrabold text-text" style={{ fontSize: u(44), lineHeight: 1.14, letterSpacing: '-0.02em' }}>
        해마다 <span style={{ color: 'var(--color-accent)' }}>{f1(GAIN_RATIO)}배</span>
        <span className="font-semibold text-muted" style={{ fontSize: u(22), letterSpacing: 0 }}>
          (예측)
        </span>{' '}
        더 개량하고, 품종은 <span style={{ color: 'var(--color-accent)' }}>{f1(DEV_SAVED)}년</span> 더 빨리
        <span className="font-semibold text-muted" style={{ fontSize: u(22), letterSpacing: 0 }}>
          (설계값)
        </span>
      </h1>
      <div className="flex flex-wrap items-center" style={{ gap: `${u(4)} ${u(24)}`, fontSize: u(18), lineHeight: 1.3 }}>
        <p className="text-muted">
          벼(<i>Oryza sativa</i>) · 쌀 수량 기준
        </p>
        <span className="flex items-center font-semibold text-text" style={{ gap: u(8) }}>
          ◀ <Swatch fill={CONV_FILL} /> 전통 {c}년 공정(표현형 선발)
        </span>
        <span className="flex items-center font-semibold text-text" style={{ gap: u(8) }}>
          <Swatch fill={DIGI_FILL} /> 디지털 {d}년 공정(유전체 선발·속성세대진전) ▶
        </span>
      </div>
    </header>
  )
}

/* ───────── C. 왜 빨라지는가 ───────── */
function WhyFaster() {
  const eq = (y: typeof c | typeof d) => `${fmtI(I[y])} × ${f2(R[y])} × ${f1(SIGMA_A[y])} / ${f1(L[y])} = ${f2(y === c ? DG.conventional : DG.digital)}`
  return (
    <section className="flex min-h-0 flex-1 flex-col border border-border bg-surface" style={{ borderRadius: u(12), padding: `${u(14)} ${u(18)} ${u(10)}`, borderWidth: u(1.5) }} aria-label="왜 빨라지는가">
      <CanvasSectionTitle
        title="왜 빨라지는가"
        sub={<span style={{ fontSize: u(16) }}>연간 유전적 개량량(ΔG) 증가분 {f2(DELTA_DG)} kg/10a/년의 구성 요소별 기여</span>}
        gapBelow={4}
      />
      <Waterfall />
      <table className="sr-only">
        <caption>연간 유전적 개량량 폭포 차트: 전통 {f2(DG.conventional)}에서 디지털 {f2(DG.digital)} kg/10a/년</caption>
        <thead>
          <tr>
            <th scope="col">단계</th>
            <th scope="col">값(kg/10a/년)</th>
            <th scope="col">증가분 비중</th>
          </tr>
        </thead>
        <tbody>
          {WATERFALL.map(s => (
            <tr key={s.key}>
              <th scope="row">{s.key === 'start' ? `전통 ΔG ${c}` : s.key === 'end' ? `디지털 ΔG ${d}` : FACTOR_NAME[s.key]}</th>
              <td>{s.key === 'start' || s.key === 'end' ? f2(s.to) : formatSigned(s.to - s.from, 2)}</td>
              <td>{s.key === 'start' || s.key === 'end' ? '–' : share(s.key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-end justify-between border-t border-border" style={{ borderTopWidth: u(1.5), paddingTop: u(6), marginTop: u(6), gap: u(12) }}>
        <div className="tabular-nums text-text" style={{ fontSize: u(18), lineHeight: 1.4 }}>
          <p>
            <span className="inline-block font-semibold text-muted" style={{ width: u(64) }}>
              전통
            </span>
            {eq(c)}
          </p>
          <p>
            <span className="inline-block font-semibold" style={{ width: u(64), color: 'var(--color-accent)' }}>
              디지털
            </span>
            <b>{eq(d)}</b>
          </p>
        </div>
        <p className="text-right text-muted" style={{ fontSize: u(16), lineHeight: 1.35 }}>
          ΔG = i · r · σA / L
          <br />
          비중은 반올림 때문에 합이 {f1(SHARE_ROUNDED_SUM)}%
        </p>
      </div>
    </section>
  )
}

/* ───────── D. 비용 대비 성과 ───────── */
function CostFigure({ label, before, after, unit, change, change2 }: { label: string; before: string; after: string; unit: string; change: string; change2?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between" style={{ gap: u(4) }}>
      <p className="font-semibold text-text" style={{ fontSize: u(18), lineHeight: 1.2 }}>
        {label}
      </p>
      <p className="flex items-baseline whitespace-nowrap tabular-nums" style={{ gap: u(8) }}>
        <span className="font-bold text-muted" style={{ fontSize: u(24) }}>
          {before}
        </span>
        <span aria-label="에서" className="text-muted" style={{ fontSize: u(22) }}>
          →
        </span>
        <span className="font-extrabold text-text" style={{ fontSize: u(32), lineHeight: 1, letterSpacing: '-0.02em' }}>
          {after}
        </span>
        <span className="font-bold text-text" style={{ fontSize: u(20) }}>
          {unit}
        </span>
      </p>
      <p className="font-bold text-text" style={{ fontSize: u(18), lineHeight: 1.25 }}>
        {change}
        {change2 && (
          <span className="block font-semibold" style={{ fontSize: u(16) }}>
            {change2}
          </span>
        )}
      </p>
    </div>
  )
}

function CostCard() {
  return (
    <section className="flex flex-col border border-border bg-surface" style={{ borderRadius: u(12), padding: `${u(14)} ${u(18)}`, borderWidth: u(1.5), gap: u(8) }} aria-label="비용 대비 성과">
      <CanvasSectionTitle
        title="비용 대비 성과"
        right={
          <span className="rounded-sm border border-border bg-surface-2 font-bold text-text" style={{ fontSize: u(16), padding: `${u(2)} ${u(10)}` }}>
            추정
          </span>
        }
        gapBelow={0}
      />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: u(20) }}>
        <CostFigure
          label="연간 직접비"
          before={`${f2(ANNUAL_COST_EOK.conventional)}억`}
          after={`${f2(ANNUAL_COST_EOK.digital)}억`}
          unit="원"
          change={`${f2(COST_RATIO)}배 증가`}
        />
        <div className="border-l border-border" style={{ borderLeftWidth: u(1.5), paddingLeft: u(20) }}>
          <CostFigure
            label="개량 1 kg/10a당 연간 직접비"
            before={`${int(COST_PER_GAIN.conventional)}만`}
            after={`${int(COST_PER_GAIN.digital)}만`}
            unit="원"
            change={`${f1(-COST_PER_GAIN_PCT)}% 감소(예측 기준) ·`}
            change2={`실현 기준 ${f1(-COST_PER_GAIN_REALIZED_PCT)}% 감소`}
          />
        </div>
      </div>
      <p className="rounded-md bg-surface-2 text-text" style={{ fontSize: u(17), lineHeight: 1.35, padding: `${u(5)} ${u(12)}` }}>
        비용은 <b>{f2(COST_RATIO)}배</b>, 연간 개량량은 <b style={{ color: 'var(--color-accent)' }}>{f1(GAIN_RATIO)}배</b>(예측) · 실현 {f1(REALIZED_RATIO)}배 — 같은 돈으로 더 많이 개량합니다
      </p>
    </section>
  )
}

/* ───────── E. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const pl = COST.perLine
const NOTES: ReactNode[] = [
  <>모든 수치는 가상 기관의 목업 데이터이며 실제 성적이 아닙니다. 기관명·품종명은 가상입니다.</>,
  <>
    전통 = {c}년 공정({c}~{GS_START_YEAR - 1} 표현형 선발기 대표), 디지털 = {d}년 공정(GS {d - GS_START_YEAR + 1}년차, 진행 중 연도). 디지털 개발 기간 {f1(DEV_YEARS.digital)}년은 설계값(예상)이며 실제 최단 출원은 도입 과도기 계통 {SHORTEST_ACTUAL_YEARS}년입니다. ΔG %/년은 기준 평균 {MU} kg/10a 대비, 예측 정확도는 쌀 수량·GBLUP(유전체 최적 선형 불편 예측)·5-fold × 10회 교차 검증.
  </>,
  <>
    ΔG와 배율 {f1(GAIN_RATIO)}배는 연도별 구성 요소로 계산한 예측값입니다. 코호트 평균 유전체 추정 육종가(GEBV)로 본 실현 추세는 전통 {f1(REALIZED.conventional)} · GS {f1(REALIZED.gs)} kg/10a/년({f1(REALIZED_RATIO)}배)입니다. 기여 분해: 연도별 LMDI(로그 평균 디비지아 지수)를 {c + 1}~{d}에 걸쳐 합산, 비중은 반올림 때문에 합이 {f1(SHARE_ROUNDED_SUM)}%.
  </>,
  <>
    비용(추정): 직접비만(인건비·시설 감가상각·교배 작업비 제외). 계통당 선발 평가비 전통 {f1(PER_LINE.conventional)}만 원 = 포장 세대 진전 {f1(pl.conventional.advance)} + 관찰 포장 평가 {f1(pl.conventional.phenoEval)}, 디지털 {f1(PER_LINE.digital)}만 원 = 속성세대진전 {f1(pl.digital.speedAdvance)} + 유전형 분석(6K SNP 칩, DNA 추출 포함, 약 {int(CHIP_USD)} USD) {f1(pl.digital.genotyping)} + 예측·데이터 관리 {f1(pl.digital.prediction)}. 시험구 단가 {int(COST.plot)}만 원, 대비 품종 {COST.checks}개 포함, 반복 PYT {COST.reps.pyt}·AYT {COST.reps.ayt}·MET {COST.reps.met}, MET {COST.sites.met}개 지역. 시험구는 단계별 1개 세트·1년 기준(겹쳐 심는 세트 제외)입니다. 개량 1 kg/10a당 직접비는 예측 ΔG 기준이며, 실현 추세 기준으로는 {int(COST_PER_GAIN_REALIZED.conventional)}만 → {int(COST_PER_GAIN_REALIZED.digital)}만 원({formatSigned(COST_PER_GAIN_REALIZED_PCT, 1)}%)입니다.
  </>,
]

function Footnotes() {
  return (
    <footer className="border-t border-border text-muted" style={{ fontSize: u(16), lineHeight: 1.36, paddingTop: u(6), borderTopWidth: u(1.5) }}>
      {NOTES.map((n, i) => (
        <p key={i}>※ {n}</p>
      ))}
    </footer>
  )
}

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 요약(인쇄 제외) ───────── */
/** 요약 카드 값: 전통 값은 작은 회색(캔버스 비용 패널의 전 → 후 규격), 디지털 값만 크게 — 390px 2열 카드에서 화살표 뒤 줄바꿈 방지 */
function FromTo({ from, to }: { from: string; to: string }) {
  return (
    <>
      <span className="whitespace-nowrap text-[15px] font-bold text-muted">{from} →</span> <span className="whitespace-nowrap">{to}</span>
    </>
  )
}

function Summary() {
  const cards = [
    { label: '연간 유전적 개량량', value: `${f1(GAIN_RATIO)}배`, unit: '(예측)', sub: `${f2(DG.conventional)} → ${f2(DG.digital)} kg/10a/년`, primary: true },
    { label: '품종 개발 기간', value: <FromTo from={f1(DEV_YEARS.conventional)} to={f1(DEV_YEARS.digital)} />, unit: '년', sub: '설계값' },
    { label: '세대 간격', value: <FromTo from={f1(L[c])} to={f1(L[d])} />, unit: '년', sub: `${f1(L[c] - L[d])}년 단축` },
    { label: '개량 1 kg/10a당 직접비', value: <FromTo from={`${int(COST_PER_GAIN.conventional)}만`} to={`${int(COST_PER_GAIN.digital)}만`} />, unit: '원', sub: '추정 · 예측 기준' },
  ]
  return (
    <div className="flex flex-col gap-2">
      <MobileSummary
      title={
        <>
          전통 {c} vs 디지털 {d} · 벼 쌀 수량
        </>
      }
      items={cards.map(s => ({
        key: s.label,
        label: s.label,
        value: s.value,
        primary: s.primary,
        detail: (
          <>
            <span className="text-[14px] font-bold text-text">{s.unit}</span>
            <span className="ml-1 inline-block break-keep text-[14px] text-muted">· {s.sub}</span>
          </>
        ),
      }))}
      footer={<>개량량 증가분의 {share('L')}는 세대 간격 단축 덕분입니다</>}
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
  const contrib = FACTORS.map(f => `${FACTOR_NAME[f]} ${formatSigned(CONTRIB[f], 2)}(${share(f)})`).join(', ')
  const label = `전통 육종 vs 디지털육종 인포그래픽. 벼 쌀 수량의 연간 유전적 개량량이 ${f2(DG.conventional)}에서 ${f2(DG.digital)} kg/10a/년(${f2(DG_PCT.conventional)}에서 ${f2(DG_PCT.digital)}%/년)으로 ${f1(GAIN_RATIO)}배(예측) · 실현 ${f1(REALIZED_RATIO)}배, 품종 개발 기간은 ${f1(DEV_YEARS.conventional)}년에서 ${f1(DEV_YEARS.digital)}년(설계값)으로 줄어듭니다. 증가분 기여: ${contrib}. 세대 간격 단축이 ${share('L')}를 차지합니다. 개량 1 kg/10a당 연간 직접비는 ${int(COST_PER_GAIN.conventional)}만 원에서 ${int(COST_PER_GAIN.digital)}만 원으로 ${f1(-COST_PER_GAIN_PCT)}% 감소합니다(예측 ΔG 기준, 실현 추세 기준 ${f1(-COST_PER_GAIN_REALIZED_PCT)}% 감소, 추정).`
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas width={1920} height={1080} print="a4-landscape" minScale={MIN_SCALE} ariaLabel={label} className="bg-bg text-text" summary={<Summary />}>
        <div className="absolute inset-0 flex flex-col break-keep" style={{ padding: `${u(30)} ${u(PAD_X)} ${u(22)}`, gap: u(12) }}>
          <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${u(LEFT_W)} ${u(RIGHT_W)}`, gap: u(28) }}>
            <div className="flex min-h-0 flex-col" style={{ gap: u(14) }}>
              <TitleBand />
              <div className="min-h-0 flex-1">
                <ContrastTable />
              </div>
            </div>
            <div className="flex min-h-0 flex-col" style={{ gap: u(10) }}>
              <p className="self-end rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums" style={{ fontSize: u(17), padding: `${u(4)} ${u(12)}` }}>
                기준일 {AS_OF}
              </p>
              <WhyFaster />
              <CostCard />
            </div>
          </div>
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}
