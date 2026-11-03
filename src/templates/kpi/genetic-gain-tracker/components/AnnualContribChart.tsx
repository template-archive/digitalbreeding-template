import { useMemo } from 'react'
import { EChart, useChartTheme, useNarrowCategoryAxis, type EChartsOption } from '@/charts'
import { FACTORS, FACTOR_LABEL, FACTOR_NAME, GS_START, dG, lmdi, type Factor, type Year } from '../data'
import { n, sg, yearLabel } from './fmt'

/** H. 전년 대비 ΔG 변화의 요소별 기여(누적 막대, 음수는 0 아래) + 순변화 ◆ */
export function AnnualContribChart({ years, height, colors }: { years: Year[]; height: number; colors: Record<Factor, string> }) {
  const theme = useChartTheme()
  // 시작 연도 다음 해부터
  const ys = years.slice(1)
  // 칸이 좁으면(390px 등) 'yy→yy' 라벨이 붙으므로 기울인다
  const { ref, narrow } = useNarrowCategoryAxis(ys.length, 56)

  const option = useMemo<EChartsOption>(() => {
    const rows = ys.map(y => ({ y, c: lmdi(y), net: dG(y) - dG((y - 1) as Year) }))
    return {
      grid: { left: 36, right: 8, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const r = rows[list[0]?.dataIndex ?? 0]
          if (!r) return ''
          return [
            `<b>${r.y - 1}→${yearLabel(r.y)}</b>`,
            `ΔG ${n(dG((r.y - 1) as Year), 2)} → ${n(dG(r.y), 2)} kg/10a/년`,
            `순변화 <b>${sg(r.net, 2)}</b>`,
            ...FACTORS.map(f => `<span style="color:${colors[f]}">■</span> ${FACTOR_NAME[f]} ${sg(r.c[f], 2)}`),
          ].join('<br/>')
        },
      },
      xAxis: { type: 'category', data: ys.map(y => `${String(y - 1).slice(2)}→${String(y).slice(2)}`), axisLabel: narrow ? { interval: 0, fontSize: 11, rotate: 45, margin: 6 } : { interval: 0, fontSize: 11 } },
      yAxis: { type: 'value', name: '전년 대비 ΔG 변화 (kg/10a/년)', nameLocation: 'middle', nameGap: 36 },
      series: [
        ...FACTORS.map(f => ({
          name: FACTOR_LABEL[f],
          type: 'bar' as const,
          stack: 'c',
          barMaxWidth: 26,
          // 음수 기여는 0 아래로 쌓고 빗금 대신 옅은 채움 + 테두리로 구분(툴팁에 − 부호)
          data: rows.map(r => ({
            value: r.c[f],
            itemStyle: r.c[f] < 0 ? { color: theme.surface, borderColor: colors[f], borderWidth: 1.5, borderType: 'solid' as const, borderRadius: 0 } : { color: colors[f], borderRadius: 0 },
          })),
        })),
        {
          name: '순변화',
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 10,
          z: 6,
          itemStyle: { color: theme.text },
          tooltip: { show: false },
          data: rows.map(r => ({
            value: r.net,
            label:
              r.y === GS_START
                ? { show: true, position: 'top' as const, formatter: `${sg(r.net, 2)} GS·속성세대진전 도입`, fontSize: 11, fontWeight: 700, color: theme.accent, align: 'left' as const, offset: [-6, 0] }
                : { show: false },
          })),
        },
        {
          name: '0 기준',
          type: 'line',
          silent: true,
          symbol: 'none',
          tooltip: { show: false },
          data: [],
          markLine: { symbol: 'none', silent: true, data: [{ yAxis: 0 }], lineStyle: { color: theme.text, width: 1, type: 'solid' }, label: { show: false } },
        },
      ],
    } as EChartsOption
  }, [ys, theme, colors, narrow])

  const last = ys[ys.length - 1]
  const lc = last ? lmdi(last) : null
  return (
    <div ref={ref} className="h-full">
      <EChart
        option={option}
        height={height}
        ariaLabel={
          last && lc
            ? `전년 대비 ΔG 변화 요소별 기여. ${last - 1}→${last}: 순변화 ${sg(dG(last) - dG((last - 1) as Year), 2)} = ${FACTORS.map(f => `${FACTOR_LABEL[f]} ${sg(lc[f], 2)}`).join(', ')}.${ys.includes(GS_START as Year) ? ` ${GS_START - 1}→${GS_START}이 ${sg(dG(GS_START as Year) - dG((GS_START - 1) as Year), 2)}로 가장 크다(GS·속성세대진전 도입).` : ''}`
            : '전년 대비 기여'
        }
        fallbackTable={{
          columns: ['전년→연도', '순변화', ...FACTORS.map(f => FACTOR_LABEL[f])],
          rows: ys.map(y => {
            const c = lmdi(y)
            return [`${y - 1}→${y}`, sg(dG(y) - dG((y - 1) as Year), 2), ...FACTORS.map(f => sg(c[f], 2))]
          }),
        }}
      />
    </div>
  )
}
