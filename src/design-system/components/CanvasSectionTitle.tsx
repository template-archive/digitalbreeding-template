import type { ReactNode } from 'react'
import { u } from './ScaledCanvas'

export interface CanvasSectionTitleProps {
  /** 굵은 영역 제목(줄바꿈하지 않는다) */
  title: ReactNode
  /** 제목 오른쪽에 이어지는 보조 설명(muted, 15 논리 px, 줄바꿈 허용) */
  sub?: ReactNode
  /** 오른쪽 끝 조건·범례 문구(muted, 15 논리 px, 오른쪽 정렬) */
  right?: ReactNode
  /** 영역 번호. 주면 강조색 사각 번호 배지(26×26), 없으면 강조색 세로 막대(5×20) */
  no?: ReactNode
  /** 제목 글자 크기(논리 px). 기본 21 */
  size?: number
  /** 아래 여백(논리 px). 기본 8 */
  gapBelow?: number
}

/**
 * ScaledCanvas 안의 인포그래픽 영역 제목. 모든 크기를 u(n)으로 정하므로 ScaledCanvas 밖에서는 쓰지 않는다.
 * 레이아웃: 한 줄 flex(baseline 정렬) — 왼쪽 h2(마커 + 제목 + 보조 설명), 오른쪽 조건. 공간이 모자라면 h2가 줄어든다.
 */
export function CanvasSectionTitle({ title, sub, right, no, size = 21, gapBelow = 8 }: CanvasSectionTitleProps) {
  return (
    <div className="flex items-baseline justify-between" style={{ gap: u(16), marginBottom: u(gapBelow) }}>
      <h2 className="flex min-w-0 items-baseline font-extrabold text-text" style={{ fontSize: u(size), gap: u(10), lineHeight: 1.2 }}>
        {no == null ? (
          <span aria-hidden className="self-center bg-accent" style={{ width: u(5), height: u(20), borderRadius: u(2) }} />
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center justify-center self-center bg-accent text-accent-contrast font-extrabold"
            style={{ width: u(26), height: u(26), borderRadius: u(6), fontSize: u(15) }}
          >
            {no}
          </span>
        )}
        <span className="whitespace-nowrap">{title}</span>
        {sub && (
          <span className="font-medium text-muted" style={{ fontSize: u(15) }}>
            {sub}
          </span>
        )}
      </h2>
      {right && (
        <div className="shrink-0 text-right text-muted" style={{ fontSize: u(15) }}>
          {right}
        </div>
      )}
    </div>
  )
}
