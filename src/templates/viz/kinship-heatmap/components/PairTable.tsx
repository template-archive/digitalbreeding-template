import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KIN_LEVEL_LABEL } from '@/lib/genomics'
import { Button, DataTable, SeverityTag, type DataTableColumn, type DataTableSort } from '@/design-system'
import { fmt2, fmt4, fmtDelta, fmtInt, type Pair } from '../data'

export const PAGE_SIZE = 20
export const DEFAULT_SORT: DataTableSort = { key: 'G', dir: 'desc' }

const LEVEL_RANK = { ok: 0, caution: 1, warn: 2 } as const
/** 열별 정렬 값(DataTable과 부모의 페이지 계산이 같은 값을 쓴다) */
const SORT_VALUE: Record<string, (p: Pair) => unknown> = {
  a: p => p.a.name,
  b: p => p.b.name,
  groupPair: p => p.groupPair,
  rel: p => (p.rel === '—' ? null : p.rel),
  G: p => p.G,
  f: p => p.f,
  level: p => LEVEL_RANK[p.level] * 10 + p.f,
  fPed: p => p.fPed,
  delta: p => p.delta,
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ko', { numeric: true })
}

/** DataTable 내부 정렬과 같은 결과(안정 정렬). 선택 쌍이 몇 쪽에 있는지 계산할 때 쓴다 */
export function sortPairs(rows: Pair[], sort: DataTableSort | null): Pair[] {
  if (!sort) return rows
  const sv = SORT_VALUE[sort.key]
  if (!sv) return rows
  const sign = sort.dir === 'desc' ? -1 : 1
  return rows.slice().sort((x, y) => sign * compare(sv(x), sv(y)))
}

interface Props {
  rows: Pair[]
  sorted: Pair[]
  sort: DataTableSort | null
  onSortChange: (s: DataTableSort | null) => void
  page: number
  onPageChange: (p: number) => void
  selectedKey: string | null
  onSelect: (p: Pair) => void
}

const dash = (label: string) => (
  <span aria-label={label} className="text-muted">
    —
  </span>
)

/** 등급 열: 표 전체가 경보색으로 채워지지 않게 의미색은 아이콘·테두리에만(채운 KinBadge는 상세·KPI에서만 쓴다) */
function LevelTag({ level }: { level: Pair['level'] }) {
  if (level === 'ok') return <span className="text-xs text-muted">{KIN_LEVEL_LABEL.ok}</span>
  return <SeverityTag severity={level === 'warn' ? 'critical' : 'warning'} label={KIN_LEVEL_LABEL[level]} />
}

export function PairTable({ rows, sorted, sort, onSortChange, page, onPageChange, selectedKey, onSelect }: Props) {
  const rank = new Map(sorted.map((p, k) => [p.key, k + 1]))
  const columns: DataTableColumn<Pair>[] = [
    { key: 'rank', header: '순위', numeric: true, sortable: false, width: 52, format: (_v, p) => <span className="text-muted">{rank.get(p.key)}</span> },
    { key: 'a', header: '계통 1', sortValue: SORT_VALUE.a, format: (_v, p) => <span className="font-medium">{p.a.name}</span> },
    { key: 'b', header: '계통 2', sortValue: SORT_VALUE.b, format: (_v, p) => <span className="font-medium">{p.b.name}</span> },
    { key: 'groupPair', header: '그룹', sortValue: SORT_VALUE.groupPair },
    { key: 'rel', header: '관계 유형', sortValue: SORT_VALUE.rel, format: (_v, p) => (p.rel === '—' ? dash('계보상 공통 조상 미기록') : p.rel) },
    { key: 'G', header: 'G', numeric: true, sortDescFirst: true, headerTitle: '유전체 관계 계수(2f 척도)', sortValue: SORT_VALUE.G, format: (_v, p) => <b>{fmt2(p.G)}</b> },
    { key: 'f', header: 'f(= G/2)', numeric: true, sortDescFirst: true, headerTitle: '유전체 공조계수 f_G = G/2', sortValue: SORT_VALUE.f, format: (_v, p) => fmt2(p.f) },
    { key: 'level', header: '근연 등급', sortDescFirst: true, sortValue: SORT_VALUE.level, format: (_v, p) => <LevelTag level={p.level} /> },
    {
      key: 'fPed',
      header: '계보 f',
      numeric: true,
      sortDescFirst: true,
      headerTitle: '계보 기대 공조계수(소수 4자리)',
      sortValue: SORT_VALUE.fPed,
      format: (_v, p) => (p.fPed === null ? dash('계보상 공통 조상 미기록') : fmt4(p.fPed)),
    },
    {
      key: 'delta',
      header: 'Δ',
      numeric: true,
      sortDescFirst: true,
      headerTitle: '유전체 − 계보 차이 f_G − f_ped',
      sortValue: SORT_VALUE.delta,
      format: (_v, p) => (p.delta === null ? dash('계보 비교 불가') : fmtDelta(p.delta)),
    },
  ]

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const cur = Math.min(page, pages - 1)
  const shown = sorted.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="key"
          dense
          caption="근연 쌍 표: 두 계통의 유전체 관계 계수 G, 공조계수 f, 근연 등급, 계보 기대값과 차이"
          sort={sort}
          onSortChange={onSortChange}
          allowUnsorted={false}
          pageSize={PAGE_SIZE}
          page={cur}
          onPageChange={onPageChange}
          pageLabel="근연 쌍 표 페이지"
          onRowClick={onSelect}
          activeRow={p => p.key === selectedKey}
          emptyText="조건에 맞는 쌍이 없습니다."
        />
      </div>

      {/* 390px: 카드 목록 */}
      <div className="md:hidden">
        <ul className="flex flex-col gap-2" aria-label="근연 쌍 목록">
          {shown.map(p => {
            const active = p.key === selectedKey
            return (
              <li key={p.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(p)}
                  className={`flex w-full flex-col gap-1.5 rounded-md border bg-surface px-3 py-2 text-left ${active ? 'select-ring border-border' : 'border-border'}`}
                >
                  <span className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-text">
                      <span className="mr-1.5 text-xs font-normal text-muted">{rank.get(p.key)}</span>
                      {p.a.name} × {p.b.name}
                    </span>
                    <LevelTag level={p.level} />
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted">
                    <span>
                      G <b className="text-text">{fmt2(p.G)}</b>
                    </span>
                    <span>f {fmt2(p.f)}</span>
                    <span>{p.groupPair}</span>
                    <span>{p.rel === '—' ? '계보 기록 없음' : p.rel}</span>
                    {p.fPed !== null && (
                      <span>
                        계보 {fmt4(p.fPed)} · Δ {fmtDelta(p.delta!)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {sorted.length === 0 && <p className="py-4 text-center text-[13px] text-muted">조건에 맞는 쌍이 없습니다.</p>}
        {sorted.length > 0 && (
          <nav aria-label="근연 쌍 목록 페이지" className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {fmtInt(cur * PAGE_SIZE + 1)}–{fmtInt(Math.min(sorted.length, (cur + 1) * PAGE_SIZE))} / {fmtInt(sorted.length)}
            </span>
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={cur === 0} onClick={() => onPageChange(cur - 1)} aria-label="이전 쪽" icon={<ChevronLeft size={14} aria-hidden="true" />} />
              <span aria-live="polite">
                {cur + 1} / {pages}쪽
              </span>
              <Button size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => onPageChange(cur + 1)} aria-label="다음 쪽" icon={<ChevronRight size={14} aria-hidden="true" />} />
            </span>
          </nav>
        )}
      </div>
    </>
  )
}
