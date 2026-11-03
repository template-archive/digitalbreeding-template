/** 육종 계통 67 × 5좌위 유리 대립유전자 보유 요약. 행을 누르면 격자를 육종 계통으로 바꾸고 그 행을 강조 */
import { useMemo, useState } from 'react'
import { Badge, DataTable, Segmented, useMediaQuery, type BadgeTone, type DataTableColumn } from '@/design-system'
import { formatSigned } from '@/lib/format'
import {
  LOCI,
  PARENT_GROUP_LABEL,
  ROLE_LABEL,
  SUBPOP_LABEL,
  summaryOrder,
  type Assign,
  type BreedLine,
  type HapData,
  type LocusKey,
} from '../data'

export interface SumRow {
  i: number
  b: BreedLine
  fav: number
  st: Record<LocusKey, Assign>
  order: number
}

type RoleFilter = 'all' | 'parent' | 'app' | 'var'
const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'parent', label: '부모 후보' },
  { value: 'app', label: '출원 후보' },
  { value: 'var', label: '대비·참고 품종' },
]

const ROLE_TONE: Record<BreedLine['role'], BadgeTone> = { app: 'positive', check: 'neutral', ref: 'info', parent: 'neutral' }

interface Props {
  data: HapData
  selected: LocusKey
  activeLine: string | null
  onPickLine: (id: string) => void
}

/** 대비·참고 품종: GEBV가 계통도 탐색기 재추정값(† 표식) */
const isVariety = (b: BreedLine) => b.role === 'check' || b.role === 'ref'

const PIGM_NOTE = 'Pigm: Pi9와 같은 좌위의 다른 대립유전자 — 이 리드 SNP로 구별 안 됨, 기능 마커(KASP) 확인'

