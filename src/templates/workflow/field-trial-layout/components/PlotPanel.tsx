import type { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, MapPin } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  CHECK_LABEL,
  ENTRY_BY_NO,
  LINE_STAT_BY_ENTRY,
  PLOT_AREA_M2,
  PLOT_BY_NO,
  PLOTS_BY_ENTRY,
  REP_LABEL,
  TRAIT_KEYS,
  TRAITS,
  headingDate,
  issueFor,
  plotHarvestKg,
  type PlotStatus,
  type TraitKey,
} from '../data'

export const MEMO_MAX = 200

function StatusBadge({ s }: { s: PlotStatus }) {
  if (s === 'missing')
    return (
      <Badge tone="warning">
        <AlertTriangle size={11} aria-hidden="true" />
        결측
      </Badge>
    )
  if (s === 'outlier')
    return (
      <Badge tone="negative">
        <AlertOctagon size={11} aria-hidden="true" />
        이상치
      </Badge>
    )
  return <Badge tone="positive">정상</Badge>
}

function fmt(t: TraitKey, v: number | null): string {
  if (v === null) return '—'
  return formatNumber(v, { digits: TRAITS[t].digits })
}

export interface PlotPanelProps {
  plotNo: number | null
  draft: string
  onDraft: (v: string) => void
  onSelect: (plotNo: number) => void
  /** 시트·서랍 안: 카드 틀 없이 그린다(저장 동작은 시트 아래 줄) */
  plain?: boolean
  /** 시트 제목 요소 id(aria-labelledby) */
  titleId?: string
}

/** 메모 저장·취소는 공통 SaveBar(화면 아래)·시트 아래 줄이 맡는다 */
export function PlotPanel({ plotNo, draft, onDraft, onSelect, plain, titleId }: PlotPanelProps) {
  if (plotNo === null)
    return (
      <Card title="구 상세" className="self-start">
        <EmptyState title="포장에서 구를 선택하세요" description="격자의 구를 누르거나 방향키로 이동한 뒤 Enter를 누르면 관측값과 메모가 여기에 나옵니다." />
      </Card>
    )

  const p = PLOT_BY_NO.get(plotNo)!
  const e = ENTRY_BY_NO.get(p.entry)!
  const line = LINE_STAT_BY_ENTRY.get(p.entry)!
  const siblings = PLOTS_BY_ENTRY.get(p.entry)!.filter(q => q.no !== p.no)
  const issues = TRAIT_KEYS.map(t => issueFor(p.no, t)).filter(i => i?.kind === 'outlier')

  const title: ReactNode = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xl font-bold tabular-nums">구 {p.no}</span>
      <span className="text-[13px] font-normal text-muted">
        {p.row}행 {p.col}열 · 반복 {REP_LABEL[p.rep - 1]} · 블록 B{p.block}
      </span>
    </span>
  )
  const body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted tabular-nums">처리 {e.no}</span>
          <span className="text-base font-semibold text-text">{e.name}</span>
          {e.check && <Badge tone="info">{CHECK_LABEL[e.check]}</Badge>}
        </div>

        <table className="w-full text-[13px]">
          <caption className="sr-only">구 {p.no} 관측값과 계통 평균</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="py-1.5 text-left font-medium">형질</th>
              <th scope="col" className="py-1.5 text-right font-medium">값</th>
              <th scope="col" className="py-1.5 pl-2 text-left font-medium">상태</th>
              <th scope="col" className="py-1.5 text-right font-medium">계통 평균</th>
            </tr>
          </thead>
          <tbody>
            {TRAIT_KEYS.map(t => {
              const v = p.values[t]
              const T = TRAITS[t]
              return (
                <tr key={t} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-2 text-left font-medium text-text">
                    {T.label}
                    <span className="block text-[11px] font-normal text-muted">{T.unit}</span>
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    <b className="font-semibold text-text">{fmt(t, v)}</b>
                    {t === 'heading' && v !== null && <span className="block text-[11px] text-muted">{headingDate(v)}</span>}
                    {t === 'yield' && v !== null && (
                      <span className="block text-[11px] text-muted" title={`쌀 수량 × 구 면적 ${PLOT_AREA_M2} m² ÷ 1000. 백미 기준 환산값(실측 정조 무게 아님)`}>
                        구당 백미 {formatNumber(plotHarvestKg(v), { digits: 2 })} kg(환산)
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-2">
                    <StatusBadge s={p.status[t]} />
                  </td>
                  <td className="py-2 text-right text-muted tabular-nums">
                    {line.mean[t] === null ? '—' : formatNumber(line.mean[t]!, { digits: 1 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {p.values.heading !== null && (
          <p className="-mt-2 text-xs text-muted tabular-nums">
            출수기 {p.values.heading}일 · {headingDate(p.values.heading)} (파종 2026-04-22 기준) · 계통 평균은 결측·이상치 제외
          </p>
        )}

        {issues.map(is => (
          <div key={is!.trait} data-plot-issue={`${p.no}-${is!.trait}`} className="flex items-start gap-2 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-[13px] text-text">
            <AlertOctagon size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-negative" />
            <span>
              <b className="font-semibold">{TRAITS[is!.trait].short} 이상치</b> — {is!.reason}. 평균·CV·색 척도·공간 경향 계산에서 제외했습니다.
            </span>
          </div>
        ))}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">같은 계통 다른 반복</p>
          <div className="flex flex-wrap gap-2">
            {siblings.map(q => (
              <Button key={q.no} size="sm" icon={<MapPin size={13} aria-hidden="true" />} onClick={() => onSelect(q.no)}>
                구 {q.no} · 반복 {REP_LABEL[q.rep - 1]}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="ftl-memo" className="text-xs font-medium text-muted">
              구 메모
            </label>
            <span className={`text-[11px] tabular-nums ${draft.length >= MEMO_MAX ? 'text-warning' : 'text-muted'}`} aria-live="polite">
              {draft.length}/{MEMO_MAX}자
            </span>
          </div>
          <textarea
            id="ftl-memo"
            value={draft}
            maxLength={MEMO_MAX}
            rows={3}
            onChange={ev => onDraft(ev.target.value)}
            placeholder="병해충·도복·조사 메모를 남기세요(관측값은 이 화면에서 수정하지 않습니다)"
            data-field="memo"
            className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
      </div>
  )
  if (plain)
    return (
      <div className="flex flex-col gap-3">
        <h3 id={titleId} className="text-[15px] font-semibold leading-snug text-text">
          {title}
        </h3>
        {body}
      </div>
    )
  return (
    <Card title={title} className="self-start">
      {body}
    </Card>
  )
}
