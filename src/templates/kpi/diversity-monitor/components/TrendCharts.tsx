import { useMemo } from 'react'
import { EChart, gsIntroLine, hMarkLine, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { DFGEN_MAX, FBAR_AXIS, FIXED_CAUTION_COUNT, FIXED_CAUTION_N, FIXED_WATCH_START, GS_START, HE_AXIS, H_REF, M, NE_WATCH_YEARS, RATIO, TH, YEAR_ROWS, YEARS, neStatus } from '../data'
import { GS_INDEX, STATUS_LABEL, n, pct, statusColor, yearAxis } from './fmt'

const GRID = { left: 8, right: 16, top: 28, bottom: 4, containLabel: true }
const R0 = YEAR_ROWS[0]!
const RZ = YEAR_ROWS[YEAR_ROWS.length - 1]!
const xAxis = { type: 'category' as const, data: yearAxis, boundaryGap: false }

function rowAt(params: unknown) {
  const list = params as { dataIndex: number }[]
  return YEAR_ROWS[list[0]?.dataIndex ?? 0]
}

/** D. 유효 집단 크기(Ne) 추이 + 95% 구간 띠 */
export function NeChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const option = useMemo<EChartsOption>(() => {
    const main = theme.categorical[0]!
    return {
      grid: GRID,
      tooltip: {
        trigger: 'axis',
        formatter: (p: unknown) => {
          const r = rowAt(p)
          if (!r) return ''
          const s = neStatus(r.year)
          return [
            `<b>${r.year}${r.year === 2026 ? ' (잠정)' : ''}</b>`,
            `유효 집단 크기 Ne ${n(r.ne)} (95% 구간 ${r.ci[0]}~${r.ci[1]})`,
            `세대 간격 L ${n(r.L, 1)}년`,
            `상태 ${STATUS_LABEL[s]}`,
          ].join('<br/>')
        },
      },
      xAxis,
      yAxis: { type: 'value', min: 0, max: 120, interval: 20, name: '유효 집단 크기 Ne', nameLocation: 'middle', nameGap: 34 },
      series: [
        { name: '구간 하한', type: 'line', stack: 'ci', data: YEAR_ROWS.map(r => r.ci[0]), lineStyle: { opacity: 0 }, symbol: 'none', silent: true, tooltip: { show: false } },
        {
          name: '95% 구간',
          type: 'line',
          stack: 'ci',
          data: YEAR_ROWS.map(r => r.ci[1] - r.ci[0]),
          lineStyle: { opacity: 0 },
          symbol: 'none',
          areaStyle: { color: main, opacity: 0.16 },
          silent: true,
          tooltip: { show: false },
        },
        {
          name: 'Ne',
          type: 'line',
          z: 4,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: main, width: 2.5 },
          itemStyle: { color: main },
          data: YEAR_ROWS.map(r => {
            const s = neStatus(r.year)
            if (s === 'ok') return r.ne
            const c = statusColor(theme, s)
            const last = r === YEAR_ROWS[YEAR_ROWS.length - 1]
            // 상태는 색 + 문자로 보인다(▲는 증감 전용). 마지막 점 라벨은 오른쪽 끝에서 잘리지 않게 왼쪽으로 민다
            return {
              value: r.ne,
              symbolSize: 11,
              itemStyle: { color: c, borderColor: theme.surface, borderWidth: 1.5 },
              label: { show: true, position: 'top' as const, distance: 8, offset: [last ? -16 : 0, 0], formatter: narrow ? String(r.ne) : `${r.ne} ${STATUS_LABEL[s]}`, color: theme.text, backgroundColor: theme.surface, padding: [1, 3], borderRadius: 2, fontSize: 11, fontWeight: 700 },
            }
          }),
          label: { show: false },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              hMarkLine(TH.neMin, `경보 하한 ${TH.neMin}`, theme.negative, { position: 'insideStartBottom' }),
              hMarkLine(TH.neCaution, `주의 ${TH.neCaution}`, theme.warning, { line: 'dashed', position: 'insideStartTop' }),
              gsIntroLine(theme, GS_INDEX),
            ],
          },
        },
      ],
    } as EChartsOption
  }, [theme, narrow])
  const first = YEAR_ROWS[0]!
  const lastRow = YEAR_ROWS[YEAR_ROWS.length - 1]!
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`유효 집단 크기(Ne)는 ${first.year}년 ${first.ne}에서 ${lastRow.year}년 ${lastRow.ne}(95% 구간 ${lastRow.ci[0]}~${lastRow.ci[1]})로 줄었고, GS 도입(${GS_START}) 이후 급감해 ${NE_WATCH_YEARS[0]}년부터 ${NE_WATCH_YEARS.length}년 연속 주의 구간(${TH.neCaution} 미만)이며 경보 하한 ${TH.neMin}에 가깝습니다.`}
      fallbackTable={{ columns: ['연도', 'Ne', '95% 구간', '상태'], rows: YEAR_ROWS.map(r => [r.year, r.ne, `${r.ci[0]}~${r.ci[1]}`, STATUS_LABEL[neStatus(r.year)]]) }}
    />
  )
}

