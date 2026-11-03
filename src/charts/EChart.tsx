import { useEffect, useLayoutEffect, useRef } from 'react'
import type { EChartsOption } from 'echarts'
import { echarts } from './registry'
import { useChartTheme } from './theme'

export type { EChartsOption }

export interface EChartProps {
  /** 색을 지정하지 않으면 테마(토큰)가 적용된다 */
  option: EChartsOption
  height: number | string
  /** 필수: 차트가 말하는 결론 한 문장 */
  ariaLabel: string
  /** 스크린리더용 숨김 표 */
  fallbackTable?: { columns: string[]; rows: (string | number)[][] }
  onEvents?: Record<string, (params: unknown) => void>
  /** 기본 canvas */
  renderer?: 'canvas' | 'svg'
  loading?: boolean
  className?: string
}

type Instance = ReturnType<typeof echarts.init>

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 이 점 수 이상이거나 large: true인 시리즈를 대용량으로 본다(ECharts largeThreshold 기본값과 같음) */
const LARGE_SERIES_THRESHOLD = 2000

type SeriesLike = { large?: boolean; progressive?: number; data?: unknown }

/**
 * 대용량 시리즈의 progressive 렌더 기본값을 끈다(progressive: 0).
 * ECharts는 큰 시리즈를 여러 프레임에 나눠 그리는데, 그 사이에 찍은 스크린샷·인쇄에는 점이 일부만 나온다.
 * 템플릿이 progressive를 직접 지정했으면 그 값을 존중한다.
 */
function withSafeLargeSeries(option: EChartsOption): EChartsOption {
  const series = option.series
  if (!series) return option
  const fix = (s: SeriesLike): SeriesLike => {
    if (s.progressive !== undefined) return s
    const n = Array.isArray(s.data) ? s.data.length : ArrayBuffer.isView(s.data) ? (s.data as unknown as ArrayLike<number>).length : 0
    return s.large || n >= LARGE_SERIES_THRESHOLD ? { ...s, progressive: 0 } : s
  }
  return { ...option, series: (Array.isArray(series) ? series.map(s => fix(s as SeriesLike)) : fix(series as SeriesLike)) as EChartsOption['series'] }
}

type AxisLike = {
  type?: string
  min?: unknown
  max?: unknown
  interval?: unknown
  axisTick?: { customValues?: unknown; [k: string]: unknown }
  axisLabel?: { customValues?: unknown; showMinLabel?: unknown; showMaxLabel?: unknown; [k: string]: unknown }
  [k: string]: unknown
}

const decimals = (x: number) => {
  const s = String(x)
  const e = s.indexOf('e-')
  if (e >= 0) return Number(s.slice(e + 2))
  const d = s.indexOf('.')
  return d < 0 ? 0 : s.length - d - 1
}

/**
 * 값 축 눈금을 interval의 배수에 맞춘다.
 * ECharts는 min·interval을 함께 주면 눈금을 min부터 센다(min 0.5, interval 1 → 0.5, 1.5, …; min 126.1 → 126.1°E, 127.1°E, …).
 * 그러면 막대·정수 위치에 라벨이 없거나, 반올림 formatter가 눈금과 다른 값을 적는다. min이 interval의 배수가 아니면
 * axisTick·axisLabel의 customValues를 [min, max] 안의 배수로 채운다(눈금·격자선·라벨이 같은 값을 따른다).
 * 템플릿이 customValues를 직접 주었으면 건드리지 않는다. 가장자리 라벨을 숨긴 설정(showMinLabel·showMaxLabel false)은
 * 그 가장자리에 눈금이 더는 없을 때 기본값으로 돌린다(첫 배수 라벨이 숨지 않게). 2026-10-30
 */
function alignIntervalTicks(axis: AxisLike, isY: boolean): AxisLike {
  const { min, max, interval } = axis
  const isValue = axis.type === 'value' || (isY && axis.type === undefined)
  if (!isValue || typeof min !== 'number' || typeof max !== 'number' || typeof interval !== 'number' || !(interval > 0) || max <= min) return axis
  if (axis.axisTick?.customValues !== undefined || axis.axisLabel?.customValues !== undefined) return axis
  const k0 = min / interval
  if (Math.abs(k0 - Math.round(k0)) < 1e-6) return axis
  const dec = Math.min(12, decimals(interval) + decimals(min))
  const values: number[] = []
  for (let k = Math.ceil(k0 - 1e-9); k * interval <= max + interval * 1e-9 && values.length < 500; k++) values.push(Number((k * interval).toFixed(dec)))
  if (values.length === 0) return axis
  const minEdge = Math.abs(values[0]! - min) < interval * 1e-6
  const maxEdge = Math.abs(values[values.length - 1]! - max) < interval * 1e-6
  const label = { ...(axis.axisLabel ?? {}), customValues: values }
  if (!minEdge && label.showMinLabel === false) delete label.showMinLabel
  if (!maxEdge && label.showMaxLabel === false) delete label.showMaxLabel
  return { ...axis, axisTick: { ...(axis.axisTick ?? {}), customValues: values }, axisLabel: label }
}

