/**
 * 스크롤 공개: [data-reveal="rise|slide|media"] 묶음이 화면에 들어오기 직전 한 번만 움직인다.
 * 숨김 상태를 미리 걸어 두지 않는다. 요소는 항상 보이는 상태로 있다가 진입 순간에만 애니메이션을 만들므로
 * 스크립트 실패, 인쇄, 전체 페이지 캡처에서도 내용이 빠지지 않는다. 지연은 data-reveal-delay(ms), 상한 240ms.
 * 재생 뒤에는 관찰을 끝내고, 정리 때 소유한 애니메이션만 취소한다.
 */
export function installReferenceReveals(root: ParentNode = document) {
  if (typeof IntersectionObserver !== 'function') return () => {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const running = new Set<Animation>()
  const pending = [...root.querySelectorAll<HTMLElement>('[data-reveal]')].filter(el => el.dataset.revealPlayed !== 'true')

  const play = (element: HTMLElement) => {
    const kind = element.dataset.reveal
    const transform = kind === 'media' ? 'translateY(4%)' : kind === 'slide' ? 'translateX(-8px)' : 'translateY(8px)'
    const animation = element.animate([{ opacity: 0.01, transform }, { opacity: 1, transform: 'none' }], {
      duration: kind === 'slide' ? 500 : 600,
      delay: Math.min(240, Number(element.dataset.revealDelay ?? 0)),
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards',
    })
    running.add(animation)
    animation.onfinish = () => running.delete(animation)
  }

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const element = entry.target as HTMLElement
        observer.unobserve(element)
        element.dataset.revealPlayed = 'true'
        const passed = entry.boundingClientRect.bottom <= 0
        if (!reduced.matches && !passed && document.visibilityState !== 'hidden') play(element)
      }
    },
    { threshold: 0, rootMargin: '0px 0px 10% 0px' },
  )

  const stop = () => {
    observer.disconnect()
    running.forEach(a => a.cancel())
    running.clear()
  }
  const onPreference = () => {
    if (reduced.matches) stop()
  }
  reduced.addEventListener('change', onPreference)

  for (const element of pending) {
    // 이미 보이는 내용은 첫 페인트 뒤에 움직이지 않는다
    if (reduced.matches || element.getBoundingClientRect().top < innerHeight) element.dataset.revealPlayed = 'true'
    else observer.observe(element)
  }

  return () => {
    stop()
    reduced.removeEventListener('change', onPreference)
  }
}
