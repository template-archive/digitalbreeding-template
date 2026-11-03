import { CircleSlash, PauseCircle, Sprout, ArrowUpRight } from 'lucide-react'
import { Card } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { MET, MET_TARGET, SEED_MET_G, TEST_MEAN, type Decisions, type Summary } from '../data'
import { REC_TEXT, f1, fGebv } from './ui'

/** I. 결정 요약 — 진급·보류·탈락 3칸(미저장 포함 현재 결정) */
export function DecisionSummary({ s, decisions, onSelect }: { s: Summary; decisions: Decisions; onSelect: (name: string) => void }) {
  const pm = s.promotedMean
  const chip = (name: string, warn = false) => (
    <li key={name}>
      <button
        type="button"
        onClick={() => onSelect(name)}
        className="touch-hit inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-medium tabular-nums text-text hover:bg-surface-2"
      >
        {name}
        {warn && <Sprout size={11} aria-label="종자 주의" className="text-warning" />}
      </button>
    </li>
  )
  const dr = s.dropReasons
  const shortfall = MET_TARGET - s.promote
  const undecidedLine = (n: number, label: string) => (
    <p className="mt-auto border-t border-border pt-2 text-xs tabular-nums text-muted">
      미결정 {s.undecided}계통 중 자동 판정 {label} <b className="text-text">{n}</b>
    </p>
  )
  return (
    <Card title="결정 요약" subtitle={`현재 결정 기준(미저장 포함) · 미결정 ${s.undecided}(자동 판정: 진급 ${s.undecidedRec.promote} · 보류 ${s.undecidedRec.hold} · 탈락 ${s.undecidedRec.drop})`}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section aria-label="진급" className="flex flex-col gap-2 rounded-md border border-border p-3">
          <h3 className="flex items-baseline justify-between text-sm font-semibold text-text">
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpRight size={15} aria-hidden="true" className={`self-center ${REC_TEXT.promote}`} />
              진급 → {MET.year} MET
            </span>
            <span className="tabular-nums">
              <b className="text-2xl font-extrabold">{s.promote}</b>
              <span className="text-xs text-muted"> / 목표 {MET_TARGET}</span>
            </span>
          </h3>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${s.promote > MET_TARGET ? 'bg-warning' : 'bg-positive'}`} style={{ width: `${Math.min(100, (100 * s.promote) / MET_TARGET)}%` }} />
          </div>
          <p className="text-xs tabular-nums text-muted">
            {shortfall > 0 ? `목표까지 ${shortfall} 부족` : shortfall === 0 ? '목표 달성' : `목표 초과 ${-shortfall}`} · 예상(미결정 = 자동 판정) {s.expected.promote}
          </p>
          <ul className="flex flex-wrap gap-1.5 touch:gap-2" aria-label="진급 계통(진급 지수 순)">
            {s.promoted.map(l => chip(l.name, l.seedWarn))}
          </ul>
          {pm && (
            <p className="text-xs leading-relaxed tabular-nums text-text">
              평균 쌀 수량 <b>{f1(pm.yield)}</b> kg/10a · 지수 <b>{f1(pm.idx)}</b> · GEBV <b>{fGebv(pm.gebv)}</b>
              <span className="text-muted">
                {' '}
                (시험 40계통 {f1(TEST_MEAN.yield)} · {f1(TEST_MEAN.idx)} · {fGebv(TEST_MEAN.gebv)})
              </span>
            </p>
          )}
          <p className="text-xs tabular-nums text-muted">
            MET 준비 종자 {formatNumber(SEED_MET_G)} g × {s.promote} = {formatNumber(SEED_MET_G * s.promote)} g · 종자 주의{' '}
            <b className={s.promotedSeedWarn.length ? 'text-warning' : 'text-text'}>{s.promotedSeedWarn.length}</b>
            {s.promotedSeedWarn.length > 0 && `(${s.promotedSeedWarn.map(l => l.name).join(', ')})`}
          </p>
          {undecidedLine(s.undecidedRec.promote, '진급')}
        </section>

        <section aria-label="보류" className="flex flex-col gap-2 rounded-md border border-border p-3">
          <h3 className="flex items-baseline justify-between text-sm font-semibold text-text">
            <span className="inline-flex items-center gap-1.5">
              <PauseCircle size={15} aria-hidden="true" className={`self-center ${REC_TEXT.hold}`} />
              보류 → {MET.year} AYT 재시험
            </span>
            <b className="text-2xl font-extrabold tabular-nums">{s.hold}</b>
          </h3>
          {s.held.length === 0 && <p className="text-xs text-muted">보류 결정이 없습니다.</p>}
          <ul className="flex flex-col gap-1.5">
            {s.held.map(l => (
              <li key={l.name} className="text-xs">
                <button type="button" onClick={() => onSelect(l.name)} className="font-semibold text-text underline decoration-border underline-offset-2 hover:decoration-text">
                  {l.name}
                </button>
                <span className="text-muted"> — {firstLine(decisions[l.name]?.reason ?? '') || '사유 없음(자동 판정과 같음)'}</span>
              </li>
            ))}
          </ul>
          {undecidedLine(s.undecidedRec.hold, '보류')}
        </section>

        <section aria-label="탈락" className="flex flex-col gap-2 rounded-md border border-border p-3">
          <h3 className="flex items-baseline justify-between text-sm font-semibold text-text">
            <span className="inline-flex items-center gap-1.5">
              <CircleSlash size={15} aria-hidden="true" className={`self-center ${REC_TEXT.drop}`} />
              탈락 → 시험 종료
            </span>
            <b className="text-2xl font-extrabold tabular-nums">{s.drop}</b>
          </h3>
          <p className="text-xs leading-relaxed tabular-nums text-text">
            사유별(중복 포함): 수량 미달 <b>{dr.short}</b> · 출수기 부적합 <b>{dr.heading}</b> · 간장 <b>{dr.culm}</b> · 도열병 <b>{dr.blast}</b> · 품질(밥맛) <b>{dr.taste}</b> · 심사자 사유{' '}
            <b>{dr.reviewer}</b>
          </p>
          <ul className="flex flex-wrap gap-1.5 touch:gap-2" aria-label="탈락 계통">
            {s.dropped.map(l => chip(l.name))}
          </ul>
          <p className="text-[11px] text-muted">교배 모본·유전자원 보존은 별도 결정입니다.</p>
          {undecidedLine(s.undecidedRec.drop, '탈락')}
        </section>
      </div>
    </Card>
  )
}

function firstLine(t: string): string {
  const s = t.trim().split(/\n/)[0] ?? ''
  const cut = s.split(/(?<=\.)\s/)[0] ?? s
  return cut.length > 60 ? `${cut.slice(0, 60)}…` : cut
}
