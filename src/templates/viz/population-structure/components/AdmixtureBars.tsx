import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { GROUP_ORDER, GROUPS, K_COMPONENTS, type GroupKey, type KValue, type Line, type SortMode } from '../data'
import { componentColor, groupColor } from './colors'

/** 막대 그리드 여백(px) — 아래 집단 띠·경계선을 같은 x 범위에 맞춘다 */
const GRID = { left: 46, right: 8, top: 8, bottom: 4 }
/** 390px 라벨: 띠 폭이 좁아 줄인다(아우스는 아랫줄, 혼합형은 오른쪽 끝에 붙인다) */
const NARROW_LABEL: Record<GroupKey, string> = { TEJ: '온대 자포니카', TRJ: '열대', IND: '인디카', AUS: '아우스', ADM: '혼합형' }

export interface AdmixtureBarsProps {
  k: KValue
  order: Line[]
  sort: SortMode
  selected: ReadonlySet<string>
  narrow: boolean
}

/** ADMIXTURE 누적 막대(계통 412개) + 아래 하위 집단(K = 4 소속) 띠. 부모 높이를 채운다. 어떤 폭에서도 412개를 한 화면에 담는다(좁으면 막대 1px 미만) */
export function AdmixtureBars({ k, order, sort, selected, narrow }: AdmixtureBarsProps) {
  const theme = useChartTheme()
  const comps = K_COMPONENTS[k]
  const hasSel = selected.size > 0

  const option = useMemo<EChartsOption>(() => {
    const ids = order.map(l => l.id)
    return {
      grid: { ...GRID, containLabel: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.text, type: 'solid', width: 1 } },
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number }[]
          const l = order[arr[0]?.dataIndex ?? -1]
          if (!l) return ''
          const parts = comps.map((c, i) => `${c.label} ${(l.qm[k][i]! / 1000).toFixed(3)}`).join(' / ')
          const head = `<b>${l.id}${l.name ? ` ${l.name}` : ''}</b> · 소속 ${GROUPS[l.group].label}`
          const extra = l.anchor && l.note ? `<br/><span style="color:${theme.textMuted}">${l.note}</span>` : ''
          return `${head}<br/>${parts}${extra}`
        },
      },
      xAxis: { type: 'category', data: ids, show: false, boundaryGap: true },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        interval: 0.25,
        name: '조상 성분 비율(Q)',
        nameLocation: 'middle',
        nameGap: 32,
        axisLabel: { formatter: (v: number) => v.toFixed(2), fontSize: 11 },
        splitLine: { show: false },
      },
      series: comps.map((c, ci) => ({
        type: 'bar' as const,
        name: c.label,
        stack: 'q',
        barCategoryGap: 0,
        barGap: 0,
        itemStyle: { color: componentColor(theme, c.color), borderRadius: 0 },
        emphasis: { disabled: true },
        animation: false,
        data: order.map(l => {
          const v = l.qm[k][ci]! / 1000
          return hasSel && !selected.has(l.id) ? { value: v, itemStyle: { opacity: 0.25 } } : v
        }),
      })),
    }
  }, [theme, order, k, comps, selected, hasSel])

  // 집단 순 정렬일 때만 구간(경계선·라벨)이 연속이다
  const segments = useMemo(() => {
    if (sort !== 'group') return null
    let start = 0
    return GROUP_ORDER.map(g => {
      const n = order.filter(l => l.group === g).length
      const seg = { g, start, n }
      start += n
      return seg
    })
  }, [order, sort])

  const total = order.length
  const inner = { left: GRID.left, right: GRID.right }
  const pct = (i: number) => `${(i / total) * 100}%`

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <EChart
          option={option}
          height="100%"
          ariaLabel={`ADMIXTURE K = ${k} 조상 성분 막대, 계통 ${total}개. 패널은 ${comps.map(c => c.label).join(', ')} 성분으로 나뉜다.`}
          fallbackTable={{
            columns: ['하위 집단', '계통 수', ...comps.map(c => `${c.label} 평균 Q`)],
            rows: GROUP_ORDER.map(g => {
              const m = order.filter(l => l.group === g)
              return [GROUPS[g].label, m.length, ...comps.map((_, i) => (m.reduce((a, l) => a + l.qm[k][i]!, 0) / m.length / 1000).toFixed(3))]
            }),
          }}
        />
        {segments && (
          <div aria-hidden="true" className="pointer-events-none absolute" style={{ left: inner.left, right: inner.right, top: GRID.top, bottom: GRID.bottom }}>
            {segments.slice(1).map(s => (
              <span key={s.g} className="absolute inset-y-0 border-l-2 border-surface" style={{ left: pct(s.start) }} />
            ))}
          </div>
        )}
      </div>
      {/* 하위 집단 띠(K = 4 소속) */}
      <div aria-hidden="true" className="relative shrink-0" style={{ marginLeft: inner.left, marginRight: inner.right }}>
        <div className="flex h-2.5 overflow-hidden rounded-[2px]">
          {order.map(l => (
            <span key={l.id} className="h-full flex-1" style={{ background: groupColor(theme, l.group), opacity: hasSel && !selected.has(l.id) ? 0.3 : 1 }} />
          ))}
        </div>
        <div className="relative h-9">
          {segments ? (
            segments.map((s, i) =>
              narrow ? (
                <div key={s.g} className="absolute top-0 h-full border-l border-text/40 text-[11px] font-semibold leading-tight text-text" style={{ left: pct(s.start), width: pct(s.n) }}>
                  <span className={`absolute whitespace-nowrap ${i === segments.length - 1 ? 'right-0' : 'left-1'} ${s.g === 'AUS' ? 'top-4' : 'top-0.5'}`}>{NARROW_LABEL[s.g]}</span>
                </div>
              ) : (
                <div
                  key={s.g}
                  className="absolute top-0 flex h-full flex-col items-start border-l border-text/40 pl-1 pt-0.5 text-[11px] leading-tight"
                  style={{ left: pct(s.start), width: pct(s.n) }}
                >
                  <span className="truncate font-semibold text-text" style={{ maxWidth: '100%' }}>
                    {GROUPS[s.g].label}
                  </span>
                  <span className="text-muted tabular-nums">{s.n}계통</span>
                </div>
              ),
            )
          ) : (
            <p className="pt-1 text-[11px] text-muted">
              띠 색 = K = 4 소속 하위 집단 · {sort === 'pc1' ? 'PC1 오름차순(왼쪽 인디카형 → 오른쪽 자포니카형)' : '선택 계통을 앞에 모음'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
