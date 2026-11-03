import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { u } from '@/design-system'

/** 좋은 변화(개선)·나쁜 변화를 기호 + 문자 + 색으로 함께 보여 준다 */
export function Change({ children, good }: { children: ReactNode; good: boolean }) {
  return <b className={good ? 'text-positive' : 'text-negative'}>{children}</b>
}

/** 목표 미달 표시. 색만이 아니라 경고 아이콘과 "목표 대비 x%" 문자로 읽힌다 */
export function Shortfall({ children }: { children: ReactNode }) {
  return (
    <b className="inline-flex items-baseline text-warning" style={{ gap: u(3) }}>
      <AlertTriangle aria-hidden className="self-center" style={{ width: u(15), height: u(15) }} strokeWidth={2.5} />
      {children}
    </b>
  )
}

/** 마일스톤 번호 원(HTML). 강조(⑤) = 크고 굵은 테두리, 예정(⑧) = 점선 테두리 */
export function MilestoneDot({ n, highlight, planned, size = 28 }: { n: number; highlight?: boolean; planned?: boolean; size?: number }) {
  const s = highlight ? size + 4 : size
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center font-extrabold tabular-nums ${
        highlight ? 'border-text bg-accent text-accent-contrast' : planned ? 'border-muted bg-surface text-muted' : 'border-text bg-surface text-text'
      }`}
      style={{
        width: u(s),
        height: u(s),
        borderRadius: '50%',
        borderWidth: u(highlight ? 3.5 : 2),
        borderStyle: planned ? 'dashed' : 'solid',
        fontSize: u(highlight ? 17 : 15),
      }}
    >
      {n}
    </span>
  )
}
