import { Fragment, type ReactNode } from 'react'
import { u } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  CHR_LEN_MB,
  CROSS,
  DONOR,
  F1_N,
  FINAL_LINE,
  GENS,
  N_FINAL_LINES,
  N_POLY,
  PARENT_SAMPLES,
  RECURRENT,
  SCHEDULE,
  TARGET,
  VERIFY_2026,
  VERIFY_DONE,
  AYT_YEAR,
  f1,
  theoryBc,
  type GenSummary,
  type Segment,
} from '../data'
import { GenomeStrip } from './GenomeStrip'
import { DONOR_COLOR, HERO_COLOR, SEL, tint, type SelKey } from './style'

export const FLOW_W = 1840
const ARROW_W = 24
const CARD_FR = [0.9, 0.78, 1, 1, 1, 1, 1.12]
const FR_UNIT = (FLOW_W - ARROW_W * (CARD_FR.length - 1)) / CARD_FR.reduce((a, b) => a + b, 0)
// 카드 좌우 안쪽 여백. 12 → 10(2026-11-03): BC3F2 「회복률 … · 99.1 · 99.1」 줄이 최소 배율에서 여유 4.7px뿐이라
// 리눅스(CI) 글꼴 폭에서 카드 밖으로 2px 넘쳤다. 카드 높이는 고정이라 줄바꿈 대신 가로 여유를 만든다.
const PAD = 10
const innerW = (i: number) => Math.round(CARD_FR[i] * FR_UNIT - PAD * 2 - 3)

const STAGE_NO = ['①', '②', '③', '④', '⑤', '⑥', '⑦']
const ym = (d: string | null) => (d ? d.slice(0, 7).replace('-', '.') : '')

const ALL_DONOR_HOM: Segment[] = CHR_LEN_MB.map((l, i) => ({ chr: i + 1, start: 0, end: l, dose: 2, nMarkers: 0 }))
const ALL_DONOR_HET: Segment[] = CHR_LEN_MB.map((l, i) => ({ chr: i + 1, start: 0, end: l, dose: 1, nMarkers: 0 }))

export function SelBadge({ k, size = 22 }: { k: SelKey; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center font-extrabold"
      style={{ width: u(size), height: u(size), borderRadius: u(size), background: SEL[k].color, color: 'var(--color-surface)', fontSize: u(Math.max(16, size * 0.62)), lineHeight: 1 }}
    >
      {SEL[k].no.charCodeAt(0) - 0x245f}
    </span>
  )
}

function CardShell({ i, title, period, children, strong = false }: { i: number; title: ReactNode; period: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <article
      className={`relative flex min-w-0 flex-col border ${strong ? 'border-accent/60 bg-surface' : 'border-border bg-surface'}`}
      style={{ padding: `${u(8)} ${u(PAD)} ${u(8)}`, borderRadius: u(12), borderWidth: u(strong ? 2 : 1.5), gap: u(4) }}
    >
      <header className="flex items-baseline justify-between" style={{ gap: u(6) }}>
        <h3 className="flex items-baseline font-extrabold text-text whitespace-nowrap" style={{ fontSize: u(21), gap: u(6), lineHeight: 1.15 }}>
          <span className="text-muted" style={{ fontSize: u(20) }}>
            {STAGE_NO[i]}
          </span>
          {title}
        </h3>
      </header>
      <p className="text-muted tabular-nums whitespace-nowrap" style={{ fontSize: u(16), lineHeight: 1.2, marginTop: u(-4) }}>
        {period}
      </p>
      {children}
    </article>
  )
}

function FunnelRow({ k, label, value, frac, note }: { k: SelKey | 'n' | 'sel'; label: ReactNode; value: ReactNode; frac: number | null; note?: ReactNode }) {
  const color = k === 'n' ? 'var(--viz-chr-b)' : k === 'sel' ? HERO_COLOR : SEL[k].color
  return (
    <div className="relative grid items-center" style={{ gridTemplateColumns: `${u(22)} 1fr auto`, gap: u(6), height: u(22), fontSize: u(16) }}>
      {frac !== null && (
        <span aria-hidden className="absolute inset-y-0" style={{ left: u(28), width: `calc((100% - ${u(28)}) * ${Math.max(frac, 0.012)})`, background: tint(color, 22), borderRadius: u(3) }} />
      )}
      <span className="relative flex justify-center">
        {k === 'n' ? (
          <span aria-hidden className="font-bold whitespace-nowrap text-muted" style={{ fontSize: u(16) }}>
            재배
          </span>
        ) : k === 'sel' ? (
          <span aria-hidden className="font-black" style={{ color: HERO_COLOR, fontSize: u(18) }}>
            ◆
          </span>
        ) : (
          <SelBadge k={k} />
        )}
      </span>
      <span className="relative min-w-0 truncate text-text" style={{ paddingLeft: u(2) }}>
        {label}
        {note && (
          <span className="text-muted" style={{ marginLeft: u(4) }}>
            {note}
          </span>
        )}
      </span>
      <span className="relative font-bold text-text tabular-nums" style={{ paddingRight: u(4) }}>
        {value}
      </span>
    </div>
  )
}

