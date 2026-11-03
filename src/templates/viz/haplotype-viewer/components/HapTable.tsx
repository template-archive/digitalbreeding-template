/** 선택 좌위의 하플로타입 표(이름 있는 하플로타입 + 희귀·미정). 행을 누르면 격자에서 강조 */
import { useMemo } from 'react'
import { Badge, DataTable, HATCH_MISSING, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { GORDER, NAMED_MIN, RARE, SUBPOP_LABEL, SUBPOP_N, type HapData, type LocusResult } from '../data'
import type { GridColors } from './colors'
import { pct1 } from './FreqBars'

export interface HapRow {
  name: string
  code: string | null
  target: boolean
  panel: number
  topGroup: string
  breed: number
}

export function hapRows(L: LocusResult, data: HapData): HapRow[] {
  return L.cats.map(c => {
    const h = L.named.find(x => x.name === c)
    const byG = GORDER.map(g => ({ g, n: L.panel.filter((a, i) => a.hap === c && data.panel[i]!.group === g).length }))
    const top = byG.reduce((a, b) => (b.n > a.n ? b : a))
    return {
      name: c,
      code: h ? h.code : null,
      target: !!h?.target,
      panel: L.panel.filter(a => a.hap === c).length,
      topGroup: top.n > 0 ? `${SUBPOP_LABEL[top.g]} ${top.n} (${pct1(top.n, SUBPOP_N[top.g])}%)` : '—',
      breed: L.breed.filter(a => a.hap === c).length,
    }
  })
}

interface Props {
  L: LocusResult
  data: HapData
  hapColors: Record<string, string | null>
  gridColors: GridColors
  highlightHap: string | null
  onPick: (hap: string) => void
}

export function HapTable({ L, data, hapColors, gridColors, highlightHap, onPick }: Props) {
  const rows = useMemo(() => hapRows(L, data), [L, data])
  const fav = L.def.kind === 'fav'
  const columns: DataTableColumn<HapRow>[] = [
    {
      key: 'name',
      header: '하플로타입',
      sortable: false,
      format: (_, r) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium">
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-[3px] border border-border"
            style={{ background: hapColors[r.name] ?? HATCH_MISSING }}
          />
          {r.name}
        </span>
      ),
    },
    {
      key: 'code',
      header: `구성(블록 ${L.leadBlock.nSnp} SNP)`,
      sortable: false,
      format: (_, r) =>
        r.code ? (
          <span className="inline-flex gap-px" role="img" aria-label={`구성 ${r.code.replaceAll('M', '주 ').replaceAll('m', '소수 ').trim()}`}>
            {[...r.code].map((ch, k) => (
              <span
                key={k}
                className={`inline-block h-3.5 w-2.5 ${L.leadBlock.from + k === L.leadIdx ? 'outline outline-1 outline-offset-0 outline-[var(--color-accent)]' : ''}`}
                style={{ background: ch === 'm' ? gridColors.minor : gridColors.major }}
              />
            ))}
          </span>
        ) : (
          <span className="text-muted">{r.name === RARE ? `${NAMED_MIN}계통 미만 조합` : '결측으로 둘 이상과 맞음'}</span>
        ),
    },
    {
      key: 'target',
      header: '표적',
      sortable: false,
      format: (_, r) => (r.target ? <Badge tone="info">{fav ? '유리' : '효과'}</Badge> : <span className="text-muted">—</span>),
    },
    {
      key: 'panel',
      header: `패널 ${formatNumber(data.panel.length)}`,
      align: 'right',
      sortable: false,
      format: (_, r) => (
        <span className="tabular-nums">
          {r.panel} <span className="text-muted">({pct1(r.panel, data.panel.length)}%)</span>
        </span>
      ),
    },
    { key: 'topGroup', header: '가장 많은 하위 집단(집단 내 %)', headerTitle: '계통 수가 가장 많은 하위 집단과 그 집단 안 빈도', sortable: false },
    { key: 'breed', header: `육종 계통 ${data.breed.length}`, align: 'right', sortable: false, format: v => <span className="tabular-nums">{String(v)}</span> },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="name"
      dense
      onRowClick={r => onPick(r.name)}
      activeRow={r => r.name === highlightHap}
      highlight={r => r.target}
      caption="리드 블록 SNP 조합(블록 완전 호출 5계통 이상에 이름 부여). 결측 계통은 맞는 하플로타입이 하나일 때만 배정. 최다 하위 집단은 계통 수 기준이라 표본이 큰 집단이 앞서기 쉬우므로 집단 간 빈도 비교는 위 빈도 막대로 한다"
    />
  )
}
