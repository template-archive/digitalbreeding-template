import { useEffect, useMemo, useState } from 'react'
import { EChart, useChartTheme } from '@/charts'
import { Card, ChartCard, DataTable, KpiRow, KpiTile, PageHeader, Select, type DataTableColumn } from '@/design-system'
import { validateProgramData, type ProgramDataset, type ProgramRow } from './contract'

const gainOf = (row: ProgramRow) => row.selectionIntensity * row.accuracy * row.geneticSd / row.generationInterval

export function ProgramDataPreview({ data, onReady }: { data: ProgramDataset; onReady?: () => void }) {
  const validated = useMemo(() => validateProgramData(data), [data])
  useEffect(() => {
    if (!onReady) return
    const frame = requestAnimationFrame(onReady)
    return () => cancelAnimationFrame(frame)
  }, [validated, onReady])
  const [chosenYear, setChosenYear] = useState<number | null>(null)
  const theme = useChartTheme()
  const selected = validated.rows.find(row => row.year === chosenYear) ?? validated.rows[validated.rows.length - 1]!
  const gain = gainOf(selected)
  const percent = gain / validated.baselineYield * 100
  const rows = validated.rows.map(row => ({ ...row, gain: gainOf(row), percent: gainOf(row) / validated.baselineYield * 100 }))
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: 'year', header: '연도', numeric: true },
    { key: 'selectionIntensity', header: 'i', numeric: true },
    { key: 'accuracy', header: 'r', numeric: true },
    { key: 'geneticSd', header: 'σA (kg/10a)', numeric: true },
    { key: 'generationInterval', header: 'L (년)', numeric: true },
    { key: 'gain', header: 'ΔG (kg/10a/년)', numeric: true, format: value => Number(value).toFixed(2) },
    { key: 'percent', header: 'ΔG (%/년)', numeric: true, format: value => Number(value).toFixed(2) },
    { key: 'targetGainPct', header: '목표 (%/년)', numeric: true },
  ]
  const option = {
    animation: false,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 48, right: 16, top: 36, bottom: 48 },
    xAxis: { type: 'category' as const, data: rows.map(row => String(row.year)), name: '연도', nameLocation: 'middle' as const, nameGap: 30 },
    yAxis: { type: 'value' as const, name: 'ΔG (%/년)', min: 0 },
    series: [
      { name: '연간 개량량', type: 'bar' as const, data: rows.map(row => Number(row.percent.toFixed(4))), itemStyle: { color: theme.accent }, barMaxWidth: 48 },
      { name: '목표', type: 'line' as const, data: rows.map(row => row.targetGainPct), lineStyle: { type: 'dashed' as const, color: theme.textMuted }, itemStyle: { color: theme.textMuted } },
    ],
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-connected-preview="">
      <PageHeader
        title={`${validated.projectName} · 연간 개량량`}
        context="사용자 데이터 미리보기 · 브라우저에서만 처리"
        scope={`ΔG = i × r × σA ÷ L · 기준 수량 ${validated.baselineYield} kg/10a · ${rows.length}개 연도`}
        actions={<Select label="표시 연도" value={String(selected.year)} onChange={value => setChosenYear(Number(value))} options={rows.map(row => ({ value: String(row.year), label: `${row.year}년` }))} />}
      />
      <p className="break-keep text-sm leading-relaxed text-muted">업로드한 연간 지표만 표시합니다. 기본 예제의 파이프라인·출원·형질별 정확도 데이터는 섞지 않습니다. 파일은 서버로 전송하거나 저장하지 않습니다.</p>
      <KpiRow hero>
        <KpiTile size="hero" label="연간 유전적 개량량" value={percent} digits={2} unit="%/년" sub={`${gain.toFixed(2)} kg/10a/년`} />
        <KpiTile label="목표 달성률" value={percent / selected.targetGainPct * 100} digits={1} unit="%" sub={`목표 ${selected.targetGainPct}%/년`} />
        <KpiTile label="선발 정확도 r" value={selected.accuracy} digits={2} />
        <KpiTile label="세대 간격 L" value={selected.generationInterval} digits={2} unit="년" />
      </KpiRow>
      <ChartCard title="연도별 개량량과 목표" subtitle="막대: 연간 개량량 · 점선: 해당 연도 목표" height={320}>
        <EChart option={option} height={320} ariaLabel={`${validated.projectName} 연도별 연간 유전적 개량량. ${selected.year}년 ${percent.toFixed(2)}%/년.`} fallbackTable={{ columns: ['연도', 'ΔG (%/년)', '목표 (%/년)'], rows: rows.map(row => [row.year, row.percent.toFixed(2), row.targetGainPct]) }} />
      </ChartCard>
      <Card title="입력값과 계산 결과" subtitle="숫자 머리글을 눌러 정렬할 수 있습니다. 단위는 쌀 수량 kg/10a 기준입니다.">
        <DataTable columns={columns} rows={rows} rowKey="year" caption="업로드한 연간 지표와 계산 결과" defaultSort={{ key: 'year', dir: 'asc' }} stickyColumn="year" pageSize={20} />
      </Card>
    </div>
  )
}
