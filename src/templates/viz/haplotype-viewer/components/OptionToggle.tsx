/**
 * 라벨 + 비활성 선택지를 가진 소수 옵션 토글.
 * 넓은 화면: 공통 Segmented(sm, options[].disabled — 비활성 선택지는 aria-disabled + 보조 문구 연결), 좁은 화면: 네이티브 select(disabled option).
 */
import { useId } from 'react'
import { Segmented } from '@/design-system'
import { ChevronDown } from 'lucide-react'

export interface ToggleOption<V extends string> {
  value: V
  label: string
  disabled?: boolean
}

interface Props<V extends string> {
  label: string
  options: ToggleOption<V>[]
  value: V
  onChange: (v: V) => void
  compact: boolean
  /** 비활성 이유(보조 문구) */
  note?: string
}

export function OptionToggle<V extends string>({ label, options, value, onChange, compact, note }: Props<V>) {
  const id = useId()
  const noteId = `${id}-note`

  if (compact) {
    return (
      <div className="inline-flex flex-col gap-0.5">
        <div className="inline-flex items-center gap-2">
          <label htmlFor={id} className="whitespace-nowrap text-xs font-medium text-muted">
            {label}
          </label>
          <div className="relative">
            <select
              id={id}
              value={value}
              aria-describedby={note ? noteId : undefined}
              onChange={e => onChange(e.target.value as V)}
              className="h-8 appearance-none rounded-md border border-border bg-surface py-0 pl-2.5 pr-8 text-[13px] text-text hover:border-muted"
            >
              {options.map(o => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>
        {note && (
          <span id={noteId} className="text-[11px] text-muted">
            {note}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-0.5">
      <div className="inline-flex items-center gap-2">
        <span className="whitespace-nowrap text-xs font-medium text-muted" id={`${id}-l`}>
          {label}
        </span>
        <Segmented<V>
          size="sm"
          ariaLabelledBy={`${id}-l`}
          value={value}
          onChange={onChange}
          options={options.map(o => ({ value: o.value, label: o.label, disabled: o.disabled, describedBy: o.disabled && note ? noteId : undefined }))}
        />
      </div>
      {note && (
        <span id={noteId} className="text-[11px] text-muted">
          {note}
        </span>
      )}
    </div>
  )
}
