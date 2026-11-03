import { DataTable, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { fmtRate, mmdd, type Derived, type FieldIssues, type FieldKey, type Fields } from '../data'
import { BandBadge, RecrossBadge, StatusBadge, UnsavedMark } from './badges'
import { EditCell, EffCell } from './cells'

export interface EntryProps {
  rows: Derived[]
  fields: Record<string, Fields>
  saved: Record<string, Fields>
  issues: Record<string, FieldIssues>
  /** 미저장 변경이 있는 조합(입력값·진위 수동 변경) */
  dirty: Set<string>
  selected: string
  /** 행·카드를 눌렀을 때: 1280px 미만은 상세 시트·서랍을 연다 */
  onSelect: (id: string) => void
  /** 입력 칸에 포커스가 왔을 때: 선택만 바꾼다(입력 중 시트가 열리지 않게) */
  onFocusRow: (id: string) => void
  onChange: (id: string, key: FieldKey, value: string) => void
}

/** D. 입력 표(md 이상) — 조합 ID 열 고정, 결실률은 계산 열 */
export function EntryTable({ rows, fields, saved, issues, dirty, selected, onSelect, onFocusRow, onChange }: EntryProps) {
  const cell = (key: FieldKey, width: string, placeholder?: string) => (_: unknown, r: Derived) => {
    const id = r.cross.id
    return (
      <EditCell
        crossId={id}
        field={key}
        value={fields[id]![key]}
        issue={issues[id]?.[key]}
        modified={fields[id]![key] !== saved[id]![key]}
        onChange={v => onChange(id, key, v)}
        onFocus={() => onFocusRow(id)}
        width={width}
        placeholder={placeholder}
        inputMode={key === 'date' ? 'text' : 'numeric'}
      />
    )
  }
  const columns: DataTableColumn<Derived>[] = [
    {
      key: 'id',
      header: '조합 ID',
      sortValue: r => r.cross.id,
      format: (_, r) => (
        <span className="flex flex-col leading-tight">
          <span className="font-semibold tabular-nums text-text">{r.cross.id}</span>
          {dirty.has(r.cross.id) && <UnsavedMark />}
        </span>
      ),
    },
    {
      key: 'female',
      header: (
        <span className="flex flex-col leading-tight">
          모본(♀)
          <span className="font-normal text-muted">× 부본(♂)</span>
        </span>
      ),
      sortValue: r => r.cross.female,
      format: (_, r) => (
        <span className="flex flex-col text-[12px] leading-tight tabular-nums">
          <span className="text-text">{r.cross.female}</span>
          <span className="text-muted">× {r.cross.male}</span>
        </span>
      ),
    },
    { key: 'date', header: '교배일', numeric: true, sortValue: r => r.date, headerTitle: `MM-DD, 모본 출수일 + 1~2일`, format: cell('date', '3.5rem', mmdd('2026-08-01')) },
    { key: 'panicles', header: <span className="flex flex-col items-end leading-tight">제웅<span>이삭</span></span>, numeric: true, sortValue: r => r.panicles, format: cell('panicles', '3rem') },
    { key: 'florets', header: <span className="flex flex-col items-end leading-tight">교배<span>영화</span></span>, numeric: true, sortValue: r => r.florets, format: cell('florets', '3.25rem') },
    { key: 'seeds', header: <span className="flex flex-col items-end leading-tight">결실<span>립수</span></span>, numeric: true, sortValue: r => r.seeds ?? -1, sortDescFirst: true, format: cell('seeds', '3.25rem', '입력') },
    {
      key: 'rate',
      header: (
        <span className="flex flex-col items-end leading-tight">
          결실률 · 판정
          <span className="text-[11px] font-normal text-muted">= 립수 / 영화 × 100</span>
        </span>
      ),
      headerTitle: '결실률 = 결실 립수 / 교배 영화 수 × 100 (계산값, 입력하지 않음). 판정: < 12% 결실 저조, > 50% 결실 과다',
      numeric: true,
      sortValue: r => r.rate ?? -1,
      sortDescFirst: true,
      format: (_, r) => (
        <span className="flex items-center justify-end gap-2">
          <span className="tabular-nums text-text">{r.rate == null ? '—' : `${fmtRate(r.rate)}%`}</span>
          <span className="flex w-[5.25rem] justify-start">
            <BandBadge band={r.band} />
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'F1 진위',
      sortValue: r => r.status,
      format: (_, r) => (
        <span className="inline-flex items-center gap-1">
          <StatusBadge status={r.status} discard={r.status === 'confirmed' && !r.manual ? r.nSelf : 0} />
          {r.manual && <span className="text-[11px] font-medium text-warning">수동</span>}
        </span>
      ),
    },
    { key: 'eff', header: <span className="flex flex-col items-end leading-tight">유효 F1<span>/ 목표</span></span>, numeric: true, sortValue: r => r.eff, sortDescFirst: true, format: (_, r) => <EffCell row={r} /> },
    { key: 'recross', header: '재교배', sortValue: r => r.recross ?? '', format: (_, r) => <RecrossBadge row={r} /> },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={r => r.cross.id}
      dense
      stickyColumn="id"
      maxHeight={720}
      onRowClick={r => onSelect(r.cross.id)}
      activeRow={r => r.cross.id === selected}
      // 미저장 행 = 조합 ID 아래 「✎미저장」 + 옅은 면 배경(고정 열까지 같은 면)
      rowProps={r => ({ 'data-unsaved': dirty.has(r.cross.id) ? 'true' : undefined, className: dirty.has(r.cross.id) ? '[&>td]:bg-surface-2' : undefined })}
      caption={`교배 실적 입력 표 ${formatNumber(rows.length)}조합. 교배일·제웅 이삭·교배 영화·결실 립수를 입력하면 결실률과 판정이 다시 계산됩니다`}
      emptyText="조건에 맞는 조합이 없습니다"
    />
  )
}
