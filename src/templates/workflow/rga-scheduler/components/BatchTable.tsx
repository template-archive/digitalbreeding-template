import { CheckCircle2, PencilLine } from 'lucide-react'
import { Badge, DataTable, cn, type DataTableColumn } from '@/design-system'
import {
  BATCHES,
  CROSS27,
  DEADLINE_LABEL,
  DEADLINE_TONE,
  F1_PER_CROSS,
  LINES_PER_CROSS,
  P27,
  crossRange,
  deadlineOf,
  fmtD,
  nextTask,
  stageOf,
  type Batch,
  type BedId,
  type ParentBlock,
  type Plan,
} from '../data'

export interface Row {
  id: string
  kind: 'batch' | 'parent'
  batch?: Batch
  block?: ParentBlock
  crosses: string
  crossSub: string
  round: string
  bed: string
  stage: string
  next: string
  nextDate: string
  sample: string | null
  deadline: ReturnType<typeof deadlineOf> | null
  gs?: number
  f2: string | null
  f2Note?: string
  f2Done: boolean
  dirty: boolean
}

export function buildRows(plan: Plan, dirty: Set<string>, asOf: string): Row[] {
  const rows: Row[] = BATCHES.map(b => {
    const gens = plan.scheds.get(b.id)!
    const st = stageOf(gens)
    const nx = nextTask(gens)
    const dl = deadlineOf(b, gens)
    const nextGen = gens.find(x => x.sow > asOf)
    const beds = [...new Set<BedId>([st.gen.bed, ...(nextGen ? [nextGen.bed] : [])])]
    return {
      id: b.id,
      kind: 'batch',
      batch: b,
      crosses: crossRange(b),
      crossSub: `F1 ${b.f1Crosses * F1_PER_CROSS}주 → ${b.ssdCrosses * LINES_PER_CROSS}계통`,
      round: b.round,
      bed: beds.join(' → '),
      stage: st.label,
      next: nx.label,
      nextDate: nx.date,
      sample: dl.sample,
      deadline: dl,
      gs: b.gs,
      f2: gens[1]!.sow,
      f2Note: b.f2Note,
      f2Done: gens[1]!.sow <= asOf,
      dirty: dirty.has(b.id),
    }
  })
  for (const p of P27)
    rows.push({
      id: p.id,
      kind: 'parent',
      block: p,
      crosses: `부모 ${p.parents!.length}계통`,
      crossSub: p.label,
      round: '2027 1차 교배',
      bed: p.bed,
      stage: '파종 전(빈 베드)',
      next: `첫 파종 ${fmtD(p.from)}`,
      nextDate: p.from,
      sample: null,
      deadline: null,
      f2: null,
      f2Done: false,
      dirty: false,
    })
  return rows
}

/** stacked: 표 셀에서 배지 아래 줄에 GS 연도(열 폭을 줄인다) */
export function DeadlineBadge({ row, stacked = false }: { row: Row; stacked?: boolean }) {
  if (!row.deadline)
    return stacked ? (
      // 표 셀: 기간을 두 줄로(열 폭을 배지 폭에 맞춘다)
      <span className="flex flex-col text-xs leading-tight tabular-nums text-muted">
        <span className="whitespace-nowrap">교배 {fmtD(CROSS27.start)}~</span>
        <span className="whitespace-nowrap">{fmtD(CROSS27.end)}</span>
      </span>
    ) : (
      <span className="text-xs text-muted">교배 {fmtD(CROSS27.start)}~{fmtD(CROSS27.end)}</span>
    )
  const d = row.deadline
  return (
    <span className={cn('inline-flex gap-x-1 gap-y-0.5', stacked ? 'flex-col items-start' : 'flex-wrap items-center')}>
      <Badge tone={DEADLINE_TONE[d.status]}>
        {DEADLINE_LABEL[d.status]} {Math.abs(d.slack)}일
      </Badge>
      <span className="text-[11px] text-muted tabular-nums">
        {row.gs}
        {row.gs === 2028 ? ' 추정' : ''}
      </span>
    </span>
  )
}

function IdCell({ row, selected, showRound = false }: { row: Row; selected: boolean; showRound?: boolean }) {
  return (
    <span className="inline-flex items-start gap-1 whitespace-nowrap">
      {selected ? <CheckCircle2 size={13} aria-label="선택됨" className="mt-0.5 shrink-0 text-text" /> : <span className="inline-block w-[13px]" aria-hidden="true" />}
      <span className="flex flex-col leading-tight">
        <span className="inline-flex items-center gap-1">
          <b className="text-text">{row.id}</b>
          {row.dirty && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning">
              <PencilLine size={11} aria-hidden="true" />
              미저장
            </span>
          )}
        </span>
        {showRound && <span className="text-[11px] text-muted">{row.round}</span>}
      </span>
    </span>
  )
}

