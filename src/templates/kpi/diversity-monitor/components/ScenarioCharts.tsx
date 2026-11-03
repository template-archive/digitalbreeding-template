import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { DFGEN_MAX, DFGEN_YR_CAUTION, DFGEN_YR_LIMIT, GROUPS, H_REF, LAST, OCS_FRONTIER, TH, he, heGroup, type Scenario } from '../data'
import { n } from './fmt'

/** G. 그룹별 He(2026) 가로 막대 */
export function GroupHeChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const rows = useMemo(() => [{ label: '전체', value: he(LAST) }, ...GROUPS.map(g => ({ label: g.label, value: heGroup(g.f) }))], [])
  const option = useMemo<EChartsOption>(() => {
    const base = theme.categorical[2]!
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p: unknown) => {
        const q = p as { dataIndex: number }
        const r = rows[q.dataIndex]
        return r ? `<b>${r.label}</b><br/>He ${n(r.value, 3)}${r.value < TH.heMin ? ' · 하한 미만(주의)' : ''}` : ''
      } },
      xAxis: { type: 'value', min: 0, max: 0.5, interval: 0.1, axisLabel: { formatter: (v: number) => n(v, 1) } },
      yAxis: { type: 'category', inverse: true, data: rows.map(r => r.label), axisLabel: { color: theme.text, fontSize: 12 } },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          data: rows.map((r, i) => {
            const low = r.value < TH.heMin
            return {
              value: r.value,
              itemStyle: { color: low ? theme.warning : i === 0 ? theme.textMuted : base, borderRadius: [0, 3, 3, 0] },
            }
          }),
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              { xAxis: TH.heMin, lineStyle: { color: theme.negative, width: 1.5 }, label: { formatter: `하한 ${n(TH.heMin, 2)}`, position: 'start' as const, offset: [-30, 0], color: theme.negative, fontSize: 11, fontWeight: 600 } },
              { xAxis: H_REF, lineStyle: { color: theme.textMuted, width: 1.5, type: 'dashed' as const }, label: { formatter: `훈련 ${n(H_REF, 2)}`, position: 'start' as const, offset: [30, 0], color: theme.textMuted, fontSize: 11 } },
            ],
          },
        },
        {
          // 값 라벨 전용 계열: 막대 안·막대 끝 라벨은 0.35·0.40 세로선에 가려서 두 선 오른쪽에 값 열로 모은다
          name: '값',
          type: 'scatter',
          symbolSize: 0,
          silent: true,
          z: 6,
          tooltip: { show: false },
          data: rows.map((r, i) => [H_REF + 0.006, i, r.value]),
          label: {
            show: true,
            position: 'right',
            distance: 2,
            color: theme.text,
            fontSize: 11,
            fontWeight: 700,
            formatter: (p: unknown) => {
              const v = (p as { value: number[] }).value[2]!
              return v < TH.heMin ? `${n(v, 3)} 주의` : n(v, 3)
            },
          },
        },
      ],
    } as EChartsOption
  }, [theme, rows])
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${LAST} 그룹별 기대 이형접합도(He): 전체 ${n(rows[0]!.value, 3)}, A 중만생 다수성 ${n(rows[1]!.value, 3)}과 B 조생 고품질 ${n(rows[2]!.value, 3)}은 하한 ${n(TH.heMin, 2)} 아래(주의), C 저항성 공여 ${n(rows[3]!.value, 3)}는 하한 위입니다.`}
      fallbackTable={{ columns: ['그룹', 'He', '판정'], rows: rows.map(r => [r.label, n(r.value, 3), r.value < TH.heMin ? '주의' : '정상']) }}
    />
  )
}

/** J. 이득-다양성 경계 */
export function FrontierChart({ height, scenarios }: { height: number; scenarios: Scenario[] }) {
  const theme = useChartTheme()
  const [trunc, expand, ocs] = scenarios as [Scenario, Scenario, Scenario]
  const narrow = useMediaQuery('(max-width: 639px)')
  const option = useMemo<EChartsOption>(() => {
    const curve = theme.categorical[0]!
    const pt = (s: Scenario, symbol: string, color: string, label: string, pos: 'top' | 'bottom' | 'left' | 'right') => ({
      name: s.label,
      type: 'scatter' as const,
      symbol,
      symbolSize: 14,
      z: 5,
      itemStyle: { color, borderColor: theme.surface, borderWidth: 1.5 },
      label: { show: true, position: pos, formatter: label, color: theme.text, fontSize: 11, fontWeight: 700 },
      data: [[s.dF * 100, s.dG]],
      tooltip: {
        formatter: () =>
          `<b>${s.label}</b> (${s.detail})<br/>세대당 ΔF ${n(s.dF * 100, 2)}% · Ne ${n(s.ne)}<br/>연간 ΔF ${n(s.dFyr * 100, 2)}%/년 · ${s.badge}<br/>ΔG ${n(s.dG, 1)} kg/10a/년 (${n(s.dGpct, 2)}%/년)`,
      },
    })
    return {
      grid: { left: 8, right: 20, top: 44, bottom: 28, containLabel: true },
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', min: 0.3, max: 1.1, interval: 0.1, name: '세대당 근교 증가율 ΔF (%)', nameLocation: 'middle', nameGap: 26, axisLabel: { formatter: (v: number) => n(v, 1) } },
      yAxis: { type: 'value', min: 10, max: 14, interval: 1, name: 'ΔG (kg/10a/년)', nameLocation: 'middle', nameGap: 30 },
      series: [
        {
          name: 'OCS 경계',
          type: 'line',
          symbol: 'none',
          smooth: false,
          lineStyle: { color: curve, width: 2.5 },
          data: OCS_FRONTIER,
          tooltip: { show: false },
          markArea: {
            silent: true,
            // 연간 기준 세 구간: 충족(≤ 0.38%/년) · 주의(0.38~0.42%/년) · 초과
            data: [
              [{ xAxis: 0.3, itemStyle: { color: theme.positive, opacity: 0.08 } }, { xAxis: DFGEN_YR_CAUTION * 100 }],
              [{ xAxis: DFGEN_YR_CAUTION * 100, itemStyle: { color: theme.warning, opacity: 0.14 } }, { xAxis: DFGEN_YR_LIMIT * 100 }],
              [{ xAxis: DFGEN_YR_LIMIT * 100, itemStyle: { color: theme.negative, opacity: 0.08 } }, { xAxis: 1.1 }],
            ],
          },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              // 두 수직선의 값은 카드 범례에 있다. 넓은 화면만 선 위에 양쪽으로 벌려 적고, 좁은 화면은 눈금·점 라벨과 겹쳐 뺀다
              { xAxis: DFGEN_MAX * 100, lineStyle: { color: theme.negative, width: 1.5 }, label: narrow ? { show: false } : { formatter: `Ne ${TH.neMin} 하한\n${n(DFGEN_MAX * 100, 2)}%`, position: 'end' as const, align: 'left' as const, offset: [-2, 0], color: theme.negative, fontSize: 11, fontWeight: 600 } },
              { xAxis: DFGEN_YR_LIMIT * 100, lineStyle: { color: theme.warning, width: 1.5, type: 'dashed' as const }, label: narrow ? { show: false } : { formatter: `연간 상한 환산\n${n(DFGEN_YR_LIMIT * 100, 2)}%`, position: 'end' as const, align: 'right' as const, offset: [2, 0], color: theme.warning, fontSize: 11, fontWeight: 600 } },
            ],
          },
          endLabel: { show: false },
        },
        pt(trunc, 'circle', theme.text, '현행', narrow ? 'bottom' : 'left'),
        pt(expand, 'rect', theme.categorical[1]!, '부모 확대', 'bottom'),
        // 슬라이더를 현행 쪽으로 올리면 라벨이 왼쪽의 '현행'과 겹치므로 아래로. 좁은 화면은 '현행'이 점 아래라 위가 항상 비어 있다
        pt(ocs, 'diamond', theme.accent, 'OCS', !narrow && ocs.dF * 100 > 0.85 ? 'bottom' : 'top'),
      ],
    } as EChartsOption
  }, [theme, trunc, expand, ocs, narrow])
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`이득-다양성 경계: 현행 절단 선발은 세대당 ΔF ${n(trunc.dF * 100, 2)}%, ΔG ${n(trunc.dG, 1)} kg/10a/년으로 연간 상한 환산 ${n(DFGEN_YR_LIMIT * 100, 2)}%와 Ne ${TH.neMin} 하한 ${n(DFGEN_MAX * 100, 2)}% 사이에 있습니다. OCS 목표 ${n(ocs.dF * 100, 2)}%에서 ΔG ${n(ocs.dG, 1)}, 부모 수 확대는 ${n(expand.dF * 100, 2)}%에서 ΔG ${n(expand.dG, 1)}입니다.`}
      fallbackTable={{
        columns: ['시나리오', '세대당 ΔF(%)', 'ΔG(kg/10a/년)'],
        rows: scenarios.map(s => [s.label, n(s.dF * 100, 2), n(s.dG, 1)]),
      }}
    />
  )
}
