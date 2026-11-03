/**
 * 막대 시리즈 색을 살린 채 사선 빗금을 겹치는 ECharts `itemStyle.decal`.
 * 계획·전망·진행 중(미확정) 막대를 확정 막대와 구분할 때 쓴다. 바탕은 시리즈 색 그대로이고,
 * `color`(보통 `theme.surface`) 1px 선을 -45°로 `gap`px 간격(주기 2 + gap)마다 그린다.
 * 회색 바탕 빗금(결측)은 `hatchPattern`(@/design-system)을 쓴다.
 */
export interface StripeDecal {
  symbol: 'rect'
  symbolSize: number
  color: string
  dashArrayX: number[]
  dashArrayY: number[]
  rotation: number
}

export function stripeDecal(color: string, gap = 3): StripeDecal {
  return { symbol: 'rect', symbolSize: 1, color, dashArrayX: [1, 0], dashArrayY: [2, gap], rotation: -Math.PI / 4 }
}