/** E. 세대당·연간 근교 증가율 */
export function InbreedingChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const gen = theme.categorical[0]!
  const yr = theme.categorical[3] ?? theme.categorical[1]!
  const option = useMemo<EChartsOption>(
    () =>
      ({
        grid: { ...GRID, right: 52 },
        tooltip: {
          trigger: 'axis',
          formatter: (p: unknown) => {
            const r = rowAt(p)
            if (!r) return ''
            return [`<b>${r.year}</b> · 세대 간격 L ${n(r.L, 1)}년`, `세대당 ΔF ${pct(r.dFgen, 3)}/세대`, `연간 ΔF ${pct(r.dFyr, 3)}/년`].join('<br/>')
          },
        },
        xAxis,
        yAxis: { type: 'value', min: 0, max: 1.2, interval: 0.2, name: '근교 증가율(%)', nameLocation: 'middle', nameGap: 34, axisLabel: { formatter: (v: number) => n(v, 1) } },
        series: [
          {
            name: '세대당 ΔF',
            type: 'line',
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { color: gen, width: 2.5 },
            itemStyle: { color: gen },
            data: YEAR_ROWS.map(r => r.dFgen * 100),
            endLabel: { show: true, formatter: (p: { value: number }) => `${n(p.value, 2)}%`, color: gen, fontSize: 11, fontWeight: 700 },
            markLine: {
              symbol: 'none',
              silent: true,
              data: [hMarkLine(DFGEN_MAX * 100, `세대당 상한 ${pct(DFGEN_MAX, 2)}(Ne ${TH.neMin})`, theme.negative, { position: 'insideStartTop' }), gsIntroLine(theme, GS_INDEX)],
            },
          },
          {
            name: '연간 ΔF',
            type: 'line',
            symbol: 'rect',
            symbolSize: 8,
            lineStyle: { color: yr, width: 2.5, type: 'dashed' },
            itemStyle: { color: yr },
            data: YEAR_ROWS.map(r => r.dFyr * 100),
            endLabel: { show: true, formatter: (p: { value: number }) => `${n(p.value, 2)}%`, color: yr, fontSize: 11, fontWeight: 700 },
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                hMarkLine(TH.dFyrMax * 100, `연간 상한 ${pct(TH.dFyrMax, 2)}`, theme.negative, { position: 'insideStartTop' }),
                hMarkLine(TH.dFyrCaution * 100, `연간 주의 ${pct(TH.dFyrCaution, 2)}`, theme.warning, { line: 'dashed', position: 'insideStartBottom' }),
              ],
            },
          },
        ],
      }) as EChartsOption,
    [theme, gen, yr],
  )
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`세대당 근교 증가율(ΔF)은 ${R0.year}년 ${pct(R0.dFgen, 2)}에서 ${RZ.year}년 ${pct(RZ.dFgen, 2)}로 ${n(RATIO.gen, 1)}배, 세대 간격 단축이 겹친 연간 근교 증가율은 ${pct(R0.dFyr, 2)}에서 ${pct(RZ.dFyr, 2)}/년으로 ${n(RATIO.yr, 1)}배가 되어 연간 상한 ${pct(TH.dFyrMax, 2)}/년을 넘었습니다.`}
      fallbackTable={{ columns: ['연도', 'L(년)', '세대당 ΔF(%)', '연간 ΔF(%)'], rows: YEAR_ROWS.map(r => [r.year, n(r.L, 1), n(r.dFgen * 100, 3), n(r.dFyr * 100, 3)]) }}
    />
  )
}

