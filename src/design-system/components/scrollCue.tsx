import type { ReactNode } from 'react'
import { cn } from './cn'

/** 가로 스크롤 안내 기본 문구(DataTable·ScrollRegion). '옆으로 밀어 … 보기 →' 꼴 */
export const DEFAULT_TABLE_HINT = '옆으로 밀어 나머지 열 보기 →'
export const DEFAULT_REGION_HINT = '옆으로 밀어 전체 보기 →'

/** 가로 스크롤 안내 문구(내부). 넘칠 때만 렌더하고, 낱말 중간에서 줄이 바뀌지 않게 break-keep */
export function ScrollHint({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('break-keep text-xs text-muted', className)} aria-hidden="true">
      {children}
    </p>
  )
}

/**
 * 오른쪽 가장자리 페이드(내부). 스크롤 컨테이너를 감싼 relative 요소 안에 두고, 넘치는데 끝까지 스크롤하지 않았을 때만 보인다.
 * color는 페이드가 섞여 들어갈 바탕색(기본 surface). 클릭은 통과한다.
 */
export function ScrollFade({
  show,
  color = 'var(--color-surface)',
  insideBorder,
  inset,
  className,
}: {
  show: boolean
  color?: string
  insideBorder?: boolean
  /** 스크롤 컨테이너 테두리 안쪽에 맞출 위치(측정값, ScrollRegion). 주면 insideBorder보다 우선한다 */
  inset?: FadeInset | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      data-scroll-fade=""
      data-print-hide=""
      className={cn(
        'pointer-events-none absolute w-8 transition-opacity duration-200',
        // insideBorder: 1px 테두리가 있는 스크롤 컨테이너(DataTable)에서 테두리를 덮지 않게 안쪽에 둔다
        inset ? null : insideBorder ? 'inset-y-px right-px' : 'inset-y-0 right-0',
        show ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{
        background: `linear-gradient(to left, ${color}, transparent)`,
        ...(inset
          ? { top: inset.top, right: inset.right, bottom: inset.bottom, borderTopRightRadius: inset.radiusTop, borderBottomRightRadius: inset.radiusBottom }
          : null),
      }}
    />
  )
}

/** 테두리 안 페이드 위치(px): 스크롤 컨테이너의 위·오른쪽·아래 테두리 두께와 오른쪽 모서리 안쪽 반경 */
export interface FadeInset {
  top: number
  right: number
  bottom: number
  radiusTop: number
  radiusBottom: number
}

/** 스크롤 컨테이너의 계산된 테두리에서 페이드 위치를 구한다(테두리가 없으면 null — 기본 inset-0) */
export function measureFadeInset(el: HTMLElement): FadeInset | null {
  const cs = getComputedStyle(el)
  const top = parseFloat(cs.borderTopWidth) || 0
  const right = parseFloat(cs.borderRightWidth) || 0
  const bottom = parseFloat(cs.borderBottomWidth) || 0
  if (!top && !right && !bottom) return null
  return {
    top,
    right,
    bottom,
    radiusTop: Math.max(0, (parseFloat(cs.borderTopRightRadius) || 0) - right),
    radiusBottom: Math.max(0, (parseFloat(cs.borderBottomRightRadius) || 0) - right),
  }
}
