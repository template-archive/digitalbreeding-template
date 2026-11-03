import { useMemo } from 'react'
import { EChart, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { formatSigned } from '@/lib/format'
import { ALT_MODELS, MODELS, OPERATING_MODEL, PRACTICAL_DELTA, RECS, SWITCHES, TRAITS, TRAIT_BY_KEY, fmtCi, fmtSigned3, type TraitKey } from '../data'

// ECharts custom series renderItem API는 공개 타입이 없어 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

/** x축 눈금 간격(0이 눈금에 오도록 양끝을 이 배수로 맞춘다) */
const STEP = 0.02
const allDiffs = RECS.flatMap(r => r.diffs)
const X_MIN = Math.floor(Math.min(...allDiffs.map(d => d.lo)) / STEP) * STEP
const X_MAX = Math.ceil(Math.max(...allDiffs.map(d => d.hi)) / STEP) * STEP

/** A0. 어느 모델이 나은가: 형질별 GBLUP 대비 Δr 점 + 95% CI, 0 기준선과 실용 기준선. 채운 점 = 교체 기준 충족 */
export function DeltaCiChart({ selected, narrow, height }: { selected: TraitKey; narrow: boolean; height: number }) {
  const theme = useChartTheme()
  const selIdx = TRAITS.findIndex(t => t.key === selected)

  const option = useMemo<EChartsOption>(() => {
    const background = {
      name: '선택 형질',
      type: 'custom' as const,
      silent: true,
      z: 0,
      data: [[selIdx]],
      tooltip: { show: false },
      renderItem: (params: Api, api: Api): Api => {
        const box = params.coordSys as { x: number; width: number }
        const band = (api.size([0, 1]) as number[])[1]!
        const y = (api.coord([0, api.value(0)]) as number[])[1]!
        return { type: 'rect', shape: { x: box.x, y: y - band / 2, width: box.width, height: band }, style: { fill: theme.text, opacity: 0.06 } }
      },
    }

    const modelSeries = ALT_MODELS.map((m, j) => {
      const color = theme.categorical[MODELS.indexOf(m)]!
      return {
        name: m,
        type: 'custom' as const,
        z: 3,
        encode: { x: [0, 2, 3], y: 1 },
        data: RECS.map((r, i) => {
          const d = r.diffs.find(x => x.model === m)!
          return [d.delta, i, d.lo, d.hi, d.ok ? 1 : 0, r.rec === m ? 1 : 0]
        }),
        renderItem: (_p: Api, api: Api): Api => {
          const idx = api.value(1) as number
          const delta = api.value(0) as number
          const band = (api.size([0, 1]) as number[])[1]!
          const off = (j - (ALT_MODELS.length - 1) / 2) * Math.min(band * 0.27, 18)
          const [cx, cy0] = api.coord([delta, idx]) as [number, number]
          const y = cy0 + off
          const x0 = (api.coord([api.value(2), idx]) as number[])[0]!
          const x1 = (api.coord([api.value(3), idx]) as number[])[0]!
          const ok = api.value(4) === 1
          const rec = api.value(5) === 1
          const stroke = { stroke: color, lineWidth: 1.5 }
          const children: unknown[] = [
            { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: stroke },
            { type: 'line', shape: { x1: x0, y1: y - 3, x2: x0, y2: y + 3 }, style: stroke },
            { type: 'line', shape: { x1: x1, y1: y - 3, x2: x1, y2: y + 3 }, style: stroke },
            { type: 'circle', shape: { cx, cy: y, r: 4.5 }, style: { fill: ok ? color : theme.surface, ...stroke } },
          ]
          if (rec) {
            children.push({
              type: 'text',
              style: { x: x1 + 6, y, text: narrow ? '권장' : `권장 ${fmtSigned3(delta)}`, fill: theme.text, fontSize: 11, fontWeight: 700, verticalAlign: 'middle' },
            })
          }
          return { type: 'group', children }
        },
        ...(j === 0
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                // 세로축이 뒤집혀 있어 'start'가 위쪽이다. 아래쪽에 두면 x축 눈금과 겹친다
                data: [
                  vMarkLine(0, narrow ? '0' : `${OPERATING_MODEL}과 같음`, theme.text, { width: 1.25, position: 'start' }),
                  vMarkLine(PRACTICAL_DELTA, `${narrow ? '기준' : '실용 기준'} ${formatSigned(PRACTICAL_DELTA, 2)}`, theme.textMuted, { line: 'dashed', labelColor: theme.text, position: 'start' }),
                ],
              },
            }
          : {}),
      }
    })

    return {
      grid: { left: 8, right: 20, top: 26, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const r = RECS[list[0]?.dataIndex ?? 0]
          if (!r) return ''
          const rows = r.diffs.map(d => {
            const color = theme.categorical[MODELS.indexOf(d.model)]
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px"></span><b>${d.model}</b> Δr ${fmtSigned3(d.delta)} · 95% CI ${fmtCi(d)}${d.ok ? ' · 기준 충족' : ''}`
          })
          return [`<b>${TRAIT_BY_KEY[r.trait].name}</b> · ${r.switch ? `${r.rec} 교체 권장` : `${OPERATING_MODEL} 유지`}`, ...rows].join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        min: X_MIN,
        max: X_MAX,
        interval: STEP,
        name: `Δr(모델 − ${OPERATING_MODEL})`,
        nameLocation: 'middle',
        nameGap: 24,
        axisLabel: { formatter: (v: number) => formatSigned(v, 2) },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: TRAITS.map(t => t.name),
        axisLabel: narrow ? { interval: 0, fontSize: 11, color: theme.text, width: 60, overflow: 'break' } : { interval: 0, fontSize: 11, color: theme.text },
        axisTick: { show: false },
      },
      series: [background, ...modelSeries] as EChartsOption['series'],
    }
  }, [theme, narrow, selIdx])

  const ariaLabel = `형질별 ${OPERATING_MODEL} 대비 예측 정확도 차이와 95% 신뢰구간. 교체 기준(Δr ${formatSigned(PRACTICAL_DELTA, 2)} 이상, 신뢰구간 하한 0 초과)을 넘어 권장된 형질: ${SWITCHES.map(s => {
    const d = s.diffs.find(x => x.model === s.rec)!
    return `${TRAIT_BY_KEY[s.trait].name} ${s.rec} ${fmtSigned3(d.delta)} ${fmtCi(d)}`
  }).join(', ')}. 나머지 ${RECS.length - SWITCHES.length}개 형질은 ${OPERATING_MODEL} 유지.`

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      fallbackTable={{
        columns: ['형질', ...ALT_MODELS.map(m => `${m} Δr [95% CI]`), '판정'],
        rows: RECS.map(r => [
          TRAIT_BY_KEY[r.trait].name,
          ...ALT_MODELS.map(m => {
            const d = r.diffs.find(x => x.model === m)!
            return `${fmtSigned3(d.delta)} ${fmtCi(d)}`
          }),
          r.switch ? `${r.rec} 교체` : `${OPERATING_MODEL} 유지`,
        ]),
      }}
    />
  )
}
