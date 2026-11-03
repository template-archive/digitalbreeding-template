import { DataTable, type DataTableColumn } from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatNumber } from '@/lib/format'
import { GROUPS, LINES, Q_ASSIGN, SUMMARY, type GroupKey, type Line } from '../data'
import { groupColor } from './colors'

interface Row {
  key: GroupKey | 'total'
  label: string
  short: string
  count: number
  share: number
  meanQ: number | null
  yr: number
  yrg: number
  reps: Line[]
  sel: number | null
}

const repText = (l: Line) => (l.name ? `${l.name}(${l.id})` : l.id)

export interface GroupTableProps {
  selected: ReadonlySet<string>
  onToggleGroup: (g: GroupKey) => void
  /** 집단 전체가 선택된 상태인지 */
  isGroupActive: (g: GroupKey) => boolean
}

/** 하위 집단 범례·요약 표. 행 클릭(Enter) = 그 집단 전체 선택, 다시 누르면 해제 */
export function GroupTable({ selected, onToggleGroup, isGroupActive }: GroupTableProps) {
  const theme = useChartTheme()
  const hasSel = selected.size > 0
  const rows: Row[] = SUMMARY.map(s => ({
    key: s.key,
    label: GROUPS[s.key].label,
    short: GROUPS[s.key].short,
    count: s.count,
    share: s.share,
    meanQ: s.meanQ,
    yr: s.yr,
    yrg: s.yrg,
    reps: s.reps,
    sel: hasSel ? LINES.filter(l => l.group === s.key && selected.has(l.id)).length : null,
  }))
  rows.push({
    key: 'total',
    label: '합계',
    short: '',
    count: LINES.length,
    share: 1,
    meanQ: null,
    yr: SUMMARY.reduce((a, s) => a + s.yr, 0),
    yrg: SUMMARY.reduce((a, s) => a + s.yrg, 0),
    reps: [],
    sel: hasSel ? selected.size : null,
  })

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'label',
      header: '하위 집단',
      sortable: false,
      format: (_, r) =>
        r.key === 'total' ? (
          <span className="font-semibold">합계</span>
        ) : (
          <span className="inline-flex items-center gap-2 whitespace-nowrap" title={GROUPS[r.key].desc}>
            <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: groupColor(theme, r.key) }} />
            <span className="font-medium">{r.label}</span>
            <span className="text-xs text-muted">{r.short}</span>
          </span>
        ),
    },
    { key: 'count', header: '계통 수', numeric: true, sortable: false, format: v => <span className="tabular-nums">{formatNumber(v as number)}</span> },
    { key: 'share', header: '비율', numeric: true, sortable: false, format: v => <span className="tabular-nums">{((v as number) * 100).toFixed(1)}%</span> },
    {
      key: 'meanQ',
      header: '평균 소속 계수',
      headerTitle: '집단 소속 계통의 자기 집단 Q 평균. 혼합형은 최대 Q 평균',
      numeric: true,
      sortable: false,
      format: (v, r) =>
        v === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="tabular-nums">
            {(v as number).toFixed(3)}
            {r.key === 'ADM' && <span className="block text-[11px] text-muted">최대 Q 평균</span>}
          </span>
        ),
    },
    {
      key: 'yr',
      header: '육성 / 도입',
      headerTitle: '육성 계통(YR) / 도입 유전자원(YRG)',
      numeric: true,
      sortable: false,
      format: (_, r) => (
        <span className="whitespace-nowrap tabular-nums">
          {r.yr} / {r.yrg}
        </span>
      ),
    },
    {
      key: 'reps',
      header: '대표 계통',
      sortable: false,
      format: (_, r) =>
        r.reps.length === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="block min-w-[220px] whitespace-normal text-[12px] leading-snug">
            {r.reps.map(repText).join(' · ')}
            {r.key === 'ADM' && <span className="block text-[11px] text-muted">{r.reps.map(l => l.note).join(' · ')} 계통</span>}
          </span>
        ),
    },
    {
      key: 'sel',
      header: '선택',
      numeric: true,
      sortable: false,
      format: (v, r) =>
        v === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className={(v as number) > 0 ? 'font-semibold tabular-nums text-text' : 'tabular-nums text-muted'}>
            {v as number} / {r.count}
          </span>
        ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="key"
      dense
      stickyColumn={{ key: 'label', below: 'md' }}
      caption={`하위 집단 요약. 소속 판정: K = 4에서 최대 Q ≥ ${Q_ASSIGN.toFixed(2)}, 미만은 혼합형. 행을 누르면 그 집단 전체를 선택합니다.`}
      onRowClick={r => {
        if (r.key !== 'total') onToggleGroup(r.key)
      }}
      highlight={r => r.key !== 'total' && isGroupActive(r.key)}
      activeRow={r => r.key !== 'total' && isGroupActive(r.key)}
    />
  )
}
