import { useState } from 'react'
import { DataTable, DivergingBar, type DataTableColumn, type DataTableSort } from '@/design-system'
import { formatDelta } from '@/lib/format'
import { FY, NEXT_FY, PLAN_ITEMS, PLAN_ROWS_GROUPED, PLAN_TOTAL, type PlanRow } from '../data'
import { man, spc } from './fmt'

/** 증감 막대 범위: 비목 증감 최대 절댓값(소계·합계 포함)에서 계산 */
const MAX_NEG = Math.max(...PLAN_ROWS_GROUPED.map(r => -r.delta), 1)
const MAX_POS = Math.max(...PLAN_ROWS_GROUPED.map(r => r.delta), 1)
// 막대 끝 글자 여백: 음수 쪽은 값 글자("▼ 384")가 막대 왼쪽에 붙으므로 넓게, 양수 쪽은 40% 더한다
const DOMAIN: [number, number] = [Math.max(MAX_NEG * 3.2, MAX_POS * 0.45), MAX_POS * 1.4]

const strong = (r: PlanRow) => r.kind !== 'item'

const columns: DataTableColumn<PlanRow>[] = [
  {
    key: 'name',
    header: '비목',
    sortable: false,
    format: (_, r) => (
      <span className={r.kind === 'item' ? 'block w-[10rem] whitespace-normal break-keep pl-3 text-text sm:w-auto sm:min-w-[11rem]' : 'block w-[10rem] whitespace-normal break-keep font-semibold text-text sm:w-auto sm:min-w-[11rem]'}>
        {r.name}
        {r.kind === 'group' && r.reason && <span className="block text-[11px] font-normal text-muted">{r.reason}</span>}
      </span>
    ),
  },
  { key: 'b26', header: `${FY} 예산`, numeric: true, sortable: false, format: (_, r) => <span className={strong(r) ? 'font-semibold' : undefined}>{man(r.b26)}</span> },
  { key: 'fc26', header: `${FY} 연말 전망`, numeric: true, hideBelow: 'sm', sortable: false, format: (_, r) => man(r.fc26) },
  { key: 'b27', header: `${NEXT_FY}안`, numeric: true, sortable: false, format: (_, r) => <span className="font-semibold text-text">{man(r.b27)}</span> },
  {
    key: 'delta',
    header: '증감(만 원)',
    sortable: false,
    width: 200,
    format: (_, r) =>
      r.delta === 0 ? (
        <span className="block min-w-[200px] pl-[38%] text-xs text-muted">변동 없음</span>
      ) : (
        <span className="block min-w-[200px] text-[12px]">
          <DivergingBar value={r.delta} domain={DOMAIN} layout="inline" tone="accent" valueText={formatDelta(r.delta, { digits: 0, unit: '' })} />
        </span>
      ),
  },
  { key: 'deltaPct', header: '증감률', numeric: true, sortable: true, sortDescFirst: true, headerTitle: `${NEXT_FY}안 ÷ ${FY} 예산 − 1`, format: (_, r) => spc(r.deltaPct) },
  { key: 'reason', header: '사유', sortable: false, format: (_, r) => (r.kind === 'item' ? <span className="block min-w-[12rem] text-xs text-muted">{r.reason}</span> : r.kind === 'total' ? <span className="block min-w-[12rem] text-xs text-muted">{r.reason}</span> : null) },
]

/** G. 2027 예산안 비교 표(기본 = 비목 순서 + 그룹 소계 + 합계, 증감률 정렬 시 비목만) */
export function Plan2027Table() {
  const [sort, setSort] = useState<DataTableSort | null>(null)
  const rows = sort ? PLAN_ITEMS : PLAN_ROWS_GROUPED
  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="id"
        dense
        sort={sort}
        onSortChange={setSort}
        stickyColumn="name"
        highlight={r => r.kind === 'total'}
        rowProps={r => ({ className: r.kind === 'group' ? 'bg-surface-2/60' : undefined, 'data-plan-row': r.id })}
        caption={`${FY} 예산과 ${NEXT_FY} 예산안 비교(만 원, 추정). 합계 ${man(PLAN_TOTAL.b26)} → ${man(PLAN_TOTAL.b27)}`}
        scrollHint="옆으로 밀어 증감·사유 보기 →"
      />
      {sort && (
        <p className="text-xs text-muted" role="status">
          증감률로 정렬하는 동안 그룹 소계·합계 행을 숨깁니다(합계 {man(PLAN_TOTAL.b26)} → {man(PLAN_TOTAL.b27)}만 원, {spc(PLAN_TOTAL.deltaPct)}). 머리글을 한 번 더 누르면 비목 순서로 돌아갑니다.
        </p>
      )}
    </div>
  )
}
