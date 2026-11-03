import type { ReactNode } from 'react'
import { Crosshair, Dna, Printer, Scissors } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, CanvasBigNumber, CanvasSectionTitle, MobileSummary, ScaledCanvas, u, type MobileSummaryItem } from '@/design-system'
import { formatNumber, josa } from '@/lib/format'
import {
  AS_OF,
  AYT_YEAR,
  BC6_THEORY,
  CHIP_MARKERS_QC,
  CHIP_SAMPLES,
  CHIP_TOTAL,
  CM_PER_MB,
  CONVENTIONAL,
  CONV_MONTHS,
  CROSS,
  DONOR,
  DRAG_EXPECTED,
  FINAL,
  FINAL_LINE,
  FINAL_SEGMENTS,
  FLANK,
  FLANK_DIST_CM,
  FLANK_DIST_MB,
  GENS,
  INSTITUTE,
  KASP_PANEL,
  KASP_TOTAL,
  MABC_GENS,
  MABC_MONTHS,
  MONTHS_PER_GEN,
  N_POLY,
  PARENT_SAMPLES,
  POLY_PCT,
  RECURRENT,
  RESIDUAL_SEGS,
  SAMPLE_TIMING,
  SAVED,
  SAVED_SPLIT,
  SCHEDULE,
  TARGET,
  TARGET_SEG,
  TARGET_SEG_MB,
  TAT,
  THEORY_RPG,
  VERIFY_2026,
  chrLabel,
  f1,
  fmtMb,
} from './data'
import { FlowCards, SelBadge } from './components/FlowCards'
import { GenomeStrip } from './components/GenomeStrip'
import { RecoveryDots, DOTS_H, DOTS_W } from './components/RecoveryDots'
import { FinalChromosomes, CHR_H, CHR_W } from './components/FinalChromosomes'
import { TimeCompare, TIME_H, TIME_W } from './components/TimeCompare'
import { DONOR_COLOR, HERO_COLOR, RECUR_COLOR, SEL, type SelKey } from './components/style'

export const meta: TemplateMeta = {
  slug: 'mas-backcross-story',
  category: 'infographic',
  title: 'MAS 여교배 사례',
  description: '대비 품종 가람솔에 도열병 저항성 유전자 Pi9 하나만 마커 보조 여교배(MABC)로 옮긴 과정을 세대 흐름·회복률·최종 염색체·기존 대비 기간으로 보여 주는 16:9 한 장 인포그래픽',
  tags: ['인포그래픽', '벼', 'MABC', '마커 보조 선발', '여교배', '도열병', 'Pi9', '반복친 게놈 회복률', '16:9', 'A4 인쇄'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const W = 1920
const H = 1080
const PAD_X = 40
/** 하한 16 논리 px가 11px 이상이 되는 배율(16 × 0.6875 = 11). 1440px 화면에서는 잘리지 않는다 */
const MIN_SCALE = 0.6875

const RESID = RESIDUAL_SEGS[0]
const residLen = RESID ? RESID.end - RESID.start : 0
const residText = RESID ? `${chrLabel(RESID.chr)} ${RESID.dose === 1 ? '이형' : '동형'} ${fmtMb(residLen)} Mb` : ''
const theoryBc3 = THEORY_RPG.BC3F2
const V = VERIFY_2026
const headingSame = V.final.heading === V.recurrent.heading
const FINAL_GEN = GENS[GENS.length - 1]
/** 머리 오른쪽 게놈 띠 폭(논리 px) */
const STRIP_W = 880

/* ───────── A. 제목 띠 ───────── */
function Swatch({ kind }: { kind: 'r' | 'd' }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: u(26), height: u(14), borderRadius: u(3), background: kind === 'r' ? RECUR_COLOR : DONOR_COLOR }}
    />
  )
}

