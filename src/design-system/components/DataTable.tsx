import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import { Button } from './Button'
import { cn } from './cn'
import { DEFAULT_TABLE_HINT, ScrollFade, ScrollHint } from './scrollCue'

export interface DataTableColumn<T> {
  /** 행 객체의 필드 이름(정렬 기준). 계산 열이면 임의 문자열 + format 사용 */
  key: string
  header: ReactNode
  /** 정렬. numeric이면 기본 'right' */
  align?: 'left' | 'right' | 'center'
  /**
   * 숫자 열: 셀·머리글 모두 오른쪽 정렬(자릿수 맞춤 tabular-nums는 표 전체 기본). 앱 화면 규칙 7.4(숫자 열 오른쪽 정렬).
   * align을 따로 주면 align이 이긴다. ISO 날짜처럼 자릿수를 비교하는 열도 오른쪽 정렬을 권장한다. 2026-10-30
   */
  numeric?: boolean
  /** 셀 표시 형식. 없으면 값을 그대로 출력 */
  format?: (value: unknown, row: T) => ReactNode
  /** 예: 120 또는 '20%' */
  width?: number | string
  /** 기본 true */
  sortable?: boolean
  /** 정렬 값. 없으면 row[key]. 중첩 필드·계산 열을 정렬할 때 */
  sortValue?: (row: T) => unknown
  /** 처음 누를 때 내림차순(큰 값이 위). 수치 지표 열에 */
  sortDescFirst?: boolean
  /** 머리글 정렬 버튼의 title(단위·정의 같은 보조 설명) */
  headerTitle?: string
  /**
   * 이 폭 미만에서 열(머리글·셀)을 숨긴다: 'sm' < 640px, 'md' < 768px, 'lg' < 1024px. 좁은 화면에서 결론 열(상태·판정·지수)이
   * 가로 스크롤 끝에 숨지 않게 덜 중요한 열(기간·단위·설명)을 뺀다. 고정 열(stickyColumn)에는 쓰지 않는다. 2026-10-30
   */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: keyof T | ((row: T) => string | number)
  dense?: boolean
  /** 세로 스크롤 최대 높이(px). 지정하면 머리글이 고정된다 */
  maxHeight?: number
  onRowClick?: (row: T) => void
  highlight?: (row: T) => boolean
  /** 표 설명(스크린리더 caption) */
  caption?: string
  /** 빈 데이터 메시지 */
  emptyText?: ReactNode
  className?: string
  /**
   * 열 고정(가로 스크롤 시 왼쪽에 붙음). 열 key 또는 { key, below }.
   * below: 'md'|'lg'이면 그 폭 미만에서만 고정한다(모바일 전용 고정). 고정 열은 left 0에 붙으므로 보통 첫 열이나
   * 좁은 선택 열 바로 다음 열을 고른다(스크롤하면 앞 열을 덮는다).
   */
  stickyColumn?: string | { key: string; below?: 'md' | 'lg' }
  /** 초기 정렬. rows가 이미 이 순서로 정렬돼 있어도 넘기면 머리글에 정렬 상태(aria-sort·아이콘)가 표시된다 */
  defaultSort?: DataTableSort
  /**
   * 제어형 정렬. 넘기면(null 포함) 정렬 상태를 부모가 가진다. 머리글을 누르면 onSortChange(다음 상태)가 불린다.
   * 정렬 자체(rows 재배열)는 DataTable이 한다.
   */
  sort?: DataTableSort | null
  onSortChange?: (next: DataTableSort | null) => void
  /** false면 같은 열을 다시 눌러도 정렬 해제 없이 방향만 바꾼다(첫 방향 ↔ 반대). 기본 true(오름 → 내림 → 해제) */
  allowUnsorted?: boolean
  /** 페이지 크기. 지정하면 표 아래에 페이지 나눔(범위·이전/다음·쪽 번호)이 붙는다 */
  pageSize?: number
  /** 제어형 페이지(0부터). 없으면 내부 상태. 정렬을 바꾸면 0쪽으로 돌아간다(제어형이면 onPageChange(0)) */
  page?: number
  onPageChange?: (page: number) => void
  /** 페이지 나눔 nav의 접근성 이름. 기본 '표 페이지' */
  pageLabel?: string
  /**
   * 현재 보고 있는 행(상세 패널과 연동 등): 2px 글자색 윤곽선 + aria-selected. highlight(배경)와 함께 쓸 수 있다.
   * stickyColumn과 함께 써도 고정 셀 위에 윤곽이 이어진다(2026-10-30)
   */
  activeRow?: (row: T) => boolean
  /** 행(tr)에 붙일 속성: data-*(QA 선택자·행 식별), className, title. 클릭·키보드·aria 속성은 DataTable이 정한다 */
  rowProps?: (row: T) => DataTableRowProps
  /**
   * 행 상태 띠: 고정 열(stickyColumn) 셀, 없으면 첫 셀 왼쪽 안쪽에 3px 의미색 띠(inset box-shadow).
   * 색만으로 알리지 말고 셀 안에 아이콘·문구(예: AlertTriangle aria-label="사유 누락")를 함께 둔다.
   */
  rowTone?: (row: T) => DataTableRowTone | null | undefined
  /**
   * 가로 스크롤 단서 문구. 표가 실제로 가로로 넘칠 때만(폭과 관계없이, 768px 포함) 표 위에 `text-xs text-muted break-keep`(aria-hidden)로
   * 보이고, 끝까지 밀기 전에는 오른쪽 가장자리에 페이드가 생긴다. 생략하면 기본 문구 '옆으로 밀어 나머지 열 보기 →'(2026-10-30부터 기본),
   * 문구를 바꾸려면 '옆으로 밀어 … 보기 →' 꼴로 넘기고, 끄려면 false(페이드도 꺼짐)
   */
  scrollHint?: ReactNode
}

