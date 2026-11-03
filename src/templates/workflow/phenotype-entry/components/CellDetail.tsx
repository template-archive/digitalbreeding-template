import { ArrowLeftRight, Check, CloudUpload, Download, StickyNote } from 'lucide-react'
import { Badge, Button, HATCH_MISSING_DENSE, type BadgeTone } from '@/design-system'
import { formatNumber, formatSigned } from '@/lib/format'
import {
  CHECK_LABEL,
  ENTRY_BY_NO,
  MEMOS,
  PLOTS_BY_ENTRY,
  REP_LABEL,
  SOWING,
  TRAITS,
  TRAIT_KEYS,
  blockLabel,
  cellKey,
  type CellMap,
  type CheckMap,
  type Plot,
  type RemoteChange,
  type TraitKey,
} from '../data'
import { STATUS_GLYPH, STATUS_TEXT, formatCell, type DisplayStatus } from './cells'
import { displayStatus } from './EntryGrid'

interface Props {
  plot: Plot
  trait: TraitKey | null
  values: CellMap
  server: CellMap
  checks: CheckMap
  conflicts: Record<string, RemoteChange>
  dirty: Set<string>
  resolving: Set<string>
  onResolve: (key: string, how: 'server' | 'mine') => void
  onJump: (plot: number, trait: TraitKey | null) => void
}

const TONE: Record<DisplayStatus, BadgeTone> = {
  ok: 'positive',
  range: 'warning',
  dev: 'warning',
  error: 'negative',
  missing: 'neutral',
  empty: 'neutral',
  conflict: 'negative',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const glyph = STATUS_GLYPH[status]
  return (
    <Badge tone={TONE[status]}>
      {glyph ? (
        <span aria-hidden="true" className="font-bold">
          {glyph}
        </span>
      ) : status === 'ok' ? (
        <Check size={11} aria-hidden="true" />
      ) : null}
      <span className="text-text">{STATUS_TEXT[status]}</span>
    </Badge>
  )
}

