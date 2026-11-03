import { useMemo } from 'react'
import { EChart, useChartTheme, vMarkLine, type ChartTheme, type EChartsOption } from '@/charts'
import { Legend } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { STATUS_LABEL, TARGET_SEEDS, type Derived } from '../data'

type Kind = 'confirmed' | 'pending' | 'suspect' | 'missing'
/** 막대 종류는 값의 근거(basis) 기준: 재판독 대기 조합은 KASP 판정 색을 유지하고 점선 테두리로 구분 */
const kindOf = (r: Derived): Kind => (r.seeds == null ? 'missing' : r.basis)
const KIND_LABEL: Record<Kind, string> = { ...STATUS_LABEL, missing: '미입력' }

/** 상태 색은 KPI 막대·표 배지와 같다: 확인 positive · 자식 의심 negative · 대기 info(검토 R1) */
function colorOf(theme: ChartTheme, k: Kind) {
  if (k === 'confirmed') return theme.positive
  if (k === 'suspect') return theme.negative
  if (k === 'pending') return theme.info
  return theme.border
}

/** 재판독 대기 행은 막대 길이가 0일 수 있어(자식 의심) 점선 테두리 외에 라벨에도 표시. short: 390px(플롯 폭이 좁아 결실 립수를 뺀다) */
function barLabel(r: Derived, short = false) {
  const base = barLabelBase(r, short)
  return r.reread ? `${base} · 재판독 대기` : base
}

function barLabelBase(r: Derived, short: boolean) {
  const k = kindOf(r)
  if (k === 'missing') return '미입력'
  if (k === 'suspect') return short ? '자식 의심' : `자식 의심(결실 ${formatNumber(r.seeds ?? 0)}립)`
  return formatNumber(Math.round(r.eff))
}

/** E. 조합별 유효 F1 가로 막대 + 목표선 */
export function ProgressChart({ rows, selected, onSelect, narrow = false }: { rows: Derived[]; selected: string; onSelect: (id: string) => void; narrow?: boolean }) {
  const theme = useChartTheme()
  const below = rows.filter(r => r.eff < TARGET_SEEDS)
  const max = Math.max(TARGET_SEEDS, ...rows.map(r => r.eff))
  const option = useMemo<EChartsOption>(
    () => ({
      // 390px: 오른쪽 라벨 자리를 줄여 플롯 폭을 확보한다(라벨은 짧은 문구, 검토 R6)
      grid: { left: narrow ? 4 : 8, right: narrow ? 64 : 132, top: 30, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex]!
          const lines = [
            `<b>${r.cross.id}</b> ${r.cross.female} × ${r.cross.male}`,
            `결실 립수 ${r.seeds == null ? '미입력' : `${formatNumber(r.seeds)}립`}`,
            `유효 F1 ${formatNumber(Math.round(r.eff))}립 / 목표 ${TARGET_SEEDS}립`,
            r.reread
              ? `F1 진위 ${STATUS_LABEL[r.status]}(재판독 · KASP 판정 ${STATUS_LABEL[r.basis]} 값 유지)`
              : `F1 진위 ${STATUS_LABEL[r.status]}${r.manual ? '(수동 변경)' : ''}`,
          ]
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(max / 20) * 20,
        name: '유효 F1 종자(립)',
        nameLocation: 'middle',
        nameGap: 24,
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map(r => r.cross.id),
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: string) => (v === selected ? `{sel|${v}}` : v),
          rich: { sel: { fontWeight: 700, color: theme.text } },
          color: theme.textMuted,
          fontSize: 11,
        },
      },
      series: [
        {
          type: 'bar',
          barWidth: '62%',
          cursor: 'pointer',
          data: rows.map(r => {
            const k = kindOf(r)
            const sel = r.cross.id === selected
            return {
              value: r.eff,
              itemStyle: {
                color: colorOf(theme, k),
                borderColor: sel || r.reread ? theme.text : 'transparent',
                borderWidth: sel ? 2 : r.reread ? 1 : 0,
                borderType: r.reread ? 'dashed' : 'solid',
                borderRadius: [0, 2, 2, 0],
              },
              label: {
                show: true,
                position: 'right',
                formatter: barLabel(r, narrow),
                color: k === 'suspect' ? theme.negative : k === 'missing' ? theme.textMuted : theme.text,
                fontSize: 11,
                fontWeight: k === 'suspect' || r.eff < TARGET_SEEDS ? 700 : 400,
              },
            }
          }),
          markLine: {
            symbol: 'none',
            silent: true,
            data: [vMarkLine(TARGET_SEEDS, `목표 ${TARGET_SEEDS}립`, theme.warning, { line: 'dashed', width: 2, fontWeight: 700, position: 'start' })],
          },
        },
      ],
    }) as EChartsOption,
    [rows, selected, theme, max, narrow],
  )
  const rereadRows = rows.filter(r => r.reread)
  const aria = `조합 ${rows.length}개 중 ${below.length}개가 목표 ${TARGET_SEEDS}립 아래입니다: ${below.map(r => `${r.cross.id} ${barLabel(r)}`).join(', ')}.${rereadRows.length > 0 ? ` 재판독 대기 ${rereadRows.length}조합(${rereadRows.map(r => r.cross.id).join(', ')})은 KASP 판정 값을 유지합니다.` : ''}`
  return (
    <div>
      <div className="mb-2 text-xs text-muted">
        <Legend
          items={[
            ...(['confirmed', 'pending', 'suspect', 'missing'] as Kind[]).map(k => ({
              label: k === 'missing' ? '미입력(막대 없음)' : k === 'pending' ? '대기(결실 립수 그대로)' : k === 'confirmed' ? '확인(진성 F1 비율 반영)' : '자식 의심(0으로 셈)',
              color: colorOf(theme, k),
            })),
            ...(rereadRows.length > 0 ? [{ label: '재판독 대기(KASP 판정 값 유지, 점선 테두리)', color: theme.text, shape: 'dashed' as const }] : []),
          ]}
        />
      </div>
      <EChart
        option={option}
        height={rows.length * 24 + 64}
        ariaLabel={aria}
        fallbackTable={{
          columns: ['조합 ID', '결실 립수', '유효 F1', '진위 상태'],
          rows: rows.map(r => [r.cross.id, r.seeds == null ? '미입력' : r.seeds, Math.round(r.eff), r.reread ? `${KIND_LABEL[kindOf(r)]}(재판독 대기)` : KIND_LABEL[kindOf(r)]]),
        }}
        onEvents={{
          click: (p: unknown) => {
            const i = (p as { dataIndex?: number }).dataIndex
            if (typeof i === 'number' && rows[i]) onSelect(rows[i]!.cross.id)
          },
        }}
      />
    </div>
  )
}
