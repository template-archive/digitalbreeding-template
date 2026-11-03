import { Badge } from '@/design-system'
import {
  FAIL_LABEL,
  PLATFORM_LABEL,
  callDetail,
  isUnresolved,
  sampleTimeline,
  statusLabel,
  type PlateInfo,
  type Sample,
  type TrackState,
} from '../data'
import { Field, PlatformTag } from './ui'

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'info' | 'neutral'> = {
  통과: 'positive',
  '진행 중': 'negative',
  대기: 'warning',
  '재시퀀싱 대기': 'info',
  'QC 실패 예상': 'warning',
}

/** 샘플 상세 + 이력 타임라인 */
export function SampleDetail({ state, sample, info }: { state: TrackState; sample: Sample; info: PlateInfo }) {
  const { def } = info
  const events = sampleTimeline(state, sample)
  const failed = sample.fail && sample.fail !== 'REQUEST'
  const callTxt = sample.call != null ? `${sample.call.toFixed(1)}%` : '—'
  const cd = callDetail(sample)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-lg font-bold tabular-nums text-text">{sample.id}</span>
          <Badge tone={STATUS_TONE[sample.status] ?? 'neutral'}>{statusLabel(sample, info)}</Badge>
        </div>
        <p className="text-xs tabular-nums text-muted">
          바코드 {sample.barcode} · {def.id} {sample.well}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Field label="플랫폼">
          <span className="inline-flex items-center gap-1.5">
            <PlatformTag platform={sample.platform} /> {PLATFORM_LABEL[sample.platform]}
          </span>
        </Field>
        {sample.platform === 'KASP' ? (
          <Field label="교배 조합 · F2 개체">
            <span className="tabular-nums">
              {sample.cross} · F2 개체 {sample.indiv}
            </span>
          </Field>
        ) : (
          <Field label="계통 · 구분">
            <span className="tabular-nums">
              {sample.line} · {sample.group}
            </span>
          </Field>
        )}
        <Field label="의뢰">
          {def.reqNo} · {def.requester}
        </Field>
        <Field label="목적">{def.purpose}</Field>
        <Field label="콜레이트(call rate)">
          <span className={`font-semibold tabular-nums ${failed ? 'text-negative' : ''}`}>{callTxt}</span>
          {cd && <span className="tabular-nums text-muted"> · {cd}</span>}
        </Field>
        <Field label="실패 원인">
          {sample.fail ? (sample.fail === 'REQUEST' ? `재분석 요청(${sample.reason})` : FAIL_LABEL[sample.fail]) : sample.status === 'QC 실패 예상' ? '미호출 마커 2개 이상(판정 전)' : '—'}
        </Field>
        <Field label="조치">{sample.action ?? '—'}</Field>
        <Field label="재분석 상태 · 예정일">
          {isUnresolved(sample) ? (
            <span className="tabular-nums">
              {statusLabel(sample, info)} · {sample.due}
            </span>
          ) : sample.status === '폐기·대체 개체 사용' ? (
            <span className="tabular-nums">해결(대체 개체) · {sample.due}</span>
          ) : (
            '—'
          )}
        </Field>
      </dl>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-text">이력</h3>
        <ol className="relative flex flex-col" aria-label={`${sample.id} 이력 타임라인`}>
          {events.map((e, i) => {
            const last = i === events.length - 1
            const dot =
              e.kind === 'current'
                ? 'h-3.5 w-3.5 bg-primary'
                : e.kind === 'warn'
                  ? 'h-2.5 w-2.5 bg-warning'
                  : e.kind === 'planned'
                    ? 'h-2.5 w-2.5 border-2 border-dashed border-muted bg-surface'
                    : e.kind === 'future'
                      ? 'h-2.5 w-2.5 border-2 border-border bg-surface'
                      : 'h-2.5 w-2.5 bg-muted'
            const line = events[i + 1]?.kind === 'planned' || events[i + 1]?.kind === 'future' ? 'border-l-2 border-dashed border-border' : 'border-l-2 border-border'
            return (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="relative flex w-3 shrink-0 justify-center">
                  {!last && <span aria-hidden="true" className={`absolute left-1/2 top-3 h-full -translate-x-1/2 ${line}`} />}
                  <span aria-hidden="true" className={`relative z-[1] mt-1 rounded-full ${dot}`} />
                </div>
                <div className={`min-w-0 flex-1 ${e.kind === 'future' || e.kind === 'planned' ? 'text-muted' : 'text-text'}`}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold tabular-nums">{e.date ?? '—'}</span>
                    <span className={`text-xs font-semibold ${e.kind === 'warn' ? 'text-warning' : ''}`}>
                      {e.stage}
                      {e.kind === 'current' && ' · 현재'}
                      {e.kind === 'future' && ' · 아직'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{e.text}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
