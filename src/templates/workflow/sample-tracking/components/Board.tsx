import type { ReactNode } from 'react'
import { ChevronDown, Eye, RotateCcw } from 'lucide-react'
import { Badge, cn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  DEADLINE,
  STAGES,
  TAT_TARGET,
  md,
  type BoardColumn,
  type Platform,
  type PlateInfo,
  type PlateStats,
  type RerunGroup,
  type StageIdx,
} from '../data'
import { DelayBadge, PLATFORM_COLOR, PlateAlertBadge, PlatformTag } from './ui'

export type PlatformFilter = 'all' | Platform

interface Props {
  columns: BoardColumn[]
  stats: (plateId: string) => PlateStats
  platform: PlatformFilter
  delayedOnly: boolean
  rerunOnly: boolean
  selected: Set<string>
  onToggleSelect: (cardId: string) => void
  onOpenPlate: (plateId: string) => void
  onOpenRerun: (g: RerunGroup) => void
  /** 현재 플레이트 뷰에 열린 플레이트 */
  activePlate: string
  narrow: boolean
  expanded: Set<StageIdx>
  onToggleExpand: (s: StageIdx) => void
}

export const plateCardId = (id: string) => `plate:${id}`
export const rerunCardId = (g: RerunGroup) => `rerun:${g.key}`

const RERUN_STATUS_LABEL: Record<string, string> = {
  '진행 중': '재분석 진행 중',
  대기: '재분석 대기',
  '재시퀀싱 대기': '재시퀀싱 대기',
  '재채취 요청': '재채취 요청',
}

