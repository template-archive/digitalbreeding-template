import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { PRESETS, TRAIT_SHORT, blockSpanKb, type Preset, type PresetView, type PresetWindow } from '../data'

interface Row {
  pi: number
  p: Preset
  win: PresetWindow
  v: PresetView
}

/** 리드 블록 표기: "39.5 kb · 8 SNP" / "블록 밖" / "단형" */
export function leadBlockText(win: PresetWindow, v: PresetView): string {
  if (v.mono) return '단형'
  if (!v.leadBlock) return '블록 밖'
  return `${blockSpanKb(win, v.leadBlock).toFixed(1)} kb · ${v.leadBlock.nSnp} SNP`
}

export function geneInText(v: PresetView): string {
  if (v.geneIn == null) return '—'
  return v.geneIn ? '예' : '아니오'
}

/** GWAS 피크 구간 바로 가기(12행, 선택 집단 기준). 행 클릭·Enter로 그 구간으로 이동 */
export function PeakTable({
  windows,
  views,
  groupIndex,
  current,
  onSelect,
}: {
  windows: PresetWindow[]
  views: PresetView[][]
  groupIndex: number
  current: number
  onSelect: (pi: number) => void
}) {
  const rows: Row[] = PRESETS.map(p => ({ pi: p.pi, p, win: windows[p.pi]!, v: views[p.pi]![groupIndex]! }))
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'gene',
      header: '후보 유전자',
      sortValue: r => r.p.planted.gene ?? '',
      format: (_v, r) => (r.p.planted.gene ? <i className="font-medium text-text">{r.p.planted.gene}</i> : <span className="text-muted">후보 없음</span>),
    },
    {
      key: 'trait',
      header: '형질',
      sortValue: r => r.p.planted.trait,
      format: (_v, r) => [r.p.planted, ...r.p.others].map(x => TRAIT_SHORT[x.trait]).filter((s, i, a) => a.indexOf(s) === i).join(' / '),
    },
    {
      key: 'lead',
      header: '리드 SNP',
      sortValue: r => r.win.snps[r.win.leadIdx]!.id,
      format: (_v, r) => (
        <span className="inline-flex flex-col leading-tight">
          <span className="font-mono text-[12px] text-text">{r.win.snps[r.win.leadIdx]!.id}</span>
          {r.p.others.map((o, k) => (
            <span key={o.id} className="font-mono text-[11px] text-muted">
              {TRAIT_SHORT[o.trait]} {r.win.snps[r.win.otherIdx[k]!]!.id}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: 'logP',
      header: '−log10 p',
      numeric: true,
      sortValue: r => r.p.planted.logP,
      sortDescFirst: true,
      format: (_v, r) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <span>{r.p.planted.logP.toFixed(1)}</span>
          {r.p.others.map(o => (
            <span key={o.id} className="text-[11px] text-muted">
              {o.logP.toFixed(1)}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: 'nSnp',
      header: '창 SNP',
      numeric: true,
      sortValue: r => r.win.snps.length,
      sortDescFirst: true,
      format: (_v, r) => (r.v.nPoly < r.win.snps.length ? `${r.v.nPoly}/${r.win.snps.length}` : r.win.snps.length),
      headerTitle: '리드 ± 500 kb 창의 SNP 수(집단 안 단형이 있으면 다형/전체)',
    },
    { key: 'blocks', header: '블록 수', numeric: true, sortValue: r => r.v.blocks.length, sortDescFirst: true, format: (_v, r) => r.v.blocks.length },
    {
      key: 'leadBlock',
      header: '리드 블록',
      numeric: true,
      sortValue: r => (r.v.leadBlock ? blockSpanKb(r.win, r.v.leadBlock) : -1),
      sortDescFirst: true,
      format: (_v, r) =>
        r.v.mono ? (
          <Badge tone="warning">단형</Badge>
        ) : !r.v.leadBlock ? (
          <span className="text-muted">블록 밖</span>
        ) : (
          leadBlockText(r.win, r.v)
        ),
    },
    {
      key: 'proxy',
      header: '프록시',
      headerTitle: '리드와 r² ≥ 0.8인 SNP 수(창 안)',
      numeric: true,
      sortValue: r => (r.v.mono ? -1 : r.v.proxies.length),
      sortDescFirst: true,
      format: (_v, r) => (r.v.mono ? '—' : r.v.proxies.length),
    },
    { key: 'geneIn', header: '유전자 블록 안', align: 'center', sortValue: r => geneInText(r.v), format: (_v, r) => geneInText(r.v) },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="pi"
      dense
      onRowClick={r => onSelect(r.pi)}
      activeRow={r => r.pi === current}
      caption="GWAS 피크 구간 바로 가기: GWAS 결과 뷰어 유의 좌위(본페로니) 리드 SNP ± 500 kb. 행을 누르거나 Enter로 그 구간의 히트맵을 엽니다"
      stickyColumn={{ key: 'gene', below: 'md' }}
    />
  )
}
