import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { Card } from '@/design-system'
import { CALL_RATE_THRESHOLD, CATALOG_RANGE, CAUSES_6K, FAIL_COUNT, HET_THRESHOLD, NONPARENT_THRESHOLD, PLATFORMS, PLATFORM_KEYS, QC_PASS, SAMPLES, TOTAL_PASS, TOTAL_SAMPLES, qcPassPct, type PlatformKey } from '../data'
import { int, pct1, platformColor } from './shared'

const ROWS: (PlatformKey | 'all')[] = [...PLATFORM_KEYS, 'all']
const rowName = (k: PlatformKey | 'all') => (k === 'all' ? '전 플랫폼' : PLATFORMS[k].name)
const rowPass = (k: PlatformKey | 'all') => (k === 'all' ? TOTAL_PASS : QC_PASS[k])
const rowSamples = (k: PlatformKey | 'all') => (k === 'all' ? TOTAL_SAMPLES : SAMPLES[k])
const CAUSE_VARS = ['var(--color-warning)', 'var(--viz-cat-4)', 'var(--viz-cat-7)']
const CATALOG_LOW = CATALOG_RANGE.qcPass.lo

/** D. 플랫폼별 1차 QC 통과율 + 6K 실패 원인 분해 */
export function QcPassPanel({ className }: { className?: string }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 112, top: 22, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const k = ROWS[i]
          return `<b>${rowName(k)}</b><br/>1차 QC 통과 ${int(rowPass(k))} / ${int(rowSamples(k))}샘플 · ${pct1(qcPassPct(k))}<br/>미통과 ${int(rowSamples(k) - rowPass(k))}샘플`
        },
      },
      yAxis: { type: 'category', inverse: true, data: ROWS.map(rowName), axisTick: { show: false }, axisLabel: { color: theme.text, fontSize: 11 } },
      xAxis: {
        type: 'value',
        min: CATALOG_RANGE.qcPass.min,
        max: CATALOG_RANGE.qcPass.max,
        interval: 2,
        name: `1차 QC 통과율(%) · 축은 ${CATALOG_RANGE.qcPass.min}%부터`,
        nameLocation: 'middle',
        nameGap: 22,
      },
      series: [
        // 축이 90%부터라 막대 길이가 차이를 과장한다(6K 96.5·KASP 97.6이 1.2배로 보임). 값은 점 위치로 읽게 막대를 가는 줄기로 줄인다
        {
          name: '1차 QC 통과율',
          type: 'bar',
          barWidth: 2,
          data: ROWS.map(k => ({
            value: Number(qcPassPct(k).toFixed(2)),
            itemStyle: { color: k === 'all' ? theme.textMuted : platformColor(theme, k) },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: theme.textMuted, type: 'dashed', width: 1 },
            label: { formatter: `카탈로그 하한 ${CATALOG_LOW}%`, position: 'start', color: theme.textMuted, fontSize: 11 },
            data: [{ xAxis: CATALOG_LOW }],
          },
        },
        {
          name: '통과율 점',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 12,
          silent: true,
          z: 5,
          tooltip: { show: false },
          data: ROWS.map((k, i) => ({
            value: [Number(qcPassPct(k).toFixed(2)), i],
            itemStyle: { color: k === 'all' ? theme.textMuted : platformColor(theme, k) },
          })),
          label: {
            show: true,
            position: 'right',
            distance: 6,
            fontSize: 11,
            color: theme.text,
            formatter: (p: unknown) => {
              const k = ROWS[(p as { dataIndex: number }).dataIndex]
              return `${pct1(qcPassPct(k))} (${int(rowPass(k))}/${int(rowSamples(k))})`
            },
          },
        },
      ],
    }),
    [theme],
  )

  const total6k = FAIL_COUNT['6K']

  return (
    <Card className={className} title="1차 QC 통과율" subtitle="플랫폼별 1차 분석 통과 샘플 / 접수 샘플 · 재분석 전">
      <EChart
        option={option}
        height={176}
        ariaLabel={`1차 QC 통과율은 6K ${pct1(qcPassPct('6K'))}, KASP ${pct1(qcPassPct('KASP'))}, GBS ${pct1(qcPassPct('GBS'))}, 전 플랫폼 ${pct1(qcPassPct('all'))}로 모두 카탈로그 범위 ${CATALOG_RANGE.qcPass.lo}~${CATALOG_RANGE.qcPass.hi}% 안에 있다.`}
        fallbackTable={{ columns: ['플랫폼', '통과', '접수', '통과율'], rows: ROWS.map(k => [rowName(k), int(rowPass(k)), int(rowSamples(k)), pct1(qcPassPct(k))]) }}
      />
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 flex items-baseline justify-between text-xs text-muted">
          <span className="font-semibold text-text">6K 미통과 원인</span>
          <span className="tabular-nums">{int(total6k)}샘플 = {int(SAMPLES['6K'])} − {int(QC_PASS['6K'])}</span>
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-sm" role="img" aria-label={`6K 미통과 ${total6k}샘플: ${CAUSES_6K.map(c => `${c.label} ${c.count}`).join(', ')}`}>
          {CAUSES_6K.map((c, i) => (
            <div key={c.kind} style={{ width: `${(c.count / total6k) * 100}%`, background: CAUSE_VARS[i] }} className="h-full border-r border-surface last:border-r-0" />
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
          {CAUSES_6K.map((c, i) => (
            <li key={c.kind} className="flex items-center gap-1.5 text-text">
              <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: CAUSE_VARS[i] }} />
              {c.label}
              <b className="ml-auto tabular-nums sm:ml-1">{int(c.count)}</b>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          기준: 콜레이트 ≥ {CALL_RATE_THRESHOLD}% · 이형접합도 ≤ {HET_THRESHOLD}% · 비부모 대립유전자 ≤ {NONPARENT_THRESHOLD}%. 미통과 {int(total6k)}샘플은 모두 재분석해 통과했습니다.
        </p>
      </div>
    </Card>
  )
}