function Strip({ i, segments, caption }: { i: number; segments: Segment[]; caption: ReactNode }) {
  return (
    <div className="mt-auto">
      <div style={{ height: u(20), width: '100%' }}>
        <GenomeStrip segments={segments} width={innerW(i)} height={20} />
      </div>
      <p className="tabular-nums text-text whitespace-nowrap" style={{ fontSize: u(16), marginTop: u(3), lineHeight: 1.2 }}>
        {caption}
      </p>
    </div>
  )
}

function recNote(g: GenSummary) {
  if (g.gen === 'BC1F1') return `(왼 ${g.recL} · 오 ${g.recR})`
  if (g.gen === 'BC2F1') return '(양쪽)'
  return '· 측면 고정됨'
}

function BcCard({ g, i }: { g: GenSummary; i: number }) {
  const sch = SCHEDULE.find(s => s.gen === g.gen)!
  const self = g.gen === 'BC3F2'
  const sel = g.selected.length
  return (
    <CardShell i={i} title={g.gen} period={`${ym(sch.sow)} 파종 → ${ym(sch.seed)} 종자`}>
      <div className="flex flex-col" style={{ gap: u(1) }}>
        <FunnelRow k="n" label="개체" value={formatNumber(g.n)} frac={1} />
        <FunnelRow k="fg" label={<>전경(<i>{TARGET.gene}</i> {self ? '동형' : '이형'})</>} value={formatNumber(g.carriers)} frac={g.carriers / g.n} />
        <FunnelRow k="rec" label="재조합" note={recNote(g)} value={formatNumber(g.rec)} frac={g.rec / g.n} />
        <FunnelRow k="bg" label="6K 분석" value={formatNumber(g.chipN)} frac={g.chipN / g.n} />
        <FunnelRow k="sel" label={self ? `선발 상위 ${N_FINAL_LINES}계통` : `선발 ${g.best.id.slice(-3)}번`} value={formatNumber(sel)} frac={null} />
      </div>
      <div className="flex items-baseline justify-between" style={{ marginTop: u(2), gap: u(4) }}>
        <p className="tabular-nums whitespace-nowrap" style={{ lineHeight: 1.1 }}>
          <span className="text-muted" style={{ fontSize: u(16), marginRight: u(4) }}>
            회복률
          </span>
          <span className="font-extrabold" style={{ color: HERO_COLOR, fontSize: u(30), letterSpacing: '-0.01em' }}>
            {f1(g.best.rpg)}
          </span>
          <span className="font-bold text-text" style={{ fontSize: u(18), marginLeft: u(2) }}>
            %
          </span>
        </p>
        <span className="text-muted tabular-nums whitespace-nowrap" style={{ fontSize: u(16) }}>
          {self ? g.selected.slice(1).map(s => f1(s.rpg)).join(' · ') : `이론 ${g.theory}`}
        </span>
      </div>
      <Strip
        i={i}
        segments={g.segments}
        caption={
          <>
            <span aria-hidden style={{ color: DONOR_COLOR }}>■</span> 공여친 <b>{f1(g.donorPct)}%</b> · 단편 {g.segCount}개
          </>
        }
      />
    </CardShell>
  )
}

function CrossCard() {
  const s = SCHEDULE[0]
  return (
    <CardShell i={0} title="교배" period={s.note}>
      <div className="flex flex-col text-text" style={{ fontSize: u(17), lineHeight: 1.3, gap: u(2) }}>
        <span>
          ♀ <b>{RECURRENT.name}</b>
        </span>
        <span>
          ♂ <b className="tabular-nums">{DONOR.name}</b>
        </span>
        <span className="text-muted" style={{ fontSize: u(16) }}>
          {CROSS.id} · F1 종자 {ym(s.seed)}
          <br />양친 {PARENT_SAMPLES} 6K → 다형성 {formatNumber(N_POLY)}
        </span>
      </div>
      <div className="mt-auto flex flex-col" style={{ gap: u(4) }}>
        <div>
          <p className="text-muted" style={{ fontSize: u(16), lineHeight: 1.2 }}>
            {RECURRENT.name}
          </p>
          <div style={{ height: u(16) }}>
            <GenomeStrip segments={[]} width={innerW(0)} height={16} />
          </div>
        </div>
        <div>
          <p className="text-muted" style={{ fontSize: u(16), lineHeight: 1.2 }}>
            {DONOR.name}
          </p>
          <div style={{ height: u(16) }}>
            <GenomeStrip segments={ALL_DONOR_HOM} width={innerW(0)} height={16} />
          </div>
        </div>
      </div>
    </CardShell>
  )
}