function TitleBand() {
  return (
    <header className="grid items-end" style={{ gridTemplateColumns: `1fr ${u(STRIP_W)}`, gap: u(28) }}>
      <div className="min-w-0">
        <p className="font-semibold text-muted" style={{ fontSize: u(17), lineHeight: 1.2 }}>
          마커 보조 여교배(MABC) 사례 · {INSTITUTE}
        </p>
        <h1 className="font-black text-text" style={{ fontSize: u(44), lineHeight: 1.08, letterSpacing: '-0.02em', marginTop: u(3) }}>
          익숙한 품종에 저항성 유전자 하나만 더하다
        </h1>
        <p className="font-semibold text-text" style={{ fontSize: u(18), marginTop: u(4), lineHeight: 1.25 }}>
          벼 · 대비 품종 <b>{RECURRENT.name}</b> + 도열병 저항성 유전자 <i className="font-bold">{TARGET.gene}</i> · <span className="tabular-nums">{CROSS.pedigree}</span>
        </p>
      </div>
      {/* 실제 도식: 최종 계통 12개 염색체를 이은 게놈 띠(공여친 단편이 얼마나 작은지 한눈에). 범례를 겸한다 */}
      <figure aria-label={`최종 계통 ${FINAL_LINE} 게놈 띠: 공여친 ${f1(FINAL_GEN.donorPct)}%, 표적 ${TARGET.gene} 주변 단편과 잔여 단편`} className="flex min-w-0 flex-col" style={{ gap: u(3) }}>
        <figcaption className="flex items-center justify-between" style={{ gap: u(12) }}>
          <span className="font-bold text-text" style={{ fontSize: u(17) }}>
            최종 계통 {FINAL_LINE} 게놈 <span className="tabular-nums">· 공여친 {f1(FINAL_GEN.donorPct)}%</span>
          </span>
          <span className="rounded-sm border border-border bg-surface-2 font-semibold text-text tabular-nums" style={{ fontSize: u(16), padding: `${u(2)} ${u(10)}` }}>
            기준일 {AS_OF}
          </span>
        </figcaption>
        <div style={{ height: u(24) }}>
          <GenomeStrip segments={FINAL_SEGMENTS} width={STRIP_W} height={24} />
        </div>
        <div className="flex items-center text-text" style={{ fontSize: u(16), gap: u(18) }}>
          <span className="flex items-center" style={{ gap: u(8) }}>
            <Swatch kind="r" />
            <span>
              <b>{RECURRENT.name}(반복친)</b> <span className="text-muted">되풀이 교배하는 품종</span>
            </span>
          </span>
          <span className="flex items-center" style={{ gap: u(8) }}>
            <Swatch kind="d" />
            <span>
              <b className="tabular-nums">{DONOR.name}(공여친)</b> <span className="text-muted">유전자를 주는 계통</span>
            </span>
          </span>
        </div>
      </figure>
    </header>
  )
}

/* ───────── B. 큰 숫자(공통 CanvasBigNumber 기본 규격) ───────── */
function KeyNumbers() {
  return (
    <section aria-label="핵심 숫자" className="grid" style={{ gridTemplateColumns: '1.15fr 1.05fr 1.15fr 0.9fr', gap: u(16), height: u(138) }}>
      <CanvasBigNumber
        primary
        value={f1(FINAL.rpg)}
        unit="%"
        label="반복친 게놈 회복률(RPG) — 가람솔로 돌아온 정도"
        sub={
          <>
            BC3 이론 {theoryBc3}% · 기존 BC6 이론 {f1(BC6_THEORY)}%와 같은 수준
          </>
        }
      />
      <CanvasBigNumber
        value={`${SAVED.gens}세대 · ${SAVED.months}`}
        unit="개월"
        label="기존 여교배보다 단축"
        sub={
          <>
            기존 {CONVENTIONAL.generations}세대 {CONV_MONTHS}개월 → MABC {MABC_GENS}세대 {MABC_MONTHS}개월
          </>
        }
      />
      <CanvasBigNumber
        value={fmtMb(TARGET_SEG_MB)}
        unit="Mb"
        label={
          <>
            <i>{TARGET.gene}</i> 주변 공여친 단편(짧을수록 좋음)
          </>
        }
        sub={
          <>
            연관 끌림(linkage drag, 표적 옆 공여친 유전자가 딸려 옴)
            <br />· 기존 BC6 기대 {fmtMb(DRAG_EXPECTED.bc6)} Mb
          </>
        }
      />
      <CanvasBigNumber
        value={`${V.final.blast}`}
        unit="점"
        label="잎도열병 발병 지수(0~9, 낮을수록 강함)"
        sub={
          <>
            {RECURRENT.name} {V.recurrent.blast} · 출수 {V.final.heading}일 {headingSame ? '같음' : `(${RECURRENT.name} ${V.recurrent.heading}일)`}
          </>
        }
      />
    </section>
  )
}

