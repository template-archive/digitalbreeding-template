import { useLayoutEffect, useState, type RefObject } from 'react'

export interface ScrollOverflow {
  /** 가로로 실제로 넘치는지(scrollWidth > clientWidth) */
  overflow: boolean
  /** 오른쪽 끝까지 스크롤했는지(넘치지 않으면 true) */
  atEnd: boolean
}

/**
 * 가로 스크롤 컨테이너의 넘침·끝 도달 여부를 구독한다(내부 훅 — DataTable·ScrollRegion·ScaledCanvas 공용, 공개 API 아님).
 * 폭 조건(md:hidden 등)이 아니라 실제 넘침으로 안내·페이드를 켜기 위해서다(768px에서 넘치는데 안내가 숨던 문제).
 * 컨테이너와 직계 자식의 크기 변화를 ResizeObserver로, 스크롤 위치를 scroll 이벤트로 본다.
 */
export function useScrollOverflow(ref: RefObject<HTMLElement | null>, enabled = true): ScrollOverflow {
  const [state, setState] = useState<ScrollOverflow>({ overflow: false, atEnd: true })
  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const check = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1
      const atEnd = !overflow || el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
      setState(prev => (prev.overflow === overflow && prev.atEnd === atEnd ? prev : { overflow, atEnd }))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [ref, enabled])
  return state
}
