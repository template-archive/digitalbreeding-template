import type { ReactNode } from 'react'

export interface MobileSummaryItem {
  key: string
  /** 카드 이름(dt) */
  label: ReactNode
  /** 큰 숫자(22px 굵게). 단위를 숫자와 같은 크기로 붙이려면 문자열에 함께 넣는다 */
  value: ReactNode
  /** 숫자 아래에 이어지는 내용(dd 안, 값 뒤). 단위·보조 문구 span을 템플릿이 직접 준다 */
  detail?: ReactNode
  /** 강조 카드(accent 테두리·옅은 accent 배경, 숫자 accent 색) */
  primary?: boolean
}

export interface MobileSummaryProps {
  /** h2 제목 */
  title: ReactNode
  /** 2열로 놓이는 카드(보통 4개) */
  items: MobileSummaryItem[]
  /** 카드 아래 한 줄 결론(p) */
  footer?: ReactNode
  /** 영역 이름(기본 '핵심 요약') */
  ariaLabel?: string
}

/**
 * 인포그래픽 요약 카드. `ScaledCanvas`가 최소 배율에 걸려 잘리는 화면(390px, 768px)에서 캔버스 위에 핵심 숫자를 2열 카드로 보인다.
 * 인쇄 때는 숨는다(data-print-hide).
 * 표시 조건은 `<ScaledCanvas summary={<MobileSummary … />}>`로 넘겨 캔버스가 정한다(잘릴 때만, 2026-10-30).
 * 예전 방식(`useMediaQuery('(max-width: 639px)')` + 캔버스 앞에 직접 렌더)은 768px에서 요약이 빠지므로 옮긴다.
 */
export function MobileSummary({ title, items, footer, ariaLabel = '핵심 요약' }: MobileSummaryProps) {
  return (
    <section data-print-hide="" aria-label={ariaLabel} className="rounded-lg border border-border bg-surface p-3">
      <h2 className="text-[15px] font-extrabold text-text">{title}</h2>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {items.map(s => (
          <div key={s.key} className={`rounded-md border p-2 ${s.primary ? 'border-accent bg-accent/5' : 'border-border'}`}>
            <dt className="text-[14px] font-semibold leading-tight text-muted">{s.label}</dt>
            <dd className="mt-1">
              <span className={`block text-[22px] font-extrabold leading-tight tabular-nums ${s.primary ? 'text-accent' : 'text-text'}`}>{s.value}</span>
              {s.detail}
            </dd>
          </div>
        ))}
      </dl>
      {footer != null && <p className="mt-2 text-[14px] font-semibold text-text">{footer}</p>}
    </section>
  )
}