function fheTooltip(p: unknown) {
  const r = rowAt(p)
  if (!r) return ''
  return [`<b>${r.year}</b>`, `평균 공조계수 f̄ ${n(r.fbar, 4)}`, `기대 이형접합도 He ${n(r.he, 3)}`].join('<br/>')
}

/** F①. 평균 공조계수 f̄ 추이 */
export function FbarChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const c = theme.categorical[1]!
  const option = useMemo<EChartsOption>(
    () =>
      ({
        grid: GRID,
        tooltip: { trigger: 'axis', formatter: fheTooltip },
        xAxis,
        yAxis: { type: 'value', min: FBAR_AXIS[0], max: FBAR_AXIS[1], interval: 0.005, name: '평균 공조계수 f̄ (f = G/2)', nameLocation: 'middle', nameGap: 44, axisLabel: { formatter: (v: number) => n(v, 3) } },
        series: [
          {
            name: 'f̄',
            type: 'line',
            symbol: 'circle',
            symbolSize: 7,
            lineStyle: { color: c, width: 2.5 },
            itemStyle: { color: c },
            areaStyle: { color: c, opacity: 0.08, origin: 'start' },
            data: YEAR_ROWS.map(r => r.fbar),
            endLabel: { show: true, formatter: (p: { value: number }) => n(p.value, 3), color: c, fontSize: 11, fontWeight: 700, offset: [-36, -14] },
            markLine: { symbol: 'none', silent: true, data: [gsIntroLine(theme, GS_INDEX)] },
          },
        ],
      }) as EChartsOption,
    [theme, c],
  )
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`부모 후보 간 평균 공조계수(f̄)는 ${R0.year}년 ${n(R0.fbar, 3)}에서 ${RZ.year}년 ${n(RZ.fbar, 3)}로 올랐습니다(축 ${n(FBAR_AXIS[0], 2)}~${n(FBAR_AXIS[1], 2)}).`}
      fallbackTable={{ columns: ['연도', 'f̄'], rows: YEAR_ROWS.map(r => [r.year, n(r.fbar, 4)]) }}
    />
  )
}

/** F②. 기대 이형접합도 He 추이 */
export function HeChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const c = theme.categorical[2]!
  const option = useMemo<EChartsOption>(
    () =>
      ({
        grid: GRID,
        tooltip: { trigger: 'axis', formatter: fheTooltip },
        xAxis,
        yAxis: { type: 'value', min: HE_AXIS[0], max: HE_AXIS[1], interval: 0.02, name: '기대 이형접합도 He', nameLocation: 'middle', nameGap: 40, axisLabel: { formatter: (v: number) => n(v, 2) } },
        series: [
          {
            name: 'He',
            type: 'line',
            symbol: 'circle',
            symbolSize: 7,
            lineStyle: { color: c, width: 2.5 },
            itemStyle: { color: c },
            data: YEAR_ROWS.map(r => r.he),
            endLabel: { show: true, formatter: (p: { value: number }) => n(p.value, 3), color: c, fontSize: 11, fontWeight: 700, offset: [-36, 14] },
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                hMarkLine(H_REF, `훈련 집단 기준 ${n(H_REF, 2)}`, theme.textMuted, { line: 'dashed', position: 'insideStartTop' }),
                hMarkLine(TH.heMin, `하한 ${n(TH.heMin, 2)}`, theme.negative, { position: 'insideStartBottom' }),
                gsIntroLine(theme, GS_INDEX),
              ],
            },
          },
        ],
      }) as EChartsOption,
    [theme, c],
  )
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`집단 전체 기대 이형접합도(He)는 ${R0.year}년 ${n(R0.he, 3)}에서 ${RZ.year}년 ${n(RZ.he, 3)}으로 ${n((1 - RZ.he / R0.he) * 100, 1)}% 줄었고 하한 ${n(TH.heMin, 2)} 위에 있습니다(축 ${n(HE_AXIS[0], 2)}~${n(HE_AXIS[1], 2)}).`}
      fallbackTable={{ columns: ['연도', 'He'], rows: YEAR_ROWS.map(r => [r.year, n(r.he, 3)]) }}
    />
  )
}

