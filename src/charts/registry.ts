/** ECharts 모듈 등록 — 한 곳에서 한 번만. 템플릿은 echarts.use()를 호출하지 않는다. */
import * as echarts from 'echarts/core'
import { BarChart, BoxplotChart, CustomChart, GraphChart, HeatmapChart, LineChart, PieChart, ScatterChart, TreeChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  DatasetComponent,
} from 'echarts/components'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'
import { LabelLayout, UniversalTransition } from 'echarts/features'

echarts.use([
  ScatterChart,
  LineChart,
  BarChart,
  HeatmapChart,
  GraphChart,
  TreeChart,
  BoxplotChart,
  CustomChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  LegendComponent,
  TitleComponent,
  AriaComponent,
  DatasetComponent,
  CanvasRenderer,
  SVGRenderer,
  LabelLayout,
  UniversalTransition,
])

export { echarts }
