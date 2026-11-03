import { CircleAlert, TriangleAlert } from 'lucide-react'
import { FIELD_LABEL, TARGET_SEEDS, type Derived, type FieldIssue, type FieldKey } from '../data'

export interface CellProps {
  crossId: string
  field: FieldKey
  value: string
  issue?: FieldIssue
  modified: boolean
  onChange: (v: string) => void
  /** 입력 칸에 포커스가 오면(행 선택. 표에서 칸을 누를 때 시트·서랍을 열지 않는다) */
  onFocus?: () => void
  /** 입력 칸 너비(rem) */
  width?: string
  placeholder?: string
  inputMode?: 'numeric' | 'text'
  /** 입력 칸 높이. 기본 h-7(표), 카드는 좁은 화면·터치에서 44px(phenotype-entry 좁은 화면 h-11 규격) */
  tall?: boolean
  /** 카드: 문구는 호출 측이 입력 줄 아래 전폭 줄(IssueLine)로 그린다 */
  externalMessage?: boolean
}

export const issueMsgId = (crossId: string, field: FieldKey) => `cr-${crossId}-${field}-msg`

/** 입력 줄 아래 전폭 문구(카드) */
export function IssueLine({ crossId, field, issue }: { crossId: string; field: FieldKey; issue: FieldIssue }) {
  const err = issue.level === 'error'
  const Icon = err ? CircleAlert : TriangleAlert
  return (
    <p id={issueMsgId(crossId, field)} className={`mt-1.5 flex items-start gap-1 text-xs leading-snug ${err ? 'font-medium text-negative' : 'text-warning'}`}>
      <Icon size={12} aria-hidden="true" className="mt-px shrink-0" />
      {issue.message}
    </p>
  )
}

/**
 * 표·카드 공용 입력 칸. 수정 = 잉크 테두리(행 「✎미저장」이 함께 말한다), 오류 = aria-invalid + 짧은 표식.
 * 표 안에서는 긴 문구로 열이 벌어져 재교배 열이 밀려났다(검토 R3). 전체 문구는 저장 바 위 오류 띠·조합 상세·title에 있다.
 */
export function EditCell({ crossId, field, value, issue, modified, onChange, onFocus, width = '4.25rem', placeholder, inputMode = 'numeric', tall, externalMessage }: CellProps) {
  const msgId = issueMsgId(crossId, field)
  const err = issue?.level === 'error'
  const warn = issue?.level === 'warn'
  const border = err ? 'border-negative ring-1 ring-negative' : modified ? 'border-text ring-1 ring-text/40' : warn ? 'border-warning' : 'border-border'
  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        title={issue?.message}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onFocus={onFocus}
        aria-label={`${crossId} ${FIELD_LABEL[field]}`}
        aria-invalid={err || undefined}
        aria-describedby={issue || modified ? msgId : undefined}
        className={`${tall ? 'h-9 touch:h-11' : 'h-7'} rounded-sm border bg-surface px-1.5 text-right text-[13px] tabular-nums text-text placeholder:text-muted ${border}`}
        style={{ width }}
      />
      {issue && !externalMessage && (
        <span id={msgId} className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] leading-none ${err ? 'font-medium text-negative' : 'text-warning'}`}>
          {err ? <CircleAlert size={11} aria-hidden="true" className="shrink-0" /> : <TriangleAlert size={11} aria-hidden="true" className="shrink-0" />}
          {err ? '오류' : '주의'}
          <span className="sr-only"> {issue.message}</span>
        </span>
      )}
      {!issue && modified && (
        <span id={msgId} className="sr-only">
          미저장
        </span>
      )}
    </div>
  )
}

/** 유효 F1 / 목표 — 작은 막대 + "86 / 40" */
export function EffCell({ row }: { row: Derived }) {
  const frac = Math.min(row.eff, TARGET_SEEDS) / TARGET_SEEDS
  const full = row.eff >= TARGET_SEEDS
  const label = row.seeds == null ? '—' : row.status === 'suspect' ? '0' : String(Math.round(row.eff))
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className={`absolute inset-y-0 left-0 rounded-full ${full ? 'bg-muted' : 'bg-warning'}`} style={{ width: `${frac * 100}%` }} />
      </span>
      <span className={`w-14 text-right text-[13px] tabular-nums ${full ? 'text-text' : 'font-semibold text-text'}`}>
        {label}
        <span className="text-muted"> / {TARGET_SEEDS}</span>
      </span>
    </div>
  )
}
