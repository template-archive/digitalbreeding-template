import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Badge, HATCH_MISSING_DENSE, ScrollRegion } from '@/design-system'
import {
  CHECK_LABEL,
  ENTRY_BY_NO,
  REP_LABEL,
  SOWING,
  TRAITS,
  blockLabel,
  cellKey,
  editText,
  type CellMap,
  type CheckMap,
  type Plot,
  type RemoteChange,
  type TraitKey,
} from '../data'
import { STATUS_GLYPH, cellAria, cellTitle, formatCell, type DisplayStatus } from './cells'

export type ColId = 'plot' | 'rep' | 'block' | 'entry' | 'name' | TraitKey

export interface GridCol {
  id: ColId
  width: number
  /** 왼쪽 고정 열의 left(px) */
  left?: number
  trait?: TraitKey
}

export interface ActiveCell {
  plot: number
  col: ColId
}

interface Props {
  rows: Plot[]
  columns: GridCol[]
  narrow: boolean
  active: ActiveCell
  onActive: (a: ActiveCell) => void
  values: CellMap
  checks: CheckMap
  conflicts: Record<string, RemoteChange>
  dirty: Set<string>
  /** 값이 바뀌면 활성 칸으로 포커스를 옮기고 보이게 스크롤한다 */
  focusSignal: number
  onCommit: (key: string, text: string) => void
  onPaste: (cells: { key: string; text: string }[], ignored: number) => void
  onReadOnly: () => void
  othersText: (plot: number, trait: TraitKey) => string
}

interface Editing {
  key: string
  text: string
}

const PAGE = 15

export function displayStatus(key: string, checks: CheckMap, conflicts: Record<string, RemoteChange>): DisplayStatus {
  if (conflicts[key]) return 'conflict'
  return checks.get(key)!.status
}

