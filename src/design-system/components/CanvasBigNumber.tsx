import type { ReactNode } from 'react'
import { u } from './ScaledCanvas'

export interface CanvasBigNumberProps {
  /** 큰 숫자(강조색, extrabold, 한 줄) */
  value: ReactNode
  /** 숫자 뒤 단위(bold text 색). 빈 문자열이면 자리만 남는다 */
  unit: ReactNode
  /** 카드 제목(h2) */
  label: ReactNode
  /** 보조 줄(muted, tabular-nums) */
  sub: ReactNode
  /** 대표 카드: 강조색 테두리 2·바탕 accent 5%, 숫자·단위가 한 단계 크다 */
  primary?: boolean
  /** 라벨 위치. below(기본): 숫자 → 라벨 → 보조, above: 라벨 → 숫자 → 보조 */
  labelPosition?: 'above' | 'below'
  /** 숫자 줄 끝 작은 보조 문구(muted semibold 15 — 캔버스 글자 하한, 세로 가운데, 줄바꿈 허용) */
  note?: ReactNode
  /** sub가 문자열일 때 ' · '로 나뉜 구절 안에서는 줄을 바꾸지 않는다(예: "b 0.87"이 갈라지지 않게) */
  keepSegments?: boolean
  /** default: 라벨 19·보조 17·단위 26/22·좌우 여백 20(16:9 캔버스), compact: 라벨 17·보조 15·단위 24/21·좌우 여백 18(A4 세로) */
  size?: 'default' | 'compact'
}

const SIZE = {
  default: { padX: 20, unit: [26, 22], label: 19, sub: 17, subLh: 1.25 },
  compact: { padX: 18, unit: [24, 21], label: 17, sub: 15, subLh: 1.3 },
} as const

/** " · "로 나뉜 구절을 각각 nowrap으로 감싼다 */
function segments(text: string) {
  return text.split(' · ').map((seg, i) => (
    <span key={i}>
      {i > 0 && ' · '}
      <span className="whitespace-nowrap">{seg}</span>
    </span>
  ))
}

/**
 * ScaledCanvas 안의 인포그래픽 큰 숫자 카드(mas-backcross-story BigNumber 규격). 모든 크기가 u(n)이라 캔버스 밖에서는 쓰지 않는다.
 * 높이는 감싼 격자가 정하고 세 줄은 justify-between으로 위·가운데·아래에 놓인다.
 */
export function CanvasBigNumber({ value, unit, label, sub, primary = false, labelPosition = 'below', note, keepSegments = false, size = 'default' }: CanvasBigNumberProps) {
  const s = SIZE[size]
  const title = (
    <h2 className="font-bold text-text" style={{ fontSize: u(s.label), lineHeight: 1.2 }}>
      {label}
    </h2>
  )
  return (
    <section
      className={`flex min-w-0 flex-col justify-between border ${primary ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'}`}
      style={{ padding: `${u(8)} ${u(s.padX)} ${u(10)}`, borderRadius: u(12), borderWidth: u(primary ? 2 : 1.5) }}
    >
      {labelPosition === 'above' && title}
      <div className="flex items-baseline tabular-nums whitespace-nowrap" style={{ gap: u(8) }}>
        <span className="font-extrabold" style={{ fontSize: u(primary ? 60 : 52), lineHeight: 1, color: 'var(--color-accent)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span className="font-bold text-text" style={{ fontSize: u(primary ? s.unit[0] : s.unit[1]) }}>
          {unit}
        </span>
        {note != null && note !== '' && (
          <span className="self-center whitespace-normal break-keep font-semibold text-muted" style={{ fontSize: u(15), lineHeight: 1.15 }}>
            {note}
          </span>
        )}
      </div>
      {labelPosition === 'below' && title}
      <p className="text-muted tabular-nums" style={{ fontSize: u(s.sub), lineHeight: s.subLh }}>
        {keepSegments && typeof sub === 'string' ? segments(sub) : sub}
      </p>
    </section>
  )
}
