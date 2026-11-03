import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 범주축 하나에 돌아가는 폭(컨테이너 폭 / 범주 수)이 minBandPx보다 좁은지 ResizeObserver로 잰다.
 * 좁으면 x축 라벨을 기울이는 등 범주축 라벨 배치를 바꾸는 데 쓴다(한국어 형질명처럼 긴 라벨의 390px 겹침 방지).
 *
 * 반환한 ref를 차트를 감싸는 요소에 붙인다.
 *   const { ref, narrow } = useNarrowCategoryAxis(names.length)
 *   axisLabel: narrow ? { interval: 0, rotate: 35 } : { interval: 0, width: 64, overflow: 'break' }
 *   return <div ref={ref}><EChart … /></div>
 */
export function useNarrowCategoryAxis<T extends HTMLElement = HTMLDivElement>(
  count: number,
  minBandPx = 80,
): { ref: RefObject<T>; narrow: boolean } {
  const ref = useRef<T>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setNarrow(el.clientWidth / Math.max(1, count) < minBandPx)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count, minBandPx])
  return { ref, narrow }
}
