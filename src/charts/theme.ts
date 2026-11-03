/** 토큰 → ECharts 테마 변환 */
import { useMemo } from 'react'
import { readToken, useThemeMode, type ThemeMode } from '@/design-system/themeMode'
import { palettes } from './palettes'

export interface ChartTheme {
  mode: ThemeMode
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  textMuted: string
  accent: string
  positive: string
  negative: string
  warning: string
  info: string
  categorical: string[]
  sequential: string[]
  diverging: string[]
  chromosome: [string, string]
  threshold: string
  fontFamily: string
  /** echarts.init(el, theme)에 넘기는 테마 객체 */
  echarts: Record<string, unknown>
}

const FONT = "'Pretendard Variable', Pretendard, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

export function buildChartTheme(mode: ThemeMode): ChartTheme {
  const t = {
    bg: readToken('--color-bg'),
    surface: readToken('--color-surface'),
    surface2: readToken('--color-surface-2'),
    border: readToken('--color-border'),
    text: readToken('--color-text'),
    textMuted: readToken('--color-text-muted'),
    accent: readToken('--color-accent'),
    positive: readToken('--color-positive'),
    negative: readToken('--color-negative'),
    warning: readToken('--color-warning'),
    info: readToken('--color-info'),
  }
  const categorical = palettes.categorical()
  const axis = {
    axisLine: { show: true, lineStyle: { color: t.border } },
    axisTick: { show: false, lineStyle: { color: t.border } },
    axisLabel: { color: t.textMuted, fontSize: 11, fontFamily: FONT },
    splitLine: { show: true, lineStyle: { color: t.border, type: 'dashed' as const, opacity: 0.7 } },
    splitArea: { show: false },
    nameTextStyle: { color: t.textMuted, fontSize: 11, fontFamily: FONT },
  }
  const echarts: Record<string, unknown> = {
    color: categorical,
    backgroundColor: 'transparent',
    textStyle: { color: t.text, fontFamily: FONT },
    title: {
      textStyle: { color: t.text, fontSize: 14, fontWeight: 600, fontFamily: FONT },
      subtextStyle: { color: t.textMuted, fontSize: 12, fontFamily: FONT },
    },
    legend: { textStyle: { color: t.textMuted, fontSize: 12, fontFamily: FONT }, inactiveColor: t.border, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.text, fontSize: 12, fontFamily: FONT },
      extraCssText: 'box-shadow: var(--shadow-2); border-radius: 8px;',
      axisPointer: { lineStyle: { color: t.textMuted, type: 'dashed' }, crossStyle: { color: t.textMuted } },
    },
    categoryAxis: { ...axis, splitLine: { ...axis.splitLine, show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    logAxis: { ...axis, axisLine: { show: false } },
    timeAxis: { ...axis, splitLine: { ...axis.splitLine, show: false } },
    line: { symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 }, smooth: false },
    bar: { itemStyle: { borderRadius: [3, 3, 0, 0] } },
    scatter: { symbolSize: 5 },
    markLine: { label: { color: t.textMuted }, lineStyle: { color: t.textMuted } },
    visualMap: { textStyle: { color: t.textMuted }, inRange: { color: palettes.sequential() } },
    dataZoom: {
      borderColor: t.border,
      fillerColor: 'rgba(128,128,128,0.12)',
      textStyle: { color: t.textMuted },
      handleStyle: { color: t.surface, borderColor: t.textMuted },
      dataBackground: { lineStyle: { color: t.textMuted }, areaStyle: { color: t.surface2 } },
    },
    graph: { lineStyle: { color: t.border }, label: { color: t.text } },
  }
  return {
    mode,
    ...t,
    categorical,
    sequential: palettes.sequential(),
    diverging: palettes.diverging(),
    chromosome: palettes.chromosome(),
    threshold: palettes.threshold(),
    fontFamily: FONT,
    echarts,
  }
}

/** 현재 테마의 색. 테마가 바뀌면 새 객체를 반환한다. */
export function useChartTheme(): ChartTheme {
  const mode = useThemeMode()
  return useMemo(() => buildChartTheme(mode), [mode])
}
