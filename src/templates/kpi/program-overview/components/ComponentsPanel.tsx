import { useMemo, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Badge, Card, Tooltip } from '@/design-system'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { CV_FOLDS, CV_ROUNDS, GS_MODEL, GS_START, H2_SINGLE_REP, I, L, L_T, MU, P, R, R_T, SIGMA_A, TRAIN_N, YEARS, accuracyLabel, dG, dGpct, type Year } from '../data'

const n = (v: number, d: number) => formatNumber(v, { digits: d })
const PRE_GS = (GS_START - 1) as Year
const Y0 = YEARS[0]

/** 축 끝값이 눈금과 어긋나 '1.711·1.799'처럼 보이지 않게 1·2·5 단위 눈금으로 맞춘다 */
function niceStep(span: number) {
  const e = 10 ** Math.floor(Math.log10(span))
  const f = span / e
  return (f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * e
}
const snap = (v: number) => Number(v.toFixed(6))

interface Spec {
  key: 'i' | 'r' | 'sa' | 'l'
  title: string
  symbol: string
  unit: string
  digits: number
  values: Record<Year, number>
  target?: Record<Year, number>
  better: 'up' | 'down'
  info: ReactNode
  extra?: (y: Year) => string
}

const SPECS: Spec[] = [
  {
    key: 'i',
    title: '선발 강도',
    symbol: 'i',
    unit: '',
    digits: 3,
    values: I,
    better: 'up',
    info: `부모 선발(재순환 선발) 단계의 선발 비율 p로 정한 정규 절단 강도입니다. ${Y0}~${PRE_GS} p=${n(P[Y0] * 100, 0)}% → ${n(I[Y0], 3)}, ${GS_START}~ p=${n(P[GS_START as Year] * 100, 0)}% → ${n(I[GS_START as Year], 3)}. 품종 개발 파이프라인(깔때기)의 같은 해 단계 수 비와는 다른 값입니다.`,
    extra: y => `부모 선발 비율 p ${n(P[y] * 100, 0)}%`,
  },
  {
    key: 'r',
    title: '정확도',
    symbol: 'r',
    unit: '',
    digits: 2,
    values: R,
    target: R_T,
    better: 'up',
    info: `${PRE_GS}년까지는 표현형 선발 정확도 √h²(초기 세대 단반복 수량 h²=${n(H2_SINGLE_REP, 2)} → ${n(R[PRE_GS], 2)}), ${GS_START}년부터는 GS 예측 정확도 corr(GEBV, y)/√h²(${GS_MODEL}, ${CV_FOLDS}-fold × ${CV_ROUNDS}회 교차 검증 평균)입니다.`,
    extra: y => (TRAIN_N[y] ? `훈련 집단 ${n(TRAIN_N[y] as number, 0)}계통` : '표현형 선발'),
  },
  {
    key: 'sa',
    title: '상가적 유전 표준편차',
    symbol: 'σA',
    unit: 'kg/10a',
    digits: 1,
    values: SIGMA_A,
    better: 'up',
    info: `√σA². 선발이 거듭되며 조금씩 줄어듭니다(Bulmer 효과). 기준 평균 ${MU} kg/10a의 약 ${n((SIGMA_A[YEARS[YEARS.length - 1]] / MU) * 100, 0)}%입니다.`,
    extra: y => `μ 대비 ${n((SIGMA_A[y] / MU) * 100, 1)}%`,
  },
  {
    key: 'l',
    title: '세대 간격',
    symbol: 'L',
    unit: '년',
    digits: 1,
    values: L,
    target: L_T,
    better: 'down',
    info: `부모 선발부터 다음 부모 선발까지의 육종 사이클 길이입니다. ${GS_START}년 속성세대진전 도입으로 크게 줄었습니다. 낮을수록 좋습니다.`,
  },
]

function MiniChart({ spec, years, height }: { spec: Spec; years: Year[]; height: number }) {
  const theme = useChartTheme()
  const color = theme.categorical[0]
  const start = years[0]
  const end = years[years.length - 1]
  const showTransition = spec.key === 'r' && years.includes(2021 as Year) && years.includes(GS_START as Year)

  const option = useMemo<EChartsOption>(() => {
    const vals = years.map(y => spec.values[y])
    const tgts = spec.target ? years.map(y => spec.target![y]) : []
    const all = [...vals, ...tgts]
    const lo = Math.min(...all)
    const hi = Math.max(...all)
    const pad = (hi - lo || hi * 0.1) * 0.25
    const step = niceStep((hi - lo + 2 * pad) / 3)
    // 눈금 자릿수는 간격에 맞춘다: 좁은 범위(2019~2021 L 4.4~4.5)에서 지표 자릿수로 쓰면 눈금이 '4.5, 4.5, 4.5'로 겹친다
    const tickDigits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
    const series: EChartsOption['series'] = [
      {
        name: spec.symbol,
        type: 'line',
        data: vals,
        symbolSize: 6,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        label: {
          show: true,
          position: spec.better === 'down' ? 'bottom' : 'top',
          fontSize: 11,
          color: theme.textMuted,
          formatter: (p: unknown) => ((p as { dataIndex: number }).dataIndex === years.length - 1 ? n(vals[vals.length - 1], spec.digits) : ''),
        },
        markArea: showTransition
          ? {
              silent: true,
              itemStyle: { color: theme.accent, opacity: 0.08 },
              label: { show: true, position: 'insideTop', color: theme.accent, fontSize: 11, formatter: '표현형 정확도\n→ GS 예측 정확도', lineHeight: 14 },
              data: [[{ xAxis: '2021' }, { xAxis: String(GS_START) }]],
            }
          : undefined,
      },
    ]
    if (spec.target) {
      series.push({
        name: '목표',
        type: 'line',
        data: tgts,
        symbol: 'none',
        lineStyle: { color: theme.text, type: 'dashed', width: 1.25 },
        itemStyle: { color: theme.text },
      })
    }
    return {
      grid: { left: 4, right: 14, top: 16, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as { axisValue: string }[]
          const y = Number(list[0]?.axisValue) as Year
          const label = spec.key === 'r' ? accuracyLabel(y) : spec.title
          const lines = [
            `<b>${y}년</b>`,
            `${label}(${spec.symbol}) ${n(spec.values[y], spec.digits)}${spec.unit ? ` ${spec.unit}` : ''}`,
          ]
          if (spec.target) lines.push(`목표 ${n(spec.target[y], spec.digits)}${spec.unit ? ` ${spec.unit}` : ''}`)
          if (spec.extra) lines.push(spec.extra(y))
          lines.push(`그해 ΔG ${n(dG(y), 2)} kg/10a/년 (${n(dGpct(y), 2)}%/년)`)
          return lines.join('<br/>')
        },
      },
      xAxis: { type: 'category', data: years.map(String), boundaryGap: false, axisLabel: { fontSize: 11, formatter: (v: string) => `'${v.slice(2)}` } },
      yAxis: {
        type: 'value',
        min: snap(Math.floor((lo - pad) / step) * step),
        max: snap(Math.ceil((hi + pad) / step) * step),
        interval: step,
        inverse: false,
        axisLabel: { fontSize: 11, formatter: (v: number) => v.toFixed(tickDigits) },
      },
      series,
    }
  }, [spec, years, theme, color, showTransition])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${spec.title}(${spec.symbol}) ${start}년 ${n(spec.values[start], spec.digits)}에서 ${end}년 ${n(spec.values[end], spec.digits)}${spec.unit ? ` ${spec.unit}` : ''}로 변화${spec.target ? `, ${end}년 목표 ${n(spec.target[end], spec.digits)}` : ''}.`}
      fallbackTable={{
        columns: ['연도', `${spec.title}(${spec.symbol})`, ...(spec.target ? ['목표'] : [])],
        rows: years.map(y => [y, n(spec.values[y], spec.digits), ...(spec.target ? [n(spec.target[y], spec.digits)] : [])]),
      }}
    />
  )
}

/** E. ΔG 구성 요소 small multiples */
export function ComponentsPanel({ years }: { years: Year[] }) {
  const end = years[years.length - 1]
  const formula = `${n(I[end], 3)} × ${n(R[end], 2)} × ${n(SIGMA_A[end], 1)} / ${n(L[end], 1)} = ${n(dG(end), 1)} kg/10a/년(${n(dGpct(end), 2)}%/년)`
  return (
    <Card
      title="ΔG 구성 요소"
      subtitle={`${years[0]}~${end} · 수량 기준 · 육종가 방정식으로 분해`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-2 px-3 py-2.5">
        <Badge tone="info">{end}년</Badge>
        <p className="min-w-0 text-[13px] text-text tabular-nums sm:text-sm">
          <span className="font-semibold">ΔG = i · r · σA / L</span>
          <span className="text-muted"> = </span>
          <span className="font-semibold">{formula}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SPECS.map(spec => {
          const title = spec.key === 'r' ? accuracyLabel(end) : spec.title
          return (
            <div key={spec.key} className="min-w-0 rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <h3 className="text-[13px] font-semibold text-text">
                    {title}({spec.symbol})
                  </h3>
                  <Tooltip content={spec.info}>
                    <button type="button" aria-label={`${title} 설명`} className="touch-hit rounded-sm text-muted hover:text-text">
                      <Info size={13} aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                {spec.better === 'down' ? <Badge tone="neutral">낮을수록 좋음</Badge> : spec.target ? <Badge tone="neutral">--- 목표</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                {end}년 {n(spec.values[end], spec.digits)}
                {spec.unit ? ` ${spec.unit}` : ''}
                {spec.target ? ` · 목표 ${n(spec.target[end], spec.digits)}${spec.unit ? ` ${spec.unit}` : ''}` : ''}
              </p>
              <MiniChart spec={spec} years={years} height={150} />
              {spec.key === 'r' && <p className="text-xs leading-relaxed text-muted">~{PRE_GS} 표현형 정확도(√h²) · {GS_START}~ GS 예측 정확도</p>}
              {spec.key === 'l' && <p className="text-xs leading-relaxed text-muted">점선은 목표 · {GS_START} 속성세대진전 도입</p>}
              {spec.key === 'i' && <p className="text-xs leading-relaxed text-muted">부모 선발 비율 p 기준(깔때기 단계 수 비와 다름)</p>}
              {spec.key === 'sa' && <p className="text-xs leading-relaxed text-muted">선발에 따른 점진 감소(Bulmer 효과)</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
