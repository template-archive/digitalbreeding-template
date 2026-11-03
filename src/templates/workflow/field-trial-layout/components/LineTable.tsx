import { MapPin } from 'lucide-react'
import { Badge, Button, DataTable, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { CHECK_LABEL, LINE_STATS, type LineStat } from '../data'

/** 42처리를 세로 스크롤(높이 제한) 대신 페이지로 나눈다: 옆 결측·이상치 목록과 높이를 맞추고 표 아래 빈 띠를 없앤다(검토 F3) */
const PAGE_SIZE = 16

const num = (v: number | null, digits = 1) => (v === null ? '—' : formatNumber(v, { digits }))

export function LineTable({ onLocate, activeEntry }: { onLocate: (name: string) => void; activeEntry: number | null }) {
  const columns: DataTableColumn<LineStat>[] = [
    { key: 'entry', header: '처리', numeric: true, width: 56 },
    {
      key: 'name',
      header: '계통명',
      format: (_, r) => (
        <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
          <span className="font-medium">{r.name}</span>
          {r.check && <Badge tone="info">{CHECK_LABEL[r.check]}</Badge>}
        </span>
      ),
    },
    {
      key: 'yield',
      header: '수량 평균',
      headerTitle: '쌀 수량 kg/10a(백미 기준), 결측·이상치 제외',
      numeric: true,
      sortDescFirst: true,
      sortValue: r => r.mean.yield ?? -Infinity,
      format: (_, r) => num(r.mean.yield),
    },
    {
      key: 'yieldIndex',
      header: '수량 지수',
      headerTitle: '계통 평균 수량 / 가람솔 평균 수량 × 100',
      numeric: true,
      sortDescFirst: true,
      sortValue: r => r.yieldIndex ?? -Infinity,
      format: (_, r) => (
        <span className={r.yieldIndex !== null && r.yieldIndex >= 110 ? 'font-semibold text-text' : undefined}>{num(r.yieldIndex)}</span>
      ),
    },
    { key: 'heading', header: '출수기', headerTitle: '파종 후 일수', numeric: true, sortValue: r => r.mean.heading ?? -Infinity, format: (_, r) => num(r.mean.heading) },
    { key: 'culm', header: '간장', headerTitle: 'cm', numeric: true, sortValue: r => r.mean.culm ?? -Infinity, format: (_, r) => num(r.mean.culm) },
    { key: 'yieldReps', header: '수량 반복', headerTitle: '정상 관측 반복 수(수량)', numeric: true, format: v => `${v}/3` },
    {
      key: 'issues',
      header: '결측·이상',
      numeric: true,
      sortDescFirst: true,
      format: v => (Number(v) > 0 ? <Badge tone="warning">{String(v)}건</Badge> : <span className="text-muted">0</span>),
    },
    {
      key: 'locate',
      header: <span className="sr-only">포장에서 보기</span>,
      sortable: false,
      format: (_, r) => (
        <Button size="sm" variant="ghost" icon={<MapPin size={13} aria-hidden="true" />} onClick={() => onLocate(r.name)} aria-label={`${r.name} 포장에서 보기`}>
          <span className="whitespace-nowrap">포장에서 보기</span>
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={LINE_STATS}
      rowKey="entry"
      dense
      pageSize={PAGE_SIZE}
      pageLabel="계통별 요약 페이지"
      stickyColumn={{ key: 'name', below: 'md' }}
      defaultSort={{ key: 'entry', dir: 'asc' }}
      highlight={r => r.check !== null}
      activeRow={r => r.entry === activeEntry}
      caption="계통별 요약(42처리). 평균은 결측·이상치 제외, 수량 지수는 가람솔 = 100"
    />
  )
}
