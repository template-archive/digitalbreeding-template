import { MET_ZONES, metZoneColor, useChartTheme } from '@/charts'
import type { Zone } from '../data'

/** 신품종(별하랑) = 강조색, 대비 품종(가람솔) = 중립 회청. 흑백 인쇄에서는 이름 라벨·빗금으로 구분한다. */
export const V_COLOR = 'var(--color-accent)'
export const C_COLOR = 'var(--viz-chr-b)'

/**
 * 권역 색: 공통 MET 권역 규칙(`metZoneColor` — 중부 평야지 cat[0]·남부 평야지 cat[1]·중북부지 cat[2]).
 * met-gxe-stability·trial-site-environment·variety-application-brief와 같은 권역을 같은 색으로 그린다. 권역 구분은 묶음 머리글 문자와 함께 쓴다.
 */
export function useZoneColor(): (zone: Zone) => string {
  const theme = useChartTheme()
  return zone => metZoneColor(theme, MET_ZONES.find(m => m.label === zone)!.key)
}

export const f1 = (v: number) => v.toFixed(1)