/* ───────── C. 세대 흐름 ───────── */
const SEL_ICON: Record<SelKey, ReactNode> = {
  fg: <Crosshair aria-hidden style={{ width: u(18), height: u(18) }} />,
  rec: <Scissors aria-hidden style={{ width: u(18), height: u(18) }} />,
  bg: <Dna aria-hidden style={{ width: u(18), height: u(18) }} />,
}

function SelLegend() {
  return (
    <div className="flex items-center text-text" style={{ gap: u(20), fontSize: u(17) }}>
      {(['fg', 'rec', 'bg'] as SelKey[]).map(k => (
        <span key={k} className="flex items-center whitespace-nowrap" style={{ gap: u(6) }}>
          <SelBadge k={k} size={24} />
          <span style={{ color: SEL[k].color }} className="flex">
            {SEL_ICON[k]}
          </span>
          <b>{SEL[k].name}</b>
          <span className="text-muted">“{SEL[k].plain}”</span>
        </span>
      ))}
    </div>
  )
}

function FlowSection() {
  const firstChip = SCHEDULE[2]
  return (
    <section aria-label="세대 흐름" className="flex flex-col" style={{ height: u(376) }}>
      <CanvasSectionTitle title="어떻게 했나 — 마커로 세 번 고르며 세대를 진전" sub={undefined} right={<SelLegend />} size={22} gapBelow={8} />
      <div className="min-h-0 flex-1">
        <FlowCards />
      </div>
      <div className="text-muted" style={{ fontSize: u(16), marginTop: u(6), lineHeight: 1.35 }}>
        <p className="truncate">
          세 번 모두 마커 보조 선발(MAS) · ①② KASP(경쟁적 대립유전자 특이 PCR): <b className="text-text">KASP {KASP_PANEL}마커 패널의 <i>{TARGET.gene}</i> 마커</b> + 측면 마커(표적 양옆 표지) {FLANK.leftName}·{FLANK.rightName}, <b className="text-text">{formatNumber(KASP_TOTAL)}개체</b> · ③ 6K 단일 염기 다형성(SNP) 칩: <b className="text-text">{formatNumber(CHIP_TOTAL)}개체</b>(+ 양친 {PARENT_SAMPLES}), 다형성 SNP {formatNumber(N_POLY)} / {formatNumber(CHIP_MARKERS_QC)}({f1(POLY_PCT)}%)
        </p>
        <p className="truncate">
          개화 전 회신: KASP 결과 파종 {SAMPLE_TIMING.kaspDay}일(채취 {SAMPLE_TIMING.sampleDay} + 시료 준비 {SAMPLE_TIMING.kaspPrep} + TAT {TAT.kasp}일) → 6K +{SAMPLE_TIMING.chipLag}일(시료 준비 {SAMPLE_TIMING.chipPrep} + TAT {TAT.chip}일) → 여교배 파종 {SAMPLE_TIMING.crossDay}일 무렵({firstChip.gen} 기준)
        </p>
      </div>
    </section>
  )
}

