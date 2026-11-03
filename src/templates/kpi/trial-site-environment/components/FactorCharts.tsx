import { useMemo } from 'react'
import { EChart, hMarkLine, selectionStroke, selectionSymbolSeries, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { formatFixed, formatPValue } from '@/lib/format'
import {
  CORR_BY_KEY,
  CORRELATIONS,
  ENVS,
  envLabel,
  FACTOR_BY_KEY,
  lowestResiduals,
  N_ENV,
  R_CRIT,
  YEARS,
  type Env,
  type FactorKey,
  type Year,
} from '../data'
import { f1, f2, n0, s1 } from './fmt'

/** 요인 값 표시(요인 자릿수) */
export const factorText = (key: FactorKey, v: number) => {
  const f = FACTOR_BY_KEY[key]
  return `${f.digits === 0 ? n0(v) : f1(v)} ${f.unit}`
}
/** 회귀 기울기 자릿수: 값 크기에 맞춰 유효숫자 3개 */
const slopeText = (b: number) => {
  const a = Math.abs(b)
  const d = a >= 10 ? 1 : a >= 1 ? 2 : 3
  return b < 0 ? `− ${formatFixed(-b, d)}` : `+ ${formatFixed(b, d)}`
}
export const regressionText = (key: FactorKey) => {
  const c = CORR_BY_KEY[key]
  return `y = ${f1(c.a)} ${slopeText(c.b)}x`
}
export const corrText = (key: FactorKey) => {
  const c = CORR_BY_KEY[key]
  return `r = ${f2(c.r)}, p = ${formatPValue(c.p)}, R² = ${f2(c.r2)}`
}

// ---------------- ① 요인별 상관 막대 ----------------

interface BarsProps {
  factor: FactorKey
  onFactor: (k: FactorKey) => void
  height: number
}

export function FactorBars({ factor, onFactor, height }: BarsProps) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const crit = R_CRIT
    const ss = selectionStroke(theme)
    return {
      animation: false,
      grid: { left: 8, right: 44, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: 'value', min: -1, max: 1, interval: 0.5, axisLabel: { formatter: (v: number) => f1(v) } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: CORRELATIONS.map(c => c.label),
        axisLabel: {
          formatter: (v: string) => {
            const c = CORRELATIONS.find(x => x.label === v)!
            return c.key === factor ? `{sel|${v}}` : c.sig ? `{sig|${v}}` : v
          },
          // 선택 요인 = 글자색 테두리 상자(강조색은 유의 막대 색이라 선택 표시에 쓰지 않음)
          rich: { sel: { color: theme.text, fontWeight: 700, fontSize: 12, borderColor: theme.text, borderWidth: 1.5, borderRadius: 3, padding: [2, 4] }, sig: { color: theme.text, fontWeight: 700, fontSize: 12 } },
        },
        axisTick: { show: false },
      },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const c = CORRELATIONS[(p as { dataIndex: number }).dataIndex]!
          return `<b>${c.label}</b><br/>r = ${f2(c.r)} · p = ${formatPValue(c.p)}${c.sig ? ' (유의)' : ' (비유의)'}<br/>n = ${N_ENV}`
        },
      },
      series: [
        {
          type: 'bar',
          cursor: 'pointer',
          barWidth: '58%',
          data: CORRELATIONS.map(c => ({
            value: c.r,
            itemStyle: {
              color: c.sig ? theme.accent : theme.textMuted,
              opacity: c.sig ? 1 : 0.45,
              borderColor: c.key === factor ? ss.lineColor : 'transparent',
              borderWidth: c.key === factor ? ss.lineWidth : 0,
              ...(c.key === factor ? { shadowColor: ss.haloColor, shadowBlur: ss.haloWidth } : {}),
              borderRadius: c.r >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
            },
            label: {
              show: true,
              position: c.r >= 0 ? ('right' as const) : ('left' as const),
              formatter: `${f2(c.r)}${c.sig ? ' *' : ''}`,
              color: theme.text,
              // 막대 opacity를 물려받아 비유의 값이 흐렸다
              opacity: 1,
              fontWeight: c.sig ? 700 : 400,
              fontSize: 11,
              // 유의 임계 점선이 값 글자를 지나가므로 표면색 상자를 깐다(글자 테두리만으로는 글자 사이로 선이 보인다)
              backgroundColor: theme.surface,
              padding: [1, 2],
            },
          })),
          markLine: {
            symbol: 'none',
            silent: true,
            // 기본 z(5)면 점선이 값 라벨 위로 지나간다. 막대 뒤로 보내 라벨의 표면색 상자가 선을 가리게 한다
            z: 1,
            data: [
              vMarkLine(0, null, theme.text, { width: 1 }),
              vMarkLine(crit, `p < 0.05, n = ${N_ENV}`, theme.textMuted, { line: 'dashed', width: 1, position: 'start' }),
              vMarkLine(-crit, `±${formatFixed(R_CRIT, 3)}`, theme.textMuted, { line: 'dashed', width: 1, position: 'start' }),
            ],
          },
        },
      ],
    }
  }, [factor, theme])

  const sig = CORRELATIONS.filter(c => c.sig)
  const aria = `기상 요인 ${CORRELATIONS.length}개와 환경 지수의 상관(n = ${N_ENV}). 유의 임계 |r| ≥ ${formatFixed(R_CRIT, 3)}을 넘는 요인은 ${sig.map(c => `${c.label}(r ${f2(c.r)}, p ${formatPValue(c.p)})`).join('·')}뿐입니다.`
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={aria}
      fallbackTable={{ columns: ['요인', 'r', 'p', '유의'], rows: CORRELATIONS.map(c => [c.label, f2(c.r), formatPValue(c.p), c.sig ? '예' : '아니오']) }}
      onEvents={{
        click: (p: unknown) => {
          const c = CORRELATIONS[(p as { dataIndex: number }).dataIndex]
          if (c) onFactor(c.key)
        },
      }}
    />
  )
}