function F2Cell({ row }: { row: Row }) {
  if (!row.f2) return <span className="text-muted">—</span>
  return (
    <span className="flex flex-col items-end">
      <span className="whitespace-nowrap tabular-nums">
        {fmtD(row.f2)}
        {row.f2Done ? <span className="text-muted"> 완료</span> : null}
      </span>
      {row.f2Note && <span className="block w-24 whitespace-normal break-keep text-right text-[11px] leading-snug text-muted">{row.f2Note}</span>}
    </span>
  )
}

export function BatchTable({ rows, selected, onSelect }: { rows: Row[]; selected: string | null; onSelect: (id: string) => void }) {
  // 9열 → 7열: 회차는 묶음 아래 줄, 다음 작업은 현재 단계 아래 줄로 합쳐 1440 카드 폭(약 790px)에 들어가게 한다(조합은 범위만, lg 미만에서 숨김 — 상세에 있음)
  const columns: DataTableColumn<Row>[] = [
    { key: 'id', header: '묶음 · 회차', format: (_, r) => <IdCell row={r} selected={r.id === selected} showRound /> },
    { key: 'deadline', header: 'GS 1차 여유', headerTitle: 'GS 1차 시료 채취 마감까지 여유(일)와 대상 연도', sortValue: r => r.deadline?.slack ?? 9999, format: (_, r) => <DeadlineBadge row={r} stacked /> },
    { key: 'sample', header: 'F6 잎 채취', numeric: true, sortValue: r => r.sample ?? '9999', format: v => <span className="whitespace-nowrap tabular-nums">{v ? fmtD(String(v)) : '—'}</span> },
    { key: 'bed', header: '베드', format: v => <span className="whitespace-nowrap tabular-nums">{String(v)}</span> },
    {
      key: 'next',
      header: '단계 · 다음 작업',
      headerTitle: '현재 세대·단계와 다음 작업(날짜순 정렬)',
      sortValue: r => r.nextDate,
      format: (_, r) => (
        <span className="flex flex-col leading-tight">
          <span className="whitespace-nowrap">{r.stage}</span>
          <span className="whitespace-nowrap text-[11px] tabular-nums text-muted">다음 {r.next}</span>
        </span>
      ),
    },
    { key: 'f2', header: 'F2 진입일', numeric: true, sortValue: r => r.f2 ?? '9999', format: (_, r) => <F2Cell row={r} /> },
    {
      key: 'crosses',
      header: '조합',
      hideBelow: 'lg',
      // 주수·계통 수(crossSub)는 묶음 상세 머리에 있다. 표에서는 조합 범위만(열 폭)
      format: (_, r) => (
        <span className="whitespace-nowrap tabular-nums" title={r.crossSub}>
          {r.crosses}
          <span className="sr-only"> · {r.crossSub}</span>
        </span>
      ),
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={r => r.id}
      dense
      stickyColumn="id"
      onRowClick={r => onSelect(r.id)}
      activeRow={r => r.id === selected}
      rowProps={r => ({ 'data-batch-row': r.id })}
      caption="파종 묶음 9개와 2027 교배 부모 2개"
      scrollHint="옆으로 밀어 나머지 열 보기 →"
    />
  )
}

export function BatchCards({ rows, selected, onSelect }: { rows: Row[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="파종 묶음 목록">
      {rows.map(r => {
        const sel = r.id === selected
        return (
          <li key={r.id}>
            <button
              type="button"
              data-batch-row={r.id}
              aria-pressed={sel}
              onClick={() => onSelect(r.id)}
              className={cn('flex w-full flex-col gap-1 rounded-md border bg-surface px-3 py-2 text-left text-[13px]', sel ? 'select-ring border-border' : 'border-border hover:bg-surface-2')}
            >
              <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <IdCell row={r} selected={sel} />
                <span className="text-xs tabular-nums text-muted">
                  {r.crosses} · {r.bed}
                </span>
              </span>
              <span className="text-text">
                {r.stage} · 다음 {r.next}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <DeadlineBadge row={r} />
                {r.f2 && (
                  <span className="tabular-nums">
                    F2 {fmtD(r.f2)}
                    {r.f2Done ? ' 완료' : ''}
                    {r.f2Note ? ` · ${r.f2Note}` : ''}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
