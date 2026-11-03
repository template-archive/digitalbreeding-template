import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { GWAS_PCS, PVE, pveCum } from '../data'

/** 설명 분산 막대(scree). PC1~PC3(GWAS 공변량)을 강조하고 PC3 오른쪽에 경계선을 긋는다. */
export function ScreeChart({ height, narrow }: { height: number; narrow: boolean }) {
  const theme = useChartTheme()
  const cum = pveCum(GWAS_PCS)

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 12, top: 44, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const k = (p as { value: [number, number] }).value[0]
          const tag = k <= GWAS_PCS ? ' · GWAS 공변량' : ''
          return `<b>PC${k}</b> · ${PVE[k - 1]!.toFixed(1)}% · 누적 ${pveCum(k).toFixed(1)}%${tag}`
        },
      },
      xAxis: {
        type: 'value',
        min: 0.5,
        max: PVE.length + 0.5,
        interval: 1,
        splitLine: { show: false },
        axisLine: { show: true },
        // 눈금·라벨은 막대 위치(정수 1~10)에만(min 0.5에서 시작하는 기본 눈금은 0.5, 1.5…라 라벨이 비었다).
        // 글자 하한 11px: 좁은 화면에서는 'PC1' 다음부터 번호만(칸 폭 약 26px)
        axisTick: { customValues: PVE.map((_, i) => i + 1) },
        axisLabel: { customValues: PVE.map((_, i) => i + 1), formatter: (v: number) => (narrow && v > 1 ? String(v) : `PC${v}`), fontSize: 11, hideOverlap: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 25,
        interval: 5,
        name: '설명 분산(%)',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: { align: 'left' },
      },
      series: [
        {
          type: 'bar',
          barWidth: narrow ? 14 : 20,
          data: PVE.map((v, i) => ({
            value: [i + 1, v],
            // 강조색은 온대 자포니카 색(cat-1)과 같으므로 공변량 강조는 잉크색으로 한다
            itemStyle: { color: i < GWAS_PCS ? theme.text : theme.textMuted, opacity: i < GWAS_PCS ? 1 : 0.45 },
          })),
          // 좁은 화면: 값 라벨은 PC1~PC(공변량 수 + 1)만, % 없이(축 이름이 %) — 11px 라벨이 옆 막대와 겹치지 않게
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
            color: theme.text,
            formatter: (p: unknown) => {
              const [k, v] = (p as { value: [number, number] }).value
              if (!narrow) return `${v.toFixed(1)}%`
              return k <= GWAS_PCS + 1 ? v.toFixed(1) : ''
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: theme.text, type: 'dashed', width: 1.2 },
            label: {
              show: true,
              position: 'end',
              align: 'left',
              offset: [-2, 0],
              fontSize: 11,
              fontWeight: 600,
              color: theme.text,
              formatter: `GWAS 공변량 PC ${GWAS_PCS}개(누적 ${cum.toFixed(1)}%)`,
            },
            data: [{ xAxis: GWAS_PCS + 0.5 }],
          },
        },
      ],
    }),
    [theme, narrow, cum],
  )

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`주성분 설명 분산: PC1 ${PVE[0]}%, PC2 ${PVE[1]}%, PC3 ${PVE[2]}%로 GWAS 공변량 PC ${GWAS_PCS}개의 누적 설명 분산은 ${cum.toFixed(1)}%이고, PC4부터는 ${PVE[3]}% 이하로 평평하다.`}
      fallbackTable={{
        columns: ['주성분', '설명 분산(%)', '누적(%)', 'GWAS 공변량'],
        rows: PVE.map((v, i) => [`PC${i + 1}`, v.toFixed(1), pveCum(i + 1).toFixed(1), i < GWAS_PCS ? '예' : '아니오']),
      }}
    />
  )
}
