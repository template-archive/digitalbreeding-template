import { useMemo } from 'react'
import { EChart, stripeDecal, useChartTheme, type EChartsOption } from '@/charts'
import { CUR, MULT, P1, P2, P3, PLAN_YEAR, SEED_YIELD_T_PER_HA, SUPPLY_RATE, supplyT, type Variety } from '../data'
import { n } from './fmt'

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027] as const

type PanelKey = 'prebasic' | 'basic' | 'certified'
const PANELS: { key: PanelKey; title: string; digits: number; fn: (v: Variety, y: number) => number; seedYield: number }[] = [
  { key: 'prebasic', title: '원원종 생산(t)', digits: 3, fn: P1, seedYield: SEED_YIELD_T_PER_HA.prebasic },
  { key: 'basic', title: '원종 생산(t)', digits: 1, fn: P2, seedYield: SEED_YIELD_T_PER_HA.basic },
  { key: 'certified', title: '보급종 생산(t)', digits: 1, fn: P3, seedYield: SEED_YIELD_T_PER_HA.certified },
]

function Panel({ v, p, color, height }: { v: Variety; p: (typeof PANELS)[number]; color: string; height: number }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const decal = stripeDecal(theme.surface)
    const series: unknown[] = [
      {
        name: p.title,
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color, borderRadius: [2, 2, 0, 0] },
        data: YEARS.map(y => {
          const val = p.fn(v, y)
          return y === PLAN_YEAR ? { value: val, itemStyle: { color, opacity: 0.5, decal } } : val
        }),
      },
    ]
    if (p.key === 'certified') {
      series.push({
        name: '공급량 S(다음 해 봄)',
        type: 'line',
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { type: 'dashed', width: 1.5, color: theme.text },
        itemStyle: { color: theme.text },
        data: YEARS.map(y => (supplyT(v, y) > 0 ? supplyT(v, y) : null)),
        z: 4,
      })
    }
    return {
      grid: { left: 4, right: 8, top: 22, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const y = YEARS[i]!
          const val = p.fn(v, y)
          const lines = [`<b>${v.name} ${y}${y === PLAN_YEAR ? ' (계획)' : ''}</b>`, `${p.title.replace('(t)', '')} <b>${n(val, p.digits)} t</b>`]
          if (val > 0) lines.push(`채종 면적 ${n(val / p.seedYield, val / p.seedYield < 1 ? 2 : 1)} ha(채종 수량 ${n(p.seedYield, 1)} t/ha)`)
          if (p.key === 'certified' && supplyT(v, y) > 0) lines.push(`그해 봄 공급량 S ${n(supplyT(v, y), 1)} t(전년산 × ${n(SUPPLY_RATE, 2)})`)
          return lines.join('<br/>')
        },
      },
      // 계획 연도는 두 줄('27 / 계획)로 나눠 11px에서도 이웃 눈금과 겹치지 않게
      xAxis: { type: 'category', data: YEARS.map(y => (y === PLAN_YEAR ? `'${String(y).slice(2)}
계획` : `'${String(y).slice(2)}`)), axisLabel: { interval: 0, fontSize: 11, lineHeight: 13 } },
      yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 11, formatter: (x: number) => n(x, x !== 0 && Math.abs(x) < 1 ? 2 : 0) } },
      series,
    } as EChartsOption
  }, [theme, v, p, color])
  const cur = p.fn(v, CUR)
  const plan = p.fn(v, PLAN_YEAR)
  const peak = YEARS.reduce((best, y) => (p.fn(v, y) > p.fn(v, best) ? y : best), YEARS[0])
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[13px] font-semibold text-text">
        {p.title}
        <span className="ml-1 text-xs font-normal text-muted tabular-nums">
          {CUR} {n(cur, p.digits)} · {PLAN_YEAR} 계획 {n(plan, p.digits)}
        </span>
      </p>
      <EChart
        option={option}
        height={height}
        ariaLabel={`${v.name} ${p.title}: ${CUR}년 ${n(cur, p.digits)} t, ${PLAN_YEAR}년 계획 ${n(plan, p.digits)} t${p.fn(v, peak) > 0 ? `, 최대 ${peak}년 ${n(p.fn(v, peak), p.digits)} t` : `, ${YEARS[0]}~${YEARS[YEARS.length - 1]} 생산 없음`}.`}
        fallbackTable={{
          columns: ['연도', `${p.title}`, ...(p.key === 'certified' ? ['공급량 S(t)'] : [])],
          rows: YEARS.map(y => [y === PLAN_YEAR ? `${y} 계획` : String(y), n(p.fn(v, y), p.digits), ...(p.key === 'certified' ? [n(supplyT(v, y), 1)] : [])]),
        }}
      />
    </div>
  )
}

/** D. 선택 품종 단계별 생산·공급량 — 소형 다중 막대 3개(각 y축 0부터 독립) */
export function StagePanels({ v, height }: { v: Variety; height: number }) {
  const theme = useChartTheme()
  const colors = [theme.sequential[3]!, theme.sequential[4]!, theme.sequential[6]!]
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PANELS.map((p, i) => (
          <Panel key={p.key} v={v} p={p} color={colors[i]!} height={height} />
        ))}
      </div>
      <p className="text-xs text-muted">
        실현 증식 배율: 원원종→원종 {MULT.basic}배, 원종→보급종 {MULT.found}배(추정, 예비 비축·검사 불합격 포함). 보급종 패널 점선 = 그해 봄 공급량 S(전년산 × 0.95). 빗금 = {PLAN_YEAR} 계획. 패널마다 축 범위가 다릅니다(로그 축 대신 소형 다중).
      </p>
    </div>
  )
}
