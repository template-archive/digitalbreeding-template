import { useMemo } from 'react'
import { EChart, metZoneColor, useChartTheme, type EChartsOption } from '@/charts'
import { CENTRAL, CUR, OTHER_LABEL, PROVINCE, PROV_SERIES } from '../data'
import { josa } from '@/lib/format'
import { ha, pc, seriesColor } from './fmt'

export type ProvMode = 'all' | 'variety'

// 위 → 아래가 보급률 내림차순이 되도록 y축 범주를 뒤집는다
const ROWS = [...PROVINCE].reverse()
const endLabel = (r: (typeof PROVINCE)[number]) => `${pc(r.rate, 1)} · ${ha(r.progArea)} / ${ha(r.provArea)} ha`

/** E. 도별 보급률 — 가로 막대(전체) 또는 품종 누적(품종별) */
export function ProvinceChart({ height, mode }: { height: number; mode: ProvMode }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const centralColor = metZoneColor(theme, 'central')
    const centralIdx = ROWS.map((r, i) => (r.central ? i : -1)).filter(i => i >= 0)
    const band = {
      silent: true,
      itemStyle: { color: centralColor, opacity: 0.07 },
      label: { show: false },
      data: [[{ yAxis: Math.min(...centralIdx) - 0.5 }, { yAxis: Math.max(...centralIdx) + 0.5 }]],
    }
    const label = {
      show: true,
      position: 'right',
      distance: 6,
      color: theme.text,
      fontSize: 11,
      formatter: (p: { dataIndex: number }) => endLabel(ROWS[p.dataIndex]!),
    }
    const series =
      mode === 'all'
        ? [
            {
              name: '보급률',
              type: 'bar',
              barMaxWidth: 18,
              itemStyle: { borderRadius: [0, 3, 3, 0] },
              data: ROWS.map(r => ({
                value: r.rate,
                itemStyle: { color: r.progArea === 0 ? theme.border : r.central ? centralColor : theme.categorical[7] },
              })),
              label,
              markArea: band,
            },
          ]
        : PROV_SERIES.map((s, i) => ({
            name: s.label,
            type: 'bar',
            stack: 'prov',
            barMaxWidth: 18,
            itemStyle: { color: seriesColor(theme, i, s.key === 'new'), borderRadius: 0 },
            data: ROWS.map(r => (r.bySeries[s.key]! / r.provArea) * 100),
            ...(i === PROV_SERIES.length - 1 ? { label, markArea: band } : {}),
          }))
    return {
      grid: { left: 4, right: 168, top: 8, bottom: 22, containLabel: true },
      legend: mode === 'variety' ? { show: false } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const r = ROWS[i]!
          const lines = [
            `<b>${r.key === '기타' ? OTHER_LABEL : r.label}${r.central ? ' · 중부 평야지' : ''}</b>`,
            `도 벼 재배 면적 ${ha(r.provArea)} ha(${CUR} 추정)`,
            `프로그램 품종 면적 <b>${ha(r.progArea)} ha</b> · 보급률 <b>${pc(r.rate, 1)}</b>`,
          ]
          if (mode === 'variety')
            PROV_SERIES.forEach(s => {
              const a = r.bySeries[s.key]!
              if (a > 0) lines.push(`${s.label} ${ha(a)} ha · ${pc((a / r.provArea) * 100, 2)}`)
            })
          return lines.join('<br/>')
        },
      },
      xAxis: { type: 'value', min: 0, name: '보급률(%)', nameLocation: 'middle', nameGap: 22, axisLabel: { formatter: (v: number) => `${v}` } },
      yAxis: {
        type: 'category',
        data: ROWS.map(r => r.label),
        axisLabel: { color: theme.text, fontSize: 12, fontWeight: 600 },
        axisTick: { show: false },
      },
      series,
    } as EChartsOption
  }, [theme, mode])
  const top = PROVINCE[0]!
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${CUR}년 도별 보급률은 ${PROVINCE.filter(r => r.progArea > 0)
        .map(r => `${r.label} ${pc(r.rate, 1)}`)
        .join(', ')} 순이고 기타 지역은 0%입니다. 프로그램 지역인 중부 평야지(${CENTRAL.join('·')})가 상위 3도이며 ${josa(top.label, '가이')} ${ha(top.progArea)} / ${ha(top.provArea)} ha로 가장 높습니다.`}
      fallbackTable={{
        columns: ['도', '보급률', '프로그램 품종 면적(ha)', '도 벼 재배 면적(ha)', '중부 평야지'],
        rows: PROVINCE.map(r => [r.key === '기타' ? OTHER_LABEL : r.label, pc(r.rate, 1), ha(r.progArea), ha(r.provArea), r.central ? '예' : '']),
      }}
    />
  )
}
