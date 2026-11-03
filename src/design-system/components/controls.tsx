import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

// ---------------- Tabs ----------------

export interface TabsProps<V extends string = string> {
  /** label은 문자열이 보통이다. 개수를 회색으로 붙일 때 ReactNode(갤러리 「전체 33」, 2026-11-02 하위 호환 확장) */
  items: { id: V; label: ReactNode }[]
  value: V
  onChange: (id: V) => void
  className?: string
  /** 접근성 이름 */
  ariaLabel?: string
}

/** 탭(밑줄형). 좌우 화살표로 이동. 패널은 호출 측이 렌더한다. */
export function Tabs<V extends string = string>({ items, value, onChange, className, ariaLabel }: TabsProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % items.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = items.length - 1
    if (n < 0) return
    e.preventDefault()
    onChange(items[n]!.id)
    refs.current[n]?.focus()
  }
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {items.map((it, i) => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            ref={el => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors touch:min-h-11',
              // 활성 = 잉크 글자 + 2px 잉크 밑줄(크롬에 강조색을 쓰지 않는다, 2026-10-30)
              active ? 'border-text text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- Segmented ----------------

export interface SegmentedOption<V extends string = string> {
  value: V
  /** 문자열이 보통이다. 색 점·'(권고)' 같은 보조 표기를 넣을 때 ReactNode */
  label: ReactNode
  /** 고를 수 없는 선택지: aria-disabled + 취소선, 클릭·화살표 이동에서 빠진다(포커스 순서에는 남지 않음) */
  disabled?: boolean
  /** 버튼에 붙일 data-* 속성(QA 선택자 등). 예: { 'data-decision-option': 'promote' } */
  data?: Record<`data-${string}`, string>
  /** 버튼 aria-describedby(예: 비활성 이유 문구의 id) */
  describedBy?: string
  /** 버튼 title */
  title?: string
}

export interface SegmentedProps<V extends string = string> {
  options: SegmentedOption<V>[]
  /** null이면 아무것도 선택하지 않은 상태(미결정 등). 이때 첫 활성 선택지가 탭 정지점이 된다 */
  value: V | null
  onChange: (v: V) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
  /** 화면에 보이는 라벨 요소의 id(ariaLabel 대신) */
  ariaLabelledBy?: string
  className?: string
  /** 각 버튼에 더할 클래스(높이·아이콘 정렬 등). 예: 'inline-flex min-h-8 items-center gap-1' */
  optionClassName?: string
}

/** 소수 옵션 토글(라디오 그룹). 좁은 화면·터치에서는 선택지마다 실제 크기가 최소 44px */
export function Segmented<V extends string = string>({ options, value, onChange, size = 'md', ariaLabel, ariaLabelledBy, className, optionClassName }: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0)
  const activeIdx = options.findIndex(o => o.value === value)
  const tabStop = activeIdx >= 0 ? activeIdx : (enabled[0] ?? 0)
  const onKey = (e: KeyboardEvent, i: number) => {
    if (!enabled.length) return
    const pos = enabled.indexOf(i)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = pos < 0 ? enabled[0]! : enabled[(pos + 1) % enabled.length]!
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = pos < 0 ? enabled[enabled.length - 1]! : enabled[(pos - 1 + enabled.length) % enabled.length]!
    if (n < 0) return
    e.preventDefault()
    onChange(options[n]!.value)
    refs.current[n]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={cn('inline-flex rounded-md border border-border bg-surface-2 p-0.5', className)}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={el => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={o.disabled || undefined}
            aria-describedby={o.describedBy}
            title={o.title}
            tabIndex={i === tabStop ? 0 : -1}
            {...o.data}
            onClick={() => {
              if (!o.disabled) onChange(o.value)
            }}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              'whitespace-nowrap rounded-[6px] font-medium transition-colors touch:min-h-11 touch:min-w-11',
              size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-[13px]',
              active ? 'bg-surface text-text outline outline-border -outline-offset-1' : o.disabled ? 'cursor-not-allowed text-muted line-through decoration-1' : 'text-muted hover:text-text',
              optionClassName,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- Select ----------------

export interface SelectProps<V extends string = string> {
  options: { value: V; label: string }[]
  value: V
  onChange: (v: V) => void
  /** 접근성 이름이자 표시 라벨 */
  label: string
  /** true면 라벨을 시각적으로 숨긴다 */
  hideLabel?: boolean
  className?: string
}

/** 네이티브 select 기반 드롭다운(키보드·모바일 지원 기본 제공) */
export function Select<V extends string = string>({ options, value, onChange, label, hideLabel, className }: SelectProps<V>) {
  const id = useId()
  return (
    <div className={cn('inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <label htmlFor={id} className={cn('whitespace-nowrap text-xs font-medium text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative min-w-0 max-w-full">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value as V)}
          className="h-9 max-w-full appearance-none rounded-md border border-border bg-surface py-0 pl-2.5 pr-8 text-[13px] text-text hover:border-muted touch:h-11"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  )
}

// ---------------- Slider ----------------

export interface SliderTick {
  value: number
  /** 기본 format(value) */
  label?: string
  /** 이 폭 미만에서 숨김(좁은 화면에서 겹치는 눈금) */
  hideBelow?: 'sm' | 'md'
}

export interface SliderProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  label: string
  /** 오른쪽 위 표시값·눈금 라벨 형식 */
  format?: (v: number) => string
  /** 슬라이더 아래 눈금 라벨(장식, aria-hidden). 숫자면 format(value)로 표기 */
  ticks?: (number | SliderTick)[]
  /** PageUp/PageDown 한 번에 움직일 값(min~max로 제한). 없으면 브라우저 기본 */
  pageStep?: number
  /** aria-valuetext. 기본은 표시값. 값의 의미를 함께 읽어 줄 때(예: '선발 비율 10%, 60계통') */
  valueText?: string | ((v: number) => string)
  /** 화면의 주 파라미터: 표시값을 18px 굵게 */
  prominent?: boolean
  className?: string
}

const TICK_HIDE = { sm: 'max-sm:hidden', md: 'max-md:hidden' } as const

export function Slider({ min, max, step, value, onChange, label, format, ticks, pageStep, valueText, prominent, className }: SliderProps) {
  const id = useId()
  const fmt = (v: number) => (format ? format(v) : String(v))
  const shown = fmt(value)
  const ariaText = valueText === undefined ? shown : typeof valueText === 'function' ? valueText(value) : valueText
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  const onKeyDown =
    pageStep !== undefined
      ? (e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key !== 'PageUp' && e.key !== 'PageDown') return
          e.preventDefault()
          const n = Math.max(min, Math.min(max, value + (e.key === 'PageUp' ? pageStep : -pageStep)))
          if (n !== value) onChange(n)
        }
      : undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className={cn('flex justify-between gap-2', prominent ? 'items-baseline' : 'items-center')}>
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
        <output htmlFor={id} className={cn('text-text tabular-nums', prominent ? 'text-lg font-bold leading-none' : 'text-[13px] font-semibold')}>
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={ariaText}
        onChange={e => onChange(Number(e.target.value))}
        onKeyDown={onKeyDown}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-accent)]"
        style={{ background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)` }}
      />
      {ticks && ticks.length > 0 && (
        <div aria-hidden="true" className="relative h-4 text-[11px] text-muted tabular-nums">
          {ticks.map(t => {
            const tick = typeof t === 'number' ? { value: t } : t
            const left = max === min ? 0 : ((tick.value - min) / (max - min)) * 100
            return (
              <span
                key={tick.value}
                className={cn('absolute top-0', tick.hideBelow && TICK_HIDE[tick.hideBelow])}
                style={{ left: `${left}%`, transform: tick.value <= min ? 'none' : tick.value >= max ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {tick.label ?? fmt(tick.value)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
