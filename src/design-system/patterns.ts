// CSS 배경 패턴(토큰색만 사용). style={{ background: HATCH_MISSING }}처럼 background 단축 속성에 넣는다.

/** 결측(NA·미측정) 빗금. 135° 회색 사선 + surface-2 바탕. 시험포 셀·범례 견본처럼 보통 크기 칸용 */
export const HATCH_MISSING =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-text-muted) 28%, transparent) 0 2px, transparent 2px 7px), var(--color-surface-2)'

/** 결측 빗금의 촘촘한 변형(주기 6px, 선 농도 30%). 높이 28px 안팎의 편집 그리드 셀처럼 작은 칸에서 빗금이 2줄 이상 보이게 한다 */
export const HATCH_MISSING_DENSE =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-text-muted) 30%, transparent) 0 2px, transparent 2px 6px), var(--color-surface-2)'

/**
 * HATCH_MISSING의 캔버스 패턴판(ECharts 셀 `itemStyle.color: { image, repeat: 'repeat' }`용). CSS 문자열은 ECharts에 쓸 수 없다.
 * 6px 타일: surface-2 바탕 + text-muted 45% 135° 사선(1.2px). `useChartTheme()` 값을 그대로 넘긴다(구조적으로 맞음).
 * 테마가 바뀌면 다시 만들어야 하므로 `useMemo(() => hatchPattern(theme), [theme])`로 쓴다. DOM이 없으면 null.
 */
export function hatchPattern(colors: { surface2: string; textMuted: string }): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const s = 6
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = colors.surface2
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = colors.textMuted
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (const o of [-s, 0, s]) {
    ctx.moveTo(o, s)
    ctx.lineTo(o + s, 0)
  }
  ctx.stroke()
  return c
}

/**
 * 계열 색 위 사선 빗금 CSS 배경(HTML 막대용). ECharts `stripeDecal`(@/charts)과 같은 모양: 바탕 = `color`, `surface` 1.2px 선이 135°로 4.2px 주기.
 * 계획·전망·같은 계열의 두 번째 구성 요소처럼 "같은 색 + 빗금" 구분이 필요할 때 `style={{ background: stripeBg(color) }}`.
 * `surface` 기본은 `var(--color-surface)`(다크 자동). 카드 바탕이 다르면 그 토큰을 넘긴다. 2026-10-30 승격(program-budget)
 */
export function stripeBg(color: string, surface = 'var(--color-surface)'): string {
  return `repeating-linear-gradient(135deg, ${color} 0 3px, ${surface} 3px 4.2px)`
}
