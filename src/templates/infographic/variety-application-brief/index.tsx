import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Printer } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, CanvasBigNumber, CanvasSectionTitle, MobileSummary, ScaledCanvas, u } from '@/design-system'
import { metZoneColor, useChartTheme, type MetZoneKey } from '@/charts'
import { formatFixed, formatNumber, formatSigned, josa } from '@/lib/format'
import {
  ALLELE_DIRECTION_NOTE,
  AS_OF,
  CHECK,
  DISTINCT_ROWS,
  DUS_REF,
  DUS_SURVEY,
  KASP_COLUMNS,
  KASP_MARKERS,
  KASP_STATUS,
  LINE,
  LINE_LABEL,
  MET,
  MIN_HOLD_CAND,
  RECOMMENDED_ZONE,
  REQUIREMENTS,
  SEED_LOTS,
  TRIAL,
  UNIFORMITY,
  ZONES,
  ZONE_AREA,
  allowedOffTypes,
  devYears,
  dusDiffs,
  dusDirection,
  f1,
  headingDate,
  markerDiff,
  metDiff,
  metIndex,
  nDistinct,
  parentage,
  s1,
  seedTotal,
  sitesOf,
  traitOf,
  uniformByYear,
  zoneIndex,
  zoneLabel,
} from './data'
import { DusPanel } from './components/DusPanel'
import { KaspGrid } from './components/KaspGrid'
import { LineageTimeline } from './components/LineageTimeline'
import { Schedule } from './components/Schedule'
import { SiteBars } from './components/SiteBars'
import { TraitLegend, TraitTable } from './components/TraitTable'
import { YEAR_W, YearBars } from './components/YearBars'
import { V_COLOR } from './components/style'

