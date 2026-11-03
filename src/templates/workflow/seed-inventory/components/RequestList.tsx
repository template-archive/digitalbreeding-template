import { AlertTriangle, Ban } from 'lucide-react'
import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { REQ_STATUS_RANK, lineLabel, tableDate, type Req, type ReqEval } from '../data'
import { ReqStatusBadge, UseBadge } from './ui'

export interface ReqRow {
  req: Req
  ev: ReqEval | null
}

/** 품목 n개 · 합계량(제외 품목은 "8 / 9개") */
export function itemSummary(req: Req): string {
  const active = req.items.filter(i => !i.excluded)
  const units = new Set(active.map(i => i.unit))
  const n = active.length === req.items.length ? `${req.items.length}개` : `${active.length} / ${req.items.length}개`
  if (units.size !== 1) return n
  const unit = [...units][0]!
  const sum = active.reduce((a, i) => a + (Number.isFinite(i.qty) ? i.qty : 0), 0)
  return `${n} · ${formatNumber(sum)}${unit === 'g' ? ' g' : '립'}`
}

function Checks({ ev }: { ev: ReqEval | null }) {
  if (!ev) return <span className="text-muted">—</span>
  if (!ev.blockCount && !ev.warnCount) return <span className="text-xs text-positive">통과</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ev.blockCount > 0 && (
        <Badge tone="negative">
          <Ban size={11} aria-hidden="true" />
          차단 {ev.blockCount}
        </Badge>
      )}
      {ev.warnCount > 0 && (
        <Badge tone="warning">
          <AlertTriangle size={11} aria-hidden="true" />
          주의 {ev.warnCount}
        </Badge>
      )}
    </span>
  )
}

const statusSort = (r: ReqRow) => `${REQ_STATUS_RANK[r.req.status]}-${99999999 - Number(r.req.date.replace(/-/g, ''))}`

export function RequestList({ rows, selected, onSelect, narrow }: { rows: ReqRow[]; selected: string; onSelect: (id: string) => void; narrow: boolean }) {
  if (narrow) {
    const sorted = [...rows].sort((a, b) => statusSort(a).localeCompare(statusSort(b)))
    return (
      <ul className="flex flex-col gap-2" aria-label="분양·반출 요청">
        {sorted.map(({ req, ev }) => {
          const active = req.id === selected
          return (
            <li key={req.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(req.id)}
                className={`flex w-full flex-col gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-left text-[13px] ${active ? 'select-ring' : ''}`}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums">{req.id}</span>
                  <ReqStatusBadge status={req.status} />
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <UseBadge use={req.use} />
                  <span className="text-xs text-muted">{req.requester}</span>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted tabular-nums">
                    {itemSummary(req)} · 필요 {tableDate(req.need)}
                  </span>
                  <Checks ev={ev} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }
  const cols: DataTableColumn<ReqRow>[] = [
    {
      key: 'id',
      header: '요청 ID',
      sortValue: r => r.req.id,
      format: (_, r) => <span className="font-semibold tabular-nums">{r.req.id}</span>,
    },
    {
      key: 'date',
      header: '요청일',
      numeric: true,
      sortValue: r => r.req.date,
      format: (_, r) => <span className="tabular-nums">{tableDate(r.req.date)}</span>,
    },
    {
      key: 'requester',
      header: '요청자',
      sortValue: r => r.req.requester,
      format: (_, r) => <span className="block min-w-[7rem] max-w-[9rem] whitespace-normal leading-snug">{r.req.requester}</span>,
    },
    {
      key: 'use',
      header: '용도',
      sortValue: r => r.req.use,
      format: (_, r) => <UseBadge use={r.req.use} />,
    },
    {
      key: 'items',
      header: '품목',
      numeric: true,
      sortable: false,
      format: (_, r) => (
        <span className="whitespace-nowrap tabular-nums" title={r.req.items.length <= 9 ? r.req.items.map(i => lineLabel(i.line)).join(', ') : undefined}>
          {itemSummary(r.req)}
        </span>
      ),
    },
    {
      key: 'need',
      header: '필요일',
      numeric: true,
      sortValue: r => r.req.need,
      format: (_, r) => <span className="tabular-nums">{tableDate(r.req.need)}</span>,
    },
    {
      key: 'status',
      header: '상태',
      sortValue: statusSort,
      format: (_, r) => <ReqStatusBadge status={r.req.status} />,
    },
    {
      key: 'checks',
      header: '점검',
      sortValue: r => -(r.ev?.blockCount ?? 0) * 100 - (r.ev?.warnCount ?? 0),
      format: (_, r) => <Checks ev={r.ev} />,
    },
  ]
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={r => r.req.id}
      dense
      stickyColumn="id"
      defaultSort={{ key: 'status', dir: 'asc' }}
      onRowClick={r => onSelect(r.req.id)}
      activeRow={r => r.req.id === selected}
      caption={`분양·반출 요청 ${formatNumber(rows.length)}건`}
    />
  )
}
