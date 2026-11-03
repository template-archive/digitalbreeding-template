import type { ChartTheme } from './theme'

/** 데이터 위 선택 표시 선 규격(SVG·ECharts graphic 공용) */
export interface SelectionStroke {
  /** 후광(아래에 먼저 그림): 표면색 */
  haloColor: string
  haloWidth: number
  /** 선택 선(후광 위): 글자색 */
  lineColor: string
  lineWidth: number
}

/**
 * 데이터 위 선택·현재·1위 표시(visual-language 「데이터 위 선택 표시」): 같은 도형을 두 번 그린다 — 표면색 4px 후광 → 글자색 2.5px 선.
 * 강조색은 범주 1색·순차 척도와 같은 파랑이라 데이터 위 선택에 쓰지 않는다. 기준 구현: viz/trait-correlation CorrelationMatrix 선택 셀.
 * SVG: `<rect … fill="none" stroke={s.haloColor} strokeWidth={s.haloWidth} /><rect … stroke={s.lineColor} strokeWidth={s.lineWidth} />`
 * ECharts custom/graphic: `style: { fill: 'transparent', stroke: s.haloColor, lineWidth: s.haloWidth }` 다음 `stroke: s.lineColor, lineWidth: s.lineWidth`.
 * HTML 칸은 CSS 클래스 `select-ring`. 2026-10-30 공개.
 */
export function selectionStroke(theme: Pick<ChartTheme, 'surface' | 'text'>): SelectionStroke {
  return { haloColor: theme.surface, haloWidth: 4, lineColor: theme.text, lineWidth: 2.5 }
}

export interface SelectionSymbolOptions {
  /** 선택 점의 데이터 좌표(시리즈 data 한 행, 예: [x, y]). null·undefined면 빈 시리즈(선택 없음 — 시리즈 수가 바뀌지 않는다) */
  value: readonly (number | string)[] | null | undefined
  /** 고리 모양(ECharts symbol). 기본 'circle'. 점 마크와 같게(리드 SNP 'diamond' 등) */
  symbol?: string
  /** 고리 크기(px). 기본 16. 점보다 크게 두면 점과 고리 사이에 틈이 생기고, 같게 두면 점 테두리를 덮는다 */
  symbolSize?: number
  /** 두 시리즈의 z(후광 → 선 순서로 그린다). 기본 5 — 보통 점 시리즈보다 위 */
  z?: number
  /** 후광 시리즈 이름(선 시리즈는 이 이름에서 ' 후광'을 뺀 것). 기본 '선택 후광' */
  name?: string
  /** 후광 두께. 기본 selectionStroke의 4. 지도 바탕처럼 선이 많은 곳에서 더 굵게(예: 6.5) */
  haloWidth?: number
  /** 다중 격자일 때 축 번호 */
  xAxisIndex?: number
  yAxisIndex?: number
}

type ScatterSeries = {
  type: 'scatter'
  name: string
  symbol: string
  symbolSize: number
  silent: true
  z: number
  data: (number | string)[][]
  itemStyle: { color: 'transparent'; borderColor: string; borderWidth: number }
  tooltip: { show: false }
  emphasis: { disabled: true }
  xAxisIndex?: number
  yAxisIndex?: number
}

/**
 * 산점·기호 마크 위 선택 표시(「데이터 위 선택 표시」의 점 판): 같은 자리에 빈 고리를 두 번 겹친다 — 표면색 후광 → 글자색 선.
 * 반환 [후광, 선] 두 시리즈를 option.series 끝에 펼쳐 넣는다(`...selectionSymbolSeries(theme, { value })`).
 * 두 시리즈는 silent(툴팁·클릭은 아래 점이 받는다)이고, 선택이 없어도 빈 시리즈로 남아 시리즈 번호가 바뀌지 않는다.
 * 선택 점 자체의 크기를 키우는 것은 호출 측이 정한다. 2026-10-30 승격(gebv-selection TraitScatter·gwas-manhattan ManhattanChart·trial-site-environment SiteMap)
 */
export function selectionSymbolSeries(theme: Pick<ChartTheme, 'surface' | 'text'>, opts: SelectionSymbolOptions): [ScatterSeries, ScatterSeries] {
  const s = selectionStroke(theme)
  const { value, symbol = 'circle', symbolSize = 16, z = 5, name = '선택 후광', haloWidth = s.haloWidth, xAxisIndex, yAxisIndex } = opts
  const data = value ? [[...value]] : []
  const ring = (n: string, color: string, width: number): ScatterSeries => ({
    type: 'scatter',
    name: n,
    symbol,
    symbolSize,
    silent: true,
    z,
    data,
    itemStyle: { color: 'transparent', borderColor: color, borderWidth: width },
    tooltip: { show: false },
    emphasis: { disabled: true },
    ...(xAxisIndex !== undefined ? { xAxisIndex } : null),
    ...(yAxisIndex !== undefined ? { yAxisIndex } : null),
  })
  return [ring(name, s.haloColor, haloWidth), ring(name.replace(/ 후광$/, '') || name, s.lineColor, s.lineWidth)]
}
