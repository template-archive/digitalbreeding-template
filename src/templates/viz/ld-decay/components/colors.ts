import { riceSubpopColor, type ChartTheme } from '@/charts'
import type { LegendShape } from '@/design-system'
import type { GroupKey } from '../data'

/**
 * 집단 색. 하위 집단은 공통 벼 하위 집단 색(`riceSubpopColor`, population-structure와 같은 매핑)을 쓰고,
 * 패널 전체(ALL)는 text 색(중립)으로 그려 하위 집단과 구분한다.
 */
export function groupColor(theme: ChartTheme, g: GroupKey): string {
  return g === 'ALL' ? theme.text : riceSubpopColor(theme, g)
}

/**
 * 점 그림 기호와 범례 견본(색만으로 집단을 구분하지 않도록). 범례는 공통 Legend `shape`로 같은 모양을 그린다.
 * 아우스는 빈 원(속 투명 + 집단색 1.5px 테두리 = Legend 'ring'). 이전 십자(path) 기호는 공통 범례 견본에 없어 바꿨다(2026-10-31).
 */
export const GROUP_MARK: Record<GroupKey, { symbol: string; legend: LegendShape; hollow?: boolean }> = {
  ALL: { symbol: 'circle', legend: 'circle' },
  TEJ: { symbol: 'diamond', legend: 'diamond' },
  TRJ: { symbol: 'triangle', legend: 'triangle' },
  IND: { symbol: 'rect', legend: 'square' },
  AUS: { symbol: 'circle', legend: 'ring', hollow: true },
}
