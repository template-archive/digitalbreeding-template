import { useEffect, useState } from 'react'

/**
 * CSS 미디어 쿼리 구독. 첫 렌더부터 현재 값을 돌려준다(SSR 환경이면 false).
 * 예: const mobile = useMediaQuery('(max-width: 767px)')
 * 레이아웃만 바뀌는 경우는 Tailwind 반응형 클래스를 먼저 쓰고, 렌더 트리 자체가 달라질 때만 이 훅을 쓴다.
 */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}
