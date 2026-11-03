import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { blockSpanKb, type Block, type PresetView, type PresetWindow } from '../data'

interface Row {
  no: number
  b: Block
  start: number
  end: number
  span: number
  lead: boolean
}

export const BLOCK_EMPTY = 'r² ≥ 0.5 스파인 블록이 없습니다'

export function blockRows(win: PresetWindow, view: PresetView): Row[] {
  return view.blocks.map((b, i) => ({
    no: i + 1,
    b,
    start: win.snps[b.from]!.bp / 1e6,
    end: win.snps[b.to]!.bp / 1e6,
    span: blockSpanKb(win, b),
    lead: b === view.leadBlock,
  }))
}

/** 선택 구간·집단의 LD 블록 목록 */
export function BlockTable({ win, view, caption, narrow }: { win: PresetWindow; view: PresetView; caption: string; narrow: boolean }) {
  const rows = blockRows(win, view)
  const columns: DataTableColumn<Row>[] = [
    { key: 'no', header: '블록', format: v => <span className="font-medium text-text">B{String(v)}</span> },
    { key: 'start', header: '시작~끝(Mb)', numeric: true, format: (_v, r) => `${r.start.toFixed(3)}~${r.end.toFixed(3)}` },
    { key: 'span', header: '폭(kb)', numeric: true, sortDescFirst: true, format: v => (v as number).toFixed(1) },
    { key: 'nSnp', header: 'SNP 수', numeric: true, sortValue: r => r.b.nSnp, sortDescFirst: true, format: (_v, r) => r.b.nSnp },
    { key: 'lead', header: '리드 포함', align: 'center', sortValue: r => (r.lead ? 1 : 0), sortDescFirst: true, format: (_v, r) => (r.lead ? <Badge tone="info">리드 블록</Badge> : <span className="text-muted">—</span>) },
  ]
  return <DataTable columns={columns} rows={rows} rowKey="no" dense maxHeight={narrow ? 260 : 340} highlight={r => r.lead} caption={caption} emptyText={BLOCK_EMPTY} />
}
