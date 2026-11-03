/**
 * 하플로타입 뷰어 색 규칙. 모든 색은 useChartTheme() 토큰에서 섞어 만든다(hex 직접 사용 없음).
 * - 대립유전자: 주 = 옅은 중립, 소수 = 진한 중립(강조색은 리드 블록·표적 하플로타입에만 남긴다. 다크는 밝은 면이 넓게 번쩍이지 않게 명도를 낮춘다)
 * - 표적 하플로타입: 강조색 명도 단계(가장 흔한 표적이 가장 진함), 그 밖 이름 있는 하플로타입: 중립 명도 단계
 * - 희귀: 가장 옅은 중립, 미정: 빗금
 */
import type { ChartTheme } from '@/charts'
import { riceSubpopColor } from '@/charts'
import type { LocusResult, Subpop } from '../data'
import { RARE, UNDET } from '../data'

function parse(c: string): [number, number, number] {
  const s = c.trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h.slice(0, 6)
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const m = s.match(/[\d.]+/g)
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])]
  return [128, 128, 128]
}

const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')

/** a를 t 비율로, b를 1 − t 비율로 섞는다(sRGB 선형 보간) */
export function mixColor(a: string, b: string, t: number): string {
  const x = parse(a)
  const y = parse(b)
  return `#${hex2(x[0] * t + y[0] * (1 - t))}${hex2(x[1] * t + y[1] * (1 - t))}${hex2(x[2] * t + y[2] * (1 - t))}`
}

export function withAlpha(c: string, alpha: number): string {
  const [r, g, b] = parse(c)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface GridColors {
  major: string
  minor: string
  same: string
  diff: string
  leadTint: string
}

export function gridColors(theme: ChartTheme): GridColors {
  return {
    major: mixColor(theme.textMuted, theme.surface, 0.16),
    minor: mixColor(theme.text, theme.surface, theme.mode === 'dark' ? 0.42 : 0.68),
    same: theme.accent,
    diff: mixColor(theme.warning, theme.surface, 0.42),
    leadTint: mixColor(theme.accent, theme.surface, 0.1),
  }
}

/** 하플로타입 이름 → 색(미정은 null: 빗금으로 그린다) */
export function hapColorMap(L: LocusResult, theme: ChartTheme): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  const targets = L.named.filter(h => h.target)
  const others = L.named.filter(h => !h.target)
  const tSteps = [1, 0.62, 0.36]
  targets.forEach((h, i) => (out[h.name] = mixColor(theme.accent, theme.surface, tSteps[Math.min(i, tSteps.length - 1)]!)))
  others.forEach((h, i) => {
    const t = others.length <= 1 ? 0.62 : 0.72 - (0.44 * i) / (others.length - 1)
    out[h.name] = mixColor(theme.textMuted, theme.surface, t)
  })
  out[RARE] = mixColor(theme.textMuted, theme.surface, 0.14)
  out[UNDET] = null
  return out
}

export const subpopColor = (theme: ChartTheme, g: Subpop) => riceSubpopColor(theme, g)
