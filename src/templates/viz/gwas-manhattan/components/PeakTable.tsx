import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { Badge, DataTable, Tooltip, useMediaQuery, type DataTableColumn } from '@/design-system'
import { formatNumber, formatPValue } from '@/lib/format'
import { SUGGESTIVE, type Lead, type Trait } from '../data'
import { formatBeta } from './format'

export interface PeakRow extends Lead {
  status: '유의' | '제안'
  qtl: number
}

export interface PeakTableProps {
  leads: Lead[]
  trait: Trait
  sigLine: number
  selectedLeadId: string | null
  onSelect: (lead: Lead) => void
  /** 좁은 화면: 염색체·위치 열을 빼고(SNP ID에 들어 있음) 후보 유전자·효과를 p값 바로 뒤로 당긴다 */
  narrow?: boolean
}

export function PeakTable({ leads, trait, sigLine, selectedLeadId, onSelect, narrow = false }: PeakTableProps) {
  // 1280 이상은 표가 QQ 옆 8칸이다: SNP ID·p값과 겹치는 염색체·−log10(p) 열을 빼 가로 스크롤 없이 결론 열(후보 유전자)까지 보인다
  const beside = useMediaQuery('(min-width: 1280px)')
  const rows = useMemo<PeakRow[]>(
    () => leads.map(l => ({ ...l, status: l.logP >= sigLine ? '유의' : '제안', qtl: l.qtlStart })),
    [leads, sigLine],
  )

  const columns = useMemo<DataTableColumn<PeakRow>[]>(() => {
    const all: DataTableColumn<PeakRow>[] = [
      {
        key: 'status',
        header: '상태',
        // 유의 = 발견(위험 아님): 경보색 대신 info 톤
        format: v => <Badge tone={v === '유의' ? 'info' : 'neutral'}>{String(v)}</Badge>,
      },
      { key: 'id', header: 'SNP ID', format: v => <span className="font-mono text-[12px]">{String(v)}</span> },
      { key: 'chrNum', header: '염색체', format: (_v, r) => r.chr },
      { key: 'bp', header: '위치(bp)', numeric: true, format: v => formatNumber(v as number) },
      { key: 'p', header: 'p값', numeric: true, format: v => formatPValue(v as number) },
      { key: 'logP', header: '−log10(p)', numeric: true, format: v => (v as number).toFixed(2) },
      {
        key: 'maf',
        header: (
          <>
            소수 대립유전자
            <br />
            빈도(MAF)
          </>
        ),
        numeric: true,
        format: v => (v as number).toFixed(2),
      },
      {
        key: 'beta',
        header:
          trait.key === 'blast' ? (
            <Tooltip content="음수 = 저항성 증가(병반 점수가 낮을수록 강함)">
              <span className="inline-flex items-center gap-1">
                효과 β <Info size={12} aria-hidden="true" />
              </span>
            </Tooltip>
          ) : (
            '효과 β'
          ),
        numeric: true,
        format: v => formatBeta(v as number, trait.unit),
      },
      {
        key: 'pve',
        header: (
          <>
            설명 분산
            <br />
            비율(PVE)
          </>
        ),
        numeric: true, format: v => `${((v as number) * 100).toFixed(1)}%`,
      },
      {
        key: 'qtl',
        header: 'QTL 구간(Mb)',
        numeric: true,
        format: (_v, r) => `${r.qtlStart.toFixed(2)}–${r.qtlEnd.toFixed(2)}`,
      },
      {
        key: 'gene',
        header: '후보 유전자(거리)',
        format: (_v, r) =>
          r.gene ? (
            <span>
              <em className="font-semibold">{r.gene}</em>{' '}
              <span className="text-muted">({r.geneDistKb} kb)</span>
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ]
    if (beside) return all.filter(c => c.key !== 'chrNum' && c.key !== 'logP')
    if (!narrow) return all
    const order = ['status', 'id', 'p', 'gene', 'beta', 'pve', 'logP', 'maf', 'qtl']
    return order.map(k => all.find(c => c.key === k)!)
  }, [trait, narrow, beside])

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="id"
      dense
      maxHeight={360}
      onRowClick={onSelect}
      activeRow={r => r.id === selectedLeadId}
      caption={`${trait.short} 리드 SNP 표: ±500 kb LD 묶음(clumping)으로 고른 제안선 이상 SNP, p값 오름차순`}
      emptyText={`제안선(−log10 p = ${SUGGESTIVE})을 넘는 SNP가 없습니다`}
    />
  )
}