/** H. 고정 마커(막대)·희소 마커(선) */
export function MarkerChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const bar = theme.categorical[0]!
  const line = theme.categorical[4] ?? theme.categorical[1]!
  const option = useMemo<EChartsOption>(
    () =>
      ({
        grid: GRID,
        tooltip: {
          trigger: 'axis',
          formatter: (p: unknown) => {
            const r = rowAt(p)
            if (!r) return ''
            return [
              `<b>${r.year}</b>`,
              `고정 마커 ${n(r.fixed)}개 (${pct(r.fixed / M, 2)})${r.fixed >= FIXED_CAUTION_N ? ' · 주의' : ''}`,
              `희소 마커 ${n(r.rare)}개 (${pct(r.rare / M, 2)})`,
            ].join('<br/>')
          },
        },
        xAxis: { type: 'category', data: yearAxis },
        yAxis: { type: 'value', min: 0, max: 280, interval: 40, name: `SNP 수(${n(M)} 중)`, nameLocation: 'middle', nameGap: 34 },
        series: [
          {
            name: '고정 마커',
            type: 'bar',
            barMaxWidth: 28,
            data: YEAR_ROWS.map(r =>
              r.fixed >= FIXED_CAUTION_N
                ? { value: r.fixed, itemStyle: { color: theme.warning }, label: { show: true, position: 'top' as const, formatter: narrow ? String(r.fixed) : `${r.fixed} 주의`, color: theme.text, fontSize: 11, fontWeight: 700 } }
                : r.fixed,
            ),
            itemStyle: { color: bar, borderRadius: [3, 3, 0, 0] },
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                hMarkLine(FIXED_CAUTION_N, `고정 주의 ${pct(TH.fixedShare, 0)}(${FIXED_CAUTION_COUNT}개)`, theme.warning, { line: 'dashed', position: 'insideStartTop' }),
                gsIntroLine(theme, YEARS.indexOf(GS_START)),
              ],
            },
          },
          {
            name: '희소 마커',
            type: 'line',
            symbol: 'rect',
            symbolSize: 7,
            lineStyle: { color: line, width: 2 },
            itemStyle: { color: line },
            data: YEAR_ROWS.map(r => r.rare),
          },
        ],
      }) as EChartsOption,
    [theme, bar, line, narrow],
  )
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`부모 후보 집단의 고정 마커(MAF = 0)는 ${R0.year}년 ${R0.fixed}개에서 ${RZ.year}년 ${RZ.fixed}개(${n(M)} 중 ${pct(RZ.fixed / M, 1)})로 늘어 ${FIXED_WATCH_START}년부터 주의 기준 ${pct(TH.fixedShare, 0)}(${FIXED_CAUTION_COUNT}개)를 넘었고, 희소 마커(MAF < 0.05)는 ${R0.rare}개에서 ${RZ.rare}개가 됐습니다.`}
      fallbackTable={{ columns: ['연도', '고정 마커', '희소 마커'], rows: YEAR_ROWS.map(r => [r.year, r.fixed, r.rare]) }}
    />
  )
}
