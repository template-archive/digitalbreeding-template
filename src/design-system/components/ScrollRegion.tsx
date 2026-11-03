import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import { cn } from './cn'
import { DEFAULT_REGION_HINT, ScrollFade, ScrollHint, measureFadeInset, type FadeInset } from './scrollCue'

export interface ScrollRegionProps {
  /** 가로로 넘칠 수 있는 내용(계통도 SVG, ADMIXTURE 막대, 격자·행렬 표 등) */
  children: ReactNode
  /** 넘칠 때 스크롤 영역의 접근성 이름(role="region" + tabIndex=0으로 키보드 스크롤). 예: '계통도(가로 스크롤)' */
  label: string
  /** 넘칠 때만 위에 보이는 안내. 기본 '옆으로 밀어 전체 보기 →'. '옆으로 밀어 … 보기 →' 꼴로 바꾸고, false면 숨김 */
  hint?: ReactNode
  /** 오른쪽 가장자리 페이드. 기본 true */
  fade?: boolean
  /** 페이드가 섞여 들어갈 바탕색. 기본 var(--color-surface)(카드 안). 페이지 바탕 위면 'var(--color-bg)' */
  fadeColor?: string
  /**
   * 스크롤 컨테이너(overflow-x-auto) 클래스. 높이·세로 스크롤·테두리 등.
   * 테두리(border)를 주면 페이드가 테두리 안쪽(두께·모서리 반경을 측정)에 그려져 오른쪽 테두리를 덮지 않는다(2026-10-30)
   */
  className?: string
  /** 바깥 래퍼 클래스(여백 등). 고정 높이 카드에서 채우려면 'flex min-h-0 flex-1 flex-col' 같은 flex 열 */
  wrapperClassName?: string
  /**
   * 안내 문구 아래, 스크롤 컨테이너를 감싼 relative 상자의 클래스. 고정 높이 카드에서 남은 높이를 채울 때
   * wrapperClassName="flex min-h-0 flex-1 flex-col" + innerClassName="min-h-0 flex-1" + className="h-full"(안내 줄 높이를 따로 더하지 않아도 된다, 2026-10-30)
   */
  innerClassName?: string
  /** 넘침 상태가 바뀔 때(넘침에 따라 다른 안내를 보이는 템플릿용) */
  onOverflowChange?: (overflowing: boolean) => void
  /** 스크롤 컨테이너 요소(선택한 노드 위치로 scrollTo 등) */
  scrollRef?: Ref<HTMLDivElement | null>
}

/**
 * 표가 아닌 가로 스크롤 영역 래퍼. 폭 조건(md:hidden, narrow)이 아니라 실제 넘침(scrollWidth > clientWidth)일 때만
 * 위에 안내 문구(12px muted, break-keep)와 오른쪽 페이드를 보인다(768px에서 넘치는데 안내가 숨던 문제). 넘칠 때는 region + tabIndex.
 * DataTable은 같은 규칙을 기본으로 가진다(scrollHint). 2026-10-30 신설.
 * DOM: div[data-scroll-region](wrapperClassName) > [p 안내] + div.relative(innerClassName) > div.relative.overflow-x-auto(className) — relative: 안쪽 sr-only(absolute)가 페이지 폭을 늘리지 않게 + span[data-scroll-fade]
 */
export function ScrollRegion({ children, label, hint, fade = true, fadeColor, className, wrapperClassName, innerClassName, onOverflowChange, scrollRef }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useImperativeHandle(scrollRef, () => ref.current, [])
  const { overflow, atEnd } = useScrollOverflow(ref)
  const cb = useRef(onOverflowChange)
  cb.current = onOverflowChange
  useEffect(() => {
    cb.current?.(overflow)
  }, [overflow])
  // 스크롤 컨테이너에 테두리가 있으면 페이드를 테두리 안쪽에(넘칠 때 한 번, className이 바뀌면 다시 잰다)
  const [inset, setInset] = useState<FadeInset | null>(null)
  useLayoutEffect(() => {
    if (!fade || !overflow || !ref.current) return
    const next = measureFadeInset(ref.current)
    setInset(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [fade, overflow, className])
  const hintText = hint === undefined || hint === true ? DEFAULT_REGION_HINT : hint
  const showHint = overflow && hint !== false && hint !== null
  return (
    <div data-scroll-region="" className={cn('min-w-0', wrapperClassName)}>
      {showHint && <ScrollHint className="mb-1.5">{hintText}</ScrollHint>}
      <div className={cn('relative', innerClassName)}>
        <div
          ref={ref}
          className={cn('relative overflow-x-auto', className)}
          role={overflow ? 'region' : undefined}
          tabIndex={overflow ? 0 : undefined}
          aria-label={overflow ? label : undefined}
        >
          {children}
        </div>
        {fade && <ScrollFade show={overflow && !atEnd} color={fadeColor} inset={inset} />}
      </div>
    </div>
  )
}
