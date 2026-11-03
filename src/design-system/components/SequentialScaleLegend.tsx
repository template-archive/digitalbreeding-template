import type { ReactNode } from 'react'
import { HATCH_MISSING } from '../patterns'
import { cn } from './cn'

/** 순차 척도 기본 색: --viz-seq-1..7(CSS 변수라 테마 전환 시 자동으로 바뀐다) */
const SEQ_VARS = Array.from({ length: 7 }, (_, i) => `var(--viz-seq-${i + 1})`)

export interface ScaleTick {
  value: number
  label: string
}

export interface ScaleMark {
  value: number
  /** 막대 아래 둘째 줄 라벨(굵게, text 색). 없으면 눈금선만 */
  label?: string
  /** 라벨을 눈금선 왼쪽(오른쪽 정렬) 또는 오른쪽에 붙인다. 기본 'right' */
  labelSide?: 'left' | 'right'
}

export interface SequentialScaleLegendProps {
  /** 범례 제목(figcaption) */
  title: ReactNode
  /** figure의 접근성 이름. 척도 범위·임계값을 문장으로 쓴다(막대·눈금은 aria-hidden) */
  ariaLabel: string
  /** 그라데이션 색(낮음 → 높음). 기본 --viz-seq-1..7 */
  colors?: readonly string[]
  /**
   * 'block'(기본): 제목 위, 막대 h-3, 그 아래 눈금 라벨과 임계 표시(marks)를 값 위치에 둔다. 폭 max 340px.
   * 'inline': 한 줄 `제목 · 첫 눈금 · 막대(w-28 h-2.5) · 끝 눈금`. ticks는 첫·끝 라벨만 쓰고 marks는 무시한다
   */
  layout?: 'block' | 'inline'
  /** 막대 양끝 값. 기본 [0, 1] */
  domain?: [number, number]
  /** block: 값 위치의 눈금 라벨(양끝은 안쪽 정렬). inline: 첫·끝 라벨 */
  ticks?: readonly ScaleTick[]
  /** block 전용 임계 표시: 막대를 가로지르는 2px text 색 세로선 + 선택적 라벨 */
  marks?: readonly ScaleMark[]
  /** 주면 figure 뒤 형제 요소로 결측 빗금(HATCH_MISSING) 견본 + 이 문구를 둔다(색 척도 밖 셀 표기) */
  missing?: ReactNode
  /** figure에 붙는 클래스 */
  className?: string
}

/**
 * 순차 색 척도 HTML 범례(히트맵 등). 결측 견본을 주면 Fragment로 `figure + span`을 돌려주므로
 * 부모 flex 컨테이너 안에 다른 범례 항목과 나란히 둔다.
 */
export function SequentialScaleLegend({
  title,
  ariaLabel,
  colors,
  layout = 'block',
  domain = [0, 1],
  ticks = [],
  marks = [],
  missing,
  className,
}: SequentialScaleLegendProps) {
  const grad = `linear-gradient(to right, ${(colors ?? SEQ_VARS).join(', ')})`
  const [lo, hi] = domain
  const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`

  const missingEl =
    missing !== undefined ? (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block size-3 rounded-[2px] border border-border" style={{ background: HATCH_MISSING }} />
        {missing}
      </span>
    ) : null

  if (layout === 'inline') {
    const first = ticks[0]
    const last = ticks.length > 1 ? ticks[ticks.length - 1] : undefined
    return (
      <>
        <figure className={cn('m-0 flex items-center gap-2', className)} aria-label={ariaLabel}>
          <figcaption className="font-semibold text-text">{title}</figcaption>
          {first && (
            <span className="tabular-nums" aria-hidden="true">
              {first.label}
            </span>
          )}
          <span className="inline-block h-2.5 w-28 rounded-sm border border-border" style={{ background: grad }} aria-hidden="true" />
          {last && (
            <span className="tabular-nums" aria-hidden="true">
              {last.label}
            </span>
          )}
        </figure>
        {missingEl}
      </>
    )
  }

  const hasMarkLabel = marks.some(m => m.label)
  return (
    <>
      <figure className={cn('m-0 w-full max-w-[340px]', className)} aria-label={ariaLabel}>
        <figcaption className="mb-1 font-semibold text-text">{title}</figcaption>
        <div className={cn('relative pt-0.5', hasMarkLabel ? 'pb-9' : 'pb-5')}>
          <div className="h-3 rounded-sm border border-border" style={{ background: grad }} aria-hidden="true" />
          {marks.map(m => (
            <span key={m.value} aria-hidden="true" className="absolute top-0 h-[18px] w-0 border-l-2 border-text" style={{ left: pct(m.value) }} />
          ))}
          {ticks.map(tk => (
            <span
              key={tk.value}
              aria-hidden="true"
              className="absolute top-[18px] tabular-nums"
              style={{ left: pct(tk.value), transform: tk.value <= lo ? 'none' : tk.value >= hi ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {tk.label}
            </span>
          ))}
          {marks.map(m =>
            m.label ? (
              <span
                key={m.label}
                aria-hidden="true"
                className={`absolute top-[32px] whitespace-nowrap font-medium text-text ${m.labelSide === 'left' ? '-translate-x-full pr-1 text-right' : 'pl-1'}`}
                style={{ left: pct(m.value) }}
              >
                {m.label}
              </span>
            ) : null,
          )}
        </div>
      </figure>
      {missingEl}
    </>
  )
}
