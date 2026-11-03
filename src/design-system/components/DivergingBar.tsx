import type { ReactNode } from 'react'
import { cn } from './cn'

export interface DivergingBarProps {
  /** 막대 값. 0 = 기준(평균·대비 품종). 축 끝을 넘으면 끝에서 자른다 */
  value: number
  /**
   * 축 한쪽 끝의 |값|. 숫자면 0이 가운데,
   * `[음수 쪽, 양수 쪽]`이면 0이 `음수 쪽 / (음수 쪽 + 양수 쪽)` 위치(한쪽으로 치우친 값에 여백을 더 줄 때)
   */
  domain: number | readonly [number, number]
  /** 왼쪽 라벨 열(stacked에서 4.5rem). 표의 다른 열이 이름을 보여 주면 생략 */
  label?: ReactNode
  /** 값 글자. stacked는 막대 아래, inline은 막대 끝 */
  valueText?: ReactNode
  /** 음수일 때 값 글자 옆에 붙일 문자 표시(색만으로 손해를 알리지 않기 위해). 예: `<Badge tone="warning">손해</Badge>` */
  negativeTag?: ReactNode
  /**
   * stacked(기본): UI 화면용. 높이 16px 막대 + 아래 12px 값 글자.
   * inline: 표 셀·인포그래픽용. 값 글자가 막대 끝에 붙고 모든 크기가 em(부모 font-size = 값 글자 크기)이라
   * `ScaledCanvas` 안에서는 감싼 요소에 `fontSize: u(15)`처럼 주면 함께 비례한다. 높이는 2em.
   */
  layout?: 'stacked' | 'inline'
  /** sign(기본): 양수 accent, 음수 warning. accent: 부호와 무관하게 accent(부호가 좋고 나쁨을 뜻하지 않는 변화량) */
  tone?: 'sign' | 'accent'
  className?: string
}

function geometry(value: number, domain: DivergingBarProps['domain']) {
  const [dn, dp] = typeof domain === 'number' ? [domain, domain] : domain
  const zero = (dn / (dn + dp)) * 100 // 0의 위치(트랙 폭 %)
  const v = Math.max(-dn, Math.min(dp, value))
  const width = v < 0 ? (-v / dn) * zero : (v / dp) * (100 - zero)
  return { zero, width, neg: value < 0 }
}

/**
 * 0 기준선에서 양쪽으로 뻗는 가로 막대 한 줄(선발 차, 표준화 GEBV, 대비 품종 대비 증감 등).
 * 막대는 장식(aria-hidden)이고 값은 `valueText` 글자로 읽힌다.
 */
export function DivergingBar({ value, domain, label, valueText, negativeTag, layout = 'stacked', tone = 'sign', className }: DivergingBarProps) {
  const { zero, width, neg } = geometry(value, domain)
  const barColor = tone === 'sign' && neg ? 'bg-warning' : 'bg-accent'
  const barPos = neg ? { right: `${100 - zero}%`, width: `${width}%` } : { left: `${zero}%`, width: `${width}%` }

  if (layout === 'inline') {
    // 기준선 1.5/15em, 막대 14/15em(위 8/15em), 글자 간격 5/15em — 값 글자 15 기준 비율
    const gap = `${5 / 15}em`
    const textPos = neg ? { right: `calc(${100 - zero + width}% + ${gap})` } : { left: `calc(${zero + width}% + ${gap})` }
    return (
      <div className={cn('relative', className)} style={{ height: '2em' }}>
        <div
          aria-hidden="true"
          className="absolute bg-muted"
          style={{ left: `${zero}%`, top: `${1 / 15}em`, bottom: `${1 / 15}em`, width: `${1.5 / 15}em`, transform: 'translateX(-50%)' }}
        />
        <div aria-hidden="true" className={cn('absolute', barColor)} style={{ ...barPos, top: `${8 / 15}em`, height: `${14 / 15}em`, borderRadius: `${2 / 15}em` }} />
        <span className="absolute inline-flex items-center gap-[0.3em] font-bold whitespace-nowrap text-text" style={{ ...textPos, top: 0, height: `${30 / 15}em`, lineHeight: 1 }}>
          {valueText}
          {neg && negativeTag}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(label != null ? 'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1' : 'flex flex-col gap-y-1', className)}>
      {label != null && <div className="text-[13px] font-medium text-text">{label}</div>}
      <div className="relative h-4">
        <div aria-hidden="true" className="absolute inset-y-0 w-px bg-border" style={{ left: `${zero}%` }} />
        <div aria-hidden="true" className={cn('absolute inset-y-0.5 rounded-sm', barColor)} style={barPos} />
      </div>
      {(valueText != null || (neg && negativeTag != null)) && (
        <div className={cn(label != null && 'col-start-2', 'flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted')}>
          <span className="font-semibold text-text">{valueText}</span>
          {neg && negativeTag}
        </div>
      )}
    </div>
  )
}