export function SummaryTable({ data, selected, activeLine, onPickLine }: Props) {
  const [filter, setFilter] = useState<RoleFilter>('all')
  const narrow = useMediaQuery('(max-width: 639px)')
  const all = useMemo<SumRow[]>(() => {
    const ord = summaryOrder(data)
    return ord.map((i, k) => ({
      i,
      b: data.breed[i]!,
      fav: data.favCount[i]!,
      st: Object.fromEntries(data.loci.map(L => [L.def.key, L.breed[i]!])) as Record<LocusKey, Assign>,
      order: k,
    }))
  }, [data])
  const rows = all.filter(r => (filter === 'all' ? true : filter === 'var' ? isVariety(r.b) : r.b.role === filter))

  const locCol = (key: LocusKey): DataTableColumn<SumRow> => {
    const def = LOCI.find(l => l.key === key)!
    const isSel = key === selected
    return {
      key: `l-${key}`,
      header: (
        <span className={isSel ? 'rounded-sm bg-active px-1 font-semibold text-text' : undefined}>
          {key}
          {def.kind === 'dir' ? `(${def.effectShort})` : ''}
        </span>
      ),
      headerTitle: def.kind === 'fav' ? `${key} 유리 대립유전자 보유` : `${key} ${def.effectName} 대립유전자(유리 판정 안 함)`,
      sortValue: r => (r.st[key].carry === true ? 1 : 0),
      sortDescFirst: true,
      format: (_, r) => {
        const a = r.st[key]
        const hap = a.hap
        if (def.kind === 'dir')
          return (
            <span className="whitespace-nowrap">
              <span className="font-medium">{hap}</span> <span className="text-muted">{a.carry === null ? '판정 불가' : `${a.carry ? def.effectShort : '—'}${a.inferred ? '(추정)' : ''}`}</span>
            </span>
          )
        const mark = a.carry === null ? '판정 불가' : a.inferred ? (a.carry ? '◐ 추정' : '○ 비보유(추정)') : a.carry ? '● 보유' : '○ 비보유'
        return (
          <span className="whitespace-nowrap">
            <span className="font-medium">{hap}</span> <span className={a.carry ? 'font-semibold text-text' : 'text-muted'}>{mark}</span>
          </span>
        )
      },
    }
  }

  const columns: DataTableColumn<SumRow>[] = [
    {
      key: 'id',
      header: '계통',
      sortValue: r => r.b.id,
      format: (_, r) => <span className="whitespace-nowrap font-medium">{r.b.name ? `${r.b.name} (${r.b.id})` : r.b.id}</span>,
    },
    {
      key: 'role',
      header: '역할',
      sortValue: r => r.order,
      format: (_, r) => <Badge tone={ROLE_TONE[r.b.role]}>{r.b.role === 'parent' ? `부모 후보 ${r.b.group}` : ROLE_LABEL[r.b.role]}</Badge>,
    },
    {
      key: 'subpop',
      header: '하위 집단',
      sortValue: r => r.b.subpop,
      format: (_, r) => <span className="whitespace-nowrap">{SUBPOP_LABEL[r.b.subpop]}{r.b.subpopEstimated ? '*' : ''}</span>,
    },
    {
      key: 'gebv',
      header: '쌀 수량 GEBV(kg/10a)',
      headerTitle: '기준 집단 평균 대비 · † 품종은 계통도 탐색기 재추정값',
      numeric: true,
      sortValue: r => r.b.gebv ?? -999,
      sortDescFirst: true,
      format: (_, r) => <span className="tabular-nums">{r.b.gebv == null ? '—' : `${formatSigned(r.b.gebv, 1)}${isVariety(r.b) ? '†' : ''}`}</span>,
    },
    locCol('sd1'),
    locCol('Pi-ta'),
    locCol('Pi9'),
    locCol('Hd1'),
    locCol('GS3'),
    { key: 'fav', header: '유리 수', headerTitle: '유리형 3좌위(sd1·Pi-ta·Pi9) 중 보유 수', numeric: true, sortDescFirst: true, format: v => <span className="font-semibold tabular-nums">{String(v)}</span> },
    { key: 'pi', header: '도열병 저항성 기록', sortValue: r => r.b.piRecord, format: (_, r) => r.b.piRecord },
    {
      key: 'note',
      header: '비고',
      sortable: false,
      format: (_, r) => {
        const notes: string[] = []
        if (r.b.piRecord === 'Pigm') notes.push(PIGM_NOTE)
        if (r.b.metIdx != null) notes.push(`MET ${r.b.metIdx.toFixed(1)}%`)
        if (r.b.role === 'parent') notes.push(PARENT_GROUP_LABEL[r.b.group!])
        if (!r.b.panelMember) notes.push('임퓨테이션(추정)')
        else notes.push('다양성 패널 구성원')
        return <span className="block min-w-[220px] text-xs text-muted">{notes.join(' · ')}</span>
      },
    },
  ]
  // 좁은 화면(< 640px): 판정 열(유리형 3좌위·유리 수)을 계통 바로 뒤로 당기고 역할·하위 집단·GEBV는 뒤로(390에서 판정이 화면 밖에 숨지 않게)
  const NARROW_ORDER = ['id', 'l-sd1', 'l-Pi-ta', 'l-Pi9', 'fav', 'role', 'l-Hd1', 'l-GS3', 'subpop', 'gebv', 'pi', 'note']
  const shown = narrow ? NARROW_ORDER.map(k => columns.find(c => c.key === k)!).filter(Boolean) : columns

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">역할</span>
        <Segmented ariaLabel="역할 필터" size="sm" value={filter} onChange={setFilter} options={FILTERS} />
        <span className="text-xs text-muted tabular-nums" aria-live="polite">
          {rows.length}행
        </span>
      </div>
      <DataTable
        columns={shown}
        rows={rows}
        rowKey={r => r.b.id}
        dense
        maxHeight={520}
        stickyColumn="id"
        onRowClick={r => onPickLine(r.b.id)}
        activeRow={r => r.b.id === activeLine}
        emptyText="해당 역할의 계통이 없습니다"
        caption="육종 계통 유리 대립유전자 보유 요약. 행을 누르면 유전형 격자에서 그 계통을 강조합니다"
      />
    </div>
  )
}
