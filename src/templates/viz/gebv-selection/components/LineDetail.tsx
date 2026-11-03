import { Badge, Card, DivergingBar } from '@/design-system'
import { TRAITS, TRAIT_KEYS, fmtGebv, type Mode, type RankedLine, type Weights } from '../data'
import { formatSigned } from '@/lib/format'

interface Props {
  item: RankedLine | null
  mode: Mode
  wn: Weights | null
  nSel: number
  className?: string
  /** 제목 요소 id(하단 시트 aria-labelledby) */
  titleId?: string
}

/** 선택 계통 상세 — 형질별 표준화 GEBV 막대(−3~+3 고정), 원 단위 GEBV·신뢰도, 지수 기여 w·z */
export function LineDetail({ item, mode, wn, nSel, className, titleId }: Props) {
  if (!item) {
    return (
      <Card title="계통 상세" className={className}>
        <p className="text-[13px] text-muted">표의 행이나 산점도의 점을 선택하세요.</p>
      </Card>
    )
  }
  const l = item.line
  const total = wn ? TRAIT_KEYS.reduce((s, t) => s + wn[t] * l.z[t], 0) : null
  return (
    <Card
      title={
        <span id={titleId} className="inline-flex flex-wrap items-center gap-2">
          {l.name}
          {/* '선발'은 표·차트와 같은 강조색 계열(초록은 '통과·양호'로 읽힌다) */}
          {item.selected ? <Badge tone="info">선발</Badge> : <Badge tone="neutral">비선발</Badge>}
        </span>
      }
      subtitle={`${mode === 'yield' ? '수량 GEBV' : '선발 지수'} 기준 ${item.rank}위 / 600 · 선발 ${nSel}계통${l.note ? ` · ${l.note}(가상)` : ''}`}
      className={className}
    >
      <div className="flex flex-col gap-3" aria-live="polite">
        <p className="text-xs text-muted">표준화 GEBV(z), 바람직한 방향 +, 범위 −3 ~ +3</p>
        {TRAIT_KEYS.map(t => {
          const def = TRAITS[t]
          return (
            <DivergingBar
              key={t}
              label={def.short}
              value={l.z[t]}
              domain={3}
              valueText={
                <>
                  z {formatSigned(l.z[t], 2)} · {fmtGebv(l.gebv[t], t)} {def.unit} · r² {l.rel[t].toFixed(2)}
                </>
              }
            />
          )
        })}
        <div className="mt-1 rounded-md bg-surface-2 p-3">
          <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
            <span>지수 기여 w·z</span>
            <span>
              지수 I = <b className="text-[15px] text-text tabular-nums">{total === null ? '–' : formatSigned(total, 2)}</b>
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums">
            {TRAIT_KEYS.map(t => (
              <li key={t} className="flex justify-between gap-2">
                <span className="text-muted">
                  {TRAITS[t].short} {wn ? `(${Math.round(wn[t] * 100)}%)` : ''}
                </span>
                <span className="font-medium text-text">{wn ? formatSigned(wn[t] * l.z[t], 2) : '–'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
