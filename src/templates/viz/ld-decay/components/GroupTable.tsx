import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatFixed, formatNumber } from '@/lib/format'
import { GROUPS, SMALL_N, bgFold, kb0, type DecayGroup, type GroupKey } from '../data'
import { groupColor } from './colors'

interface Row {
  key: GroupKey
  label: string
  g: DecayGroup
}

/** 집단 비교 표(12개 염색체 통합). 행을 누르면 그 집단을 선택한다 */
export function GroupTable({ groups, selected, onSelect }: { groups: DecayGroup[]; selected: GroupKey; onSelect: (g: GroupKey) => void }) {
  const t = useChartTheme()
  const rows: Row[] = groups.map(g => ({ key: g.key, label: GROUPS.find(x => x.key === g.key)!.label, g }))
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'label',
      header: '집단',
      sortable: false,
      format: (_v, r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: groupColor(t, r.key) }} />
          <span className="font-medium text-text">{r.label}</span>
          {r.g.n <= SMALL_N && <Badge tone="warning">표본 작음(n = {r.g.n})</Badge>}
        </span>
      ),
    },
    { key: 'n', header: 'n', numeric: true, sortValue: r => r.g.n, sortDescFirst: true, format: (_v, r) => formatNumber(r.g.n) },
    { key: 'near', header: '근거리 r²', headerTitle: '거리 0~10 kb 쌍의 평균 r²', numeric: true, sortValue: r => r.g.near, sortDescFirst: true, format: (_v, r) => formatFixed(r.g.near, 3) },
    {
      key: 'bg',
      header: '배경 r²',
      headerTitle: '다른 염색체 SNP 쌍(비연관)의 평균 r², 1/n = 표본 크기만으로 기대되는 배경',
      numeric: true,
      sortValue: r => r.g.bg,
      sortDescFirst: true,
      format: (_v, r) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>{formatFixed(r.g.bg, 3)}</span>
          <span className="text-[11px] text-muted">
            1/n = {formatFixed(1 / r.g.n, 4)} · {formatFixed(bgFold(r.g), r.key === 'ALL' ? 1 : 2)}배
          </span>
        </span>
      ),
    },
    { key: 'h', header: '반감 거리(kb)', headerTitle: '적합 곡선이 (r²₀ + b)/2로 떨어지는 거리 = h', numeric: true, sortValue: r => r.g.fit.h, sortDescFirst: true, format: (_v, r) => formatFixed(r.g.fit.h, 1) },
    {
      key: 'd02',
      header: 'd₀.₂(kb)',
      headerTitle: '적합 곡선이 r² = 0.2와 만나는 거리',
      numeric: true,
      sortValue: r => r.g.fit.d02 ?? 0,
      sortDescFirst: true,
      format: (_v, r) => <b className="text-text">{kb0(r.g.fit.d02)}</b>,
    },
    { key: 'pairs', header: '쌍 수', numeric: true, sortValue: r => r.g.pairs, sortDescFirst: true, format: (_v, r) => formatNumber(r.g.pairs) },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="key"
      dense
      onRowClick={r => onSelect(r.key)}
      activeRow={r => r.key === selected}
      caption="집단별 LD 비교(12개 염색체 통합): 근거리 r², 배경 r², 반감 거리, r² 0.2 교차 거리, 쌍 수"
      stickyColumn={{ key: 'label', below: 'md' }}
    />
  )
}
