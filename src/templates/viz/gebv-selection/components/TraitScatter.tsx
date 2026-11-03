import { useMemo } from 'react'
import { EChart, selectionSymbolSeries, useChartTheme, type EChartsOption } from '@/charts'
import { LINES, STATS, TRAITS, fmtGebv, type Mode, type SelectionResult, type TraitKey, type Weights } from '../data'
import { formatSigned } from '@/lib/format'

interface Props {
  result: SelectionResult
  mode: Mode
  yTrait: Exclude<TraitKey, 'yield'>
  /** 정규화 가중치(지수 모드 등고선용) */
  wn: Weights | null
  corr: number
  selectedName: string | null
  onSelect: (name: string) => void
  height: number
  /** 좁은 화면: 점 무리와 기준선 라벨에 겹치므로 상위 계통 라벨을 숨긴다(선택 링·툴팁·상세 패널로 식별) */
  compact?: boolean
}

/** 라벨을 붙이는 상위 계통 수 */
const N_LABELED = 3
/** 라벨끼리 겹치지 않게 y 순서대로 벌리는 간격(px) */
const LABEL_STEP = 15

const dirText = (t: TraitKey) => (TRAITS[t].d > 0 ? '높을수록 좋음' : '낮을수록 좋음')

/** 두 형질 GEBV 산점도. x = 수량 GEBV 고정, y = 선택 형질 */
export function TraitScatter({ result, mode, yTrait, wn, corr, selectedName, onSelect, height, compact = false }: Props) {
  const theme = useChartTheme()
  const yDef = TRAITS[yTrait]

  const ext = useMemo(() => {
    const xs = LINES.map(l => l.gebv.yield)
    const ys = LINES.map(l => l.gebv[yTrait])
    const pad = (lo: number, hi: number, f: number) => [lo - (hi - lo) * f, hi + (hi - lo) * f] as const
    const [x0, x1] = pad(Math.min(...xs), Math.max(...xs), 0)
    const [y0, y1] = pad(Math.min(...ys), Math.max(...ys), 0.06)
    const step = yDef.digits === 2 ? 0.5 : 1
    return { x0: Math.floor(x0 / 10) * 10, x1: Math.ceil(x1 / 10) * 10, y0: Math.floor(y0 / step) * step, y1: Math.ceil(y1 / step) * step }
  }, [yTrait, yDef.digits])

  const option = useMemo<EChartsOption>(() => {
    type Pt = { value: [number, number, number]; label?: object; labelLine?: object }
    const selPts: Pt[] = []
    const unselPts: Pt[] = []
    // 시리즈 내 dataIndex → 라벨 세로 이동(px)
    const selDy = new Map<number, number>()
    const unselDy = new Map<number, number>()
    const layoutOf = (m: Map<number, number>) => (p: { dataIndex: number }) => {
      const dy = m.get(p.dataIndex)
      return dy === undefined ? {} : { dx: 8, dy }
    }
    // 상위 계통 라벨: 점 무리 밖(오른쪽)으로 빼고 y 순서대로 위·아래로 벌린 뒤 지시선으로 잇는다
    const labeled = LINES.slice(0, compact ? 0 : N_LABELED)
      .map((l, idx) => ({ idx, y: l.gebv[yTrait] }))
      .sort((a, b) => b.y - a.y)
    const dyOf = new Map(labeled.map((o, k) => [o.idx, (k - (labeled.length - 1) / 2) * LABEL_STEP * 1.4]))
    LINES.forEach((l, idx) => {
      const r = result.byName.get(l.name)!
      const pt: Pt = { value: [l.gebv.yield, l.gebv[yTrait], idx] }
      if (dyOf.has(idx)) {
        const dy = dyOf.get(idx) ?? 0
        pt.label = {
          show: true,
          formatter: l.name,
          position: 'right',
          distance: 8,
          color: theme.text,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: theme.surface,
          padding: [1, 3],
          borderRadius: 2,
        }
        pt.labelLine = { show: true, lineStyle: { color: theme.textMuted, width: 1 } }
        ;(r.selected ? selDy : unselDy).set((r.selected ? selPts : unselPts).length, dy)
      }
      ;(r.selected ? selPts : unselPts).push(pt)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tip = (p: any) => {
      const idx = (p.value as number[])[2]
      if (idx === undefined) return ''
      const l = LINES[idx]!
      const r = result.byName.get(l.name)!
      return `<b>${l.name}</b> · 수량 ${fmtGebv(l.gebv.yield, 'yield')} · ${yDef.short} ${fmtGebv(l.gebv[yTrait], yTrait)} · 수량 신뢰도(r²) ${l.rel.yield.toFixed(2)} · 순위 ${r.rank} · ${r.selected ? '선발' : '비선발'}`
    }

    // 지수 모드: 두 형질 부분 지수 w_x·z_x + w_y·z_y = c 등고선(원 척도로 변환)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contours: any[] = []
    if (mode === 'index' && wn) {
      const wx = wn.yield
      const wy = wn[yTrait]
      const sx = STATS.yield
      const sy = STATS[yTrait]
      for (const c of [-1, 0, 1]) {
        let pts: [number, number][] = []
        if (wy > 0) {
          const yAt = (x: number) => {
            const zx = (x - sx.mean) / sx.sd
            const zy = (c - wx * zx) / wy
            return sy.mean + yDef.d * sy.sd * zy
          }
          pts = [
            [ext.x0, yAt(ext.x0)],
            [ext.x1, yAt(ext.x1)],
          ]
        } else if (wx > 0) {
          const x = sx.mean + (sx.sd * c) / wx
          pts = [
            [x, ext.y0],
            [x, ext.y1],
          ]
        }
        if (pts.length === 0) continue
        contours.push({
          name: '두 형질 부분 지수(나머지 형질 고정)',
          type: 'line',
          data: pts,
          symbol: 'none',
          silent: true,
          clip: true,
          lineStyle: { color: theme.textMuted, type: 'dashed', width: c === 0 ? 1.5 : 1 },
          endLabel: { show: true, formatter: `부분 지수 ${formatSigned(c, 0)}`, color: theme.textMuted, fontSize: 11 },
          tooltip: { show: false },
          z: 1,
        })
      }
    }

    const selLine = selectedName ? LINES.findIndex(l => l.name === selectedName) : -1

    return {
      animation: false,
      // 상위 계통 라벨이 오른쪽 끝 점 옆으로 나가므로 라벨 폭만큼 비운다(768px에서 잘리던 문제)
      grid: { left: 52, right: compact ? (mode === 'index' ? 64 : 20) : 92, top: 16, bottom: 48 },
      tooltip: { trigger: 'item', confine: true, formatter: tip },
      xAxis: {
        type: 'value',
        min: ext.x0,
        max: ext.x1,
        name: '수량 GEBV (kg/10a, 높을수록 좋음)',
        nameLocation: 'middle',
        nameGap: 28,
        splitLine: { show: false },
        axisLabel: { formatter: (v: number) => formatSigned(v, 0) },
      },
      yAxis: {
        type: 'value',
        min: ext.y0,
        max: ext.y1,
        name: `${yDef.short} GEBV (${yDef.unit}, ${dirText(yTrait)})`,
        nameLocation: 'middle',
        nameGap: 38,
        axisLabel: { formatter: (v: number) => formatSigned(v, yDef.digits === 2 ? 1 : 0) },
        interval: yDef.digits === 2 ? 0.5 : undefined,
      },
      series: [
        ...contours,
        {
          name: '비선발',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 6,
          data: unselPts,
          labelLayout: layoutOf(unselDy),
          itemStyle: { color: 'transparent', borderColor: theme.textMuted, borderWidth: 1, opacity: 0.7 },
          emphasis: { scale: 1.6 },
          z: 2,
        },
        {
          name: '선발',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 7,
          data: selPts,
          labelLayout: layoutOf(selDy),
          itemStyle: { color: theme.accent, borderColor: theme.surface, borderWidth: 0.5 },
          emphasis: { scale: 1.6 },
          z: 3,
          markLine:
            mode === 'yield'
              ? {
                  silent: true,
                  symbol: 'none',
                  animation: false,
                  lineStyle: { color: theme.text, type: 'solid', width: 2 },
                  label: { position: 'insideEndTop', formatter: `기준 ${formatSigned(result.cutoff, 1)}`, color: theme.text, fontSize: 11, fontWeight: 600 },
                  data: [{ xAxis: result.cutoff }],
                }
              : undefined,
        },
        // 선택 계통: 공통 선택 표시(표면색 후광 → 글자색 선)를 같은 원에 두 번(공통 selectionSymbolSeries)
        ...selectionSymbolSeries(theme, {
          name: '선택 계통 후광',
          value: selLine >= 0 ? [LINES[selLine]!.gebv.yield, LINES[selLine]!.gebv[yTrait], selLine] : null,
          symbolSize: 16,
          z: 5,
        }),
      ],
    }
  }, [theme, result, yTrait, yDef, mode, wn, ext, selectedName, compact])

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const v = (p as { value?: unknown }).value
        if (Array.isArray(v) && typeof v[2] === 'number' && LINES[v[2]]) onSelect(LINES[v[2]]!.name)
      },
    }),
    [onSelect],
  )

  const nSelShown = result.nSel
  const ariaLabel = `수량과 ${yDef.short} GEBV 산점도: 600계통 중 선발 ${nSelShown}계통, 두 형질 GEBV 상관 r = ${formatSigned(corr, 2)}${
    mode === 'yield' ? `, 수량 기준선 ${formatSigned(result.cutoff, 1)} kg/10a 오른쪽이 선발` : ', 지수 모드에서는 두 형질 부분 지수 등고선 표시'
  }`
  const fallbackTable = {
    columns: ['계통', '수량 GEBV', `${yDef.short} GEBV`, '선발'],
    rows: result.ranked.filter(r => r.selected).map(r => [r.line.name, fmtGebv(r.line.gebv.yield, 'yield'), fmtGebv(r.line.gebv[yTrait], yTrait), '선발']),
  }

  return <EChart option={option} height={height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} onEvents={onEvents} />
}
