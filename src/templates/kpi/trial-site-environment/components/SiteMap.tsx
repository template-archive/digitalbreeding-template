import { useMemo } from 'react'
import { EChart, selectionStroke, selectionSymbolSeries, useChartTheme, type EChartsOption } from '@/charts'
import { useElementWidth } from '@/design-system'
import { alertsOfEnv, envsOf, ZONE_BY_KEY, type Env, type Year } from '../data'
import { f1, indexColor, pct0, s0, s1 } from './fmt'

// 위경도 축 범위(근사 지점 8곳을 담는 여백 포함)
const LON: [number, number] = [126.1, 129.3]
const LAT: [number, number] = [35.1, 38.6]
/** 위도 1°를 경도 1°의 1/cos(37°)배로 그려 왜곡을 줄인다 */
const LAT_SCALE = 1 / Math.cos((37 * Math.PI) / 180)
const ASPECT = ((LAT[1] - LAT[0]) * LAT_SCALE) / (LON[1] - LON[0])

interface Props {
  year: Year
  selected: string
  onSelect: (siteId: string) => void
  height: number
}

/** C 지역 배치: 위경도 산점(행정 경계·해안선 없음). 점 색 = 환경 지수, 경보 지역 = 두꺼운 글자색 테두리(▲▼는 증감 전용이라 쓰지 않음), 선택 = 공통 선택 표시 고리 */
export function SiteMap({ year, selected, onSelect, height }: Props) {
  const theme = useChartTheme()
  const { ref, width } = useElementWidth()
  const envs = envsOf(year)

  const option = useMemo<EChartsOption>(() => {
    const padV = 28
    const gh = height - padV * 2
    const gw = Math.min(gh / ASPECT, Math.max(120, width - 110))
    const ghFit = gw * ASPECT
    const left = Math.max(40, (width - gw) / 2)
    const top = (height - ghFit) / 2
    const data = envs.map(e => {
      const nAlert = alertsOfEnv(e).length
      const isSel = e.site.id === selected
      return {
        value: [e.site.lon, e.site.lat],
        env: e,
        symbolSize: isSel ? 26 : 18,
        itemStyle: {
          color: indexColor(theme, e.index),
          borderColor: nAlert > 0 ? theme.text : theme.surface,
          borderWidth: nAlert > 0 ? 3 : 1.5,
        },
        label: {
          show: true,
          position: e.site.id === 'hwaseong' ? ('top' as const) : e.site.id === 'dangjin' || e.site.id === 'yesan' ? ('left' as const) : ('right' as const),
          distance: 8,
          formatter: `${e.site.short} ${s1(e.index)}`,
          color: theme.text,
          fontSize: isSel ? 13 : 12,
          fontWeight: isSel ? 700 : 500,
          textBorderColor: theme.surface,
          textBorderWidth: 3,
        },
      }
    })
    const sel = envs.find(e => e.site.id === selected)
    // 선택 지역 고리 = 표면색 후광 → 글자색 선(공통 selectionSymbolSeries, 강조색은 데이터 위 선택에 쓰지 않음).
    // 지도 격자선 위라 후광을 선 + 4px(6.5px)로 굵게, 지점 기호(z 2) 아래
    const ss = selectionStroke(theme)
    const rings = selectionSymbolSeries(theme, {
      name: '선택 지역 후광',
      value: sel ? [sel.site.lon, sel.site.lat] : null,
      symbolSize: 40,
      z: 1,
      haloWidth: ss.lineWidth + ss.haloWidth,
    })
    return {
      animation: false,
      grid: { left, top, width: gw, height: ghFit, containLabel: false },
      xAxis: {
        type: 'value',
        min: LON[0],
        max: LON[1],
        interval: 1,
        axisLabel: { formatter: (v: number) => `${v}°E`, fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: theme.border, type: 'dotted', opacity: 0.6 } },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: LAT[0],
        max: LAT[1],
        interval: 1,
        axisLabel: { formatter: (v: number) => `${v}°N`, fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: theme.border, type: 'dotted', opacity: 0.6 } },
      },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const d = (p as { data?: { env?: Env } }).data
          const e = d?.env
          if (!e) return ''
          const al = alertsOfEnv(e)
          return [
            `<b>${e.site.name}</b> · ${ZONE_BY_KEY[e.site.zone].label} · ${e.year}`,
            `환경 지수 <b>${s1(e.index)}</b> kg/10a`,
            `유효적산온도 평년 대비 ${s0(e.gdd - e.gddN)} °C·일`,
            `강수 ${pct0((100 * e.pr) / e.prN)} · 일조 ${pct0((100 * e.sun) / e.sunN)} · 등숙기 일조 ${pct0((100 * e.s40) / e.s40N)}`,
            `고온 ${e.heat}일(≥ 35 °C ${e.heat35}) · 저온 ${e.cold}일 · 등숙기 ${f1(e.t40)} °C`,
            al.length ? `이상 기상 ${al.length}건` : '이상 기상 없음',
          ].join('<br/>')
        },
      },
      series: [
        ...rings,
        {
          type: 'scatter' as const,
          name: '시험지',
          z: 2,
          cursor: 'pointer',
          data,
          labelLayout: { hideOverlap: false },
        },
      ],
    }
  }, [envs, selected, theme, width, height])

  const sorted = [...envs].sort((a, b) => b.index - a.index)
  const aria = `${year}년 시험지 8곳 위경도 배치. 환경 지수 최고 ${sorted[0]!.site.short} ${s1(sorted[0]!.index)}, 최저 ${sorted[7]!.site.short} ${s1(sorted[7]!.index)} kg/10a. 이상 기상 지역: ${
    envs.filter(e => alertsOfEnv(e).length > 0).map(e => e.site.short).join('·') || '없음'
  }.`

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <EChart
          option={option}
          height={height}
          ariaLabel={aria}
          fallbackTable={{
            columns: ['지역', '위도', '경도', '환경 지수(kg/10a)', '이상 기상(건)'],
            rows: envs.map(e => [e.site.name, e.site.lat, e.site.lon, s1(e.index), alertsOfEnv(e).length]),
          }}
          onEvents={{
            click: (p: unknown) => {
              const e = (p as { data?: { env?: Env } }).data?.env
              if (e) onSelect(e.site.id)
            },
          }}
        />
      )}
    </div>
  )
}
