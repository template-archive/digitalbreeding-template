import { useMemo } from 'react'
import { ChartCard } from '@/design-system'
import { EChart, hMarkLine, selectionStroke, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { CHECK_LINES, GEBV_RESCUE, REC_LABEL, TEST_LINES, Y_HOLD, Y_PROMOTE, type Decisions, type Line, type Rec } from '../data'
import { f1, fGebv, recParen } from './ui'

interface Props {
  decisions: Decisions
  visible: Set<string>
  selected: string
  onSelect: (name: string) => void
  className?: string
}

const X_RANGE: [number, number] = [90, 120]

/** E. 대비 지수 × 수량 GEBV 산점도 — 색 = 자동 판정, 모양 = 필수 형질 위반, 채움 = 결정 완료 */
export function IndexGebvScatter({ decisions, visible, selected, onSelect, className }: Props) {
  const theme = useChartTheme()
  const color: Record<Rec, string> = { promote: theme.positive, hold: theme.warning, drop: theme.negative }

  const option = useMemo<EChartsOption>(() => {
    // 선택 점 = 글자색 테두리 + 표면색 후광(공통 selectionStroke 규격)
    const ss = selectionStroke(theme)
    const point = (l: Line) => {
      const rec = l.rec!
      const decided = decisions[l.name]?.decision != null
      const sel = l.name === selected
      const dim = !visible.has(l.name)
      const c = color[rec]
      return {
        name: l.name,
        value: [l.d.idx, l.gebv],
        symbol: l.viol.length ? 'triangle' : 'circle',
        symbolSize: sel ? 17 : l.viol.length ? 12 : 10,
        itemStyle: {
          color: decided ? c : theme.surface,
          borderColor: sel ? ss.lineColor : c,
          borderWidth: sel ? ss.lineWidth : 1.6,
          ...(sel ? { shadowColor: ss.haloColor, shadowBlur: ss.haloWidth } : {}),
          opacity: dim ? 0.18 : 1,
        },
        label: sel ? { show: true, formatter: l.name, position: (l.d.idx > 114 ? 'left' : 'right') as 'left' | 'right', color: theme.text, fontSize: 11, fontWeight: 700 } : { show: false },
        z: sel ? 10 : 2,
      }
    }
    const xMin = X_RANGE[0]
    const xMax = X_RANGE[1]
    return {
      // containLabel은 축 이름(nameGap 26)을 계산에 넣지 않으므로 bottom에 축 이름 높이를 따로 둔다
      grid: { left: 8, right: 24, top: 28, bottom: 34, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const name = (p as { name?: string }).name ?? ''
          const l = TEST_LINES.find(x => x.name === name) ?? CHECK_LINES.find(x => x.name === name)
          if (!l) return ''
          if (l.check) return `${l.name} · 지수 ${f1(l.d.idx)} · GEBV ${fGebv(l.gebv)}(표현형 포함) · 대비 품종`
          const st = decisions[l.name]?.decision
          return `${l.name} · 지수 ${f1(l.d.idx)} · GEBV ${fGebv(l.gebv)} · ${recParen(l)} · ${st ? `결정 ${REC_LABEL[st]}` : '미결정'}`
        },
      },
      xAxis: {
        type: 'value',
        min: xMin,
        max: xMax,
        interval: 5,
        name: '대비 품종 대비 지수(가람솔 = 100, %)',
        nameLocation: 'middle',
        nameGap: 26,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: -10,
        max: 60,
        interval: 10,
        name: '수량 GEBV(kg/10a)',
        nameLocation: 'end',
        nameTextStyle: { align: 'left', padding: [0, 0, 0, -28] },
      },
      series: [
        {
          type: 'scatter',
          name: '시험 계통',
          data: TEST_LINES.map(point),
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              vMarkLine(Y_HOLD, `보류 ${f1(Y_HOLD).replace('.0', '')}`, theme.warning, { line: 'dashed', width: 1.2 }),
              vMarkLine(Y_PROMOTE, `진급 ${f1(Y_PROMOTE).replace('.0', '')}`, theme.positive, { line: 'dashed', width: 1.2 }),
              hMarkLine(GEBV_RESCUE, `GEBV 보완 ${fGebv(GEBV_RESCUE)}`, theme.accent, { line: 'dashed', width: 1, position: 'insideStartTop' }),
              [
                { coord: [Y_HOLD, GEBV_RESCUE], lineStyle: { color: theme.accent, type: 'solid', width: 2.5 }, label: { show: false } },
                { coord: [Y_PROMOTE, GEBV_RESCUE] },
              ],
            ],
          },
          markArea: {
            silent: true,
            itemStyle: { color: theme.accent, opacity: 0.06 },
            data: [[{ coord: [Y_HOLD, GEBV_RESCUE] }, { coord: [Y_PROMOTE, 60] }]],
          },
        },
        {
          type: 'scatter',
          name: '대비 품종',
          data: CHECK_LINES.map(l => ({
            name: l.name,
            value: [l.d.idx, l.gebv],
            symbol: 'rect',
            symbolSize: 10,
            itemStyle: { color: theme.textMuted, borderColor: theme.text, borderWidth: 1 },
            label: { show: true, formatter: l.name, position: 'bottom' as const, color: theme.textMuted, fontSize: 11 },
          })),
          z: 3,
        },
      ],
    } as EChartsOption
    // color는 theme에서 파생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions, visible, selected, theme])

  const counts = { promote: 0, hold: 0, drop: 0 }
  for (const l of TEST_LINES) counts[l.rec!]++
  const highViol = TEST_LINES.filter(l => l.viol.length && l.d.idx >= Y_PROMOTE).sort((a, b) => b.d.idx - a.d.idx)
  const aria = `자동 판정 진급 ${counts.promote} · 보류 ${counts.hold} · 탈락 ${counts.drop}. 수량 지수가 ${f1(Y_PROMOTE)} 이상인데 필수 형질을 어겨 탈락 권고된 계통 ${highViol.map(l => l.name).join('·')} ${highViol.length}계통.`

  return (
    <ChartCard
      title="수량 지수 × 수량 GEBV"
      subtitle="점을 누르면 계통 상세가 열립니다 · 음영 = GEBV 보완으로 진급 권고되는 구간"
      height={360}
      source={`지수 = 2026 AYT 쌀 수량(정상 관측 구 평균) / 가람솔 A-3 · GEBV = 2026-10 GBLUP(AYT 2026 미포함)`}
      className={className}
    >
      <div className="flex h-full flex-col gap-2">
        <ScatterLegend />
        <div className="min-h-0 flex-1">
          <EChart
            option={option}
            height="100%"
            ariaLabel={aria}
            onEvents={{
              click: (p: unknown) => {
                const name = (p as { name?: string; seriesIndex?: number }).name
                const si = (p as { seriesIndex?: number }).seriesIndex
                if (name && si === 0) onSelect(name)
              },
            }}
            fallbackTable={{
              columns: ['계통', '대비 지수', '수량 GEBV', '자동 판정', '필수 형질 위반', '결정'],
              rows: TEST_LINES.map(l => [
                l.name,
                f1(l.d.idx),
                fGebv(l.gebv),
                REC_LABEL[l.rec!],
                l.viol.length ? '위반' : '통과',
                decisions[l.name]?.decision ? REC_LABEL[decisions[l.name]!.decision!] : '미결정',
              ]),
            }}
          />
        </div>
      </div>
    </ChartCard>
  )
}

function ScatterLegend() {
  const item = 'inline-flex items-center gap-1.5'
  return (
    <ul aria-label="산점도 범례" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      <li className={item}>
        <span aria-hidden="true" className="size-2.5 rounded-full bg-positive" />
        진급 권고
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-2.5 rounded-full bg-warning" />
        보류 권고
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-2.5 rounded-full bg-negative" />
        탈락 권고
      </li>
      <li className={item}>
        <svg aria-hidden="true" width="11" height="10" viewBox="0 0 11 10" className="text-muted">
          <path d="M5.5 0.8 L10.2 9.2 L0.8 9.2 Z" fill="currentColor" />
        </svg>
        필수 형질 위반
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-2.5 rounded-full border-[1.6px] border-muted bg-surface" />
        미결정(빈 모양)
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-2.5 rounded-[2px] border border-text bg-muted" />
        대비 품종
      </li>
    </ul>
  )
}
