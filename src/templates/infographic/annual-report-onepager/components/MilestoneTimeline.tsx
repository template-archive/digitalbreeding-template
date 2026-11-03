import { u } from '@/design-system'
import { AS_OF, AS_OF_X, MILESTONES, MILESTONE_LEVELS, YEAR, xOf } from '../data'
import { MilestoneDot } from './ui'

const MONTH_START = Array.from({ length: 12 }, (_, i) => xOf(`${YEAR}-${String(i + 1).padStart(2, '0')}-01`))

/**
 * 2026 마일스톤: 가로 1~12월 축 + 번호 마커(7일 이내는 위로 쌓기) + 기준일 세로 점선,
 * 아래 2열 × 4행 카드(①~④ 왼쪽, ⑤~⑧ 오른쪽, 위→아래로 날짜 순).
 */
export function MilestoneTimeline({ width }: { width: number }) {
  const axisH = 104
  const padX = 18
  const pw = width - padX * 2
  const X = (t: number) => padX + pw * t
  const axisY = 74
  const R = 14
  const levelY = (lv: number) => axisY - 28 - lv * 30
  const asOfX = X(AS_OF_X)
  const asOfLabel = `기준일 ${Number(AS_OF.slice(5, 7))}/${Number(AS_OF.slice(8, 10))}`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${axisH}`} style={{ width: u(width), height: u(axisH), display: 'block' }} aria-hidden>
        {/* 기준일 이후(예정 구간) */}
        <rect x={asOfX} y={4} width={X(1) - asOfX} height={axisY - 4} fill="var(--color-surface-2)" />
        <text x={X(1) - 6} y={20} fontSize={15} textAnchor="end" fill="var(--color-text-muted)">
          예정 →
        </text>
        {/* 월 칸 */}
        <line x1={X(0)} x2={X(1)} y1={axisY} y2={axisY} stroke="var(--color-text)" strokeWidth={2} />
        {MONTH_START.map((t, i) => {
          const next = i === 11 ? 1 : MONTH_START[i + 1]
          return (
            <g key={i}>
              <line x1={X(t)} x2={X(t)} y1={axisY} y2={axisY + 8} stroke="var(--color-text)" strokeWidth={1.5} />
              <text x={X((t + next) / 2)} y={axisY + 26} fontSize={15} textAnchor="middle" fill="var(--color-text-muted)">
                {i + 1}월
              </text>
            </g>
          )
        })}
        <line x1={X(1)} x2={X(1)} y1={axisY} y2={axisY + 8} stroke="var(--color-text)" strokeWidth={1.5} />
        {/* 줄기(마커 아래 층): 모든 줄기를 먼저 그려 가까운 마커(⑥·⑦)의 줄기가 다른 원을 가로지르지 않게 한다 */}
        {MILESTONES.map((m, i) => {
          const cx = X(xOf(m.date))
          const cy = levelY(MILESTONE_LEVELS[i])
          const r = m.highlight ? R + 3 : R
          return (
            <g key={m.n}>
              <line x1={cx} x2={cx} y1={cy + r} y2={axisY} stroke="var(--color-text)" strokeWidth={1.5} strokeDasharray={m.planned ? '3 3' : undefined} />
              <circle cx={cx} cy={axisY} r={3.5} fill="var(--color-text)" />
            </g>
          )
        })}
        {/* 기준일 세로 점선: 마커 원 아래 층. 라벨은 마커 줄 아래(축 바로 위)에 둔다 */}
        <line x1={asOfX} x2={asOfX} y1={4} y2={axisY + 10} stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="5 3" />
        <text x={asOfX + 6} y={axisY - 5} fontSize={15} fontWeight={700} fill="var(--color-text-muted)" paintOrder="stroke" stroke="var(--color-surface-2)" strokeWidth={4}>
          {asOfLabel}
        </text>
        {/* 마커 원(맨 위 층) */}
        {MILESTONES.map((m, i) => {
          const cx = X(xOf(m.date))
          const cy = levelY(MILESTONE_LEVELS[i])
          const r = m.highlight ? R + 3 : R
          return (
            <g key={m.n}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={m.highlight ? 'var(--color-accent)' : 'var(--color-surface)'}
                stroke={m.planned ? 'var(--color-text-muted)' : 'var(--color-text)'}
                strokeWidth={m.highlight ? 3.5 : 2}
                strokeDasharray={m.planned ? '4 3' : undefined}
              />
              <text
                x={cx}
                y={cy + 5.5}
                fontSize={m.highlight ? 17 : 15}
                fontWeight={800}
                textAnchor="middle"
                fill={m.highlight ? 'var(--color-accent-contrast)' : m.planned ? 'var(--color-text-muted)' : 'var(--color-text)'}
              >
                {m.n}
              </text>
            </g>
          )
        })}
      </svg>
      <ol className="grid grid-flow-col" style={{ gridTemplateRows: 'repeat(4, auto)', gridTemplateColumns: '1fr 1fr', columnGap: u(20), rowGap: u(2), marginTop: u(2) }}>
        {MILESTONES.map(m => (
          <li
            key={m.n}
            className={`grid items-start ${m.highlight ? 'border-accent/60 bg-accent/5' : m.planned ? 'border-border' : 'border-transparent'}`}
            style={{
              gridTemplateColumns: `${u(34)} ${u(90)} 1fr`,
              gap: u(6),
              padding: `${u(3)} ${u(8)}`,
              borderRadius: u(8),
              borderWidth: u(m.highlight ? 2 : 1.5),
              borderStyle: m.planned ? 'dashed' : 'solid',
            }}
          >
            <MilestoneDot n={m.n} highlight={m.highlight} planned={m.planned} size={26} />
            <span className={`font-bold tabular-nums ${m.planned ? 'text-muted' : 'text-text'}`} style={{ fontSize: u(16), lineHeight: u(26) }}>
              {m.label}
            </span>
            <span className="min-w-0" style={{ lineHeight: 1.3 }}>
              <span className={`block font-bold ${m.planned ? 'text-muted' : 'text-text'}`} style={{ fontSize: u(16) }}>
                {m.title}
                {m.planned && <span className="font-semibold" style={{ marginLeft: u(6) }}>· 실적 아님</span>}
              </span>
              <span className="block text-muted" style={{ fontSize: u(15), lineHeight: 1.25 }}>
                {m.note}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