export type DataTableRowTone = 'negative' | 'warning'

/** rowProps가 돌려주는 행 속성 */
export type DataTableRowProps = { className?: string; title?: string } & { [key: `data-${string}`]: string | undefined }

export interface DataTableSort {
  key: string
  dir: 'asc' | 'desc'
}

type SortState = DataTableSort | null

// Tailwind가 정적으로 찾을 수 있도록 클래스 문자열을 그대로 둔다
const STICKY_TD = {
  always: 'sticky left-0 z-[1]',
  md: 'max-md:sticky max-md:left-0 max-md:z-[1]',
  lg: 'max-lg:sticky max-lg:left-0 max-lg:z-[1]',
} as const
// 고정 셀 오른쪽 1px 경계선과 rowTone 띠(inset 3px)는 같은 box-shadow라 조합별로 한 클래스로 둔다
const STICKY_TD_SHADOW = {
  none: {
    always: 'shadow-[1px_0_0_var(--color-border)]',
    md: 'max-md:shadow-[1px_0_0_var(--color-border)]',
    lg: 'max-lg:shadow-[1px_0_0_var(--color-border)]',
  },
  negative: {
    always: 'shadow-[inset_3px_0_0_var(--color-negative),1px_0_0_var(--color-border)]',
    md: 'shadow-[inset_3px_0_0_var(--color-negative)] max-md:shadow-[inset_3px_0_0_var(--color-negative),1px_0_0_var(--color-border)]',
    lg: 'shadow-[inset_3px_0_0_var(--color-negative)] max-lg:shadow-[inset_3px_0_0_var(--color-negative),1px_0_0_var(--color-border)]',
  },
  warning: {
    always: 'shadow-[inset_3px_0_0_var(--color-warning),1px_0_0_var(--color-border)]',
    md: 'shadow-[inset_3px_0_0_var(--color-warning)] max-md:shadow-[inset_3px_0_0_var(--color-warning),1px_0_0_var(--color-border)]',
    lg: 'shadow-[inset_3px_0_0_var(--color-warning)] max-lg:shadow-[inset_3px_0_0_var(--color-warning),1px_0_0_var(--color-border)]',
  },
} as const
const TONE_TD = {
  negative: 'shadow-[inset_3px_0_0_var(--color-negative)]',
  warning: 'shadow-[inset_3px_0_0_var(--color-warning)]',
} as const
const STICKY_TD_BG = {
  always: 'bg-surface',
  md: 'max-md:bg-surface',
  lg: 'max-lg:bg-surface',
} as const
// 강조 행: 고정 셀은 불투명해야 하므로 accent 10%를 surface에 섞은 색을 쓴다(bg-accent/10과 같은 모양)
const STICKY_TD_HL = {
  always: 'bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))]',
  md: 'max-md:bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))]',
  lg: 'max-lg:bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))]',
} as const
// 현재 행(activeRow) 윤곽 조각: 고정 셀이 tr outline을 가리므로 셀 안에 다시 그린다. 고정이 풀리는 폭에서는 숨긴다(셀이 static이면 absolute가 표 밖 기준이 된다)
const STICKY_ACTIVE = {
  always: 'pointer-events-none absolute inset-0 border-y-2 border-text',
  md: 'pointer-events-none absolute inset-0 hidden border-y-2 border-text max-md:block',
  lg: 'pointer-events-none absolute inset-0 hidden border-y-2 border-text max-lg:block',
} as const
// 고정 열 머리 배경은 표면색(머리 띠 없음, 2026-10-30)
const STICKY_TH = {
  always: 'sticky left-0 z-[2] bg-surface',
  md: 'max-md:sticky max-md:left-0 max-md:z-[2] max-md:bg-surface',
  lg: 'max-lg:sticky max-lg:left-0 max-lg:z-[2] max-lg:bg-surface',
} as const
const alignOf = <T,>(col: DataTableColumn<T>) => col.align ?? (col.numeric ? 'right' : 'left')

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const
const HIDE_BELOW = { sm: 'max-sm:hidden', md: 'max-md:hidden', lg: 'max-lg:hidden' } as const

function getValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function sortValueOf<T>(row: T, key: string, col: DataTableColumn<T> | undefined): unknown {
  return col?.sortValue ? col.sortValue(row) : getValue(row, key)
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ko', { numeric: true })
}

/** 정렬 가능한 표. 가로로 넘치면 자체 스크롤 컨테이너 안에서만 넘친다. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  dense,
  maxHeight,
  onRowClick,
  highlight,
  caption,
  emptyText = '표시할 데이터가 없습니다.',
  className,
  stickyColumn,
  defaultSort,
  sort: sortProp,
  onSortChange,
  allowUnsorted = true,
  pageSize,
  page: pageProp,
  onPageChange,
  pageLabel = '표 페이지',
  activeRow,
  rowProps,
  rowTone,
  scrollHint,
}: DataTableProps<T>) {
  const [sortInner, setSortInner] = useState<SortState>(defaultSort ?? null)
  const sort = sortProp !== undefined ? sortProp : sortInner
  const [pageInner, setPageInner] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    // 내림차순도 비교 부호만 바꿔 안정 정렬을 유지한다(같은 값의 원래 순서 보존)
    const sign = sort.dir === 'desc' ? -1 : 1
    return rows.slice().sort((a, b) => sign * compare(sortValueOf(a, sort.key, col), sortValueOf(b, sort.key, col)))
  }, [rows, sort, columns])

  const paged = pageSize !== undefined && pageSize > 0
  const pages = paged ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const cur = paged ? Math.min(Math.max(0, pageProp ?? pageInner), pages - 1) : 0
  const shown = paged ? sorted.slice(cur * pageSize, cur * pageSize + pageSize) : sorted
  const setPage = (p: number) => {
    if (pageProp === undefined) setPageInner(p)
    onPageChange?.(p)
  }

  const stickyKey = typeof stickyColumn === 'string' ? stickyColumn : stickyColumn?.key
  const stickyMode = typeof stickyColumn === 'object' && stickyColumn.below ? stickyColumn.below : 'always'

  const keyOf = (row: T, i: number): string | number => {
    if (typeof rowKey === 'function') return rowKey(row)
    const v = row[rowKey]
    return typeof v === 'string' || typeof v === 'number' ? v : i
  }

  const toggle = (col: DataTableColumn<T>) => {
    const key = col.key
    const first: DataTableSort['dir'] = col.sortDescFirst ? 'desc' : 'asc'
    const next: SortState =
      !sort || sort.key !== key ? { key, dir: first } : sort.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : allowUnsorted ? null : { key, dir: first }
    if (sortProp === undefined) setSortInner(next)
    onSortChange?.(next)
    if (paged && cur !== 0) setPage(0)
  }

  // 가로 스크롤 단서·페이드: 스크롤 컨테이너가 실제로 넘칠 때만(scrollHint={false}면 끔)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hintOff = scrollHint === false || scrollHint === null
  const { overflow: overflowX, atEnd } = useScrollOverflow(scrollRef, !hintOff)
  const hintText = scrollHint === undefined || scrollHint === true ? DEFAULT_TABLE_HINT : scrollHint
  const toneKey = stickyKey ?? columns[0]?.key

  const cellPad = dense ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2.5 text-sm'

  const table = (
    // 바깥 relative: 오른쪽 페이드 자리. 안쪽 relative: 셀 안 absolute 요소(sr-only 등)의 containing block을 스크롤 컨테이너 안에 둬 페이지 가로 넘침을 막는다
    <div className="relative min-w-0">
    <div ref={scrollRef} role={maxHeight || overflowX ? 'region' : undefined} aria-label={maxHeight || overflowX ? caption ?? '데이터 표' : undefined} className={cn('relative overflow-auto rounded-md border border-border', !paged && className)} style={maxHeight ? { maxHeight } : undefined} tabIndex={maxHeight || overflowX ? 0 : undefined}>
      <table className="w-full border-collapse tabular-nums">
        {caption && <caption className="sr-only">{caption}</caption>}
        {/* 머리: 채운 띠 없음(세로 스크롤 고정 머리만 표면색으로 가림), 12px 회색 문장형, 아래 선이 표 안에서 가장 진한 1px 선(앱 화면 규칙, 2026-10-30) */}
        <thead className={cn(maxHeight !== undefined && 'sticky top-0 z-10 bg-surface')}>
          <tr>
            {columns.map(col => {
              const sortable = col.sortable !== false
              const active = sort?.key === col.key
              const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined
              const Icon = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={col.width !== undefined ? { width: col.width } : undefined}
                  className={cn(
                    'whitespace-nowrap border-b border-border font-medium text-muted',
                    dense ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs',
                    // 좁은 화면·터치: 정렬 머리 줄을 44px로(정렬 버튼의 누르는 영역이 첫 행을 덮지 않게 줄 자체를 높인다)
                    sortable && 'touch:h-11',
                    ALIGN[alignOf(col)],
                    col.hideBelow && HIDE_BELOW[col.hideBelow],
                    col.key === stickyKey && STICKY_TH[stickyMode],
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      title={col.headerTitle}
                      onClick={() => toggle(col)}
                      className={cn('touch-hit inline-flex items-center gap-1 rounded-sm hover:text-text', alignOf(col) === 'right' && 'flex-row-reverse', active && 'text-text')}
                    >
                      {/* 머리 내용을 한 덩어리로: 오른쪽 정렬 열의 flex-row-reverse가 Fragment 조각('수량' + 'GEBV')의 어순까지 뒤집지 않게 */}
                      <span>{col.header}</span>
                      <Icon size={12} aria-hidden="true" className={active ? 'opacity-100' : 'opacity-40'} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-muted">
                {emptyText}
              </td>
            </tr>
          )}
          {shown.map((row, i) => {
            const hl = highlight?.(row)
            const act = activeRow?.(row)
            const tone = rowTone?.(row) ?? null
            const { className: rowCls, ...rowAttrs } = rowProps?.(row) ?? {}
            return (
              <tr
                {...rowAttrs}
                key={keyOf(row, i)}
                onClick={
                  onRowClick
                    ? event => {
                        const target = event.target
                        if (target instanceof Element && target.closest('button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [contenteditable="true"]')) return
                        onRowClick(row)
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? e => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? (act !== undefined ? act : hl) : undefined}
                className={cn(
                  // 행 구분선은 머리 아래 선보다 옅게, 지브라 없음
                  'border-b border-border/70 last:border-b-0',
                  onRowClick && 'cursor-pointer',
                  hl ? 'bg-accent/10 hover:bg-accent/15 [--badge-base:var(--color-surface)]' : onRowClick && 'hover:bg-surface-2',
                  act && 'outline outline-2 -outline-offset-2 outline-text',
                  rowCls,
                )}
              >
                {columns.map((col, ci) => {
                  const v = getValue(row, col.key)
                  const sticky = col.key === stickyKey
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'whitespace-nowrap text-text',
                        cellPad,
                        ALIGN[alignOf(col)],
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        sticky && STICKY_TD[stickyMode],
                        sticky && STICKY_TD_SHADOW[tone ?? 'none'][stickyMode],
                        sticky && (hl ? STICKY_TD_HL[stickyMode] : STICKY_TD_BG[stickyMode]),
                        tone && col.key === toneKey && !sticky && TONE_TD[tone],
                      )}
                    >
                      {col.format ? col.format(v, row) : v == null ? '–' : String(v)}
                      {/*
                        현재 행 윤곽(activeRow)은 tr의 outline이라 불투명 바탕의 고정 셀(z-[1])이 그 부분을 가린다.
                        고정 셀 안에 같은 2px 윤곽 조각(위·아래, 첫 열이면 왼쪽)을 다시 그린다. 고정이 풀린 폭(below)에서는 숨긴다.
                      */}
                      {sticky && act && <span aria-hidden="true" className={cn(STICKY_ACTIVE[stickyMode], ci === 0 && 'border-l-2')} />}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    {!hintOff && <ScrollFade show={overflowX && !atEnd} insideBorder className="rounded-r-[5px]" />}
    </div>
  )

  // 단서 유무로 트리 구조가 바뀌면 표가 다시 마운트돼 관찰이 끊기므로, 항상 같은 자리(형제)에 둔다
  const hint = (cls: string) => (!hintOff && overflowX ? <ScrollHint className={cls}>{hintText}</ScrollHint> : null)

  if (!paged)
    return (
      <>
        {hint('mb-1.5')}
        {table}
      </>
    )

  const from = sorted.length === 0 ? 0 : cur * pageSize + 1
  const to = Math.min(sorted.length, (cur + 1) * pageSize)
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {hint('-mb-1.5')}
      {table}
      <nav aria-label={pageLabel} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted tabular-nums">
        <span>
          {sorted.length === 0 ? '0' : `${from}–${to}`} / {sorted.length.toLocaleString('ko-KR')}
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} aria-hidden="true" />} disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            이전
          </Button>
          <span aria-live="polite">
            {cur + 1} / {pages}쪽
          </span>
          <Button size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
            다음
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </nav>
    </div>
  )
}
