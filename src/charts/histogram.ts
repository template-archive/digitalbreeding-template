/**
 * 사전 계산한 구간(bin)을 막대로 그리는 ECharts custom 시리즈 빌더.
 * 축(xAxis: value, yAxis: value|log)·기준선·주석은 템플릿이 정한다. 막대만 공통으로 그린다:
 * - 구간 경계 [x0, x1]에 정확히 맞춘 사각형(이웃 막대와 1px 틈)
 * - 누적 막대: 같은 bins로 시리즈를 여러 개 만들고 각 시리즈의 y0를 아래 시리즈의 y1로 준다
 * - 로그 축: baseline을 1로(0은 로그 축에서 그릴 수 없다)
 * - 구간별 색·커서(예: 기준 미달 구간만 경고색·클릭 가능)
 *
 * 데이터 행은 `[x0, x1, y0, y1, ...extra(bin)]`이다. 툴팁 formatter·클릭 핸들러의 `params.value`가 이 배열이다.
 */
import type { EChartsOption } from 'echarts'

export interface HistogramBin {
  x0: number
  x1: number
}

type SeriesOption = Extract<NonNullable<EChartsOption['series']>, unknown[]>[number]

export interface HistogramSeriesOptions<B extends HistogramBin> {
  name: string
  bins: readonly B[]
  /** 막대 윗변 값(예: 계통 수, 누적이면 아래 값 + 이 시리즈 값) */
  y1: (bin: B) => number
  /** 막대 아랫변 값. 기본 baseline(누적 막대의 위 시리즈는 아래 시리즈의 y1) */
  y0?: (bin: B) => number
  /** 기본 0. 로그 y축이면 1 */
  baseline?: number
  /** 색. 문자열 또는 구간별 함수(차트 테마 색을 넘긴다: useChartTheme()) */
  color: string | ((bin: B, index: number) => string)
  /** 기본 1 */
  opacity?: number
  /** 구간별 커서(클릭 가능한 구간만 'pointer') */
  cursor?: (bin: B, index: number) => 'pointer' | 'default'
  /** 데이터 행 끝에 붙일 값(툴팁·클릭에서 params.value[4..]로 읽는다) */
  extra?: (bin: B) => (number | string)[]
  /** custom 시리즈의 나머지 옵션(tooltip, z 등) */
  series?: Record<string, unknown>
}

interface RenderApi {
  value: (dim: number) => number
  coord: (v: number[]) => number[]
}

/** 사전 계산 구간의 막대 시리즈. 반환값을 option.series 배열에 넣는다 */
export function histogramSeries<B extends HistogramBin>(opts: HistogramSeriesOptions<B>): SeriesOption {
  const { name, bins, y1, y0, baseline = 0, color, opacity = 1, cursor, extra, series } = opts
  const renderItem = (params: { dataIndex: number }, api: RenderApi) => {
    const lo = api.value(0)
    const hi = api.value(1)
    const b0 = api.value(2)
    const b1 = api.value(3)
    if (!(b1 > b0)) return null
    const p0 = api.coord([lo, b1])
    const p1 = api.coord([hi, b0])
    const bin = bins[params.dataIndex]!
    return {
      type: 'rect',
      shape: { x: p0[0]! + 0.5, y: p0[1]!, width: Math.max(1, p1[0]! - p0[0]! - 1), height: p1[1]! - p0[1]! },
      style: { fill: typeof color === 'function' ? color(bin, params.dataIndex) : color, opacity },
      cursor: cursor ? cursor(bin, params.dataIndex) : undefined,
    }
  }
  return {
    name,
    type: 'custom',
    renderItem: renderItem as never,
    encode: { x: [0, 1], y: [2, 3] },
    data: bins.map(b => [b.x0, b.x1, y0 ? y0(b) : baseline, y1(b), ...(extra ? extra(b) : [])]),
    ...series,
  } as SeriesOption
}
