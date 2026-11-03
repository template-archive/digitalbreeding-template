import { ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { fmtRate, mmdd } from '../data'
import { BandBadge, RecrossBadge, StatusBadge, UnsavedMark } from './badges'
import { EditCell, EffCell, IssueLine } from './cells'
import type { EntryProps } from './EntryTable'

/** D. 390px용 조합 카드 목록 — ID·부모·립수 입력·결실률·판정·진위·재교배 */
export function CrossCards({ rows, fields, saved, issues, dirty, selected, onSelect, onFocusRow, onChange }: EntryProps) {
  if (rows.length === 0) return <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">조건에 맞는 조합이 없습니다</p>
  return (
    <ul className="flex flex-col gap-2" aria-label="교배 조합 카드 목록">
      {rows.map(r => {
        const id = r.cross.id
        const active = id === selected
        const issue = issues[id]?.seeds
        return (
          <li key={id} data-unsaved={dirty.has(id) ? 'true' : undefined} className={`rounded-lg border border-border bg-surface p-3 ${active ? 'select-ring' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onSelect(id)} className="touch-hit-y flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-text">
                  {id}
                  <ChevronRight size={14} aria-hidden="true" className="text-muted" />
                  {dirty.has(id) && <UnsavedMark />}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {r.cross.female} × {r.cross.male} · {mmdd(r.date)}
                </span>
              </button>
              <RecrossBadge row={r} />
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <label className="flex items-start gap-2 text-xs text-muted">
                <span className="whitespace-nowrap pt-2.5 touch:pt-3.5">결실 립수</span>
                <EditCell
                  crossId={id}
                  field="seeds"
                  value={fields[id]!.seeds}
                  issue={issue}
                  modified={fields[id]!.seeds !== saved[id]!.seeds}
                  onChange={v => onChange(id, 'seeds', v)}
                  onFocus={() => onFocusRow(id)}
                  width="4.5rem"
                  placeholder="입력"
                  tall
                  externalMessage
                />
              </label>
              <div className="text-right text-xs text-muted">
                <span className="tabular-nums text-text">
                  {r.rate == null ? '—' : `${fmtRate(r.rate)}%`}
                </span>{' '}
                / 영화 {formatNumber(r.florets)}
                <div className="mt-1">
                  <BandBadge band={r.band} />
                </div>
              </div>
            </div>
            {/* 오류 문구는 입력 줄 아래 전폭 줄(좁은 칸에서 오른쪽 정렬로 감기지 않게, 검토 R3) */}
            {issue && <IssueLine crossId={id} field="seeds" issue={issue} />}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
              <StatusBadge status={r.status} discard={r.status === 'confirmed' && !r.manual ? r.nSelf : 0} />
              <EffCell row={r} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
