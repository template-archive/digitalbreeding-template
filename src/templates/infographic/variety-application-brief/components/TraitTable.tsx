import type { ReactNode } from 'react'
import { u } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import { CHECK, LINE, TRAITS, blastClass, headingDate, traitDiff, traitIndex, verdict, verdictTone, type Trait } from '../data'
import { TONE_CLASS, V_COLOR } from './style'
import { ToneMark } from './ToneMark'

/** 값 칸: 큰 숫자 + 아래 보조 줄(출수 일수, 도열병 등급) */
function valueCell(t: Trait, v: number): { main: string; sub?: string } {
  if (t.key === 'heading') return { main: headingDate(v), sub: `${v}일` }
  if (t.key === 'blast') return { main: String(v), sub: blastClass(v) }
  return { main: formatFixed(v, t.digits) }
}

function Cell({ children, align = 'left', className = '' }: { children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <span role="cell" className={`flex min-w-0 flex-col justify-center ${align === 'right' ? 'items-end text-right' : ''} ${className}`}>
      {children}
    </span>
  )
}

/** 판정 기호 범례(영역 부제로 쓴다) */
export function TraitLegend() {
  return (
    <>
      <ToneMark tone="positive" />
      좋은 방향 · • 중립 형질(정보) · = 비슷(차 ≤ LSD) · 차 아래 % = 지수
    </>
  )
}

/** 주요 특성 6행 비교 표(MET 2년 평균, 대비 가람솔). 판정 = |차| > LSD(5%) */
export function TraitTable() {
  const cols = `minmax(0, 1fr) ${u(78)} ${u(78)} ${u(72)} ${u(72)}`
  return (
    <div role="table" aria-label={`주요 특성 비교: ${TRAITS.map(t => `${t.label} ${verdict(t)}`).join(', ')}`}>
      <div role="row" className="grid border-b border-text/60 font-bold text-muted" style={{ gridTemplateColumns: cols, gap: u(8), fontSize: u(15), paddingBottom: u(4), borderBottomWidth: u(1.5) }}>
        <span role="columnheader">형질(단위)</span>
        <span role="columnheader" className="text-right" style={{ color: V_COLOR }}>
          {LINE.id}
        </span>
        <span role="columnheader" className="text-right">
          대비 {CHECK.name}
        </span>
        <span role="columnheader" className="text-right">
          차
        </span>
        <span role="columnheader">판정</span>
      </div>
      {TRAITS.map(t => {
        const a = valueCell(t, t.v)
        const b = valueCell(t, t.c)
        const d = traitDiff(t)
        const idx = traitIndex(t)
        const tone = verdictTone(t)
        // 차 단위: 출수 '일', 간장·천립중은 단위를 붙이고, 수량·점수는 형질 칸 단위로 충분
        const unit = t.key === 'heading' ? '일' : t.key === 'culm' || t.key === 'tgw' ? ` ${t.unit}` : ''
        return (
          <div role="row" key={t.key} className="grid border-b border-border" style={{ gridTemplateColumns: cols, gap: u(8), minHeight: u(36), paddingBlock: u(1) }}>
            <Cell>
              <span className="font-bold text-text" style={{ fontSize: u(15.5), lineHeight: 1.2 }}>
                {t.label}{' '}
                <span className="font-medium text-muted" style={{ fontSize: u(15) }}>
                  {t.key === 'heading' ? '월·일' : t.unit}
                </span>
              </span>
              <span className="text-muted" style={{ fontSize: u(15), lineHeight: 1.2 }}>
                {t.note}
              </span>
            </Cell>
            <Cell align="right">
              <span className="font-extrabold tabular-nums" style={{ fontSize: u(16), lineHeight: 1.15, color: V_COLOR }}>
                {a.main}
              </span>
              {a.sub && (
                <span className="text-muted" style={{ fontSize: u(15), lineHeight: 1.2 }}>
                  {a.sub}
                </span>
              )}
            </Cell>
            <Cell align="right">
              <span className="font-semibold text-text tabular-nums" style={{ fontSize: u(16), lineHeight: 1.15 }}>
                {b.main}
              </span>
              {b.sub && (
                <span className="text-muted" style={{ fontSize: u(15), lineHeight: 1.2 }}>
                  {b.sub}
                </span>
              )}
            </Cell>
            <Cell align="right">
              <span className="font-bold text-text tabular-nums whitespace-nowrap" style={{ fontSize: u(15), lineHeight: 1.15 }}>
                {formatSigned(d, t.digits)}
                {unit}
              </span>
              {idx != null && (
                <span className="text-muted tabular-nums" style={{ fontSize: u(15), lineHeight: 1.2 }}>
                  {formatFixed(idx, 1)}%
                </span>
              )}
            </Cell>
            <Cell>
              <span className={`font-extrabold break-keep ${TONE_CLASS[tone]}`} style={{ fontSize: u(15.5), lineHeight: 1.15 }}>
                <ToneMark tone={tone} />
                {verdict(t)}
              </span>
            </Cell>
          </div>
        )
      })}
    </div>
  )
}
