import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { AS_OF_LABEL, AS_OF_X, FY, MONTHLY, TOTAL } from '../data'
import { eok, pc } from './fmt'

const toEok = (v: number) => v / 1e4
const pctOf = (v: number) => (v / TOTAL.budget) * 100

/** B. 월별 누계 집행 — 계획 누계(점선), 실적 누계(실선), 연말 전망(파선), 예산선, 기준일선 */
export function MonthlyCumChart({ height, narrow }: { height: number; narrow: boolean }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const planColor = theme.textMuted
    const actColor = theme.categorical[0]!
    const fcColor = theme.negative
    const tip = (x: number) => {
      const p = MONTHLY.find(m => Math.abs(m.x - x) < 1e-6)
      if (!p) {
        // 연말 전망 끝점
        return `<b>12월말 연말 전망</b><br/>${eok(TOTAL.forecast)}억 원 · 예산의 ${pc(TOTAL.fcPct)}`
      }
      const rows = [`<b>${p.label}</b>`, `계획 누계 ${eok(p.plan)}억 원 · ${pc(pctOf(p.plan), 2)}`]
      if (p.act !== null) rows.push(`실적 누계 ${eok(p.act)}억 원 · ${pc(pctOf(p.act), 2)}`)
      return rows.join('<br/>')
    }
    return {
      grid: { left: 8, right: narrow ? 12 : 24, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => tip((p as { value: number[] }).value[0]!),
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 12,
        interval: 1,
        axisLabel: { formatter: (v: number) => (v === 0 ? '' : narrow && v % 2 === 1 ? '' : `${v}월`) },
        splitLine: { show: false },
        axisPointer: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 10,
        interval: 2,
        name: '억 원',
        nameTextStyle: { align: 'left', padding: [0, 0, 0, -4] },
        // 왼쪽 여백을 두어 원점 눈금 '0'이 선에 붙지 않게 한다
        axisLabel: { margin: 12, formatter: (v: number) => String(v) },
      },
      series: [
        {
          name: '계획 누계',
          type: 'line',
          data: [[0, 0], ...MONTHLY.map(m => [m.x, toEok(m.plan)])],
          lineStyle: { color: planColor, type: 'dotted', width: 2 },
          itemStyle: { color: planColor },
          // (0, 0)은 측정점이 아니라 선의 시작이다. 마커가 y축 '0' 눈금을 가려 그리지 않는다
          symbol: (v: number[]) => (v[0] === 0 ? 'none' : 'circle'),
          symbolSize: 5,
          z: 2,
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              hMarkLine(toEok(TOTAL.budget), `예산 ${eok(TOTAL.budget)}억`, theme.text, { line: 'solid', width: 1.25, position: 'insideStartTop' }),
              // 좁은 화면: '전망' 라벨과 겹쳐 기준일 라벨은 범례로 옮긴다
              vMarkLine(AS_OF_X, narrow ? null : `기준일 ${AS_OF_LABEL}`, theme.textMuted, { line: 'dashed', width: 1.25 }),
            ],
          },
        },
        {
          name: '실적 누계',
          type: 'line',
          data: [[0, 0], ...MONTHLY.filter(m => m.act !== null).map(m => [m.x, toEok(m.act!)])],
          lineStyle: { color: actColor, width: 3 },
          itemStyle: { color: actColor },
          symbol: (v: number[]) => (v[0] === 0 ? 'none' : 'circle'),
          symbolSize: (v: number[]) => (Math.abs(v[0]! - AS_OF_X) < 1e-6 ? 10 : 6),
          z: 4,
          label: {
            show: true,
            formatter: (p: { value: number[] }) => (Math.abs(p.value[0]! - AS_OF_X) < 1e-6 ? `${eok(TOTAL.actToDate)}억 · ${pc(TOTAL.execPct)}` : ''),
            position: 'left',
            color: theme.text,
            fontWeight: 700,
            fontSize: 12,
            distance: 8,
            backgroundColor: theme.surface,
            padding: [2, 4],
          },
        },
        {
          name: '연말 전망',
          type: 'line',
          data: [
            [AS_OF_X, toEok(TOTAL.actToDate)],
            [12, toEok(TOTAL.forecast)],
          ],
          lineStyle: { color: fcColor, type: 'dashed', width: 2 },
          itemStyle: { color: fcColor },
          symbol: (v: number[]) => (v[0] === 12 ? 'triangle' : 'none'),
          symbolSize: 9,
          z: 3,
          label: {
            show: true,
            formatter: (p: { value: number[] }) => (p.value[0] === 12 ? `전망 ${pc(TOTAL.fcPct)}` : ''),
            position: 'top',
            color: theme.text,
            fontWeight: 700,
            fontSize: 11,
            distance: 14,
            align: 'right',
          },
        },
      ],
    } as EChartsOption
  }, [theme, narrow])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${FY} 월별 누계 집행: 기준일 ${AS_OF_LABEL} 실적 누계 ${eok(TOTAL.actToDate)}억 원(예산의 ${pc(TOTAL.execPct)}), 계획 누계 ${eok(TOTAL.planToDate)}억 원(${pc(TOTAL.planPct)})으로 계획과 같은 속도입니다. 연말 전망은 ${eok(TOTAL.forecast)}억 원으로 예산 ${eok(TOTAL.budget)}억 원의 ${pc(TOTAL.fcPct)}입니다.`}
      fallbackTable={{
        columns: ['시점', '계획 누계(억 원)', '계획 %', '실적 누계(억 원)', '실적 %'],
        rows: [
          ...MONTHLY.map(m => [m.label, eok(m.plan), pc(pctOf(m.plan), 2), m.act === null ? '—' : eok(m.act), m.act === null ? '—' : pc(pctOf(m.act), 2)]),
          ['연말 전망', '—', '—', eok(TOTAL.forecast), pc(TOTAL.fcPct)],
        ],
      }}
    />
  )
}
