import type { CSSProperties, ReactNode } from 'react'
import { HATCH_MISSING, ScrollRegion, cn, useElementWidth } from '@/design-system'
import {
  AS_OF,
  BATCHES,
  BED_CAP,
  CROSS27,
  DEADLINE_GS,
  HOUSES,
  MAINT,
  METHOD,
  PARENTS,
  WIN,
  WIN_DAYS,
  addDays,
  cellsAt,
  cohortVar,
  diffDays,
  fmtD,
  type Batch,
  type BedId,
  type CohortKey,
  type Gen,
  type ParentBlock,
  type Plan,
} from '../data'

const LABEL_W = 84
const TRACK_MIN = 980
const LANE_H = 22
const LANE_GAP = 3
const ROW_PAD = 5

const pct = (iso: string) => (diffDays(WIN.from, iso) / WIN_DAYS) * 100
const WIN_END_EX = addDays(WIN.to, 1)
const clip = (from: string, toEx: string) => {
  const a = from < WIN.from ? WIN.from : from
  const z = toEx > WIN_END_EX ? WIN_END_EX : toEx
  return a < z ? { a, z, left: pct(a), width: pct(z) - pct(a) } : null
}
const mix = (c: string, p: number) => `color-mix(in oklab, ${c} ${p}%, var(--color-surface))`
/** 막대 1px 안쪽 테두리: 다크 모드에서 옅은 구간(영양 생장·정리)이 배경과 명도가 비슷해 막대 시작점이 흐려지지 않게(검토 G4) */
const barEdge = (color: string, faint: boolean) => ({ boxShadow: `inset 0 0 0 1px ${mix(color, faint ? 34 : 60)}` })
/** 충돌 빗금(negative 사선 + 옅은 negative 바탕) */
export const HATCH_CONFLICT =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-negative) 70%, transparent) 0 2px, transparent 2px 6px), color-mix(in oklab, var(--color-negative) 12%, transparent)'

type BarItem =
  | { kind: 'gen'; key: string; track: string; batch: Batch; gen: Gen; preview: boolean }
  | { kind: 'parent'; key: string; track: string; block: ParentBlock }

export interface Selection {
  type: 'batch' | 'bed'
  id: string
}

