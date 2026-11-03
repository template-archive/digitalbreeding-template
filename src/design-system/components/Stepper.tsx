import { Check, ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { cn } from './cn'

export interface StepperItem<K extends string | number = string | number> {
  id: K
  label: string
  /**
   * 보조 표기(예: '부모 4', '조합 6', '04-22 / 05-20 · 126구').
   * 문자열이면 ' · ' 구절마다 줄바꿈하지 않는다(날짜 '05-20'이 하이픈에서 끊기지 않게). ReactNode면 템플릿이 단위마다 whitespace-nowrap span을 준다.
   */
  description?: ReactNode
  /** 이동 가능 여부. 기본 true */
  enabled?: boolean
  /** 완료 표시(체크). 현재 단계는 번호를 유지한다 */
  done?: boolean
}

export interface StepperProps<K extends string | number = string | number> {
  items: StepperItem<K>[]
  current: K
  onChange: (id: K) => void
  /** nav 접근성 이름. 예: '교배 계획 단계' */
  ariaLabel: string
  /**
   * 이 폭 미만에서 축약 배치('n/총 + 단계 이름 + 번호 버튼')를 쓴다. 기본은 단계 4개 이하 'md', 5개 이상 'lg'
   * (768px에서 5단계 라벨이 잘리고 설명이 조각나던 문제, 2026-10-30).
   */
  compactBelow?: 'md' | 'lg'
  className?: string
}

// Tailwind가 정적으로 찾을 수 있게 클래스 문자열을 풀어 쓴다
const COMPACT = { md: 'md:hidden', lg: 'lg:hidden' } as const
const FULL = { md: 'hidden md:flex', lg: 'hidden lg:flex' } as const

/** 문자열 설명을 ' · ' 구절 단위 nowrap span으로(구절 사이에서만 줄이 바뀐다) */
function Desc({ value }: { value: ReactNode }) {
  if (typeof value !== 'string') return <>{value}</>
  const parts = value.split(' · ')
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">{p}</span>
        </Fragment>
      ))}
    </>
  )
}

/**
 * 다단계 업무 화면 스테퍼. 현재 단계에 aria-current="step".
 * compactBelow(기본 md, 5단계 이상 lg) 미만에서는 'n/총 + 현재 단계 이름 + 번호 버튼'으로 축약한다.
 * 번호 버튼은 보이는 크기 28px, 좁은 화면·터치에서 누르는 영역 44px(버튼 사이 16px, 줄이 모자라면 아래 줄로 내려 오른쪽 정렬).
 * 현재 단계 = 잉크(주 버튼과 같은 --color-primary) 번호 + 잉크 밑줄, 완료 = 회색 원 테두리 + 잉크 체크. 강조색·의미색은 쓰지 않는다(2026-10-30).
 */
export function Stepper<K extends string | number>({ items, current, onChange, ariaLabel, compactBelow, className }: StepperProps<K>) {
  const curIndex = Math.max(
    0,
    items.findIndex(i => i.id === current),
  )
  const cur = items[curIndex]
  const bp = compactBelow ?? (items.length >= 5 ? 'lg' : 'md')
  return (
    <nav aria-label={ariaLabel} className={cn('rounded-lg border border-border bg-surface', className)}>
      {/* 축약 */}
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5', COMPACT[bp])}>
        {/* 왼쪽 묶음(최소 12rem)과 번호 버튼이 한 줄에 안 들어가면 버튼이 아래 줄 오른쪽으로 내려간다 */}
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-contrast tabular-nums">
            {curIndex + 1}/{items.length}
          </span>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-text">{cur?.label}</span>
          {cur?.description != null && (
            <span className="min-w-0 text-xs text-muted tabular-nums">
              <Desc value={cur.description} />
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-1 touch:gap-4">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              disabled={it.enabled === false}
              onClick={() => onChange(it.id)}
              aria-current={it.id === current ? 'step' : undefined}
              aria-label={`${i + 1} ${it.label}`}
              className={cn(
                'size-7 rounded-full border text-xs font-bold tabular-nums disabled:opacity-40 touch:size-11',
                it.id === current ? 'border-text bg-active text-text' : 'border-border text-muted',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      {/* 넓은 화면 */}
      <ol className={cn('items-stretch', FULL[bp])}>
        {items.map((it, i) => {
          const active = it.id === current
          return (
            <li key={it.id} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                disabled={it.enabled === false}
                onClick={() => onChange(it.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-3 border-b-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                  active ? 'border-text' : 'border-transparent hover:bg-surface-2',
                  i === 0 && 'rounded-tl-lg',
                  i === items.length - 1 && 'rounded-tr-lg',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
                    // 현재 = 잉크 채움, 완료 = 회색 원 테두리 + 잉크 체크(의미색은 데이터에만 — 앱 화면 규칙 T7), 나머지 = 회색 채움 번호
                    active ? 'bg-primary text-primary-contrast' : it.done ? 'border border-border text-text' : 'bg-surface-2 text-muted',
                  )}
                >
                  {it.done && !active ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn('block truncate text-sm font-semibold', active ? 'text-text' : 'text-muted group-hover:text-text')}>{it.label}</span>
                  {it.description != null && (
                    <span className="block text-xs text-muted tabular-nums">
                      <Desc value={it.description} />
                    </span>
                  )}
                </span>
              </button>
              {i < items.length - 1 && <ChevronRight size={16} aria-hidden="true" className="mx-1 shrink-0 text-muted" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
