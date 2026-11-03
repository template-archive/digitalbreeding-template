import type { ReactNode } from 'react'
import { ScrollRegion } from '@/design-system'

export interface MetricStripProps {
  /** 넘칠 때 스크롤 영역의 접근성 이름 */
  label: string
  /** 타일 배열(첫 타일이 대표). 타일 폭은 여기서 정한다 */
  children: ReactNode
}

/**
 * 390px 선택 지표 가로 띠. 타일 폭을 고정하고 넘치면 ScrollRegion 안내·페이드가 붙는다.
 * 스크롤 영역은 세로로도 잘리므로 위로 열리는 Tooltip(KpiTile `info`)을 넣지 않는다: 설명은 PageHeader `details`로 옮긴다.
 * 기준 구현 viz/gwas-manhattan과 같은 규격.
 */
export function MetricStrip({ label, children }: MetricStripProps) {
  return (
    <ScrollRegion label={label} hint="옆으로 밀어 지표 더 보기 →" fadeColor="var(--color-bg)">
      <div className="flex w-max items-stretch gap-3 [&>*]:w-[184px] [&>*]:shrink-0 [&>*:first-child]:w-[228px]">{children}</div>
    </ScrollRegion>
  )
}
