import { Check } from 'lucide-react'
import { u } from '@/design-system'
import { AS_OF, SCHEDULE, type ScheduleItem } from '../data'
import { V_COLOR } from './style'

/** 날짜 표기: 올해(2026) 일자는 MM-DD, 월만 확정이면 YYYY-MM, 구간·연도는 그대로 */
const dateText = (d: string) => (/^2026-\d\d-\d\d$/.test(d) ? d.slice(5) : d)

function Dot({ state }: { state: ScheduleItem['state'] }) {
  const size = state === 'asof' ? 18 : 14
  const done = state !== 'planned'
  return (
    <span
      aria-hidden
      className="relative z-10 flex items-center justify-center font-black"
      style={{
        width: u(size),
        height: u(size),
        borderRadius: u(999),
        border: `${u(2.25)} solid ${done ? V_COLOR : 'var(--color-text-muted)'}`,
        background: done ? V_COLOR : 'var(--color-bg)',
        color: 'var(--color-accent-contrast)',
      }}
    >
      {done && <Check aria-hidden style={{ width: u(size - 5), height: u(size - 5) }} strokeWidth={4} />}
    </span>
  )
}

/** 출원 일정 8항목 가로 목록. 지난 일 = 채운 점 + 체크 아이콘, 예정 = 빈 점. 기준일 뒤에 세로 구분선 */
export function Schedule() {
  const asofIdx = SCHEDULE.findIndex(s => s.state === 'asof')
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${SCHEDULE.length}, minmax(0, 1fr))`, columnGap: u(10) }} aria-label={`출원 일정 ${SCHEDULE.length}항목, 기준일 ${AS_OF}`}>
      {/* 연결선: 완료 구간은 강조색 실선, 예정 구간은 점선 */}
      <span aria-hidden className="absolute" style={{ left: u(7), right: u(7), top: u(31), borderTop: `${u(2)} dashed var(--color-text-muted)` }} />
      <span aria-hidden className="absolute" style={{ left: u(7), width: `calc(${((asofIdx + 0.5) / SCHEDULE.length) * 100}% - ${u(7)})`, top: u(30), height: u(3), background: V_COLOR }} />
      {SCHEDULE.map((s, i) => {
        const planned = s.state === 'planned'
        const afterAsof = i === asofIdx + 1
        return (
          <li key={s.date + s.label} className="relative flex min-w-0 flex-col" style={{ gap: u(3), paddingLeft: afterAsof ? u(10) : undefined }}>
            {afterAsof && (
              <span aria-hidden className="absolute" style={{ left: u(-6), top: 0, bottom: 0, borderLeft: `${u(2)} dashed var(--color-text)` }} />
            )}
            <span className={`font-extrabold tabular-nums whitespace-nowrap ${s.state === 'asof' ? '' : planned ? 'text-text' : 'text-muted'}`} style={{ fontSize: u(15.5), lineHeight: 1.2, color: s.state === 'asof' ? V_COLOR : undefined }}>
              {dateText(s.date)}
              <span className="font-semibold" style={{ fontSize: u(15), marginLeft: u(4) }}>
                {s.state === 'asof' ? '기준일' : planned ? '예정' : '완료'}
              </span>
            </span>
            <span className="flex items-center" style={{ height: u(22) }}>
              <Dot state={s.state} />
            </span>
            <span className="font-bold text-text" style={{ fontSize: u(15), lineHeight: 1.2 }}>
              {s.label}
            </span>
            <span className="text-muted" style={{ fontSize: u(15), lineHeight: 1.2 }}>
              {s.detail.split(/(RQ\d\d-\d{3})/).map((part, k) =>
                /^RQ\d/.test(part) ? (
                  <span key={k} className="whitespace-nowrap">
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