/** 단계 보드(칸반형): 5열 접수 → DNA 추출 → 분석 → QC → 결과 */
export function Board(props: Props) {
  const { columns, narrow, expanded, onToggleExpand } = props
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-5 lg:gap-2.5" role="list" aria-label="단계 보드">
      {columns.map(c => {
        const open = !narrow || expanded.has(c.stage)
        return (
          <div key={c.stage} role="listitem" aria-label={`${STAGES[c.stage]} 열`} className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-2/60">
            <ColumnHeader col={c} narrow={narrow} open={open} onToggle={() => onToggleExpand(c.stage)} />
            {open && (
              <div id={`st-col-${c.stage}`} className="flex flex-col gap-2 p-2 pt-0">
                <ColumnBody {...props} col={c} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ColumnHeader({ col, narrow, open, onToggle }: { col: BoardColumn; narrow: boolean; open: boolean; onToggle: () => void }) {
  const isResult = col.stage === 4
  const inner = (
    <>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-text">
          <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-muted ring-1 ring-border">
            {col.stage + 1}
          </span>
          {STAGES[col.stage]}
          {isResult && <span className="text-[11px] font-medium text-muted">(10월 제공)</span>}
        </span>
        <span className="flex items-center gap-1">
          {col.delayedPlates > 0 && (
            <Badge tone="warning">
              지연 {col.delayedPlates}장
            </Badge>
          )}
          {narrow && <ChevronDown size={16} aria-hidden="true" className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />}
        </span>
      </div>
      <div className="flex w-full items-baseline gap-1.5">
        <span className="text-2xl font-extrabold leading-none tracking-tight text-text tabular-nums">{formatNumber(col.samples)}</span>
        <span className="text-xs text-muted">샘플 · {col.plates.length}장</span>
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
        {isResult ? (
          <span>재분석은 해당 단계 열에 표시</span>
        ) : (
          <span className={col.rerun > 0 ? 'font-semibold text-text' : ''}>
            <RotateCcw size={10} aria-hidden="true" className="mr-0.5 inline" />
            재분석 {formatNumber(col.rerun)}샘플
          </span>
        )}
        {col.delayedPlates > 0 && <span className="text-warning">지연 {formatNumber(col.delayedSamples)}샘플</span>}
      </div>
    </>
  )
  const cls = 'flex w-full flex-col items-start gap-1.5 px-2.5 pb-2 pt-2.5 text-left'
  if (narrow)
    return (
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`st-col-${col.stage}`} className={`${cls} rounded-lg hover:bg-surface-2`}>
        {inner}
      </button>
    )
  return <div className={cls}>{inner}</div>
}

function ColumnBody(props: Props & { col: BoardColumn }) {
  const { col, platform, delayedOnly, rerunOnly } = props
  const plateOk = (p: PlateInfo) => (platform === 'all' || p.def.platform === platform) && (!delayedOnly || p.delay > 0) && !rerunOnly
  const rerunOk = (g: RerunGroup) => (platform === 'all' || g.platform === platform) && !delayedOnly
  const plates = col.plates.filter(plateOk)
  const reruns = col.rerunGroups.filter(rerunOk)

  if (col.stage === 2) {
    // 분석 열: 플랫폼별 소그룹
    const groups: Platform[] = ['KASP', 'GBS', '6K']
    return (
      <>
        {groups.map(pf => {
          if (platform !== 'all' && platform !== pf) return null
          const ps = plates.filter(p => p.def.platform === pf)
          const rs = reruns.filter(g => g.platform === pf)
          return (
            <div key={pf} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-1 pt-1 text-[11px] font-semibold text-muted">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[pf] }} />
                  {pf}
                </span>
                <span className="tabular-nums">{pf === '6K' && col.byPlatform['6K'] === 0 ? '0 · 2026 캠페인 완료' : `${formatNumber(col.byPlatform[pf])}샘플`}</span>
              </div>
              {ps.map(p => (
                <PlateCard key={p.def.id} info={p} {...props} />
              ))}
              {rs.map(g => (
                <RerunCard key={g.key} g={g} {...props} />
              ))}
            </div>
          )
        })}
      </>
    )
  }
  const empty = plates.length === 0 && reruns.length === 0
  return (
    <>
      {plates.map(p => (
        <PlateCard key={p.def.id} info={p} {...props} />
      ))}
      {reruns.map(g => (
        <RerunCard key={g.key} g={g} {...props} />
      ))}
      {empty && <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted">{delayedOnly || rerunOnly || platform !== 'all' ? '조건에 맞는 카드 없음' : '없음'}</p>}
    </>
  )
}

function CardShell({
  id,
  label,
  selected,
  active,
  tone,
  onToggle,
  onOpen,
  children,
}: {
  id: string
  label: string
  selected: boolean
  active: boolean
  tone: 'default' | 'warning' | 'negative' | 'rerun'
  onToggle: () => void
  onOpen: () => void
  children: ReactNode
}) {
  const edge =
    tone === 'warning' ? 'border-l-warning' : tone === 'negative' ? 'border-l-negative' : tone === 'rerun' ? 'border-l-muted border-dashed' : 'border-l-border'
  // 선택(일괄 작업 대상) = select-ring(안쪽 글자색 테두리, shadow-1과 함께 쓰지 않는다) + 체크된 체크박스,
  // 열림(플레이트 뷰에 표시 중) = 글자색 바깥 윤곽 + '열림' 표시. 강조색 링·틴트 바탕은 쓰지 않는다(앱 화면 규칙)
  return (
    <div
      data-card-selected={selected || undefined}
      data-card-active={active || undefined}
      className={cn(
        'relative flex gap-1.5 rounded-md border border-l-4 bg-surface p-2',
        edge,
        selected ? 'select-ring' : 'shadow-1',
        active && 'outline outline-2 outline-offset-2 outline-text',
      )}
    >
      <label className="touch-hit mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`${label} 선택`}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-text)]"
          id={`chk-${id}`}
        />
      </label>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        {children}
        {active && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text">
            <Eye size={12} aria-hidden="true" />
            플레이트 뷰에 열림
          </span>
        )}
        <span className="sr-only">— 플레이트 뷰에서 열기</span>
      </button>
    </div>
  )
}

function PlateCard(props: Props & { info: PlateInfo }) {
  const { info, stats, selected, onToggleSelect, onOpenPlate, activePlate } = props
  const { def, stage } = info
  const st = stats(def.id)
  const id = plateCardId(def.id)
  const tone = info.delay > 0 ? 'warning' : st.alert ? 'negative' : 'default'
  return (
    <CardShell
      id={id}
      label={def.id}
      selected={selected.has(id)}
      active={activePlate === def.id}
      tone={tone}
      onToggle={() => onToggleSelect(id)}
      onOpen={() => onOpenPlate(def.id)}
    >
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-[13px] font-bold tabular-nums text-text">{def.id}</span>
        <PlatformTag platform={def.platform} />
        {info.delay > 0 && <DelayBadge days={info.delay} />}
        {st.alert && <PlateAlertBadge />}
      </span>
      <span className="truncate text-[11px] text-muted">
        시료 {st.n} · {def.requester}
      </span>
      {stage < 4 ? (
        <>
          <span className={`text-[11px] tabular-nums ${info.delay > 0 ? 'font-semibold text-warning' : 'text-text'}`}>
            경과 {info.elapsed}일 · {STAGES[stage]} 마감 {info.deadline}일
          </span>
          <TatBar info={info} />
          <span className="text-[11px] tabular-nums text-muted">목표 결과 {md(info.targetDate)}</span>
          {stage === 3 &&
            (info.awaitingReadout ? (
              <span className="text-[11px] font-semibold text-warning">판독 파일 업로드 대기</span>
            ) : (
              <span className="text-[11px] text-text">
                판독 완료 · 판정 대기 <span className="font-semibold text-warning">QC 실패 예상 {st.expFail}</span>
              </span>
            ))}
          {def.note && (
            <span className="text-[11px] leading-snug text-warning">
              비고: {def.note.text}
              {!def.note.current && ` (${md(def.note.date)})`}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-[11px] tabular-nums text-text">
            통과 {st.pass} · 실패 <span className={st.alert ? 'font-bold text-negative' : ''}>{st.fail}</span>
            {st.alert && ` (${st.failRate.toFixed(1)}%)`}
          </span>
          <span className="text-[11px] tabular-nums text-muted">
            결과 {md(info.dates[4]!)} · TAT {info.tat}일
          </span>
        </>
      )}
    </CardShell>
  )
}

/** 경과일 막대: 전체 폭 = TAT 목표, 눈금 = 현재 단계 마감 */
function TatBar({ info }: { info: PlateInfo }) {
  const tat = TAT_TARGET[info.def.platform]
  const dl = DEADLINE[info.def.platform]
  const pct = Math.min(100, (info.elapsed / tat) * 100)
  const tick = info.deadline !== null ? (info.deadline / tat) * 100 : null
  return (
    <span aria-hidden="true" className="relative mt-0.5 block h-1.5 w-full rounded-full bg-surface-2">
      <span className={`absolute inset-y-0 left-0 rounded-full ${info.delay > 0 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      {dl.slice(0, 3).map(d => (
        <span key={d} className="absolute -top-0.5 h-2.5 w-px bg-border" style={{ left: `${(d / tat) * 100}%` }} />
      ))}
      {tick !== null && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-text" style={{ left: `calc(${tick}% - 1px)` }} />}
    </span>
  )
}

function RerunCard(props: Props & { g: RerunGroup }) {
  const { g, stats, selected, onToggleSelect, onOpenRerun, activePlate } = props
  const id = rerunCardId(g)
  const alert = stats(g.plate).alert
  const label = RERUN_STATUS_LABEL[g.status] ?? g.status
  return (
    <CardShell
      id={id}
      label={`${g.plate} ${label} ${g.samples.length}샘플`}
      selected={selected.has(id)}
      active={false}
      tone="rerun"
      onToggle={() => onToggleSelect(id)}
      onOpen={() => onOpenRerun(g)}
    >
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone={g.status === '진행 중' ? 'negative' : g.status === '대기' ? 'warning' : 'info'}>
          <RotateCcw size={10} aria-hidden="true" />
          {label}
        </Badge>
        {alert && <PlateAlertBadge compact />}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[13px] font-bold tabular-nums text-text">{g.plate}</span>
        <span className="text-[13px] font-bold tabular-nums text-text">· {g.samples.length}샘플</span>
      </span>
      <span className="text-[11px] tabular-nums text-text">예정 {md(g.due)}</span>
      <span className="line-clamp-2 text-[11px] leading-snug text-muted">원인: {g.causes.join(', ')}</span>
      {activePlate === g.plate && <span className="sr-only">현재 플레이트 뷰에 열림</span>}
    </CardShell>
  )
}