function F1Card() {
  const s = SCHEDULE[1]
  return (
    <CardShell i={1} title="F1" period={`${ym(s.sow)} → ${ym(s.seed)}`}>
      <div className="flex flex-col" style={{ gap: u(1) }}>
        <FunnelRow k="n" label="개체" value={formatNumber(F1_N)} frac={1} />
        <FunnelRow k="fg" label="진위 확인" value={formatNumber(F1_N)} frac={1} />
        <FunnelRow k="rec" label="—" value="" frac={null} />
        <FunnelRow k="bg" label="—" value="" frac={null} />
        <FunnelRow k="sel" label="여교배 ♂친" value="" frac={null} />
      </div>
      <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.3 }}>
        모두 <i>{TARGET.gene}</i> 이형
        <br />
        <span className="text-muted">회복률 {theoryBc(0)}%(이론)</span>
      </p>
      <Strip i={1} segments={ALL_DONOR_HET} caption={<span className="text-muted">전 게놈 이형</span>} />
    </CardShell>
  )
}

function VerifyCard() {
  const s = SCHEDULE[6]
  const V = VERIFY_2026
  const rows: { label: string; unit: string; f: number; r: number; d: number }[] = [
    { label: '잎도열병', unit: '점', f: V.final.blast, r: V.recurrent.blast, d: V.donor.blast },
    { label: '출수', unit: '일', f: V.final.heading, r: V.recurrent.heading, d: V.donor.heading },
    { label: '간장', unit: 'cm', f: V.final.culm, r: V.recurrent.culm, d: V.donor.culm },
  ]
  const cols = `${u(64)} 1fr 1fr 1fr`
  return (
    <CardShell i={6} title="검증 BC3F3" period={`${ym(s.sow)} 파종 → ${ym(VERIFY_DONE)} 정리`} strong>
      <p className="text-text" style={{ fontSize: u(16), lineHeight: 1.25 }}>
        <b>{N_FINAL_LINES}계통</b> 관찰 포장 · <i>{TARGET.gene}</i> 동형 확인
      </p>
      <div role="table" aria-label={`2026 관찰 포장 검증: ${FINAL_LINE} / ${RECURRENT.name} / ${DONOR.name}`} style={{ fontSize: u(16) }}>
        <div role="row" className="grid border-b border-border font-bold text-muted" style={{ gridTemplateColumns: cols, paddingBottom: u(2), borderBottomWidth: u(1.5) }}>
          <span role="columnheader">형질</span>
          <span role="columnheader" className="text-right" style={{ color: HERO_COLOR }}>
            최종
          </span>
          <span role="columnheader" className="text-right">
            {RECURRENT.name}
          </span>
          <span role="columnheader" className="text-right">
            공여친
          </span>
        </div>
        {rows.map(r => (
          <div role="row" key={r.label} className="grid items-baseline border-b border-border tabular-nums" style={{ gridTemplateColumns: cols, height: u(24) }}>
            <span role="rowheader" className="text-text">
              {r.label}
            </span>
            <span role="cell" className="text-right font-extrabold" style={{ color: HERO_COLOR, fontSize: u(18) }}>
              {r.f}
              <span className="font-semibold text-muted" style={{ fontSize: u(16) }}>
                {r.unit}
              </span>
            </span>
            <span role="cell" className="text-right text-text">
              {r.r}
            </span>
            <span role="cell" className="text-right text-muted">
              {r.d}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto text-text" style={{ fontSize: u(16), lineHeight: 1.3 }}>
        <p>
          선발 <b style={{ color: HERO_COLOR }}>{FINAL_LINE}</b>
        </p>
        <p className="text-muted">
          공여친 = {DONOR.name} · {AYT_YEAR} 생산력 검정(AYT) 편입 예정
        </p>
      </div>
    </CardShell>
  )
}

function Arrow() {
  return (
    <div aria-hidden className="flex items-center justify-center text-muted">
      <svg viewBox="0 0 24 24" style={{ width: u(22), height: u(22) }}>
        <path d="M5 12 H18 M13 6 L19 12 L13 18" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
      </svg>
    </div>
  )
}

export function FlowCards() {
  const cards = [<CrossCard key="c" />, <F1Card key="f1" />, ...GENS.map((g, k) => <BcCard key={g.gen} g={g} i={k + 2} />), <VerifyCard key="v" />]
  const template = CARD_FR.map(fr => `${fr}fr`).join(` ${u(ARROW_W)} `)
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: template }}>
      {cards.map((c, k) => (
        <Fragment key={k}>
          {k > 0 && <Arrow />}
          {c}
        </Fragment>
      ))}
    </div>
  )
}
