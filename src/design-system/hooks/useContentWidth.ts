import { useLayoutEffect, useState } from 'react'

/**
 * 요소의 내용 상자 폭(패딩 제외, px 반올림)을 첫 페인트 전부터 구독한다(내부 훅 — KpiTile 좁은 칸 판정용, 공개 API 아님).
 * 컨테이너 쿼리(container-type)는 쓰지 않는다: 크기 격리가 쌓임 맥락을 만들어 타일 안 툴팁이 옆 타일 아래로 깔리기 때문이다.
 */
export function useContentWidth<T extends HTMLElement = HTMLDivElement>(): { ref: (el: T | null) => void; width: number } {
  const [el, setEl] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!el) return
    const cs = getComputedStyle(el)
    setWidth(Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)))
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setWidth(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return { ref: setEl, width }
}