export const meta: TemplateMeta = {
  slug: 'variety-application-brief',
  category: 'infographic',
  title: '신품종 출원 요약서',
  description: '출원 예정 계통의 품종보호 출원 근거(MET 성적·안정성, 대조 품종과의 구별성, 균일성·안정성, KASP 식별 마커, 육성 경위, 출원 일정)를 내부 검토·심사 대응용 A4 세로 한 장으로 모은 인포그래픽',
  tags: ['인포그래픽', '벼', '품종보호', '출원', 'DUS', '지역 적응 시험', 'KASP', 'A4 인쇄'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const W = 1240
const H = 1754
const PAD_X = 48
/** 하한 15 논리 px가 11px 이상이 되는 배율(15 × 0.74 = 11.1) */
const MIN_SCALE = 0.74

const HEADING = traitOf('heading')
const refDiff = markerDiff(DUS_REF.id).length
const headRow = DISTINCT_ROWS.find(r => r.upov === 12)!
const tgwRow = DISTINCT_ROWS.find(r => r.upov === 38)!
const headD = dusDiffs(headRow)![0]
const tgwD = dusDiffs(tgwRow)![0]
// 연도별 값 구분은 ' / '(DUS 표의 "2025 / 2026"과 같은 기호). ' · '는 큰 글자에서 소수점처럼 읽혀 "1 · 0주"가 "1.0주"로 보였다
const offText = uniformByYear.map(r => r.off).join(' / ')
const yearsText = DUS_SURVEY.years.join(' / ')
const lsdExceeded = metDiff > MET.lsd
const surveyNote = `출원 전 자체 조사(${DUS_SURVEY.years.join('·')}, ${DUS_SURVEY.place})`
const headingShort = headingDate(HEADING.v)
const kaspNote = `KASP 마커 ${refDiff}개(식별 참고)`
const reqOk = REQUIREMENTS.filter(r => r.state === 'ok').length

/* ───────── 공통 ───────── */
/** 영역 제목(번호 배지) + 부제 한 줄 */
function Section({ no, title, sub, right, label, children, className = '', style }: { no: string; title: string; sub?: ReactNode; right?: ReactNode; label: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section aria-label={label} className={`flex min-w-0 flex-col ${className}`} style={style}>
      <CanvasSectionTitle no={no} title={title} right={right} size={20} gapBelow={sub ? 1 : 6} />
      {sub && (
        <p className="text-muted" style={{ fontSize: u(15), lineHeight: 1.3, marginBottom: u(6), paddingLeft: u(34) }}>
          {sub}
        </p>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/* ───────── A. 머리: 표제 라벨 → 큰 표제 → 부제(결론), 오른쪽에 연도별 수량 도식 ───────── */
function TitleBand() {
  return (
    <header className="grid" style={{ gridTemplateColumns: `1fr ${u(YEAR_W)}`, gap: u(24) }}>
      <div className="flex min-w-0 flex-col" style={{ gap: u(4) }}>
        <p className="font-semibold text-muted" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          신품종 출원 요약서 · {LINE.institute}
        </p>
        <div className="flex items-end" style={{ gap: u(14) }}>
          <h1 className="font-black whitespace-nowrap text-text" style={{ fontSize: u(54), lineHeight: 1, letterSpacing: '-0.03em' }}>
            <span className="font-bold text-muted" style={{ fontSize: u(26), marginRight: u(8), letterSpacing: 0 }}>
              가칭
            </span>
            &lsquo;{LINE.provisionalName}&rsquo;
          </h1>
          <span className="font-extrabold tabular-nums" style={{ fontSize: u(30), lineHeight: 1.1, color: V_COLOR, paddingBottom: u(2) }}>
            ({LINE.id})
          </span>
          <span className="text-muted" style={{ fontSize: u(15), lineHeight: 1.3, paddingBottom: u(4) }}>
            명칭은 {LINE.nameDecision} 품종 선정
            <br />
            심의에서 확정 예정
          </span>
        </div>
        <p className="font-bold text-text tabular-nums" style={{ fontSize: u(20), lineHeight: 1.3 }}>
          품종보호 요건 <span style={{ color: V_COLOR }}>{reqOk}/{REQUIREMENTS.length}</span> 충족 · 재배 적지 {zoneLabel(RECOMMENDED_ZONE)} <span style={{ color: V_COLOR }}>{f1(zoneIndex(RECOMMENDED_ZONE))}%</span> · 출원 예정 <span style={{ color: V_COLOR }}>{LINE.filingMonth}</span>
        </p>
        <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.3 }}>
          벼 · {LINE.type} · {LINE.maturity}(출수 {headingShort}) · 출원 전 · 가칭
        </p>
      </div>
      <div className="flex min-w-0 flex-col justify-between" style={{ gap: u(4) }}>
        <span className="self-end rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums" style={{ fontSize: u(15), padding: `${u(2)} ${u(10)}` }}>
          기준일 {AS_OF} · 내부 검토용
        </span>
        <YearBars />
      </div>
    </header>
  )
}

/* ───────── B. 근거 숫자 4개(공통 CanvasBigNumber compact · 라벨 위) ───────── */
const CARDS = {
  yield: { label: '쌀 수량 · MET 2년 평균', value: f1(MET.mean), unit: 'kg/10a', sub: `대비 ${CHECK.name} ${f1(metIndex)}% · ${s1(metDiff)} · LSD(5%) ${f1(MET.lsd)} ${lsdExceeded ? '초과' : '이내'}` },
  stability: { label: '안정성 · 작을수록 안정', value: `ASV ${formatFixed(MET.asv, 2)}`, unit: '', sub: `${MET.nGenotypes}개 유전자형 중 ${MET.asvRank}위 · W ${f1(MET.wPct)}% · b ${formatFixed(MET.b, 2)}` },
  distinct: { label: `구별성 · 대조 품종 ${DUS_REF.name} 대비`, value: `${nDistinct}`, unit: '형질', note: `· ${kaspNote}`, sub: `출수 ${formatSigned(headD, 0)}일 · 천립중 ${formatSigned(tgwD, 1)} g(정조) · ${DUS_SURVEY.years.length}년 모두 LSD(1%) 초과` },
  uniform: { label: '균일성 · 이형주', value: offText, unit: '주', sub: `${yearsText} · 해마다 ${UNIFORMITY.plantsPerYear}주 · 허용 ${allowedOffTypes}주` },
}

const CARD_STYLE = { size: 'compact', labelPosition: 'above', keepSegments: true } as const

function KeyNumbers() {
  return (
    <section aria-label="출원 근거 숫자">
      <div className="grid" style={{ gridTemplateColumns: '1.18fr 1.04fr 1.12fr 0.96fr', gap: u(14), height: u(144) }}>
        <CanvasBigNumber {...CARD_STYLE} primary {...CARDS.yield} />
        <CanvasBigNumber {...CARD_STYLE} {...CARDS.stability} />
        <CanvasBigNumber {...CARD_STYLE} {...CARDS.distinct} />
        <CanvasBigNumber {...CARD_STYLE} {...CARDS.uniform} />
      </div>
      <p className="text-muted" style={{ fontSize: u(15), marginTop: u(5), lineHeight: 1.3 }}>
        성적: 지역 적응 시험(MET) {TRIAL.years[0]}~{TRIAL.years[1]}, {TRIAL.sites}개 지역 × {TRIAL.years.length}년 × {TRIAL.reps}반복 · 구별성·균일성: 출원 전 자체 조사 ·{' '}
        <b className="text-text">
          대조 품종(가장 유사한 품종) {josa(DUS_REF.name, '는은')} MET 대비 품종({CHECK.name})과 다름
        </b>
      </p>
    </section>
  )
}

/* ───────── C. 품종보호 요건 점검 ───────── */
function Requirements() {
  return (
    <section aria-label="품종보호 요건 점검" className="grid border border-border bg-surface" style={{ gridTemplateColumns: `${u(138)} 1.62fr 1fr 0.98fr 0.8fr 1.18fr`, borderRadius: u(12), borderWidth: u(1.5), height: u(68) }}>
      <div className="flex flex-col justify-center border-r border-border" style={{ padding: `0 ${u(12)}` }}>
        <CanvasSectionTitle
          no="1"
          size={17}
          gapBelow={0}
          title={
            <>
              품종보호
              <br />
              요건 점검
            </>
          }
        />
      </div>
      {REQUIREMENTS.map((r, i) => {
        const ok = r.state === 'ok'
        return (
          <div key={r.key} className={`flex min-w-0 flex-col justify-center ${i > 0 ? 'border-l border-border' : ''}`} style={{ padding: `${u(4)} ${u(12)}`, gap: u(1) }}>
            <div className="flex items-center" style={{ gap: u(8) }}>
              {/* 판정 표식: ✓·△ 글리프 대신 SeverityTag와 같은 아이콘(달성 CheckCircle2, 주의 AlertTriangle) */}
              {ok ? (
                <CheckCircle2 aria-hidden className="shrink-0 text-positive" style={{ width: u(24), height: u(24) }} strokeWidth={2.5} />
              ) : (
                <AlertTriangle aria-hidden className="shrink-0 text-warning" style={{ width: u(24), height: u(24) }} strokeWidth={2.5} />
              )}
              <span className="font-extrabold text-text" style={{ fontSize: u(17) }}>
                {r.label}
              </span>
              <span className={`font-bold ${ok ? 'text-positive' : 'text-warning'}`} style={{ fontSize: u(15) }}>
                {ok ? '충족' : '진행 중'}
              </span>
            </div>
            <p className="text-text" style={{ fontSize: u(15), lineHeight: 1.2 }}>
              {r.reason}
            </p>
          </div>
        )
      })}
    </section>
  )
}

/* ───────── D. 육성 경위 ───────── */
function Pedigree() {
  const parent = (sex: '♀ 모본' | '♂ 부본', p: { id: string; name: string; note: string }) => (
    <div className="min-w-0 border border-border bg-surface" style={{ borderRadius: u(8), padding: `${u(5)} ${u(9)}`, borderWidth: u(1.5) }}>
      <div className="text-muted" style={{ fontSize: u(15) }}>
        {sex} · {p.id}
      </div>
      <div className="font-extrabold text-text" style={{ fontSize: u(18), lineHeight: 1.2 }}>
        {p.name}
      </div>
      <div className="text-muted" style={{ fontSize: u(15), lineHeight: 1.25 }}>
        {p.note}
      </div>
    </div>
  )
  return (
    <figure className="flex h-full flex-col" style={{ gap: u(4) }} aria-label={`계보: 모본 ${LINE.cross.female.name}(${LINE.cross.female.id}) × 부본 ${LINE.cross.male.name}(${LINE.cross.male.id}) → ${LINE_LABEL}`}>
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', gap: u(6) }}>
        {parent('♀ 모본', LINE.cross.female)}
        <span aria-hidden className="font-bold text-muted" style={{ fontSize: u(20) }}>
          ×
        </span>
        {parent('♂ 부본', LINE.cross.male)}
      </div>
      <div className="border border-accent/60 bg-accent/5 text-center" style={{ borderRadius: u(8), padding: `${u(2)} ${u(8)}`, borderWidth: u(2), lineHeight: 1.3 }}>
        <span className="font-medium text-muted" style={{ fontSize: u(15), marginRight: u(6) }}>
          {LINE.crossSeason} 교배 →
        </span>
        <span className="font-extrabold tabular-nums" style={{ fontSize: u(18), color: V_COLOR }}>
          {LINE.id}
        </span>
        <span className="font-semibold text-text" style={{ fontSize: u(15), marginLeft: u(6) }}>
          &lsquo;{LINE.provisionalName}&rsquo;
        </span>
      </div>
      <ul className="text-text" style={{ fontSize: u(15), lineHeight: 1.3 }}>
        <li>
          <b>모본:</b> <i>sd1</i>·<i>GS3</i> 비보유형(초형·이삭형)
        </li>
        <li>
          <b>부본:</b> <i>Pib</i>(도열병) · <i>Hd1</i> 비지연형
        </li>
      </ul>
    </figure>
  )
}

/* ───────── E. MET 성적 · 재배 적지 ───────── */
function ZoneBlock({ zone, color }: { zone: MetZoneKey; color: string }) {
  const best = zone === RECOMMENDED_ZONE
  const winner = MET.zoneWinners[zone]
  return (
    <div
      className={`grid border ${best ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}
      style={{ gridTemplateColumns: `${u(7)} 1fr`, gap: u(8), padding: `${u(4)} ${u(9)} ${u(5)} ${u(7)}`, borderRadius: u(10), borderWidth: u(best ? 2 : 1.5) }}
    >
      <span aria-hidden className="self-stretch" style={{ background: color, borderRadius: u(4) }} />
      <div className="min-w-0" style={{ lineHeight: 1.25 }}>
        <div className="flex items-baseline justify-between" style={{ gap: u(6) }}>
          <span className="font-extrabold whitespace-nowrap text-text" style={{ fontSize: u(16) }}>
            {zoneLabel(zone)}
            <span className="font-medium text-muted" style={{ fontSize: u(15), marginLeft: u(5) }}>
              {sitesOf(zone).length}곳
            </span>
          </span>
          <span className="font-extrabold tabular-nums" style={{ fontSize: u(best ? 24 : 20), color: best ? V_COLOR : undefined }}>
            {f1(zoneIndex(zone))}%
          </span>
        </div>
        {/* 판정 표식: ★·○ 글리프 대신 아이콘 + 낱말. 적지 강조는 강조색(초록은 중북부지 청록 막대와 같은 계열이라 쓰지 않는다) */}
        <div className={`flex items-center font-bold ${best ? 'text-accent' : 'text-muted'}`} style={{ fontSize: u(15), gap: u(4) }}>
          {best ? (
            <CheckCircle2 aria-hidden className="shrink-0" style={{ width: u(15), height: u(15) }} strokeWidth={2.75} />
          ) : (
            <Circle aria-hidden className="shrink-0" style={{ width: u(15), height: u(15) }} strokeWidth={2.75} />
          )}
          {best ? '재배 적지 · 메가 환경 승자' : `재배 가능 · 권역 승자 ${winner}`}
        </div>
      </div>
    </div>
  )
}

function MetSection() {
  const theme = useChartTheme()
  const south = zoneIndex('south')
  const central = zoneIndex('central')
  return (
    <Section
      no="3"
      title="MET 성적 · 재배 적지"
      label="지역 적응 시험 성적과 재배 적지"
      sub={`지역별 수량 증감(%, 대비 ${CHECK.name} = 0) · 2년 평균 · 막대 끝 = 지수 · 차(kg/10a)`}
    >
      <div className="grid h-full items-start" style={{ gridTemplateColumns: `${u(340)} 1fr`, gap: u(14) }}>
        <SiteBars />
        <div className="flex min-w-0 flex-col" style={{ gap: u(6) }}>
          {ZONES.map(z => (
            <ZoneBlock key={z.key} zone={z.key} color={metZoneColor(theme, z.key)} />
          ))}
          <p className="text-text" style={{ fontSize: u(15), lineHeight: 1.3, marginTop: u(2) }}>
            <b>재배 적지:</b> {zoneLabel(RECOMMENDED_ZONE)}({ZONE_AREA[RECOMMENDED_ZONE]}) — 이 권역 {MET.megaEvidence.n}개 환경 중 실측 1위 {MET.megaEvidence.k}회
          </p>
          <p className="text-muted" style={{ fontSize: u(15), lineHeight: 1.3 }}>
            ※ 지수는 {zoneLabel('south')}가 {f1(south - central)}%p 높지만 적지는 GGE 메가 환경 승자 기준
          </p>
        </div>
      </div>
    </Section>
  )
}

/* ───────── I. 출원 일정 + 종자 ───────── */
function ScheduleSection() {
  return (
    <Section
      no="7"
      title="출원 일정"
      label="출원 일정"
      right={
        <span className="inline-flex items-center border border-warning/60 bg-warning/10 font-bold text-text" style={{ fontSize: u(15), padding: `${u(2)} ${u(10)}`, borderRadius: u(6), borderWidth: u(1.5) }}>
          <AlertTriangle aria-hidden className="shrink-0 text-warning" style={{ width: u(15), height: u(15), marginRight: u(5) }} strokeWidth={2.75} />
          출원 전 외부 분양 금지(신규성 유지)
        </span>
      }
    >
      <Schedule />
      <p className="text-text" style={{ fontSize: u(15), marginTop: u(4), lineHeight: 1.3 }}>
        <b>종자(정조)</b>: {SEED_LOTS.map(l => `${l.id} ${formatFixed(l.bal, 0)} g`).join(' · ')}, 합 <b>{formatFixed(seedTotal, 0)} g</b> · 발아율 {SEED_LOTS.map(l => `${l.germ}%`).join(' · ')}
        <span className="text-muted">
          {' '}
          · 출원 후보 최소 보유량 {formatNumber(MIN_HOLD_CAND)} g {seedTotal >= MIN_HOLD_CAND ? '이상(충족)' : '미달'}
        </span>
      </p>
    </Section>
  )
}

/* ───────── J. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const NOTES: ReactNode[] = [
  <>모든 수치는 가상 기관의 목업 데이터이며 실제 성적·심사 결과가 아닙니다. 품종명(가칭)·기관명은 가상이고, 유전자 이름은 실제이나 보유 여부는 가상입니다.</>,
  <>
    수량은 쌀 수량(백미 기준, kg/10a). 지수 = 대비 품종 {CHECK.name}(MET 2년 평균 {f1(MET.checkMean)} kg/10a) 대비. LSD(5%)는 환경을 임의 효과로 본 G×E 오차항 기준.
  </>,
  <>구별성·균일성은 출원 전 자체 조사이며, 공식 판정은 출원 후 국립종자원 재배심사(2작기)에서 정합니다. 기준: UPOV TG/16/9(2020).</>,
  <>KASP {ALLELE_DIRECTION_NOTE}</>,
]

function Footnotes() {
  return (
    <footer className="border-t border-border text-muted" style={{ fontSize: u(15), lineHeight: 1.3, paddingTop: u(5), borderTopWidth: u(1.5) }}>
      {NOTES.map((n, i) => (
        <p key={i}>※ {n}</p>
      ))}
    </footer>
  )
}

const ARIA = `신품종 출원 요약서: ${LINE_LABEL}, ${LINE.filingMonth.slice(0, 4)}년 ${Number(LINE.filingMonth.slice(5))}월 품종보호 출원 예정. 지역 적응 시험 ${TRIAL.years.length}년 쌀 수량 ${f1(MET.mean)} kg/10a로 대비 품종 ${CHECK.name} 대비 ${f1(metIndex)}%, ${MET.nGenotypes}개 유전자형 중 가장 안정(ASV ${formatFixed(MET.asv, 2)}). 대조 품종 ${DUS_REF.name}와 ${DISTINCT_ROWS.map(r => r.label.replace(/\(.*\)/, '')).join('·')} ${nDistinct}형질이 ${DUS_SURVEY.years.length}년 모두 명확히 다르고 KASP 마커 ${refDiff}개가 다름(식별 참고). 이형주 ${uniformByYear.map(r => `${r.year}년 ${r.off}주`).join('·')}로 허용 ${allowedOffTypes}주 이하. 재배 적지 ${zoneLabel(RECOMMENDED_ZONE)}.`

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 요약 2장(인쇄 제외) ───────── */
function Summary() {
  // 요건 점검 결론은 기호(✓·△) 대신 낱말로. 390px에서 단어 중간 줄바꿈을 막으려고 break-keep
  const reqText = REQUIREMENTS.map(r => `${r.label === '품종 명칭' ? '명칭' : r.label} ${r.state === 'ok' ? '충족' : '진행 중(가칭)'}`).join(' · ')
  return (
    <div className="flex flex-col gap-3">
      <MobileSummary
        title={`${LINE_LABEL} · 출원 예정 ${LINE.filingMonth}`}
        ariaLabel="출원 근거 요약"
        items={[
          { key: 'yield', primary: true, label: CARDS.yield.label, value: CARDS.yield.value, detail: <MobileDetail unit={CARDS.yield.unit} sub={CARDS.yield.sub} /> },
          { key: 'stab', label: CARDS.stability.label, value: CARDS.stability.value, detail: <MobileDetail sub={CARDS.stability.sub} /> },
          { key: 'dist', label: CARDS.distinct.label, value: `${CARDS.distinct.value}형질`, detail: <MobileDetail sub={`${kaspNote} · ${CARDS.distinct.sub}`} /> },
          { key: 'unif', label: CARDS.uniform.label, value: `${CARDS.uniform.value}${CARDS.uniform.unit}`, detail: <MobileDetail sub={CARDS.uniform.sub} /> },
        ]}
        footer={<span className="break-keep">요건 점검: {reqText}</span>}
      />
      <MobileSummary
        title={`구별성 세부 · 대조 품종 ${DUS_REF.name}`}
        ariaLabel="구별성 세부 요약"
        items={[
          ...DISTINCT_ROWS.map(r => {
            const d = dusDiffs(r)!
            return {
              key: r.label,
              label: `${r.label} · ${DUS_SURVEY.years.join('/')}`,
              value: `${d.map(x => formatSigned(x, r.digits!)).join(' / ')}${r.unit === '일' ? '일' : ` ${r.unit}`}`,
              detail: <MobileDetail sub={`LSD(1%) ${formatFixed(r.lsd1!, 1)} · 명확한 차이(${dusDirection(r)})`} />,
            }
          }),
          {
            key: 'kasp',
            label: `KASP 마커 차이(${KASP_MARKERS.length}개 중) · 식별 참고`,
            value: KASP_COLUMNS.slice(1)
              .map(c => markerDiff(c.id).length)
              .join(' / '),
            detail: <MobileDetail sub={`${KASP_COLUMNS.slice(1).map(c => c.name).join(' / ')} · 친자 일치 ${parentage.match}/${parentage.total}`} />,
          },
          { key: 'site', label: `재배 적지 · 대비 ${CHECK.name}`, value: f1(zoneIndex(RECOMMENDED_ZONE)) + '%', detail: <MobileDetail sub={`${zoneLabel(RECOMMENDED_ZONE)} · 메가 환경 승자 · 실측 1위 ${MET.megaEvidence.k}/${MET.megaEvidence.n}`} /> },
        ]}
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
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas width={W} height={H} print="a4-portrait" minScale={MIN_SCALE} ariaLabel={ARIA} regionLabel="신품종 출원 요약서 A4 캔버스" className="bg-bg text-text" summary={<Summary />}>
        <div className="absolute inset-0 flex flex-col justify-between break-keep [&>*]:flex-none" style={{ padding: `${u(20)} ${u(PAD_X)} ${u(16)}` }}>
          <TitleBand />
          <KeyNumbers />
          <Requirements />
          <div className="grid" style={{ gridTemplateColumns: `${u(356)} 1fr`, gap: u(20), height: u(212) }}>
            <Section no="2" title="육성 경위" label="육성 경위" right={`교배 → 출원(예정) ${devYears}년`}>
              <Pedigree />
            </Section>
            <section aria-label="육성 경위 타임라인" className="flex flex-col">
              <p className="text-right text-muted" style={{ fontSize: u(15), lineHeight: 1.2, height: u(20) }}>
                SSD 단립계통법 · GS 유전체 선발 · GEBV 유전체 추정 육종가 · PYT 예비 생산력 검정 · AYT 생산력 검정
              </p>
              <div className="min-h-0 flex-1">
                <LineageTimeline />
              </div>
            </section>
          </div>
          <div className="grid" style={{ gridTemplateColumns: `${u(622)} 1fr`, gap: u(22), height: u(336) }}>
            <MetSection />
            <Section no="4" title="주요 특성" label="주요 특성" right={`MET ${TRIAL.years.length}년 평균 · 판정: 차이 > LSD(5%)`} sub={<TraitLegend />}>
              <TraitTable />
            </Section>
          </div>
          <div className="grid" style={{ gridTemplateColumns: `${u(648)} 1fr`, gap: u(22), height: u(478) }}>
            <Section no="5" title={`구별성 — 대조 품종 ${DUS_REF.name}(가장 유사한 품종)`} label="구별성과 균일성" sub={`${surveyNote} · 해마다 ${UNIFORMITY.plantsPerYear}주`}>
              <DusPanel />
            </Section>
            <Section no="6" title="KASP 식별 마커" label="KASP 식별 마커 프로필" right={`현재 값: ${KASP_STATUS.sourceNote.replace(', 추정', '')}`} sub={<RecheckChip />}>
              <KaspGrid />
            </Section>
          </div>
          <ScheduleSection />
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}

/** MobileSummary 카드 보조 줄(conventional-vs-digital 규격: 단위 bold + 보조 muted) */
function MobileDetail({ unit, sub }: { unit?: string; sub: string }) {
  return (
    <>
      {unit && <span className="text-[14px] font-bold text-text">{unit}</span>}
      <span className="block text-[14px] leading-snug text-muted">{sub}</span>
    </>
  )
}

function RecheckChip() {
  return (
    <span className="inline-flex items-center border border-info/50 bg-info/10 font-semibold text-text" style={{ fontSize: u(15), padding: `0 ${u(8)}`, borderRadius: u(6), borderWidth: u(1.5), lineHeight: 1.35 }}>
      출원 서류용 재확인: 시료 출고 {KASP_STATUS.recheck.shipped.slice(5)}({KASP_STATUS.recheck.req}) · {KASP_STATUS.recheck.state}
    </span>
  )
}