/* ───────── D. 하단 3패널 ───────── */
function Panel({ title, sub, width, children, caption }: { title: string; sub?: ReactNode; width: number; children: ReactNode; caption: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col" style={{ width: u(width) }}>
      <CanvasSectionTitle title={title} sub={sub} size={20} gapBelow={6} />
      {children}
      <div className="text-muted" style={{ fontSize: u(16), lineHeight: 1.3, marginTop: u(4) }}>
        {caption}
      </div>
    </section>
  )
}

const D1_W = 568
const D2_W = 664
const D3_W = 552

function RecoveryPanel() {
  return (
    <Panel
      title="가람솔로 얼마나 돌아왔나"
      sub={<span style={{ fontSize: u(16) }}> · 반복친 게놈 회복률</span>}
      width={D1_W}
      caption={
        <>
          ◇ 이론값 BCt = 1 − (1/2)^(t+1) · 자식 세대 이론값 = BC3({theoryBc3}%)
          <br />선발한 부모 덕분에 자손 평균이 이론값보다 높다(자손 기대 = 50 + 부모 회복률/2)
        </>
      }
    >
      <div style={{ height: u((D1_W * DOTS_H) / DOTS_W) }}>
        <RecoveryDots />
      </div>
      <table className="sr-only">
        <caption>세대별 반복친 게놈 회복률(%)</caption>
        <thead>
          <tr>
            <th>세대</th>
            <th>6K 분석 개체 수</th>
            <th>평균</th>
            <th>선발 개체</th>
            <th>이론값</th>
          </tr>
        </thead>
        <tbody>
          {GENS.map(g => (
            <tr key={g.gen}>
              <td>{g.gen}</td>
              <td>{g.chipN}</td>
              <td>{f1(g.chipMean)}</td>
              <td>{g.selected.map(s => `${s.id} ${f1(s.rpg)}`).join(', ')}</td>
              <td>{g.theory}</td>
            </tr>
          ))}
          <tr>
            <td>기존 BC6 이론</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>{f1(BC6_THEORY)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  )
}

function ChromosomePanel() {
  return (
    <Panel
      title={`최종 계통 ${FINAL_LINE}(BC3F2 선발 → BC3F3) — 6K 칩 판독`}
      width={D2_W}
      caption={
        <>
          <span className="text-text">
            <span aria-hidden style={{ color: DONOR_COLOR }}>■</span> 공여친형 동형 · <span aria-hidden style={{ color: DONOR_COLOR }}>▤</span> 이형 ·{' '}
            <span aria-hidden style={{ color: RECUR_COLOR }}>■</span> 가람솔형
          </span>{' '}
          · 잔여 단편 {residText} — BC3F3 계통 안에서 분리 중, 가람솔형 동형 개체를 골라 {AYT_YEAR} AYT 전에 고정 · 기대값 = 전경 선발만 한 여교배 모의 {formatNumber(DRAG_EXPECTED.reps)}회 평균
        </>
      }
    >
      <div style={{ height: u((D2_W * CHR_H) / CHR_W) }}>
        <FinalChromosomes />
      </div>
      <table className="sr-only">
        <caption>{FINAL_LINE} 공여친 단편(6K 칩 판독)</caption>
        <thead>
          <tr>
            <th>염색체</th>
            <th>구간(Mb)</th>
            <th>길이(Mb)</th>
            <th>유전형</th>
          </tr>
        </thead>
        <tbody>
          {FINAL_SEGMENTS.map(s => (
            <tr key={`${s.chr}-${s.start}`}>
              <td>{chrLabel(s.chr)}</td>
              <td>
                {s.start.toFixed(2)}~{s.end.toFixed(2)}
              </td>
              <td>{fmtMb(s.end - s.start)}</td>
              <td>
                {s.dose === 2 ? '공여친형 동형' : '이형'}
                {s === TARGET_SEG ? ` (${TARGET.gene} ${TARGET.mb} Mb 포함, 측면 마커 ${FLANK.left.toFixed(2)}·${FLANK.right.toFixed(2)} 사이)` : ''}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>연관 끌림 기대(모의 {formatNumber(DRAG_EXPECTED.reps)}회 평균)</td>
            <td colSpan={2}>
              기존 BC6 {fmtMb(DRAG_EXPECTED.bc6)} · 재조합 선발 없는 BC3 {fmtMb(DRAG_EXPECTED.bc3)} · 이 사례 {fmtMb(TARGET_SEG_MB)}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  )
}

function ComparePanel() {
  return (
    <Panel
      title="기존 여교배보다 얼마나 빨랐나"
      width={D3_W}
      caption={
        <>
          기존 여교배 가정: 도열병 접종 검정으로 고르는 표현형 선발, 세대당 {CONVENTIONAL.monthsPerGen}개월(연 2세대), 배경 선발 없음(추정)
        </>
      }
    >
      <div style={{ height: u((D3_W * TIME_H) / TIME_W) }}>
        <TimeCompare />
      </div>
      <div className="text-text" style={{ fontSize: u(17), lineHeight: 1.35, marginTop: u(4) }}>
        <p>
          <b className="text-positive">{SAVED.months}개월 단축</b> = 세대 수 감소 {SAVED_SPLIT.genCount}개월 + 세대 주기 단축 {SAVED_SPLIT.pace}개월
        </p>
        <p>
          회복률: 기존 BC6 이론 <b>{f1(BC6_THEORY)}%</b> ↔ MABC BC3F2 실측 <b style={{ color: HERO_COLOR }}>{f1(FINAL.rpg)}%</b>({SAVED.gens}세대 적게)
        </p>
      </div>
    </Panel>
  )
}

/* ───────── E. 각주(캔버스·요약 카드가 같은 문구를 쓴다) ───────── */
const NOTES: ReactNode[] = [
  <>모든 수치는 가상 기관의 목업 데이터입니다. 품종명·계통명·기관명은 가상이며, 유전자 이름(<i>{TARGET.gene}</i>)은 실제이나 보유 여부와 결과는 가상입니다.</>,
  <>
    회복률: 6K SNP 칩 {formatNumber(CHIP_MARKERS_QC)} 마커 중 양친 다형성 {formatNumber(N_POLY)} SNP, 운반 염색체 포함 전 게놈, (2·가람솔형 동형 + 이형) / (2 × {formatNumber(N_POLY)}). 이론값 BCt = 1 − (1/2)^(t+1). 측면 마커 {FLANK.leftName}·{FLANK.rightName.slice(-2)}는 <i>{TARGET.gene}</i>에서 각 {f1(FLANK_DIST_MB)} Mb(약 {f1(FLANK_DIST_CM)} cM, {f1(CM_PER_MB)} cM/Mb 가정). 기대 연관 끌림은 전경 선발만 한 여교배 모의 {formatNumber(DRAG_EXPECTED.reps)}회 평균. 6K 분석 {formatNumber(CHIP_SAMPLES)}샘플(양친 포함, 외부 위탁).
  </>,
  <>
    기존 여교배는 도열병 접종 검정으로 고르는 표현형 선발, 세대당 {CONVENTIONAL.monthsPerGen}개월(연 2세대) 가정(추정)입니다. {SAVED.months}개월 단축 = 세대 수 감소 {SAVED_SPLIT.genCount}개월({SAVED.gens}세대 × {f1(MONTHS_PER_GEN)}개월) + 세대 주기 단축 {SAVED_SPLIT.pace}개월. 검증 형질은 2026 비반복 관찰 포장(파종 {Number(SCHEDULE[6].sow!.slice(5, 7))}월 {Number(SCHEDULE[6].sow!.slice(8, 10))}일) 값이며 수량성은 {AYT_YEAR} 생산력 검정(AYT)에서 확인합니다.
  </>,
]

function Footnotes() {
  return (
    <footer className="border-t border-border text-muted" style={{ fontSize: u(16), lineHeight: 1.3, paddingTop: u(5), borderTopWidth: u(1.5) }}>
      {NOTES.map((n, i) => (
        <p key={i}>※ {n}</p>
      ))}
    </footer>
  )
}

/* ───────── 캔버스가 잘리는 폭(390·768): 캔버스 위 요약(인쇄 제외) ───────── */
function Summary() {
  const cards: MobileSummaryItem[] = [
    { key: 'rpg', label: '반복친 게놈 회복률', value: `${f1(FINAL.rpg)}%`, sub: `BC3 이론 ${theoryBc3}%`, primary: true },
    { key: 'time', label: '기존 여교배보다 단축', value: `${SAVED.months}개월`, sub: `${SAVED.gens}세대 단축 · ${CONV_MONTHS} → ${MABC_MONTHS}개월` },
    {
      key: 'drag',
      label: (
        <>
          <i>{TARGET.gene}</i> 주변 공여친 단편
        </>
      ),
      value: `${fmtMb(TARGET_SEG_MB)} Mb`,
      sub: `기존 BC6 기대 ${fmtMb(DRAG_EXPECTED.bc6)} Mb`,
    },
    { key: 'blast', label: '잎도열병 발병 지수', value: `${V.final.blast}점`, sub: `${RECURRENT.name} ${V.recurrent.blast}` },
  ].map(({ sub, ...c }) => ({ ...c, detail: <span className="text-[14px] text-muted">{sub}</span> }))
  return (
    <div className="flex flex-col gap-2">
      <MobileSummary
      title={
        <>
          MAS 여교배 사례 · {RECURRENT.name} + <i>{TARGET.gene}</i>
        </>
      }
      items={cards}
      footer={
        <>
          {RECURRENT.name}에 <i>{TARGET.gene}</i>만 더했습니다: 출수 {V.final.heading}일, 간장 {V.final.culm} cm로 {josa(RECURRENT.name, '와과')} 비슷
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
  const label =
    `마커 보조 여교배 사례: 대비 품종 ${RECURRENT.name}에 도열병 저항성 유전자 ${josa(TARGET.gene, '를을')} ${DONOR.name}에서 도입. ` +
    `전경·재조합·배경 선발로 BC3F2 최종 계통 ${FINAL_LINE}의 반복친 게놈 회복률 ${f1(FINAL.rpg)}%(BC3 이론 ${theoryBc3}%), ` +
    `${TARGET.gene} 주변 공여친 단편 ${fmtMb(TARGET_SEG_MB)} Mb, 기존 여교배 ${CONVENTIONAL.generations}세대 ${CONV_MONTHS}개월 대비 ${MABC_GENS}세대 ${MABC_MONTHS}개월로 ` +
    `${SAVED.gens}세대·${SAVED.months}개월 단축, 잎도열병 발병 지수 ${V.final.blast}(${RECURRENT.name} ${V.recurrent.blast})`
  return (
    <div className="flex flex-col gap-3">
      <div data-print-hide="" className="flex justify-end">
        <Button icon={<Printer aria-hidden className="h-4 w-4" />} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      </div>
      <ScaledCanvas width={W} height={H} print="a4-landscape" minScale={MIN_SCALE} ariaLabel={label} className="bg-bg text-text" summary={<Summary />}>
        <div className="absolute inset-0 flex flex-col justify-between break-keep [&>*]:flex-none" style={{ padding: `${u(18)} ${u(PAD_X)} ${u(12)}` }}>
          <TitleBand />
          <KeyNumbers />
          <FlowSection />
          <div className="flex justify-between" style={{ gap: u(28) }}>
            <RecoveryPanel />
            <ChromosomePanel />
            <ComparePanel />
          </div>
          <Footnotes />
        </div>
      </ScaledCanvas>
    </div>
  )
}
