import { Check } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { REP_LABEL, TRAITS, type TraitKey } from '../data'
import { HATCH_UNSAVED } from './cells'

export interface TraitProgress {
  trait: TraitKey
  filled: number
  saved: number // 저장되어 있고 바뀌지 않은 칸
  unsaved: number // 비어 있지 않은 미저장·충돌 칸
  total: number
}

/** 형질별 진척: 저장분(진한 막대) + 미저장분(빗금) */
export function TraitProgressList({ items }: { items: TraitProgress[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(it => {
        const T = TRAITS[it.trait]
        const pct = it.filled / it.total
        const done = it.filled === it.total
        return (
          <li key={it.trait} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium text-text">
                {T.label} <span className="text-xs font-normal text-muted">{T.phase}</span>
              </span>
              <span className="shrink-0 tabular-nums text-text">
                <b className="font-semibold">{it.filled}</b>
                <span className="text-muted">/{it.total}</span>
                <span className="ml-1.5 text-xs text-muted">{formatPercent(pct)}</span>
                {done && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-positive">
                    <Check size={12} aria-hidden="true" />
                    완료
                  </span>
                )}
              </span>
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={`${T.label} ${it.filled}/${it.total}칸 입력, 저장 ${it.saved}칸, 미저장 ${it.unsaved}칸`}
            >
              <div className="h-full bg-accent" style={{ width: `${(it.saved / it.total) * 100}%` }} />
              {it.unsaved > 0 && <div className="h-full" style={{ width: `${(it.unsaved / it.total) * 100}%`, background: HATCH_UNSAVED }} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function RepProgress({ reps }: { reps: { filled: number; total: number }[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
      <span className="font-medium text-text">반복별 진척</span>
      {reps.map((r, i) => (
        <span key={i} className="tabular-nums">
          {REP_LABEL[i]} <b className="font-semibold text-text">{formatPercent(r.filled / r.total)}</b>
          <span className="ml-1 text-xs">({r.filled}/{r.total})</span>
          {i < reps.length - 1 && <span aria-hidden="true" className="ml-3">·</span>}
        </span>
      ))}
    </p>
  )
}
