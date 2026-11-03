import { useMemo } from 'react'
import { EChart, stripeDecal, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import {
  AREA_SERIES,
  AREA_YEARS,
  CUR,
  GARAMSOL,
  PLAN_YEAR,
  firstFarmYear,
  nationalOf,
  pilotHa,
  pilotTotal,
  seriesArea,
  share,
  supplyHa,
  totalArea,
} from '../data'
import { josa } from '@/lib/format'
import { ha, n, pc, seriesColor } from './fmt'

const YEARS = AREA_YEARS as readonly number[]
const IDX_REG = YEARS.indexOf(GARAMSOL.reg!)
const IDX_FIRST = YEARS.indexOf(firstFarmYear(GARAMSOL)!)

/** 막대 위 합계 라벨 */
export function totalLabel(y: number) {
  const t = totalArea(y)
  if (t === 0) return '0 ha'
  if (t === pilotTotal(y)) return `${ha(t)} ha · 시범`
  return `${ha(t)} ha · ${pc(share(y), 2)}`
}

/** B. 재배 면적 추이 — 품종 누적 막대(2027 전망은 빗금) */
export function AreaTrendChart({ height, narrow = false }: { height: number; narrow?: boolean }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const planDecal = stripeDecal(theme.surface)
    const series = AREA_SERIES.map((s, i) => {
      const color = seriesColor(theme, i, s.key === 'new')
      return {
        name: s.label,
        type: 'bar',
        stack: 'area',
        barMaxWidth: 46,
        itemStyle: { color, borderRadius: 0 },
        emphasis: { focus: 'series' },
        data: YEARS.map(y => {
          const v = seriesArea(s.members, y)
          // 빗금이 전망을 말한다. 불투명도를 많이 낮추면 다크 바탕에서 표면색 빗금이 묻혀 계열 구분이 어렵다
          return y === PLAN_YEAR ? { value: v, itemStyle: { color, opacity: 0.8, decal: planDecal } } : v
        }),
        ...(i === 0
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                data: [
                  // 좁은 폭: 품종명을 빼고 등록 라벨은 선을 따라 세로(insideEndTop)로 내려 첫 공급 라벨과 떨어뜨린다
                  vMarkLine(IDX_REG, narrow ? `등록 ${GARAMSOL.reg}` : `${GARAMSOL.name} 등록 ${GARAMSOL.reg}`, theme.textMuted, {
                    line: 'dashed',
                    width: 1.2,
                    ...(narrow ? { position: 'insideEndTop' as const } : {}),
                  }),
                  vMarkLine(IDX_FIRST, narrow ? `첫 공급 ${firstFarmYear(GARAMSOL)}` : `${GARAMSOL.name} 첫 공급 ${firstFarmYear(GARAMSOL)}`, theme.text, {
                    line: 'dashed',
                    width: 1.2,
                  }),
                ],
              },
            }
          : {}),
      }
    })
    // 합계 라벨(보이지 않는 점)
    series.push({
      name: '합계',
      type: 'scatter',
      symbolSize: 0,
      silent: true,
      tooltip: { show: false },
      z: 5,
      ...(narrow ? { labelLayout: { moveOverlap: 'shiftY' } } : {}),
      data: YEARS.map(y => ({
        value: totalArea(y),
        label: {
          // 좁은 폭: 0 ha 라벨은 세로선 라벨과 겹쳐 숨기고, 면적·점유율을 두 줄로 나누고 단위(y축에 있음)를 빼 폭을 줄인다
          show: !(narrow && totalArea(y) === 0),
          position: 'top',
          distance: 4,
          formatter: (narrow ? totalLabel(y).replace(' ha', '').replace(' · ', '\n') : totalLabel(y)) + (y === PLAN_YEAR ? '\n(전망)' : ''),
          color: y === CUR ? theme.text : theme.textMuted,
          fontSize: narrow ? 11 : y === CUR ? 12 : 11,
          fontWeight: y === CUR ? 700 : 500,
          lineHeight: narrow ? 13 : 14,
          textBorderColor: theme.surface,
          textBorderWidth: 3,
        },
      })),
    } as never)
    return {
      grid: narrow ? { left: 18, right: 24, top: 52, bottom: 4, containLabel: true } : { left: 20, right: 16, top: 40, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const list = p as { dataIndex: number }[]
          const i = list[0]?.dataIndex ?? 0
          const y = YEARS[i]!
          const total = totalArea(y)
          const nat = nationalOf(y)
          const rows = AREA_SERIES.map((s, k) => {
            const a = seriesArea(s.members, y)
            if (a === 0) return ''
            const sup = s.members.reduce((acc, v) => acc + supplyHa(v, y), 0)
            const supShare = a > 0 ? (sup / a) * 100 : 0
            const pilot = a === s.members.reduce((acc, v) => acc + pilotHa(v, y), 0)
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${seriesColor(theme, k, s.key === 'new')};margin-right:4px"></span>${s.label} <b>${ha(a)} ha</b> · 점유율 ${pc((a / nat) * 100, 2)}${pilot ? ' · 시범' : ` · 보급종 공급 면적 비중 ${pc(supShare, 1)}`}`
          }).filter(Boolean)
          return [
            `<b>${y}${y === PLAN_YEAR ? ' 전망(계획 공급 기준)' : y === CUR ? ' (추정)' : ''}</b>`,
            ...rows,
            `합계 <b>${ha(total)} ha</b> · 국내 ${ha(nat)} ha의 ${pc(share(y), 2)}${y === PLAN_YEAR ? '(국내 면적 2026 유지 가정)' : ''}`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: YEARS.map(y => (y === PLAN_YEAR ? `${y}${narrow ? '\n' : ' '}전망` : y === CUR ? `${y}${narrow ? '\n' : ' '}추정` : String(y))),
        ...(narrow ? { axisLabel: { interval: 0, fontSize: 11, lineHeight: 13 } } : {}),
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: '재배 면적(ha)',
        nameLocation: 'middle',
        nameGap: narrow ? 42 : 48,
        axisLabel: { formatter: (v: number) => n(v), ...(narrow ? { fontSize: 11 } : {}) },
      },
      series,
    } as EChartsOption
  }, [theme, narrow])
  const t26 = totalArea(CUR)
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`프로그램 품종 재배 면적은 ${GARAMSOL.name} 첫 공급(${firstFarmYear(GARAMSOL)}) 뒤 늘어 ${CUR}년 ${ha(t26)} ha(국내 ${pc(share(CUR), 2)}, 추정)이고, ${PLAN_YEAR}년은 계획 공급 기준 ${ha(totalArea(PLAN_YEAR))} ha(${pc(share(PLAN_YEAR), 2)}) 전망입니다. ${josa(GARAMSOL.name, '가이')} ${ha(seriesArea([GARAMSOL], CUR))} ha로 가장 큽니다.`}
      fallbackTable={{
        columns: ['연도', ...AREA_SERIES.map(s => s.label), '합계(ha)', '국내 점유율'],
        rows: YEARS.map(y => [y === PLAN_YEAR ? `${y} 전망` : String(y), ...AREA_SERIES.map(s => ha(seriesArea(s.members, y))), ha(totalArea(y)), pc(share(y), 2)]),
      }}
    />
  )
}