export function BedGantt({
  plan,
  saved,
  dirty,
  selection,
  onSelectBatch,
  onSelectBed,
}: {
  plan: Plan
  saved: Plan
  dirty: Set<string>
  selection: Selection
  onSelectBatch: (id: string) => void
  onSelectBed: (bed: BedId) => void
}) {
  const { ref, width } = useElementWidth()
  const pxPerDay = (width || TRACK_MIN) / WIN_DAYS

  // 베드별 막대·레인
  const items: BarItem[] = []
  for (const b of BATCHES) {
    const gens = plan.scheds.get(b.id)!
    const sgens = saved.scheds.get(b.id)!
    for (const x of gens) {
      if (x.until < WIN.from || x.sow > WIN.to) continue
      const s = sgens[x.g - 1]!
      const preview = dirty.has(b.id) && (s.sow !== x.sow || s.bed !== x.bed || s.method !== x.method)
      items.push({ kind: 'gen', key: `${b.id}-${x.g}`, track: b.id, batch: b, gen: x, preview })
    }
  }
  for (const p of PARENTS) if (p.until >= WIN.from && p.from <= WIN.to) items.push({ kind: 'parent', key: p.id, track: 'P', block: p })
  const bedOf = (it: BarItem) => (it.kind === 'gen' ? it.gen.bed : it.block.bed)
  const startOf = (it: BarItem) => (it.kind === 'gen' ? it.gen.sow : it.block.from)

  const rows = HOUSES.map(h => ({
    house: h,
    beds: h.beds.map(bed => {
      const mine = items.filter(it => bedOf(it) === bed)
      const tracks = [...new Set([...mine].sort((a, b) => startOf(a).localeCompare(startOf(b))).map(it => it.track))]
      const lanes = Math.max(1, tracks.length)
      return { bed, mine, tracks, lanes, height: ROW_PAD * 2 + lanes * LANE_H + (lanes - 1) * LANE_GAP }
    }),
  }))

  const months: { iso: string; label: string }[] = []
  for (let d: string = WIN.from; d <= WIN.to; ) {
    const [y, m] = d.split('-').map(Number)
    months.push({ iso: d, label: m === 1 || d === WIN.from ? `${y}년 ${m}월` : `${m}월` })
    d = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  }
  const deadline = DEADLINE_GS[2027]
  const crossBand = clip(CROSS27.start, addDays(CROSS27.end, 1))!
  const conflicts = plan.conflicts.map(r => ({ r, c: clip(r.from, addDays(r.to, 1)) })).filter(x => x.c)

  const marker = (iso: string, label: ReactNode, cls: string, style?: CSSProperties) => (
    <span className={cn('absolute top-0 whitespace-nowrap pl-1 text-[11px] font-semibold leading-5', cls)} style={{ left: `${pct(iso)}%`, ...style }}>
      {label}
    </span>
  )

  const summary = `베드 간트: ${WIN.from}~${WIN.to}, 베드 10개. 오늘 ${AS_OF}, GS 1차 시료 마감 ${deadline}, 2027 1차 교배 ${CROSS27.start}~${CROSS27.end}. 막대를 누르면 묶음 상세, 베드 이름을 누르면 베드 상세가 열립니다`
  return (
    // 넘칠 때만 안내·페이드·region(공통 ScrollRegion). 간트 요약은 안쪽 group 이름으로 늘 남긴다
    <ScrollRegion label="베드 간트(가로 스크롤)" hint="옆으로 밀어 2027년 8월까지 보기 →" className="rounded-md border border-border">
      <div role="group" aria-label={summary} data-chart-ready="true" className="relative" style={{ minWidth: LABEL_W + TRACK_MIN }}>
        {/* 머리: 표식 라벨 + 월 눈금 */}
        <div className="flex border-b border-border bg-surface">
          <div className="sticky left-0 z-20 flex shrink-0 items-end border-r border-border bg-surface px-2 pb-1 text-[11px] font-semibold text-muted" style={{ width: LABEL_W }}>
            베드 · 기준일 셀
          </div>
          <div ref={ref} className="relative h-10 flex-1">
            <div className="absolute inset-x-0 top-0 h-5">
              {marker(AS_OF, `오늘 ${fmtD(AS_OF)}`, 'text-text')}
              {marker(deadline, `GS 1차 시료 마감 ${fmtD(deadline)}`, 'text-warning')}
              {marker(CROSS27.start, '2027 1차 교배', 'text-text')}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-5">
              {months.map(m => (
                <span key={m.iso} className="absolute top-0 whitespace-nowrap border-l border-border pl-1 text-[11px] leading-5 text-muted" style={{ left: `${pct(m.iso)}%` }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="relative">
          {/* 세로 표식(본문 전체 높이) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-0" style={{ left: LABEL_W }}>
            {months.map(m => (
              <span key={m.iso} className="absolute inset-y-0 border-l border-border/70" style={{ left: `${pct(m.iso)}%` }} />
            ))}
            <span className="absolute inset-y-0" style={{ left: `${crossBand.left}%`, width: `${crossBand.width}%`, background: mix(cohortVar('PARENT'), 12) }} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[3]" style={{ left: LABEL_W }}>
            <span className="absolute inset-y-0 border-l-2 border-text" style={{ left: `${pct(AS_OF)}%` }} />
            <span className="absolute inset-y-0 border-l-2 border-dashed border-warning" style={{ left: `${pct(deadline)}%` }} />
          </div>

          {rows.map(({ house, beds }) => (
            <div key={house.id} role="group" aria-label={`${house.label} 베드 ${beds.length}개`}>
              <div className="flex border-b border-border">
                <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface-2 px-2 text-[11px] font-bold leading-5 text-text" style={{ width: LABEL_W }}>
                  {house.label}
                </div>
                <div className="relative h-5 flex-1 bg-surface-2/60" />
              </div>
              {beds.map(row => {
                const now = cellsAt(plan, row.bed, AS_OF)
                const bedSel = selection.type === 'bed' && selection.id === row.bed
                return (
                  <div key={row.bed} className="flex border-b border-border last:border-b-0">
                    <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-border bg-surface px-1.5" style={{ width: LABEL_W, height: row.height }}>
                      <button
                        type="button"
                        data-bed-label={row.bed}
                        aria-pressed={bedSel}
                        onClick={() => onSelectBed(row.bed)}
                        className={cn(
                          'flex w-full flex-col items-start rounded-sm px-1.5 py-0.5 text-left hover:bg-surface-2',
                          bedSel && 'select-ring',
                        )}
                      >
                        <span className="text-[13px] font-bold leading-tight text-text">{row.bed} </span>
                        <span className="text-[11px] leading-tight tabular-nums text-muted">
                          {now}/{BED_CAP}
                          <span className="sr-only">셀 · 베드 상세</span>
                        </span>
                      </button>
                    </div>
                    <div className="relative flex-1" style={{ height: row.height }}>
                      {MAINT.filter(m => m.bed === row.bed).map(m => {
                        const c = clip(m.from, addDays(m.to, 1))
                        if (!c) return null
                        return (
                          <div
                            key={m.from}
                            title={`정비 ${fmtD(m.from)}~${fmtD(m.to)} · ${m.label}`}
                            className="absolute z-[1] flex items-start justify-center overflow-hidden rounded-sm border border-border"
                            style={{ left: `${c.left}%`, width: `${c.width}%`, top: 2, bottom: 2, background: HATCH_MISSING }}
                          >
                            <span className="mt-0.5 rounded-sm bg-surface px-0.5 text-[11px] font-bold leading-tight text-text">정비</span>
                          </div>
                        )
                      })}
                      {row.mine.map(it => {
                        const lane = row.tracks.indexOf(it.track)
                        const top = ROW_PAD + lane * (LANE_H + LANE_GAP)
                        return it.kind === 'gen' ? (
                          <GenBar key={it.key} it={it} top={top} pxPerDay={pxPerDay} selected={selection.type === 'batch' && selection.id === it.batch.id} onClick={() => onSelectBatch(it.batch.id)} />
                        ) : (
                          <ParentBar
                            key={it.key}
                            p={it.block}
                            top={top}
                            pxPerDay={pxPerDay}
                            selected={selection.type === 'batch' && selection.id === it.block.id}
                            onClick={it.block.done ? undefined : () => onSelectBatch(it.block.id)}
                          />
                        )
                      })}
                      {conflicts
                        .filter(x => x.r.bed === row.bed)
                        .map(({ r, c }) => (
                          <div
                            key={r.from}
                            data-conflict="true"
                            title={`충돌 ${r.from}~${r.to} · ${r.maint ? '정비 기간' : `${r.maxCells}/${BED_CAP}셀`}`}
                            className="pointer-events-none absolute z-[4] flex items-start justify-center overflow-hidden rounded-sm border-2 border-negative"
                            style={{ left: `${c!.left}%`, width: `${c!.width}%`, top: 1, bottom: 1, background: HATCH_CONFLICT }}
                          >
                            {c!.width * (pxPerDay * WIN_DAYS) / 100 >= 30 && <span className="mt-0.5 rounded-sm bg-surface px-1 text-[11px] font-bold leading-tight text-negative">충돌</span>}
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </ScrollRegion>
  )
}

function GenBar({ it, top, pxPerDay, selected, onClick }: { it: Extract<BarItem, { kind: 'gen' }>; top: number; pxPerDay: number; selected: boolean; onClick: () => void }) {
  const { batch: b, gen: x, preview } = it
  const endEx = addDays(x.until, 1)
  const c = clip(x.sow, endEx)
  if (!c) return null
  const full = diffDays(x.sow, endEx)
  const visPx = diffDays(c.a, c.z) * pxPerDay
  const done = x.harvest < AS_OF
  const color = cohortVar(b.cohort)
  const seg = (from: string, toEx: string) => ({ left: `${(diffDays(x.sow, from) / full) * 100}%`, width: `${(diffDays(from, toEx) / full) * 100}%` })
  const inner = {
    left: `${(-diffDays(x.sow, c.a) / diffDays(c.a, c.z)) * 100}%`,
    width: `${(full / diffDays(c.a, c.z)) * 100}%`,
  }
  const label = visPx >= 70 ? `${b.id} F${x.g}` : visPx >= 24 ? `F${x.g}` : ''
  const harvestEx = addDays(x.harvest, 1)
  // 잎 채취 마름모가 라벨과 겹치지 않게 라벨을 마름모 오른쪽에서 시작
  const diamondPx = x.sample && x.sample >= c.a ? (diffDays(c.a, x.sample) + 0.5) * pxPerDay : null
  const desc = `${b.id} F${x.g} · ${x.bed} ${x.cells}셀 · 파종 ${fmtD(x.sow)} · 출수 ${fmtD(x.heading)} · 수확 ${fmtD(x.harvest)} · 정리 ~${fmtD(x.until)}${x.method === 'embryo' ? ` · ${METHOD.embryo.label}` : ''}${x.sample ? ` · GS 시료 잎 채취 ${fmtD(x.sample)}` : ''}${done ? ' · 완료' : ''}${preview ? ' · 미저장 미리보기' : ''}`
  return (
    <button
      type="button"
      data-batch-bar={b.id}
      data-gen={x.g}
      aria-label={desc}
      aria-pressed={selected}
      title={desc}
      onClick={onClick}
      className={cn(
        'absolute z-[2] overflow-hidden rounded-[3px] text-left focus-visible:z-10',
        preview && 'border-2 border-dashed border-text',
        selected && 'z-[5] outline outline-2 outline-offset-1 outline-text',
      )}
      style={{ left: `${c.left}%`, width: `${c.width}%`, top, height: LANE_H }}
    >
      <span aria-hidden="true" className="absolute inset-y-0" style={inner}>
        <span className="absolute inset-y-0" style={{ ...seg(x.sow, x.heading), background: mix(color, done ? 16 : 30) }} />
        <span className="absolute inset-y-0" style={{ ...seg(x.heading, harvestEx), background: mix(color, done ? 34 : 78) }} />
        <span className="absolute inset-y-0" style={{ ...seg(harvestEx, endEx), background: mix(color, done ? 8 : 14) }} />
        <span className="absolute inset-y-0 w-px bg-text/50" style={{ left: seg(x.sow, x.heading).width }} />
        {x.sample && (
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-surface bg-text"
            style={{ left: `${((diffDays(x.sow, x.sample) + 0.5) / full) * 100}%` }}
          />
        )}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px]" style={barEdge(color, done)} />
      {label && (
        <span
          aria-hidden="true"
          className={cn('relative whitespace-nowrap px-1 text-[11px] font-semibold leading-[18px]', done ? 'text-muted' : 'text-text')}
          style={diamondPx !== null && diamondPx < 90 ? { paddingLeft: diamondPx + 8 } : undefined}
        >
          {label}
        </span>
      )}
    </button>
  )
}

function ParentBar({ p, top, pxPerDay, selected, onClick }: { p: ParentBlock; top: number; pxPerDay: number; selected: boolean; onClick?: () => void }) {
  const endEx = addDays(p.until, 1)
  const c = clip(p.from, endEx)
  if (!c) return null
  const full = diffDays(p.from, endEx)
  const visPx = diffDays(c.a, c.z) * pxPerDay
  const color = cohortVar('PARENT' as CohortKey)
  const inner = { left: `${(-diffDays(p.from, c.a) / diffDays(c.a, c.z)) * 100}%`, width: `${(full / diffDays(c.a, c.z)) * 100}%` }
  const crossAt = (diffDays(p.from, p.crossStart) / full) * 100
  const n = p.parents?.length
  const full2 = `${p.id} 부모${n ? ` ${n}계통` : ''}`
  const label = visPx >= 120 ? full2 : visPx >= 40 ? p.id : ''
  const desc = `${full2} · ${p.label} · ${p.bed} ${p.cells}셀 · 첫 파종 ${fmtD(p.from)} · 교배 시작 ${fmtD(p.crossStart)} · 점유 ~${fmtD(p.until)}${p.done ? ' · 완료' : ''}`
  const body = (
    <>
      <span aria-hidden="true" className="absolute inset-y-0" style={inner}>
        <span className="absolute inset-y-0 left-0" style={{ width: `${crossAt}%`, background: mix(color, p.done ? 16 : 30) }} />
        <span className="absolute inset-y-0 right-0" style={{ left: `${crossAt}%`, background: mix(color, p.done ? 34 : 70) }} />
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px]" style={barEdge(color, !!p.done)} />
      {label && <span aria-hidden="true" className={cn('relative whitespace-nowrap px-1 text-[11px] font-semibold leading-[18px]', p.done ? 'text-muted' : 'text-text')}>{label}</span>}
    </>
  )
  const cls = cn('absolute z-[2] overflow-hidden rounded-[3px] text-left', selected && 'z-[5] outline outline-2 outline-offset-1 outline-text')
  const style = { left: `${c.left}%`, width: `${c.width}%`, top, height: LANE_H }
  return onClick ? (
    <button type="button" data-batch-bar={p.id} aria-label={desc} aria-pressed={selected} title={desc} onClick={onClick} className={cls} style={style}>
      {body}
    </button>
  ) : (
    <div role="img" aria-label={desc} title={desc} className={cls} style={style}>
      {body}
    </div>
  )
}

/** 간트 범례 */
export function GanttLegend() {
  const sw = (style: CSSProperties, cls = '') => <span aria-hidden="true" className={cn('inline-block h-3 w-5 rounded-[2px]', cls)} style={style} />
  const items: { key: string; el: ReactNode; label: string }[] = [
    ...(['CR25', 'CR26', 'PARENT'] as CohortKey[]).map(c => ({
      key: c,
      el: sw({ background: `linear-gradient(90deg, ${mix(cohortVar(c), 30)} 0 55%, ${mix(cohortVar(c), 78)} 55%)` }),
      label: c === 'PARENT' ? '교배 부모(옅게 생육 · 진하게 교배·수확)' : `${c === 'CR25' ? 'CR25' : 'CR26'} 코호트(옅게 영양 생장 · 진하게 등숙)`,
    })),
    { key: 'done', el: sw({ background: mix('var(--color-text-muted)', 22) }), label: '완료(채도 낮춤)' },
    { key: 'sample', el: <span aria-hidden="true" className="inline-block size-2.5 rotate-45 bg-text" />, label: 'GS 시료 잎 채취(F6 파종 18일)' },
    { key: 'maint', el: sw({ background: HATCH_MISSING }, 'border border-border'), label: '정비' },
    { key: 'today', el: <span aria-hidden="true" className="inline-block h-3 border-l-2 border-text" />, label: '오늘' },
    { key: 'deadline', el: <span aria-hidden="true" className="inline-block h-3 border-l-2 border-dashed border-warning" />, label: 'GS 1차 시료 마감' },
    { key: 'band', el: sw({ background: mix(cohortVar('PARENT'), 12) }), label: '2027 1차 교배 기간' },
    { key: 'preview', el: sw({}, 'border-2 border-dashed border-text'), label: '미저장 미리보기' },
    { key: 'conflict', el: sw({ background: HATCH_CONFLICT }, 'border-2 border-negative'), label: '충돌' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="간트 범례">
      {items.map(it => (
        <li key={it.key} className="inline-flex items-center gap-1.5">
          {it.el}
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}
