/**
 * 현재 적용된 테마(라이트·다크)를 판정하고 변화를 구독한다. (내부 모듈 — 공개 API 아님)
 * 우선순위: <html data-theme> 강제값 → prefers-color-scheme.
 */
import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark'

const media = () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null)
const printMedia = () => (typeof window !== 'undefined' ? window.matchMedia('print') : null)

/**
 * 인쇄 캔버스(ScaledCanvas print → <html data-print-mode="canvas">)를 인쇄하는 중인지.
 * 인쇄 토큰은 CSS가 늘 라이트로 바꾸지만(tokens.css 다크 블록은 screen 전용), JS가 읽어 둔 색(useChartTheme → SVG 권역색 등)은
 * 테마 모드가 바뀌어야 다시 읽힌다. 차트(ECharts)가 있는 일반 화면은 인쇄 중 다시 그리면 애니메이션 첫 프레임이 찍힐 수 있어 캔버스 화면만 바꾼다.
 */
function printingCanvas(): boolean {
  const root = document.documentElement
  if (root.getAttribute('data-print-mode') !== 'canvas') return false
  return root.hasAttribute('data-printing') || !!printMedia()?.matches
}

export function getThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  if (printingCanvas()) return 'light'
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced === 'dark' || forced === 'light') return forced
  return media()?.matches ? 'dark' : 'light'
}

// beforeprint 때 <html data-printing>을 켜 CSS 다크 블록(:not([data-printing]))을 끄고, afterprint에 끈다(인쇄 캔버스 화면만).
// beforeprint 처리 중에는 아직 화면 미디어라 getComputedStyle이 다크 값을 주므로, 속성으로 먼저 라이트 토큰을 만든다.
let printHooked = false
function hookPrint() {
  if (printHooked || typeof window === 'undefined') return
  printHooked = true
  window.addEventListener('beforeprint', () => {
    if (document.documentElement.getAttribute('data-print-mode') === 'canvas') document.documentElement.setAttribute('data-printing', '')
  })
  window.addEventListener('afterprint', () => document.documentElement.removeAttribute('data-printing'))
}

function subscribe(cb: () => void) {
  hookPrint()
  const mq = media()
  const pm = printMedia()
  mq?.addEventListener('change', cb)
  pm?.addEventListener('change', cb)
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-printing', 'data-print-mode'] })
  return () => {
    mq?.removeEventListener('change', cb)
    pm?.removeEventListener('change', cb)
    mo.disconnect()
  }
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeMode, () => 'light')
}

/** 강제 테마 설정. null이면 시스템 설정을 따른다. */
export function setThemeOverride(mode: ThemeMode | null) {
  if (mode) document.documentElement.setAttribute('data-theme', mode)
  else document.documentElement.removeAttribute('data-theme')
}

/** CSS 변수 실제 값 읽기 */
export function readToken(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