// ---------------- ② 요인–환경 지수 산점도 ----------------

interface ScatterProps {
  factor: FactorKey
  year: Year
  siteId: string
  height: number
}

export function FactorScatter({ factor, year, siteId, height }: ScatterProps) {
  const theme = useChartTheme()
  const f = FACTOR_BY_KEY[factor]
  const c = CORR_BY_KEY[factor]
  const low = useMemo(() => lowestResiduals(factor, 4), [factor])

  const option = useMemo<EChartsOption>(() => {
    const lowSet = new Map(low.map(l => [l.env, l.resid]))
    const span = c.max - c.min
    const xMin = c.min - span * 0.08
    const xMax = c.max + span * 0.08
    const point = (e: Env, i: number) => {
      const isYear = e.year === year
      const isSel = e.site.id === siteId
      const resid = lowSet.get(e)
      const col = e.year === YEARS[0] ? theme.categorical[0]! : theme.categorical[1]!
      return {
        value: [e[factor], e.index, c.resid[i]!],
        env: e,
        symbolSize: isSel ? 15 : 10,
        itemStyle: {
          color: col,
          opacity: isYear ? 0.95 : 0.4,
          borderColor: theme.surface,
          borderWidth: 1,
        },
        label: {
          show: resid !== undefined || isSel,
          position: 'bottom' as const,
          distance: 7,
          formatter: resid !== undefined ? `${envLabel(e)} ${s1(resid)}` : envLabel(e),
          // 점 opacity 0.4를 물려받아 비선택 연도 라벨이 읽히지 않았다
          opacity: 1,
          color: isYear ? theme.text : theme.textMuted,
          fontSize: 11,
          fontWeight: isSel ? 700 : 500,
          textBorderColor: theme.surface,
          textBorderWidth: 3,
        },
      }
    }
    const tip = (p: unknown) => {
      const d = (p as { data?: { env?: Env; value?: number[] } }).data
      const e = d?.env
      if (!e) return ''
      return `<b>${e.site.name} ${e.year}</b><br/>${f.label} ${factorText(factor, e[factor])}<br/>환경 지수 ${s1(e.index)} kg/10a<br/>잔차 ${s1(d.value![2]!)}`
    }
    const sel = ENVS.find(e => e.year === year && e.site.id === siteId)
    return {
      animation: false,
      grid: { left: 8, right: 20, top: 28, bottom: 28, containLabel: true },
      xAxis: { type: 'value', name: f.axis, nameLocation: 'middle', nameGap: 26, scale: true },
      yAxis: { type: 'value', name: '환경 지수 (kg/10a, 쌀 수량)', nameTextStyle: { align: 'left' }, min: -80, max: 80, interval: 20 },
      tooltip: { trigger: 'item', formatter: tip },
      series: [
        {
          type: 'line',
          name: '회귀선',
          data: [
            [xMin, c.a + c.b * xMin],
            [xMax, c.a + c.b * xMax],
          ],
          symbol: 'none',
          silent: true,
          lineStyle: { color: theme.text, width: 1.5, type: c.sig ? 'solid' : 'dashed' },
          tooltip: { show: false },
          markLine: { symbol: 'none', silent: true, data: [hMarkLine(0, '전체 평균', theme.textMuted, { width: 1, line: 'solid' })] },
          z: 1,
        },
        {
          type: 'scatter',
          name: String(YEARS[0]),
          symbol: 'circle',
          data: ENVS.map((e, i) => (e.year === YEARS[0] ? point(e, i) : null)).filter(Boolean) as ReturnType<typeof point>[],
          z: 3,
          labelLayout: { moveOverlap: 'shiftY' as const },
        },
        {
          type: 'scatter',
          name: String(YEARS[1]),
          symbol: 'rect',
          data: ENVS.map((e, i) => (e.year === YEARS[1] ? point(e, i) : null)).filter(Boolean) as ReturnType<typeof point>[],
          z: 3,
          labelLayout: { moveOverlap: 'shiftY' as const },
        },
        // 선택 환경 고리(공통 선택 표시): 점과 같은 모양, 점 테두리를 글자색으로 바꾸지 않는다
        ...selectionSymbolSeries(theme, { value: sel ? [sel[factor], sel.index] : null, symbol: year === YEARS[0] ? 'circle' : 'rect', symbolSize: 20, z: 4 }),
      ],
    }
  }, [factor, year, siteId, theme, c, f, low])

  const aria = `${f.label}와 환경 지수 산점도(${N_ENV}개 환경, ${YEARS[0]} 원·${YEARS[1]} 사각형). ${corrText(factor)}, 회귀선 ${regressionText(factor)}. 회귀선 아래 잔차가 가장 큰 환경: ${low.map(l => `${envLabel(l.env)} ${s1(l.resid)}`).join(', ')}.`
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={aria}
      fallbackTable={{
        columns: ['환경', `${f.label}(${f.unit})`, '환경 지수(kg/10a)', '잔차'],
        rows: ENVS.map((e, i) => [envLabel(e), f.digits === 0 ? n0(e[factor]) : f1(e[factor]), s1(e.index), s1(c.resid[i]!)]),
      }}
    />
  )
}
