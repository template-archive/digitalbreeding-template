import { useMemo } from 'react'
import { Badge, DataTable, cn, useMediaQuery, type DataTableColumn } from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatFixed } from '@/lib/format'
import { GENOTYPES, MEGA_BY_WINNER, SITES, ZONE_BY_KEY, type Genotype } from '../data'
import { lineColor, zoneColor } from './colors'

export interface RankTableProps {
  selectedId: string
  onSelect: (id: string) => void
}

export function RoleBadge({ g }: { g: Genotype }) {
  if (g.role === 'check') return <Badge tone="neutral">대비({g.checkKind})</Badge>
  if (g.verdict === 'pass') return <Badge tone="positive">출원 후보</Badge>
  return null
}

export function sectorLabel(g: Genotype): string {
  const m = MEGA_BY_WINNER[g.sectorId]
  return m ? m.label : '지역 없음'
}

export function RankTable({ selectedId, onSelect }: RankTableProps) {
  const theme = useChartTheme()
  // xl 미만(표가 넘치는 폭)에서는 결론 열(2년 평균·지수·메가 환경 구역)을 계통 바로 뒤로 당기고 지역 열을 뒤로 보낸다
  const compact = useMediaQuery('(max-width: 1279px)')

  const columns = useMemo<DataTableColumn<Genotype>[]>(() => {
    const siteCols: DataTableColumn<Genotype>[] = SITES.map((s, j) => {
      const zone = ZONE_BY_KEY[s.zone]
      const first = j === 0 || SITES[j - 1]!.zone !== s.zone
      return {
        key: `site${j}`,
        numeric: true,
        width: 74,
        header: (
          <span className="flex flex-col items-end leading-tight">
            <span
              className="mb-0.5 w-full border-t-2 pt-0.5 text-right text-[11px] font-medium text-muted"
              style={{ borderColor: zoneColor(theme, s.zone) }}
            >
              {first ? zone.short : ' '}
            </span>
            <span>{s.short}</span>
          </span>
        ),
        headerTitle: `${s.name}(${zone.label}) 2년 평균, 정렬은 지역 순위`,
        sortValue: g => g.siteRanks[j],
        format: (_v, g) => {
          const top = g.siteRanks[j] === 1
          // 지역 1위 = 데이터 위 선택 표시 규격(글자색 테두리 + 표면색 후광, select-ring). 강조색 채움은 계열색(cat-1)과 겹친다
          return (
            <span
              className={cn('inline-flex items-baseline justify-end gap-0.5 rounded-sm px-1 tabular-nums', top && 'select-ring px-1.5 py-1 font-semibold')}
              title={top ? `${s.short} 1위` : undefined}
            >
              {formatFixed(g.site2[j]!, 1)}
              <span className={cn('text-[11px]', top ? 'text-text' : 'text-muted')}>{top ? '1위' : g.siteRanks[j]}</span>
            </span>
          )
        },
      }
    })
    const idCol: DataTableColumn<Genotype> = {
      key: 'id',
      header: '계통',
      width: 132,
      format: (_v, g) => {
        const c = lineColor(theme, g.id)
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: c ?? 'transparent', boxShadow: c ? undefined : 'inset 0 0 0 1px var(--color-text-muted)' }} />
            <span className="font-medium">{g.id}</span>
            {g.name && <span className="text-muted">{g.name}</span>}
            {/* 구분은 열 대신 계통 칸에: 대부분 비어 있는 96px 열 때문에 1440에서 ASV 열이 페이드 아래로 밀렸다 */}
            {g.role === 'check' && <span className="text-[11px] text-muted">대비</span>}
            {g.role !== 'check' && g.verdict === 'pass' && <span className="text-[11px] font-semibold text-text">후보</span>}
          </span>
        )
      },
    }
    const meanCol: DataTableColumn<Genotype> = {
      key: 'mean',
      header: '2년 평균',
      numeric: true,
      sortDescFirst: true,
      headerTitle: '16개 환경 셀 평균의 평균(kg/10a)',
      format: (_v, g) => (
        <span className="tabular-nums font-semibold">
          {formatFixed(g.mean, 1)}
          <span className="ml-1 text-[11px] font-normal text-muted">{g.rank}</span>
        </span>
      ),
    }
    const indexCol: DataTableColumn<Genotype> = { key: 'index', header: '지수', numeric: true, sortDescFirst: true, headerTitle: '가람솔 대비(%)', format: v => `${formatFixed(v as number, 1)}%` }
    const stabCols: DataTableColumn<Genotype>[] = [
      { key: 'b', header: 'b', numeric: true, headerTitle: 'Finlay–Wilkinson 반응 기울기', format: v => formatFixed(v as number, 2) },
      { key: 'wPct', header: 'W%', numeric: true, headerTitle: 'Wricke 생태가 비율(작을수록 안정)', format: v => formatFixed(v as number, 1) },
      { key: 'asv', header: 'ASV', numeric: true, headerTitle: 'AMMI 안정성 값(작을수록 안정)', format: v => formatFixed(v as number, 2) },
    ]
    const sectorCol: DataTableColumn<Genotype> = {
      key: 'sector',
      header: '메가 환경 구역',
      sortValue: g => sectorLabel(g),
      format: (_v, g) => {
        const m = MEGA_BY_WINNER[g.sectorId]
        return (
          <span className={`whitespace-nowrap ${m ? 'text-text' : 'text-muted'}`}>
            {sectorLabel(g)}
            {g.mega && <span className="ml-1 text-[11px] font-semibold text-muted">승자</span>}
          </span>
        )
      },
    }
    return compact
      ? [idCol, meanCol, indexCol, sectorCol, ...siteCols, ...stabCols]
      : [idCol, ...siteCols, meanCol, indexCol, sectorCol, ...stabCols]
  }, [theme, compact])

  return (
    <DataTable
      columns={columns}
      rows={GENOTYPES}
      rowKey="id"
      dense
      stickyColumn="id"
      defaultSort={{ key: 'mean', dir: 'desc' }}
      onRowClick={g => onSelect(g.id)}
      activeRow={g => g.id === selectedId}
      scrollHint={compact ? '옆으로 밀어 지역별 값 보기 →' : undefined}
      caption="지역 × 계통 2년 평균 쌀 수량과 지역 내 순위, 안정성 지표"
    />
  )
}