export function CellDetail({ plot, trait, values, server, checks, conflicts, dirty, resolving, onResolve, onJump }: Props) {
  const e = ENTRY_BY_NO.get(plot.entry)!
  const memo = MEMOS[plot.no]
  const others = PLOTS_BY_ENTRY.get(plot.entry)!.filter(q => q.no !== plot.no)

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xl font-bold tabular-nums text-text">구 {plot.no}</span>
          <span className="text-xs text-muted">
            {plot.row}행 {plot.col}열 · 반복 {REP_LABEL[plot.rep - 1]} · 블록 {blockLabel(plot)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-text">
          <span>
            처리 {plot.entry} · <b className="font-semibold">{e.name}</b>
          </span>
          {e.check && <Badge tone="info">{CHECK_LABEL[e.check]}</Badge>}
        </div>
      </div>

      {trait ? (
        <TraitSection
          plot={plot}
          trait={trait}
          values={values}
          server={server}
          checks={checks}
          conflicts={conflicts}
          dirty={dirty}
          resolving={resolving}
          onResolve={onResolve}
          others={others}
          onJump={onJump}
        />
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted">읽기 전용 열입니다. 형질 칸을 고르면 검증 사유와 반복 비교가 나옵니다.</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {TRAIT_KEYS.map(t => {
              const k = cellKey(plot.no, t)
              const st = displayStatus(k, checks, conflicts)
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => onJump(plot.no, t)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="text-xs text-muted">{TRAITS[t].short}</span>
                    <span className="tabular-nums text-text">
                      {STATUS_GLYPH[st] && <span aria-hidden="true" className="mr-1 text-[11px]">{STATUS_GLYPH[st]}</span>}
                      {values[k] === undefined ? '—' : formatCell(values[k], t)}
                      <span className="sr-only">, {STATUS_TEXT[st]}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <StickyNote size={12} aria-hidden="true" /> 구 메모(시험포장 관리, 읽기 전용)
        </p>
        <p className="mt-1 text-text">{memo ?? '메모 없음'}</p>
      </div>
    </div>
  )
}

function TraitSection({
  plot,
  trait,
  values,
  server,
  checks,
  conflicts,
  dirty,
  resolving,
  onResolve,
  others,
  onJump,
}: Omit<Props, 'trait'> & { trait: TraitKey; others: Plot[] }) {
  const T = TRAITS[trait]
  const k = cellKey(plot.no, trait)
  const v = values[k]
  const check = checks.get(k)!
  const st = displayStatus(k, checks, conflicts)
  const conflict = conflicts[k]
  const isDirty = dirty.has(k)
  const sv = server[k]

  return (
    <>
      <div data-cell-detail={k} data-cell-status={st} className="flex flex-col gap-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            {T.label} · {T.phase}
            {trait === 'heading' && <span className="block font-normal">단위: 파종({SOWING}) 후 일수</span>}
          </span>
          <StatusBadge status={st} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[32px] font-bold leading-none tabular-nums text-text">
            {v === undefined ? '—' : formatCell(v, trait)}
          </span>
          {typeof v === 'number' && <span className="text-sm text-muted">{T.unit}</span>}
          {v === undefined && <span className="text-sm text-muted">미입력</span>}
        </div>
        {check.reason && <p className={`text-[13px] font-medium ${st === 'error' ? 'text-negative' : 'text-text'}`}>{check.reason}</p>}
        <p className="text-xs text-muted tabular-nums">
          불가능 {T.hard[0].toLocaleString('ko-KR')}~{T.hard[1].toLocaleString('ko-KR')} · 허용 {T.soft[0].toLocaleString('ko-KR')}~{T.soft[1].toLocaleString('ko-KR')} {T.unit} · 반복 편차 ±{T.dev} (추정 기준)
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">같은 처리 다른 반복</p>
        <ul className="flex flex-col gap-1">
          {others.map(q => {
            const qk = cellKey(q.no, trait)
            const qs = displayStatus(qk, checks, conflicts)
            const qv = values[qk]
            return (
              <li key={q.no}>
                <button
                  type="button"
                  onClick={() => onJump(q.no, trait)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="text-text">
                    구 {q.no} <span className="text-xs text-muted">반복 {REP_LABEL[q.rep - 1]}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-sm px-1 font-semibold tabular-nums ${qs === 'missing' ? 'text-xs text-muted' : 'text-text'}`}
                      style={qs === 'missing' ? { background: HATCH_MISSING_DENSE } : undefined}
                    >
                      {qv === undefined ? '미입력' : formatCell(qv, trait)}
                    </span>
                    {qs !== 'ok' && qs !== 'empty' && qs !== 'missing' && <StatusBadge status={qs} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {check.otherMean !== undefined && check.diff !== undefined && (
          <p className="mt-2 text-[13px] text-text tabular-nums">
            다른 반복 평균 <b className="font-semibold">{formatNumber(check.otherMean, { digits: 1 })}</b> {T.unit} · 차이{' '}
            <b className="font-semibold text-warning">{formatSigned(check.diff, 1)}</b>
            <span className="block text-xs text-muted">반복 편차 주의는 어느 값이 틀렸는지가 아니라 반복끼리 맞지 않음을 알립니다. 구 메모·배치 위치와 함께 판단하세요. 비교할 다른 반복이 1개면 두 칸이 함께 주의로 표시될 수 있습니다.</span>
          </p>
        )}
      </div>

      <div className="rounded-md border border-border px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <CloudUpload size={12} aria-hidden="true" /> 저장 상태
        </p>
        {conflict ? (
          <div className="mt-1 flex flex-col gap-2">
            <p className="flex items-start gap-1.5 font-medium text-text">
              <ArrowLeftRight size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-negative" />
              <span className="tabular-nums">
                내 값 {formatCell(v, trait)} · 서버 값 {formatCell(conflict.value, trait)}({conflict.by}, {conflict.at})
              </span>
            </p>
            <p className="text-xs text-muted">세션 시작 이후 다른 조사자가 이 칸을 먼저 저장했습니다. 야장과 대조해 어느 값을 남길지 고르세요.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Download size={13} aria-hidden="true" />} disabled={resolving.has(k)} onClick={() => onResolve(k, 'server')}>
                서버 값 받기
              </Button>
              <Button size="sm" variant="danger" icon={<CloudUpload size={13} aria-hidden="true" />} disabled={resolving.has(k)} onClick={() => onResolve(k, 'mine')}>
                {resolving.has(k) ? '덮어쓰는 중…' : '내 값으로 덮어쓰기'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-text tabular-nums">
            서버 값 {sv === undefined ? '없음' : formatCell(sv, trait)} · 내 값 {v === undefined ? '없음' : formatCell(v, trait)}
            <span className={`ml-1.5 text-xs font-medium ${isDirty ? 'text-warning' : 'text-muted'}`}>{isDirty ? '— 미저장' : sv === undefined ? '' : '— 저장됨'}</span>
          </p>
        )}
      </div>
    </>
  )
}
