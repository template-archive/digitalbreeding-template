import { Search } from 'lucide-react'
import { Button, DataTable, FilterChip, Select, Switch, type DataTableColumn, type DataTableSort } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { CATS, CAT_LABEL, PAGE_SIZE, lineLabel, type Cat, type Derived, type LotRow } from '../data'
import { CatBadge, DueCell, GermCell, LotStatusBadge, StockBar, fmtG, fmtGrains, fmtSmallG } from './ui'

export type StorageFilter = 'all' | '1' | '2'
export interface LotFilters {
  cats: Cat[]
  alarmOnly: boolean
  storage: StorageFilter
  query: string
}
export const DEFAULT_FILTERS: LotFilters = {
  cats: [],
  alarmOnly: false,
  storage: 'all',
  query: '',
}

export function filterLots(d: Derived, f: LotFilters, isAlarm: (r: LotRow) => boolean): LotRow[] {
  const q = f.query.trim().toLowerCase()
  return d.rows.filter(r => {
    if (f.cats.length && !f.cats.includes(r.lot.cat)) return false
    if (f.alarmOnly && !isAlarm(r)) return false
    if (f.storage !== 'all' && String(r.lot.storage) !== f.storage) return false
    if (q) {
      const hay = `${r.lot.id} ${r.lot.line} ${lineLabel(r.lot.line)} ${r.lot.barcode}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function Stock({ r, d }: { r: LotRow; d: Derived }) {
  const L = r.lot
  const ln = d.lines.get(L.line)!
  if (r.bal == null) return <span className="text-muted">립수 미입력</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <StockBar value={r.bal} min={ln.min} alarm={ln.below} className="w-10" />
        <span className="font-semibold tabular-nums">{L.unit === 'g' ? `${fmtG(r.bal)} g` : `${formatNumber(r.bal)}립`}</span>
      </span>
      <span className="whitespace-nowrap text-xs text-muted tabular-nums">{L.unit === 'g' ? fmtGrains(r.bal, L.tgw) : `≈ ${fmtSmallG((r.bal * L.tgw) / 1000)} g`}</span>
    </span>
  )
}

export function LotToolbar({ f, setF, counts }: { f: LotFilters; setF: (f: LotFilters) => void; counts: Record<Cat, number> }) {
  const toggle = (c: Cat) =>
    setF({
      ...f,
      cats: f.cats.includes(c) ? f.cats.filter(x => x !== c) : [...f.cats, c],
    })
  return (
    <div className="flex flex-col gap-2.5">
      <div role="group" aria-label="구분 필터" className="flex flex-wrap gap-1.5">
        {CATS.map(c => (
          <FilterChip key={c} pressed={f.cats.includes(c)} onClick={() => toggle(c)} label={CAT_LABEL[c]} count={counts[c]} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Switch checked={f.alarmOnly} onChange={v => setF({ ...f, alarmOnly: v })} label="경보만" className="h-8" />
        <Select<StorageFilter>
          label="저장고"
          value={f.storage}
          onChange={v => setF({ ...f, storage: v })}
          options={[
            { value: 'all', label: '전체' },
            { value: '1', label: '저장고 1' },
            { value: '2', label: '저장고 2' },
          ]}
        />
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
          <span className="sr-only">계통·로트 ID·상자 바코드 검색</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-muted" />
          <input
            type="search"
            value={f.query}
            onChange={e => setF({ ...f, query: e.target.value })}
            placeholder="계통 · 로트 ID · 상자 바코드"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] text-text placeholder:text-muted touch:h-11"
          />
        </label>
      </div>
    </div>
  )
}

export function LotTable({
  rows,
  d,
  selected,
  onSelect,
  page,
  onPage,
  narrow,
  sort,
  onSort,
}: {
  rows: LotRow[]
  sort: DataTableSort | null
  onSort: (s: DataTableSort | null) => void
  d: Derived
  selected: string | null
  onSelect: (id: string) => void
  page: number
  onPage: (p: number) => void
  narrow: boolean
}) {
  if (narrow) return <LotCards rows={rows} d={d} selected={selected} onSelect={onSelect} page={page} onPage={onPage} />
  const cols: DataTableColumn<LotRow>[] = [
    {
      key: 'id',
      header: '로트 ID',
      sortValue: r => r.lot.id,
      format: (_, r) => <span className="font-semibold tabular-nums">{r.lot.id}</span>,
    },
    {
      key: 'line',
      header: '계통/품종 · 구분',
      sortValue: r => r.lot.line,
      format: (_, r) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <span className="whitespace-nowrap">{lineLabel(r.lot.line)}</span>
          <CatBadge cat={r.lot.cat} />
        </span>
      ),
    },
    {
      key: 'year',
      header: '수확 연도·세대 · 생산 포장',
      sortValue: r => r.lot.harvestYear,
      format: (_, r) => (
        <span className="inline-flex flex-col">
          <span className="whitespace-nowrap tabular-nums">
            {r.lot.harvestYear} · {r.lot.gen}
          </span>
          <span className="whitespace-nowrap text-xs text-muted">{r.lot.source}</span>
        </span>
      ),
    },
    {
      key: 'bal',
      header: '재고',
      numeric: true,
      sortDescFirst: true,
      sortValue: r => (r.lot.unit === 'g' ? (r.bal ?? -1) : ((r.bal ?? -1) * r.lot.tgw) / 1000),
      format: (_, r) => <Stock r={r} d={d} />,
    },
    {
      key: 'tgw',
      header: '천립중(정조)',
      numeric: true,
      headerTitle: '정조(겉껍질 포함) 1,000립 무게, g',
      sortValue: r => r.lot.tgw,
      format: (_, r) => <span className="tabular-nums">{r.lot.tgw.toFixed(1)} g</span>,
    },
    {
      key: 'germ',
      header: '발아',
      numeric: true,
      sortValue: r => r.germ.last?.germ ?? -1,
      format: (_, r) => <GermCell germ={r.germ} stacked />,
    },
    {
      key: 'due',
      header: '재검사 기한',
      numeric: true,
      sortValue: r => r.germ.due ?? '9999',
      format: (_, r) => <DueCell germ={r.germ} alignEnd />,
    },
    {
      key: 'loc',
      header: '보관 위치',
      sortValue: r => r.lot.barcode,
      format: (_, r) => (
        <span className="inline-flex flex-col whitespace-nowrap">
          <span className="tabular-nums">{r.lot.barcode}</span>
          <span className="text-[11px] text-muted">저장고 {r.lot.storage}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      sortValue: r => r.status,
      format: (_, r) => <LotStatusBadge status={r.status} />,
    },
  ]
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={r => r.lot.id}
      dense
      stickyColumn="id"
      sort={sort}
      onSortChange={onSort}
      pageSize={PAGE_SIZE}
      page={page}
      onPageChange={onPage}
      pageLabel="재고 로트 페이지"
      onRowClick={r => onSelect(r.lot.id)}
      activeRow={r => r.lot.id === selected}
      caption="재고 로트"
      emptyText="조건에 맞는 로트가 없습니다"
    />
  )
}

function LotCards({ rows, d, selected, onSelect, page, onPage }: { rows: LotRow[]; d: Derived; selected: string | null; onSelect: (id: string) => void; page: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const p = Math.min(page, pages - 1)
  const shown = rows.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)
  if (!rows.length) return <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted">조건에 맞는 로트가 없습니다</p>
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-label="재고 로트">
        {shown.map(r => {
          const active = r.lot.id === selected
          return (
            <li key={r.lot.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(r.lot.id)}
                className={`flex w-full flex-col gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-left text-[13px] ${active ? 'select-ring' : ''}`}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums">{r.lot.id}</span>
                  <LotStatusBadge status={r.status} />
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{lineLabel(r.lot.line)}</span>
                  <CatBadge cat={r.lot.cat} />
                </span>
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-xs text-muted">재고</span>
                  <Stock r={r} d={d} />
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted">발아</span>
                  <GermCell germ={r.germ} />
                  {r.germ.dueState && r.germ.dueState !== 'ok' && <DueCell germ={r.germ} />}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  저장고 {r.lot.storage} · {r.lot.barcode}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <nav aria-label="재고 로트 페이지" className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {p * PAGE_SIZE + 1}–{Math.min(rows.length, (p + 1) * PAGE_SIZE)} / {rows.length}
        </span>
        <span className="flex items-center gap-2">
          <Button size="sm" disabled={p === 0} onClick={() => onPage(p - 1)}>
            이전
          </Button>
          <span aria-live="polite" className="tabular-nums">
            {p + 1} / {pages}쪽
          </span>
          <Button size="sm" disabled={p >= pages - 1} onClick={() => onPage(p + 1)}>
            다음
          </Button>
        </span>
      </nav>
    </div>
  )
}
