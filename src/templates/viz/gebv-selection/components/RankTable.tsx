import { useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Badge, DataTable, useMediaQuery, type DataTableColumn, type DataTableSort } from '@/design-system'
import { fmtGebv, type Mode, type RankedLine } from '../data'
import { formatSigned } from '@/lib/format'

/**
 * 순위 표(600행, 20행/페이지). 공통 DataTable의 제어형 정렬·페이지 나눔을 쓰고, 검색·선발만 보기 도구 막대만 여기서 둔다.
 * 정렬은 전체 행(검색 결과) 기준, 페이지는 정렬 결과 기준. 같은 열을 다시 누르면 방향만 바뀐다(정렬 해제 없음).
 */

const PAGE = 20
const LOW_REL = 0.2
const DEFAULT_SORT: DataTableSort = { key: 'rank', dir: 'asc' }

// 음수 z는 육종가가 찾아야 할 약점이라 흐리지 않는다
const zCell = (v: number) => <span>{formatSigned(v, 2)}</span>

/** z 열: 처음 누르면 내림차순(바람직한 계통이 위) */
const zCol = (key: string, header: string, headerTitle: string, get: (r: RankedLine) => number): DataTableColumn<RankedLine> => ({
  key,
  header,
  headerTitle,
  numeric: true,
  sortDescFirst: true,
  sortValue: get,
  format: (_, r) => zCell(get(r)),
})

const COLS: DataTableColumn<RankedLine>[] = [
  { key: 'rank', header: '순위', numeric: true, sortValue: r => r.rank, format: (_, r) => r.rank },
  {
    key: 'name',
    header: '계통명',
    align: 'left',
    sortValue: r => r.line.name,
    format: (_, r) => (
      <span className="font-medium">
        {r.line.name}
        {r.line.anchor && <span className="ml-1 text-[11px] text-muted">앵커</span>}
      </span>
    ),
  },
  { key: 'yield', header: '수량 GEBV', headerTitle: 'kg/10a', numeric: true, sortDescFirst: true, sortValue: r => r.line.gebv.yield, format: (_, r) => fmtGebv(r.line.gebv.yield, 'yield') },
  {
    key: 'rel',
    header: '신뢰도(r²)',
    headerTitle: '수량 GEBV 신뢰도',
    numeric: true,
    sortDescFirst: true,
    sortValue: r => r.line.rel.yield,
    format: (_, r) => (
      <span className="inline-flex items-center justify-end gap-1.5">
        {r.line.rel.yield < LOW_REL && <Badge tone="warning">낮음</Badge>}
        {r.line.rel.yield.toFixed(2)}
      </span>
    ),
  },
  zCol('zY', 'z 수량', '표준화 GEBV, 바람직한 방향 +', r => r.line.z.yield),
  zCol('zC', 'z 간장', '표준화 GEBV, 바람직한 방향 +(짧을수록 +)', r => r.line.z.culm),
  zCol('zB', 'z 도열병', '표준화 GEBV, 바람직한 방향 +(저항성일수록 +)', r => r.line.z.blast),
  zCol('zT', 'z 식미', '표준화 GEBV, 바람직한 방향 +', r => r.line.z.taste),
  {
    key: 'index',
    header: '지수 I',
    headerTitle: '다형질 선발 지수 I = Σ w·z',
    numeric: true,
    sortDescFirst: true,
    sortValue: r => r.index ?? Number.NEGATIVE_INFINITY,
    format: (_, r) => (r.index === null ? '–' : formatSigned(r.index, 2)),
  },
  {
    key: 'selected',
    header: '선발',
    align: 'center',
    sortDescFirst: true,
    sortValue: r => (r.selected ? 1 : 0),
    format: (_, r) =>
      r.selected ? (
        <span className="inline-flex items-center gap-1 font-semibold text-accent">
          <Check size={14} aria-hidden="true" />
          선발
        </span>
      ) : (
        <span className="text-muted">–</span>
      ),
  },
]

/** 좁은 화면(< 640px) 열 순서: 결론 열(선발)·수량·지수를 앞으로, 신뢰도·z는 뒤로(스크롤 끝에 결론이 숨지 않게) */
const NARROW_ORDER = ['rank', 'name', 'selected', 'yield', 'index', 'rel', 'zY', 'zC', 'zB', 'zT']
const NARROW_COLS: DataTableColumn<RankedLine>[] = NARROW_ORDER.map(k => COLS.find(c => c.key === k)!)

interface Props {
  ranked: RankedLine[]
  mode: Mode
  selectedName: string | null
  onSelect: (name: string) => void
}

export function RankTable({ ranked, mode, selectedName, onSelect }: Props) {
  const [sort, setSort] = useState<DataTableSort>(DEFAULT_SORT)
  const [query, setQuery] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const [page, setPage] = useState(0)
  const narrow = useMediaQuery('(max-width: 639px)')

  // 선발 기준이 바뀌면 기본 정렬(현재 기준 내림차순 = 순위 오름차순)로 되돌린다
  useEffect(() => {
    setSort(DEFAULT_SORT)
    setPage(0)
  }, [mode])

  // ranked는 순위 순서다. DataTable은 안정 정렬이라 같은 값은 순위 순으로 남는다
  const rows = useMemo(() => {
    const q = query.trim().toUpperCase()
    let out = ranked
    if (q) out = out.filter(r => r.line.name.toUpperCase().includes(q))
    if (onlySelected) out = out.filter(r => r.selected)
    return out
  }, [ranked, query, onlySelected])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-60">
          <span className="sr-only">계통명 검색</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="계통명 검색 (예: YR22-04)"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2.5 text-[13px] text-text placeholder:text-muted"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={e => {
              setOnlySelected(e.target.checked)
              setPage(0)
            }}
            className="size-4 accent-[var(--color-text)]"
          />
          선발만 보기
        </label>
        <span className="ml-auto text-xs text-muted tabular-nums">{rows.length.toLocaleString('ko-KR')}계통</span>
      </div>

      <DataTable
        columns={narrow ? NARROW_COLS : COLS}
        rows={rows}
        rowKey={r => r.line.name}
        dense
        caption="후보 계통 순위 표. z는 표준화 GEBV로 바람직한 방향이 양수입니다. 행을 선택하면 계통 상세가 바뀝니다."
        emptyText="일치하는 계통이 없습니다"
        stickyColumn={{ key: 'name', below: 'md' }}
        sort={sort}
        onSortChange={next => next && setSort(next)}
        allowUnsorted={false}
        pageSize={PAGE}
        page={page}
        onPageChange={setPage}
        pageLabel="순위 표 페이지"
        onRowClick={r => onSelect(r.line.name)}
        highlight={r => r.selected}
        activeRow={r => r.line.name === selectedName}
      />
    </div>
  )
}
