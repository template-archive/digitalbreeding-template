import type { ReactNode } from 'react'
import { Circle, CircleCheck, CircleX, Printer } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, CanvasSectionTitle, MobileSummary, ScaledCanvas, u } from '@/design-system'
import { formatNumber, formatSigned } from '@/lib/format'
import {
  AS_OF,
  CHECK,
  CONVENTIONAL_YEARS,
  DIGITAL_DESIGN_YEARS,
  GENES,
  MU,
  RECOMMENDED_ZONE,
  TRIAL,
  VARIETY,
  ZONES,
  ZONE_INFO,
  blastClass,
  blastGenesHeld,
  countedTotal,
  devYears,
  diff,
  heldCount,
  index,
  savedYears,
  sitesAbove100,
  SITES,
  traitOf,
  verdict,
  zoneIndex,
  zoneSiteCount,
  type Gene,
} from './data'
import { ChromosomeTracks } from './components/ChromosomeTracks'
import { DevTimeline } from './components/DevTimeline'
import { SiteBars } from './components/SiteBars'
import { TraitTable } from './components/TraitTable'
import { YieldBars } from './components/YieldBars'
import { V_COLOR, f1, useZoneColor } from './components/style'

export const meta: TemplateMeta = {
  slug: 'variety-profile',
  category: 'infographic',
  title: '신품종 소개 카드',
  description: '신품종 별하랑이 대비 품종보다 무엇이 낫고, 어디에 심으면 좋고, 어떻게 7년 만에 만들었는지 A4 한 장으로 보여 주는 보급용 인포그래픽',
  tags: ['인포그래픽', '벼', '신품종', '품종 소개', '지역 적응 시험', '보급', 'A4 인쇄'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const W = 1240
const H = 1754
const PAD_X = 48
/** 하한 15 논리 px가 11px 이상이 되는 배율(15 × 0.74 = 11.1) */
const MIN_SCALE = 0.74
/** 머리 오른쪽 교배 조합 도식 폭 */
const CROSS_W = 420
/** 영역 1 왼쪽 수량 도식 폭. 나머지는 형질 표(COLS 합 810) */
const YIELD_W = 310

const Y = traitOf('yield')
const BLAST = traitOf('blast')
const HEADING = traitOf('heading')
const yieldIdx = index(Y)!
const blastNames = blastGenesHeld.join('·')
/** 보유 도열병 유전자의 출처(GENES.origin)가 하나면 "부본에서 온 " 식으로 붙인다 */
const blastOrigins = [...new Set(GENES.filter(g => blastGenesHeld.includes(g.gene)).map(g => g.origin?.split(' ')[0] ?? null))]
const blastOriginText = blastOrigins.length === 1 && blastOrigins[0] ? `${blastOrigins[0]}에서 온 ` : ''

/* ───────── A. 머리: 표제 라벨 → 큰 표제 → 부제, 오른쪽에 교배 조합 도식 ───────── */
function TitleBand() {
  return (
    <header className="grid" style={{ gridTemplateColumns: `1fr ${u(CROSS_W)}`, gap: u(28) }}>
      <div className="flex min-w-0 flex-col" style={{ gap: u(7) }}>
        <p className="font-semibold text-muted" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          {VARIETY.institute} · 신품종 소개
        </p>
        <div className="flex items-baseline" style={{ gap: u(16) }}>
          <h1 className="font-black text-text" style={{ fontSize: u(84), lineHeight: 0.95, letterSpacing: '-0.03em' }}>
            {VARIETY.name}
          </h1>
          <span className="font-bold text-muted tabular-nums" style={{ fontSize: u(22) }}>
            {VARIETY.line}
          </span>
        </div>
        <p className="font-semibold text-text" style={{ fontSize: u(20), lineHeight: 1.3 }}>
          유전체 선발(GS)로 고른 {VARIETY.maturity} 다수성 벼 — 수량 <b style={{ color: V_COLOR }}>{f1(yieldIdx)}%</b> · 도열병 저항성 유전자{' '}
          <b style={{ color: V_COLOR }}>{blastGenesHeld.length}개</b>
        </p>
        <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          벼(<i>Oryza sativa</i>) · {VARIETY.type} · {VARIETY.maturity} · 상태 <b style={{ color: V_COLOR }}>{VARIETY.status}</b> · 출원 {VARIETY.filedAt}
        </p>
      </div>
      <div className="flex min-w-0 flex-col items-end justify-between" style={{ gap: u(8) }}>
        <span className="rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums" style={{ fontSize: u(16), padding: `${u(4)} ${u(12)}` }}>
          기준일 {AS_OF}
        </span>
        <CrossDiagram />
      </div>
    </header>
  )
}

/** 교배 조합: 모본 × 부본 → 신품종 */
function CrossDiagram() {
  return (
    <figure className="w-full border border-border bg-surface" style={{ borderRadius: u(12), padding: `${u(10)} ${u(14)}`, borderWidth: u(1.5) }} aria-label={`교배 조합 ${VARIETY.cross.female} / ${VARIETY.cross.male}(${VARIETY.cross.maleName})`}>
      <figcaption className="font-bold text-muted" style={{ fontSize: u(15), marginBottom: u(6) }}>
        교배 조합 · {VARIETY.crossYear}
      </figcaption>
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', gap: u(8) }}>
        <div className="leading-tight">
          <div className="text-muted" style={{ fontSize: u(15) }}>
            모본 ♀
          </div>
          <div className="font-bold text-text" style={{ fontSize: u(18) }}>
            {VARIETY.cross.female}
          </div>
          <div className="text-muted" style={{ fontSize: u(15) }}>
            다수성 · 대비 품종
          </div>
        </div>
        <span className="font-bold text-muted" style={{ fontSize: u(20) }} aria-label="교배">
          /
        </span>
        <div className="leading-tight">
          <div className="text-muted" style={{ fontSize: u(15) }}>
            부본 ♂
          </div>
          <div className="font-bold text-text tabular-nums" style={{ fontSize: u(18) }}>
            {VARIETY.cross.male}
          </div>
          <div className="text-muted" style={{ fontSize: u(15) }}>
            현 {VARIETY.cross.maleName} · 도열병 저항성 공여
          </div>
        </div>
      </div>
    </figure>
  )
}

/* ───────── B. 핵심 숫자 ───────── */
function BigStat({ label, value, unit, sub, primary = false }: { label: string; value: string; unit: string; sub: ReactNode; primary?: boolean }) {
  return (
    <section
      className={`flex min-w-0 flex-col justify-between border ${primary ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'}`}
      style={{ padding: `${u(12)} ${u(18)}`, borderRadius: u(12), borderWidth: u(primary ? 2 : 1.5) }}
    >
      <h2 className="font-bold text-text" style={{ fontSize: u(17), lineHeight: 1.2 }}>
        {label}
      </h2>
      <div className="flex items-baseline tabular-nums" style={{ gap: u(6) }}>
        <span className="font-extrabold" style={{ fontSize: u(primary ? 64 : 50), lineHeight: 1, color: V_COLOR, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span className="font-bold text-text" style={{ fontSize: u(primary ? 24 : 20) }}>
          {unit}
        </span>
      </div>
      <p className="text-text" style={{ fontSize: u(15), lineHeight: 1.35 }}>
        {sub}
      </p>
    </section>
  )
}

function KeyNumbers() {
  return (
    <section aria-label="핵심 숫자">
      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1.2fr', gap: u(14), height: u(160) }}>
        <BigStat
          primary
          label="쌀 수량"
          value={formatNumber(Y.v)}
          unit="kg/10a"
          sub={
            <>
              <b style={{ color: V_COLOR }}>대비 {f1(yieldIdx)}%</b> · {formatSigned(diff(Y))} kg/10a
              <br />
              <span className="text-muted">
                {CHECK.name} {Y.c} kg/10a · 높을수록 좋음
              </span>
            </>
          }
        />
        <BigStat
          label="잎도열병 발병 지수"
          value={String(BLAST.v)}
          unit="점"
          sub={
            <>
              <b className="text-positive">{blastClass(BLAST.v)}</b> · 대비 {BLAST.c}점({blastClass(BLAST.c).replace(' 저항성', '')})
              <br />
              <span className="text-muted">0~9 척도 · 낮을수록 좋음</span>
            </>
          }
        />
        <BigStat
          label="출수기"
          value={HEADING.date!.v}
          unit=""
          sub={
            <>
              {VARIETY.maturity} · 대비 {formatSigned(diff(HEADING))}일({verdict(HEADING)})
              <br />
              <span className="text-muted">파종 후 {HEADING.v}일</span>
            </>
          }
        />
        <BigStat
          label="개발 기간(짧을수록 좋음)"
          value={String(devYears)}
          unit="년"
          sub={
            <>
              {VARIETY.crossYear} 교배 → {VARIETY.filedAt.slice(0, 4)} 출원
              <br />
              <b className="text-positive">
                전통 {f1(CONVENTIONAL_YEARS)}년보다 {f1(savedYears)}년 짧음
              </b>
            </>
          }
        />
      </div>
      <p className="text-muted" style={{ fontSize: u(15), marginTop: u(8) }}>
        대비 품종 <b className="text-text">{CHECK.name}</b>({CHECK.note}) · 성적 기준: 지역 적응 시험(MET) {TRIAL.sites}개 지역 × {TRIAL.years.length}년({TRIAL.years[0]}~{TRIAL.years[1]}) 평균, 지역별 {TRIAL.reps}반복
      </p>
    </section>
  )
}

/* ───────── C. 형질 성적 비교 ───────── */
function TraitSection() {
  return (
    <section aria-label="형질 성적 비교">
      <CanvasSectionTitle
        size={22}
        gapBelow={6}
        no="1"
        title="무엇이 나은가"
        sub={`형질 성적 · MET ${TRIAL.years[0]}~${TRIAL.years[1]} · ${TRIAL.sites}개 지역 × ${TRIAL.years.length}년 평균 · 판정: 차이가 최소 유의차(LSD, 5%)보다 클 때`}
      />
      <div className="grid" style={{ gridTemplateColumns: `${u(YIELD_W)} 1fr`, gap: u(24), height: u(372) }}>
        <div>
          <YieldBars />
        </div>
        <TraitTable />
      </div>
    </section>
  )
}

/* ───────── D. 재배 적지 ───────── */
function ZoneBlock({ zone }: { zone: (typeof ZONES)[number] }) {
  const zoneColor = useZoneColor()
  const best = zone === RECOMMENDED_ZONE
  const idx = zoneIndex(zone)
  const bad = idx < 100
  const info = ZONE_INFO[zone]
  // 판정 기호는 글리프(★·✕·○) 대신 아이콘 + 낱말. 적지 강조는 강조색(초록은 중북부지 청록 막대와 같은 계열이라 쓰지 않는다)
  const ZoneIcon = best ? CircleCheck : bad ? CircleX : Circle
  return (
    <div
      className={`grid items-center border ${best ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}
      style={{ gridTemplateColumns: `${u(8)} 1fr auto`, gap: u(12), padding: `${u(6)} ${u(14)} ${u(6)} ${u(10)}`, borderRadius: u(10), borderWidth: u(best ? 2 : 1.5) }}
    >
      <span aria-hidden className="self-stretch" style={{ background: zoneColor(zone), borderRadius: u(4) }} />
      <div className="min-w-0 leading-tight">
        <div className="font-extrabold text-text" style={{ fontSize: u(18) }}>
          {zone}
          <span
            className={`inline-flex items-center font-bold ${best ? 'text-accent' : bad ? 'text-negative' : 'text-muted'}`}
            style={{ fontSize: u(15), marginLeft: u(8), gap: u(3), verticalAlign: 'baseline' }}
          >
            <ZoneIcon className="shrink-0" aria-hidden style={{ width: u(15), height: u(15) }} strokeWidth={2.5} />
            {best ? '재배 적지' : bad ? '부적지' : '재배 가능'}
          </span>
        </div>
        <div className="text-muted" style={{ fontSize: u(15), marginTop: u(2) }}>
          {info.area} · {zoneSiteCount(zone)}개 지역
        </div>
      </div>
      <div className="text-right font-extrabold tabular-nums" style={{ fontSize: u(best ? 30 : 24), color: best ? V_COLOR : undefined }}>
        {f1(idx)}%
      </div>
    </div>
  )
}

function SuitabilitySection() {
  return (
    <section aria-label="재배 적지">
      <CanvasSectionTitle
        size={22}
        gapBelow={6}
        no="2"
        title="어디에 심으면 좋은가"
        sub={`지역별 수량 지수(대비 품종 = 100%) · ${SITES.length}곳 중 ${sitesAbove100}곳에서 대비 이상`}
      />
      <div className="grid" style={{ gridTemplateColumns: `${u(400)} 1fr`, gap: u(20), height: u(296) }}>
        <div className="flex flex-col" style={{ gap: u(8) }}>
          {ZONES.map(z => (
            <ZoneBlock key={z} zone={z} />
          ))}
          <ul className="text-text" style={{ fontSize: u(15), lineHeight: 1.32 }}>
            <li>
              <b>재배 적지:</b> {RECOMMENDED_ZONE}({ZONE_INFO[RECOMMENDED_ZONE].area})
            </li>
            <li>
              <b>부적지:</b> 중북부지·고랭지 — {VARIETY.maturity}(출수 8월 중순)이라 등숙 온도가 부족할 수 있음
            </li>
            <li className="text-muted">
              재배 요령 · 보통기 재배({TRIAL.sowing.replace('20일', '하순')} 파종, {TRIAL.transplant} 이앙) · 도열병 저항성이지만 저항성 붕괴에 대비해 적기 방제
            </li>
          </ul>
        </div>
        <div>
          <SiteBars />
        </div>
      </div>
    </section>
  )
}

/* ───────── E. 보유 유전자 ───────── */
function HeldMark({ g, k }: { g: Gene; k: 'v' | 'c' }) {
  if (!g.counted) return <span className="text-text">{g.allele}</span>
  return g[k] ? (
    <span className="font-bold" style={{ color: k === 'v' ? V_COLOR : 'var(--color-text)' }}>
      ● 보유
    </span>
  ) : (
    <span className="text-muted">○ 미보유</span>
  )
}

function GeneSection() {
  const cols = `${u(60)} ${u(134)} ${u(118)} ${u(110)} ${u(104)} 1fr`
  return (
    <section aria-label="보유 유전자와 마커">
      <CanvasSectionTitle
        size={22}
        gapBelow={6}
        no="3"
        title="무엇이 들어 있나"
        sub={
          <>
            보유 유전자·마커 · 저항성·반왜성 유전자 {countedTotal}종 중{' '}
            <b style={{ color: V_COLOR }}>
              {heldCount('v')}종 보유
            </b>
            (대비 {heldCount('c')}종)
          </>
        }
      />
      <div className="grid" style={{ gridTemplateColumns: `${u(452)} 1fr`, gap: u(22), height: u(256) }}>
        <div>
          <ChromosomeTracks />
        </div>
        <div className="flex flex-col justify-between">
          <div role="table" aria-label="보유 유전자 표">
            <div role="row" className="grid border-b border-text/60 font-bold text-muted" style={{ gridTemplateColumns: cols, fontSize: u(15), paddingBottom: u(4), borderBottomWidth: u(1.5) }}>
              {['유전자', '관련 형질', '염색체(위치 Mb)', VARIETY.name, CHECK.name, `${VARIETY.name} 유래`].map(h => (
                <span key={h} role="columnheader" className="whitespace-nowrap">
                  {h}
                </span>
              ))}
            </div>
            {GENES.map(g => (
              <div role="row" key={g.gene} className="grid items-center border-b border-border" style={{ gridTemplateColumns: cols, height: u(25), fontSize: u(15) }}>
                <span role="cell" className="font-bold text-text italic">
                  {g.gene}
                </span>
                <span role="cell" className="text-text">
                  {g.trait}
                </span>
                <span role="cell" className="text-text tabular-nums">
                  Chr{String(g.chr).padStart(2, '0')} ({g.mb.toFixed(1)})
                </span>
                <span role="cell">
                  <HeldMark g={g} k="v" />
                </span>
                <span role="cell">
                  <HeldMark g={g} k="c" />
                </span>
                <span role="cell" className="whitespace-nowrap text-muted">
                  {g.origin ?? '—'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: u(15), lineHeight: 1.3 }}>
            <p className="text-text">
              잎도열병 발병 지수 <b>{BLAST.v}점({blastClass(BLAST.v)})</b>은 {blastOriginText}<b style={{ color: V_COLOR }}>{blastNames}</b> {blastGenesHeld.length}개를 함께 가진(집적) 효과로 봅니다.
              대비 {CHECK.name}은 도열병 저항성 유전자가 없어 {BLAST.c}점({blastClass(BLAST.c)})입니다.
            </p>
            <p className="text-muted">
              ● 보유 = 저항형/기능형 대립유전자 동형접합 · ○ 미보유 · ■ 대립유전자형만 표시(Wx, 집계 제외) · 마커 보조 선발(MAS) KASP 분석 · 유전자 위치는 IRGSP-1.0 근사값
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────── F. 개발 이력 ───────── */
function TimelineSection() {
  return (
    <section aria-label="개발 이력">
      <CanvasSectionTitle size={22} gapBelow={6} no="4" title="어떻게 만들었나" sub="개발 이력" right="SSD 단립계통법 · SNP 단일 염기 다형성 · GEBV 유전체 추정 육종가 · PYT 예비 생산력 검정 · AYT 생산력 검정" />
      <div style={{ height: u(178) }}>
        <DevTimeline />
      </div>
    </section>
  )
}

/* ───────── G. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const NOTES: ReactNode[] = [
  <>모든 수치는 가상 기관의 목업 데이터이며 실제 성적이 아닙니다. 품종명·기관명은 가상이며 실존 품종과 관계없습니다. 유전자 이름은 실제이나 보유 여부는 가상입니다.</>,
  <>
    성적: 지역 적응 시험(MET) {TRIAL.years[0]}~{TRIAL.years[1]}, {TRIAL.sites}개 지역 × {TRIAL.years.length}년 평균, 대비 품종 {CHECK.name}({MU} kg/10a = 프로그램 기준 평균). 수량은 쌀 수량(백미 기준). 출수기는 {TRIAL.sowing} 파종 기준.
  </>,
  <>
    개발 기간 {devYears}년은 GS 도입 과도기 계통(세대 진전은 전통 방식)의 실제 출원 사례이며, 현재 디지털 공정 설계값은 {f1(DIGITAL_DESIGN_YEARS)}년, 전통 공정은 {f1(CONVENTIONAL_YEARS)}년입니다.
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

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 요약(인쇄 제외) ───────── */
function Summary() {
  // conventional-vs-digital 요약 규격: 단위(굵게) + 보조 문구(muted). 숫자는 캔버스 큰 숫자와 같은 상수
  const cards = [
    { key: 'yield', label: '쌀 수량', value: formatNumber(Y.v), unit: 'kg/10a', sub: `대비 ${f1(yieldIdx)}% · ${formatSigned(diff(Y))}`, primary: true },
    { key: 'blast', label: '잎도열병 발병 지수', value: String(BLAST.v), unit: '점', sub: `${blastClass(BLAST.v)} · 대비 ${BLAST.c}점` },
    { key: 'heading', label: '출수기', value: HEADING.date!.v, unit: '', sub: `${VARIETY.maturity} · 대비 ${formatSigned(diff(HEADING))}일` },
    { key: 'dev', label: '개발 기간', value: String(devYears), unit: '년', sub: `전통보다 ${f1(savedYears)}년 짧음` },
  ]
  return (
    <div className="flex flex-col gap-2">
      <MobileSummary
        title={`신품종 ${VARIETY.name}(${VARIETY.line}) · 출원 ${VARIETY.filedAt}`}
        ariaLabel="신품종 핵심 요약"
        items={cards.map(s => ({
          key: s.key,
          label: s.label,
          value: s.value,
          primary: s.primary,
          detail: (
            <>
              {s.unit && <span className="mr-1 text-[14px] font-bold text-text">{s.unit}</span>}
              <span className="inline-block break-keep text-[14px] text-muted">{s.unit ? `· ${s.sub}` : s.sub}</span>
            </>
          ),
        }))}
        footer={
          <>
            재배 적지 {RECOMMENDED_ZONE}({f1(zoneIndex(RECOMMENDED_ZONE))}%) · 도열병 저항성 유전자 {blastNames} 보유
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
  const label = `신품종 ${VARIETY.name} 소개: 쌀 수량 ${Y.v} kg/10a로 대비 품종 ${CHECK.name} 대비 ${f1(yieldIdx)}%, 잎도열병 ${blastClass(BLAST.v)}(${blastNames} 보유), 재배 적지 ${RECOMMENDED_ZONE}, ${VARIETY.crossYear} 교배 후 ${devYears}년 만인 ${VARIETY.filedAt} 출원`
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas width={W} height={H} print="a4-portrait" minScale={MIN_SCALE} ariaLabel={label} className="bg-bg text-text" summary={<Summary />}>
        <div className="absolute inset-0 flex flex-col justify-between break-keep [&>*]:flex-none" style={{ padding: `${u(26)} ${u(PAD_X)} ${u(20)}` }}>
          <TitleBand />
          <KeyNumbers />
          <TraitSection />
          <SuitabilitySection />
          <GeneSection />
          <TimelineSection />
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}
