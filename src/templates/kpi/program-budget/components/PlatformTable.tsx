import { useMemo } from 'react'
import { DataTable, SeverityTag, type DataTableColumn } from '@/design-system'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { CHIP_UNIT_TREND, FY, LAB_ANNUAL_TARGET, PLATFORMS, PLATFORM_SAMPLES_FORECAST, PLATFORM_SAMPLES_PLAN, PLATFORM_SAMPLES_TOTAL, USD_KRW, type PlatformRow } from '../data'
import { STATUS_LABEL, man, n } from './fmt'

const usdText = (v: number) => (v >= 10 ? `≈${Math.round(v)}` : `≈${n(v, 1)}`)
const wonText = (p: PlatformRow) => (p.wonPerMarker >= 100 ? man(p.wonPerMarker) : p.wonPerMarker >= 2 ? n(p.wonPerMarker, 2) : n(p.wonPerMarker, 1))
const unitText = (v: number) => (v < 1 ? n(v, 2) : n(v, 1))

/** E-위. 6K 칩 샘플당 비용 스파크라인 */
export function ChipUnitSpark() {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const c = theme.categorical[2]!
    const last = CHIP_UNIT_TREND.length - 1
    return {
      grid: { left: 6, right: 28, top: 16, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (ps: unknown) => {
        const p = (ps as { dataIndex: number }[])[0]!
        const r = CHIP_UNIT_TREND[p.dataIndex]!
        return `${r.label}: ${n(r.unit)}만 원/샘플`
      } },
      xAxis: { type: 'category', data: CHIP_UNIT_TREND.map(r => r.label), axisLabel: { fontSize: 11, interval: 0 }, axisLine: { show: false } },
      yAxis: { type: 'value', min: 2, max: 3.5, show: false },
      series: [
        {
          type: 'line',
          data: CHIP_UNIT_TREND.map(r => r.unit),
          lineStyle: { color: c, width: 2 },
          itemStyle: { color: c },
          symbolSize: 5,
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
            fontWeight: 600,
            color: theme.text,
            formatter: (p: { dataIndex: number; value: number }) => (p.dataIndex === 0 || p.dataIndex === last || p.dataIndex === last - 1 ? n(p.value) : ''),
          },
        },
      ],
    } as EChartsOption
  }, [theme])
  const first = CHIP_UNIT_TREND[0]!
  const cur = CHIP_UNIT_TREND[CHIP_UNIT_TREND.length - 2]!
  const next = CHIP_UNIT_TREND[CHIP_UNIT_TREND.length - 1]!
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-2/50 px-3 pt-2 pb-1 sm:flex-row sm:items-center sm:gap-3">
      <p className="shrink-0 text-xs text-muted">
        <b className="font-semibold text-text">6K 칩 샘플당 비용</b>
        <br className="hidden sm:block" /> {first.label} {n(first.unit)} → {cur.label} {n(cur.unit)} → {next.label} {n(next.unit)}만 원
      </p>
      <div className="min-w-0 flex-1">
        <EChart
          option={option}
          height={64}
          ariaLabel={`6K SNP 칩 샘플당 비용은 ${first.label} ${n(first.unit)}만 원에서 ${cur.label} ${n(cur.unit)}만 원으로 내렸고 ${next.label} ${n(next.unit)}만 원입니다.`}
          fallbackTable={{ columns: ['연도', '샘플당 비용(만 원)'], rows: CHIP_UNIT_TREND.map(r => [r.label, n(r.unit)]) }}
        />
      </div>
    </div>
  )
}

const columns: DataTableColumn<PlatformRow>[] = [
  {
    key: 'name',
    header: '플랫폼',
    format: (_, p) => (
      <span className="flex flex-col gap-0.5">
        <b className="font-semibold text-text">{p.name}</b>
        <span className="break-keep text-[11px] leading-snug text-muted">{p.use}</span>
        <span className="break-keep text-[11px] leading-snug text-muted">{p.inBaseline ? '비교 기준 포함' : '비교 기준 외'}</span>
      </span>
    ),
  },
  { key: 'markers', header: '마커 수', numeric: true, hideBelow: 'sm', format: (_, p) => p.markersLabel },
  {
    key: 'unit',
    header: '샘플당 비용',
    numeric: true,
    headerTitle: `만 원 / USD(1 USD = ${USD_KRW.toLocaleString('ko-KR')}원)`,
    format: (_, p) => (
      <span className="tabular-nums">
        {unitText(p.unit)}만 원
        <span className="block text-[11px] text-muted">{usdText(p.usd)} USD</span>
      </span>
    ),
  },
  { key: 'wonPerMarker', header: '마커당(원)', numeric: true, format: (_, p) => wonText(p) },
  {
    key: 'samplesAct',
    header: `${FY} 샘플 실적/계획`,
    numeric: true,
    hideBelow: 'sm',
    format: (_, p) => (
      <span className="tabular-nums">
        {man(p.samplesAct)} / {man(p.samplesPlan)}
        {p.samplesForecast !== p.samplesPlan && <span className="block text-[11px] text-muted">전망 {man(p.samplesForecast)}</span>}
      </span>
    ),
  },
  {
    key: 'costAct',
    header: '비용 실적/예산/전망(만 원)',
    numeric: true,
    format: (_, p) => (
      <span className="tabular-nums">
        {man(p.costAct)} / {man(p.costBudget)} / <b className={p.status === 'critical' ? 'text-negative' : 'text-text'}>{man(p.costForecast)}</b>
      </span>
    ),
  },
  {
    key: 'status',
    header: '상태',
    format: (_, p) => (
      <SeverityTag severity={p.status} label={p.done ? '완료' : p.status === 'ok' ? '정상' : STATUS_LABEL[p.status]} />
    ),
  },
]

/** E. 유전형 분석 플랫폼 표 */
export function PlatformTable() {
  return (
    <div className="flex flex-col gap-3">
      <ChipUnitSpark />
      <DataTable
        columns={columns}
        rows={PLATFORMS}
        rowKey={p => p.key}
        dense
        stickyColumn={{ key: 'name', below: 'md' }}
        caption={`유전형 분석 플랫폼별 단가와 ${FY} 실적(추정). 1~10월 샘플 합 ${man(PLATFORM_SAMPLES_TOTAL)}`}
        scrollHint="옆으로 밀어 비용·상태 보기 →"
      />
      <p className="text-[13px] font-medium text-text tabular-nums">
        {FY} 예산 계획 {man(PLATFORM_SAMPLES_PLAN)}샘플 · 전망 {man(PLATFORM_SAMPLES_FORECAST)}샘플(분석실 처리 목표 연 {man(LAB_ANNUAL_TARGET)}과 별개)
      </p>
      <p className="text-xs text-muted tabular-nums">
        샘플 실적 합 {man(PLATFORM_SAMPLES_TOTAL)}(1~10월, 「유전체 분석실 운영 현황」 화면과 같음) · 단가는 DNA 추출 포함, 재분석 비용은 단가에 포함 · 6K 마커당 비용은 QC 후 사용 마커 기준. 여교배(MAS) 배경 선발 6K는 외부 위탁이라 이 표와 6K 비목에 넣지 않습니다.
      </p>
    </div>
  )
}
