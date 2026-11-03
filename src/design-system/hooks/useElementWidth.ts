import { useLayoutEffect, useState } from 'react'

/**
 * 요소의 내용 폭(px, 반올림)을 구독한다. 히트맵 셀 크기·라벨 간격을 컨테이너 폭에 맞추는 데 쓴다.
 * 콜백 ref라서 로딩 화면 → 본 화면처럼 대상 요소가 바뀌어도 새 요소를 관찰한다.
 * 첫 측정 전과 요소가 없을 때는 0이다(0이면 차트를 그리지 않는 식으로 쓴다).
 *
 * 예: const { ref, width } = useElementWidth(); <div ref={ref}>{width > 0 && <Chart width={width} />}</div>
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): { ref: (el: T | null) => void; width: number } {
  const [el, setEl] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setWidth(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return { ref: setEl, width }
}
