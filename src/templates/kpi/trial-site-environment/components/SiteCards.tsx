import { AlertOctagon, AlertTriangle } from 'lucide-react'
import { useChartTheme } from '@/charts'
import { alertsOfEnv, COLD_T, envsOf, HEAT_T, ZONE_BY_KEY, ZONES, type Year } from '../data'
import { indexColor, pct0, s0, s1 } from './fmt'

interface Props {
  year: Year
  selected: string
  onSelect: (siteId: string) => void
  className?: string
}

/** C 지역 카드 8개(권역 순). 누르면 지역 선택. 권역은 문자로만 둔다(권역 띠 색과 지수 점 색이 같은 파랑·주황이라 한 카드에서 두 뜻이 됐다) */
export function SiteCards({ year, selected, onSelect, className }: Props) {
  const theme = useChartTheme()
  const envs = [...envsOf(year)].sort((a, b) => ZONES.findIndex(z => z.key === a.site.zone) - ZONES.findIndex(z => z.key === b.site.zone) || a.j - b.j)
  return (
    <ul className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${className ?? ''}`} aria-label={`${year}년 시험지 8곳`}>
      {envs.map(e => {
        const al = alertsOfEnv(e)
        const crit = al.filter(a => a.severity === 'critical').length
        const isSel = e.site.id === selected
        return (
          <li key={e.site.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={isSel}
              onClick={() => onSelect(e.site.id)}
              className={`flex w-full min-w-0 flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2 ${isSel ? 'select-ring' : ''}`}
            >
              {/* 지역명은 줄이지 않는다(같은 도 지역끼리 구분). 권역은 아래 기상 줄 맨 앞으로 */}
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-keep text-[13px] font-semibold leading-snug text-text">{e.site.name}</span>
                {al.length > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 pt-px text-[11px] font-semibold text-text">
                    {crit > 0 ? (
                      <AlertOctagon size={12} aria-hidden="true" className="text-negative" />
                    ) : (
                      <AlertTriangle size={12} aria-hidden="true" className="text-warning" />
                    )}
                    {crit > 0 ? `경보 ${crit}` : ''}
                    {crit > 0 && al.length > crit ? ' · ' : ''}
                    {al.length > crit ? `주의 ${al.length - crit}` : ''}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                <span aria-hidden="true" className="inline-block size-2.5 self-center rounded-full" style={{ background: indexColor(theme, e.index) }} />
                <span className="text-lg font-bold leading-none text-text">{s1(e.index)}</span>
                <span className="whitespace-nowrap text-[11px] text-muted">kg/10a 환경 지수</span>
              </span>
              <span className="flex flex-wrap gap-x-2 text-[11px] text-muted tabular-nums">
                <span>{ZONE_BY_KEY[e.site.zone].label}</span>
                <span>GDD {s0(e.gdd - e.gddN)} °C·일</span>
                <span>강수 {pct0((100 * e.pr) / e.prN)}</span>
                <span>일조 {pct0((100 * e.sun) / e.sunN)}</span>
                <span>
                  고온(≥ {HEAT_T} °C) {e.heat}일 · 저온(≤ {COLD_T} °C) {e.cold}일
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