function withAlignedTicks(option: EChartsOption): EChartsOption {
  const fix = (axes: unknown, isY: boolean) =>
    axes == null ? axes : Array.isArray(axes) ? axes.map(a => alignIntervalTicks(a as AxisLike, isY)) : alignIntervalTicks(axes as AxisLike, isY)
  const o = option as { xAxis?: unknown; yAxis?: unknown }
  if (o.xAxis == null && o.yAxis == null) return option
  return { ...option, ...(o.xAxis != null ? { xAxis: fix(o.xAxis, false) } : null), ...(o.yAxis != null ? { yAxis: fix(o.yAxis, true) } : null) } as EChartsOption
}

function applyOption(chart: Instance, el: HTMLElement, option: EChartsOption) {
  const reduced = prefersReducedMotion()
  // 렌더(애니메이션 포함)가 끝나면 'finished' 이벤트에서 true로 바꾼다
  el.setAttribute('data-chart-ready', 'false')
  chart.setOption({ animation: !reduced, animationDuration: 300, animationDurationUpdate: 300, ...withSafeLargeSeries(withAlignedTicks(option)) }, { notMerge: true })
}

/**
 * 공통 차트 래퍼.
 * - ResizeObserver로 컨테이너 크기에 맞춘다.
 * - 라이트·다크 테마가 바뀌면 인스턴스를 다시 만들어 토큰 색을 반영한다.
 * - role="img" + aria-label, fallbackTable은 시각적으로 숨긴 표로 렌더한다.
 * - 대용량 시리즈(large: true 또는 2,000점 이상)는 progressive를 지정하지 않았으면 0으로 둔다(한 프레임에 모두 그림).
 * - 값 축의 min이 interval의 배수가 아니면 눈금·격자선·라벨을 interval 배수로 맞춘다(customValues, alignIntervalTicks).
 * - 차트 요소에 data-chart-ready="false|true"를 단다. 렌더·애니메이션이 끝나면('finished') true. QA 스크린샷이 이것을 기다린다.
 */
export function EChart({ option, height, ariaLabel, fallbackTable, onEvents, renderer = 'canvas', loading, className }: EChartProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Instance | null>(null)
  const theme = useChartTheme()
  const optionRef = useRef(option)
  optionRef.current = option

  // 인스턴스 생성/파기 — 테마·렌더러가 바뀌면 다시 만든다
  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    const chart = echarts.init(el, theme.echarts, { renderer, locale: 'EN' })
    chartRef.current = chart
    const onFinished = () => el.setAttribute('data-chart-ready', 'true')
    chart.on('finished', onFinished)
    applyOption(chart, el, optionRef.current)
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!chart.isDisposed()) chart.resize()
      })
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [theme, renderer])

  // 옵션 갱신
  useEffect(() => {
    const chart = chartRef.current
    const el = elRef.current
    if (!chart || chart.isDisposed() || !el) return
    applyOption(chart, el, option)
  }, [option, theme])

  // 이벤트
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    const entries = Object.entries(onEvents)
    for (const [name, fn] of entries) chart.on(name, fn as (p: unknown) => void)
    return () => {
      if (chart.isDisposed()) return
      for (const [name, fn] of entries) chart.off(name, fn as (p: unknown) => void)
    }
  }, [onEvents, theme])

  // 로딩
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (loading) chart.showLoading('default', { text: '불러오는 중', color: theme.accent, textColor: theme.textMuted, maskColor: 'transparent' })
    else chart.hideLoading()
  }, [loading, theme])

  return (
    <div className={['relative w-full', className].filter(Boolean).join(' ')} style={{ height }}>
      <div ref={elRef} role="img" aria-label={ariaLabel} className="h-full w-full" />
      {fallbackTable && (
        // 표 요소에는 width/overflow 클리핑이 적용되지 않으므로 sr-only는 감싸는 div에 준다
        <div className="sr-only">
          <table>
            <caption>{ariaLabel}</caption>
            <thead>
              <tr>
                {fallbackTable.columns.map(c => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fallbackTable.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