export function EntryGrid({
  rows,
  columns,
  narrow,
  active,
  onActive,
  values,
  checks,
  conflicts,
  dirty,
  focusSignal,
  onCommit,
  onPaste,
  onReadOnly,
  othersText,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>())
  const [editing, setEditingState] = useState<Editing | null>(null)
  const editingRef = useRef<Editing | null>(null)
  const wantFocus = useRef(false)
  const setEditing = (e: Editing | null) => {
    editingRef.current = e
    setEditingState(e)
  }

  const stickyWidth = columns.filter(c => c.left !== undefined).reduce((s, c) => s + c.width, 0)
  const rowIdx = Math.max(0, rows.findIndex(r => r.no === active.plot))
  const colIdx = Math.max(0, columns.findIndex(c => c.id === active.col))
  const firstTrait = columns.findIndex(c => c.trait)
  const lastTrait = columns.length - 1
  const refKey = (plot: number, col: ColId) => `${plot}:${col}`

  const ensureVisible = (el: HTMLElement) => {
    const c = scrollRef.current
    if (!c) return
    const tr = el.parentElement as HTMLElement
    const headH = theadRef.current?.offsetHeight ?? 0
    const top = tr.offsetTop
    const h = tr.offsetHeight
    if (top - headH < c.scrollTop) c.scrollTop = top - headH
    else if (top + h > c.scrollTop + c.clientHeight) c.scrollTop = top + h - c.clientHeight
    const isSticky = el.dataset.sticky === '1'
    if (!isSticky) {
      const left = el.offsetLeft
      const w = el.offsetWidth
      if (left - stickyWidth < c.scrollLeft) c.scrollLeft = left - stickyWidth
      else if (left + w > c.scrollLeft + c.clientWidth) c.scrollLeft = left + w - c.clientWidth
    }
  }

  // 초기: 활성 행이 보이게 그리드 안에서만 스크롤(페이지는 움직이지 않음)
  useLayoutEffect(() => {
    const el = cellRefs.current.get(refKey(active.plot, active.col))
    const c = scrollRef.current
    if (!el || !c) return
    const tr = el.parentElement as HTMLElement
    const headH = theadRef.current?.offsetHeight ?? 0
    c.scrollTop = Math.max(0, tr.offsetTop - headH - c.clientHeight / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 가로로 넘치면(390·768) 활성 칸 열(처음엔 첫 미완료 형질 수장)을 고정 열 바로 옆에 둔다 — 이미 끝난 형질 열이 첫 화면을 차지하지 않게.
  // 열 배열이 바뀔 때(767px 경계를 넘는 폭 변화)도 다시 맞춘다
  useLayoutEffect(() => {
    const el = cellRefs.current.get(refKey(active.plot, active.col))
    const c = scrollRef.current
    if (!el || !c || el.dataset.sticky === '1' || c.scrollWidth <= c.clientWidth) return
    c.scrollLeft = Math.max(0, el.offsetLeft - stickyWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow])

  // 포커스 요청(키보드 이동·클릭·외부 이동)
  useEffect(() => {
    if (!wantFocus.current || editing) return
    wantFocus.current = false
    const el = cellRefs.current.get(refKey(active.plot, active.col))
    if (!el) return
    ensureVisible(el)
    el.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, editing, rows, columns])

  useEffect(() => {
    if (focusSignal === 0) return
    wantFocus.current = true
    const el = cellRefs.current.get(refKey(active.plot, active.col))
    if (el) {
      wantFocus.current = false
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      ensureVisible(el)
      el.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal])

  const go = (r: number, c: number) => {
    if (!rows.length) return
    const rr = Math.min(rows.length - 1, Math.max(0, r))
    const cc = Math.min(columns.length - 1, Math.max(0, c))
    wantFocus.current = true
    onActive({ plot: rows[rr]!.no, col: columns[cc]!.id })
  }
  /** Tab 순서: 형질 칸만, 행 끝에서 다음 행 첫 형질 칸 */
  const tabMove = (back: boolean): boolean => {
    let r = rowIdx
    let c = Math.max(colIdx, firstTrait)
    if (colIdx < firstTrait) c = back ? firstTrait : firstTrait - 1
    if (back) {
      if (c > firstTrait) c--
      else if (r > 0) {
        r--
        c = lastTrait
      } else return false
    } else if (c < lastTrait) c++
    else if (r < rows.length - 1) {
      r++
      c = firstTrait
    } else return false
    go(r, c)
    return true
  }

  const activeKey = () => {
    const col = columns[colIdx]
    return col?.trait ? cellKey(active.plot, col.trait) : null
  }

  const commitEditing = () => {
    const e = editingRef.current
    if (!e) return
    setEditing(null)
    onCommit(e.key, e.text)
  }

  const startEdit = (text?: string) => {
    const k = activeKey()
    if (!k) {
      onReadOnly()
      return
    }
    setEditing({ key: k, text: text ?? editText(values[k]) })
  }

  const onNavKey = (e: KeyboardEvent<HTMLTableElement>) => {
    if (editingRef.current) return
    const ctrl = e.ctrlKey || e.metaKey
    const k = activeKey()
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        return go(rowIdx - 1, colIdx)
      case 'ArrowDown':
        e.preventDefault()
        return go(rowIdx + 1, colIdx)
      case 'ArrowLeft':
        e.preventDefault()
        return go(rowIdx, colIdx - 1)
      case 'ArrowRight':
        e.preventDefault()
        return go(rowIdx, colIdx + 1)
      case 'Home':
        e.preventDefault()
        return ctrl ? go(0, colIdx) : go(rowIdx, firstTrait)
      case 'End':
        e.preventDefault()
        return ctrl ? go(rows.length - 1, colIdx) : go(rowIdx, lastTrait)
      case 'PageUp':
        e.preventDefault()
        return go(rowIdx - PAGE, colIdx)
      case 'PageDown':
        e.preventDefault()
        return go(rowIdx + PAGE, colIdx)
      case 'Enter':
        e.preventDefault()
        return go(rowIdx + (e.shiftKey ? -1 : 1), colIdx)
      case 'Tab':
        if (tabMove(e.shiftKey)) e.preventDefault()
        return
      case 'F2':
        e.preventDefault()
        return startEdit()
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        if (!k) return onReadOnly()
        return onCommit(k, '')
    }
    if (ctrl && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      e.preventDefault()
      if (!k) return onReadOnly()
      return onCommit(k, 'NA')
    }
    if (!ctrl && !e.altKey && e.key.length === 1 && e.key !== ' ') {
      e.preventDefault()
      startEdit(e.key)
    }
  }

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const ctrl = e.ctrlKey || e.metaKey
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(null)
      wantFocus.current = true
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEditing()
      go(rowIdx + (e.shiftKey ? -1 : 1), colIdx)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      commitEditing()
      if (!tabMove(e.shiftKey)) wantFocus.current = true
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      commitEditing()
      go(rowIdx + (e.key === 'ArrowUp' ? -1 : 1), colIdx)
      return
    }
    if (ctrl && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      e.preventDefault()
      editingRef.current = { ...editingRef.current!, text: 'NA' }
      commitEditing()
      wantFocus.current = true
      return
    }
    if (ctrl && (e.key === 's' || e.key === 'S')) {
      // 저장 단축키: 편집 중인 칸을 먼저 확정한다(저장은 상위 window 처리기)
      commitEditing()
      wantFocus.current = true
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLTableElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (editingRef.current && !/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return // 한 칸 붙여넣기는 입력창 기본 동작
    e.preventDefault()
    if (editingRef.current) setEditing(null)
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n')
    const matrix = lines.map(l => l.split('\t'))
    const startCol = colIdx < firstTrait ? firstTrait : colIdx
    const cells: { key: string; text: string }[] = []
    let ignored = 0
    matrix.forEach((cols, r) => {
      cols.forEach((raw, c) => {
        const row = rows[rowIdx + r]
        const col = columns[startCol + c]
        if (!row || !col?.trait) {
          if (raw.trim() !== '') ignored++
          return
        }
        if (raw.trim() === '') return
        cells.push({ key: cellKey(row.no, col.trait), text: raw })
      })
    })
    onPaste(cells, ignored)
    wantFocus.current = true
  }

  const traitHeader = (t: TraitKey) => {
    const T = TRAITS[t]
    return (
      <span className="flex flex-col items-end leading-tight">
        <span className="font-semibold text-text">{narrow ? T.short : T.label}</span>
        <span className="text-[11px] font-normal text-muted tabular-nums">
          {T.unit}
          {t === 'heading' && <sup aria-hidden="true">*</sup>} · {T.soft[0].toLocaleString('ko-KR')}~{T.soft[1].toLocaleString('ko-KR')}
        </span>
      </span>
    )
  }
  const headLabel: Record<string, string> = { plot: '구', rep: '반복', block: '블록', entry: '처리', name: '계통명' }

  const totalWidth = columns.reduce((s, c) => s + c.width, 0)
  const rowH = narrow ? 'h-11' : 'h-9'

  return (
    <ScrollRegion
      label="표현형 입력 그리드(가로·세로 스크롤)"
      hint="옆으로 밀어 나머지 형질 보기 →"
      scrollRef={scrollRef}
      className="relative max-h-[560px] overflow-auto overflow-y-auto rounded-md border border-border bg-surface"
    >
      <table
        role="grid"
        aria-label="표현형 입력 그리드 — 구 126행 × 조사 형질 6열"
        aria-rowcount={rows.length + 1}
        className="table-fixed border-separate border-spacing-0 text-[13px]"
        style={{ width: totalWidth, minWidth: '100%' }}
        onKeyDown={onNavKey}
        onPaste={handlePaste}
      >
        <colgroup>
          {columns.map(c => (
            <col key={c.id} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead ref={theadRef}>
          <tr>
            {columns.map(c => (
              <th
                key={c.id}
                scope="col"
                className={`sticky top-0 border-b border-r border-border border-b-text/25 bg-surface px-2 py-1.5 align-bottom text-xs font-medium text-muted ${c.trait ? 'text-right' : 'text-left'} ${c.left !== undefined ? 'z-[4]' : 'z-[3]'}`}
                style={c.left !== undefined ? { left: c.left } : undefined}
                title={c.trait === 'heading' ? `출수기: 파종(${SOWING}) 후 일수` : undefined}
              >
                {c.trait === 'heading' && <span className="sr-only">출수기 단위: 파종({SOWING}) 후 일수. </span>}
                {c.trait ? traitHeader(c.trait) : headLabel[c.id]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, ri) => {
            const e = ENTRY_BY_NO.get(p.entry)!
            const repStart = ri > 0 && rows[ri - 1]!.rep !== p.rep
            const isActiveRow = p.no === active.plot
            const rowBg = isActiveRow ? 'color-mix(in oklab, var(--color-accent) 9%, var(--color-surface))' : 'var(--color-surface)'
            return (
              <tr key={p.no} aria-rowindex={ri + 2}>
                {columns.map(c => {
                  const isActive = isActiveRow && c.id === active.col
                  const sticky = c.left !== undefined
                  const repBorder = repStart ? 'border-t-2 border-t-[color-mix(in_oklab,var(--color-text)_45%,transparent)]' : ''
                  const base = `${rowH} border-b border-r border-border ${repBorder} ${sticky ? 'sticky z-[2]' : ''} ${isActive ? 'outline-2 -outline-offset-2 outline-text' : ''} ${narrow ? 'scroll-mb-40' : ''}`
                  const setRef = (el: HTMLTableCellElement | null) => {
                    const rk = refKey(p.no, c.id)
                    if (el) cellRefs.current.set(rk, el)
                    else cellRefs.current.delete(rk)
                  }
                  const select = () => {
                    wantFocus.current = true
                    if (editingRef.current) commitEditing()
                    onActive({ plot: p.no, col: c.id })
                  }

                  if (!c.trait) {
                    const content =
                      c.id === 'plot' ? (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold tabular-nums text-text">{p.no}</span>
                          {narrow && <span className="truncate text-[11px] text-muted">{e.name}</span>}
                        </span>
                      ) : c.id === 'rep' ? (
                        REP_LABEL[p.rep - 1]
                      ) : c.id === 'block' ? (
                        blockLabel(p)
                      ) : c.id === 'entry' ? (
                        p.entry
                      ) : (
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate">{e.name}</span>
                          {e.check && (
                            <span className="shrink-0">
                              <Badge tone="info">{CHECK_LABEL[e.check]}</Badge>
                            </span>
                          )}
                        </span>
                      )
                    const Tag = c.id === 'plot' ? 'th' : 'td'
                    return (
                      <Tag
                        key={c.id}
                        ref={setRef}
                        scope={c.id === 'plot' ? 'row' : undefined}
                        role={c.id === 'plot' ? 'rowheader' : 'gridcell'}
                        aria-readonly="true"
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        data-sticky={sticky ? '1' : undefined}
                        onMouseDown={select}
                        className={`${base} px-2 text-left text-xs font-normal text-muted tabular-nums ${c.id === 'name' ? 'text-text' : ''}`}
                        style={{ left: c.left, background: rowBg }}
                        title={c.id === 'name' && e.check ? `${e.name} · ${CHECK_LABEL[e.check]}` : undefined}
                      >
                        {content}
                      </Tag>
                    )
                  }

                  const t = c.trait
                  const k = cellKey(p.no, t)
                  const v = values[k]
                  const check = checks.get(k)!
                  const status = displayStatus(k, checks, conflicts)
                  const isDirty = dirty.has(k)
                  const isEditing = editing?.key === k
                  const glyph = STATUS_GLYPH[status]
                  const bg =
                    status === 'error'
                      ? 'color-mix(in oklab, var(--color-negative) 14%, var(--color-surface))'
                      : status === 'range'
                        ? 'color-mix(in oklab, var(--color-warning) 16%, var(--color-surface))'
                        : status === 'missing'
                          ? HATCH_MISSING_DENSE
                          : isActiveRow
                            ? rowBg
                            : undefined
                  return (
                    <td
                      key={c.id}
                      ref={setRef}
                      role="gridcell"
                      aria-selected={isActive}
                      aria-invalid={status === 'error' ? true : undefined}
                      aria-label={cellAria(p, t, v, status, check, isDirty)}
                      tabIndex={isActive ? 0 : -1}
                      onMouseDown={ev => {
                        if (isEditing) return
                        ev.preventDefault()
                        select()
                      }}
                      onClick={() => {
                        if (narrow && !isEditing) setEditing({ key: k, text: editText(values[k]) })
                      }}
                      onDoubleClick={() => {
                        if (!isEditing) setEditing({ key: k, text: editText(values[k]) })
                      }}
                      title={cellTitle(t, v, status, check, othersText(p.no, t), conflicts[k])}
                      className={`${base} relative px-2 text-right tabular-nums ${status === 'missing' ? 'text-xs font-medium text-muted' : 'text-text'} ${status === 'error' ? 'font-semibold' : ''}`}
                      style={{ background: bg }}
                    >
                      {status === 'error' && <span aria-hidden="true" className="pointer-events-none absolute inset-0 border-2 border-negative" />}
                      {status === 'dev' && <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] rounded-sm border border-dashed border-warning" />}
                      {status === 'conflict' && <span aria-hidden="true" className="pointer-events-none absolute inset-[2px] border-[3px] border-double border-negative" />}
                      {status === 'empty' && <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] rounded-sm border border-dotted border-border" />}
                      {glyph && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-1 top-0.5 text-[11px] font-bold leading-none ${status === 'error' || status === 'conflict' ? 'text-negative' : 'text-warning'}`}
                        >
                          {glyph}
                        </span>
                      )}
                      {isDirty && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-0 top-0 size-0 border-l-[9px] border-t-[9px] border-l-transparent border-t-text"
                        />
                      )}
                      <span className="relative">{formatCell(v, t)}</span>
                      {isEditing && (
                        <input
                          autoFocus
                          aria-label={`${TRAITS[t].label} 입력 — 구 ${p.no}`}
                          inputMode={TRAITS[t].digits === 0 ? 'numeric' : 'decimal'}
                          value={editing.text}
                          onChange={ev => setEditing({ key: k, text: ev.target.value })}
                          onKeyDown={onEditKey}
                          onBlur={() => {
                            if (editingRef.current?.key === k) commitEditing()
                          }}
                          onFocus={ev => ev.currentTarget.setSelectionRange(ev.currentTarget.value.length, ev.currentTarget.value.length)}
                          className="absolute inset-0 z-[1] h-full w-full bg-surface px-2 text-right text-[13px] text-text tabular-nums outline-2 -outline-offset-2 outline-accent"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollRegion>
  )
}
