import { DataTable, EmptyState, type DataTableColumn } from '@/design-system'
import { useChartTheme } from '@/charts'
import { GROUPS, K_COMPONENTS, lineLabel, type Line } from '../data'
import { groupColor } from './colors'
import { formatFixed } from '@/lib/format'

const f4 = (v: number) => formatFixed(v, 4)

/** 선택 계통 목록. 순서는 ADMIXTURE 막대 순서와 같다 */
export function SelectedTable({ lines }: { lines: Line[] }) {
  const theme = useChartTheme()
  if (lines.length === 0) {
    return <EmptyState title="선택한 계통이 없습니다" description="PCA에서 점을 드래그해 계통을 고르세요. 하위 집단 요약 표의 행을 눌러 집단 전체를 고를 수도 있습니다." />
  }
  const columns: DataTableColumn<Line>[] = [
    { key: 'id', header: '계통', format: (_, l) => <span className="whitespace-nowrap font-medium">{lineLabel(l)}</span>, sortValue: l => l.id },
    {
      key: 'group',
      header: '하위 집단',
      sortValue: l => l.group,
      format: (_, l) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: groupColor(theme, l.group) }} />
          {GROUPS[l.group].label}
        </span>
      ),
    },
    { key: 'maxQ', header: '최대 Q', numeric: true, sortDescFirst: true, format: v => <span className="tabular-nums">{(v as number).toFixed(3)}</span> },
    { key: 'dom', header: '주 성분', format: (_, l) => <span className="whitespace-nowrap">{K_COMPONENTS[4][l.dom]!.label}</span>, sortValue: l => l.dom },
    ...[0, 1, 2].map(
      (k): DataTableColumn<Line> => ({
        key: `pc${k + 1}`,
        header: `PC${k + 1}`,
        numeric: true,
        sortValue: l => l.pc[k],
        format: (_, l) => <span className="tabular-nums">{f4(l.pc[k]!)}</span>,
      }),
    ),
  ]
  return <DataTable columns={columns} rows={lines} rowKey="id" dense maxHeight={340} stickyColumn={{ key: 'id', below: 'md' }} caption="선택 계통 목록(ADMIXTURE 막대 순서)" />
}
