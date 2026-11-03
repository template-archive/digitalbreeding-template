import { riceSubpopColor, type ChartTheme } from '@/charts'
import type { ComponentColor, GroupKey } from '../data'

/**
 * 하위 집단·조상 성분 색. K가 바뀌어도 같은 계열을 유지한다.
 * 자포니카형·TEJ = 파랑, TEJ-도입 = 하늘, TRJ = 청록, 인디카형·IND = 주황, IND-도입 = 황, AUS = 보라, 혼합형 = 회청(PCA 전용).
 */
export function componentColor(theme: ChartTheme, c: ComponentColor): string {
  const cat = theme.categorical
  switch (c) {
    case 'jap':
      return cat[0]!
    case 'tejImport':
      return cat[5]!
    case 'trj':
      return cat[2]!
    case 'ind':
      return cat[1]!
    case 'indImport':
      return cat[4]!
    case 'aus':
      return cat[3]!
  }
}

/** 하위 집단 색: 공통 벼 하위 집단 매핑(TEJ cat[0], IND cat[1], TRJ cat[2], AUS cat[3], 혼합형 cat[7]) */
export function groupColor(theme: ChartTheme, g: GroupKey): string {
  return riceSubpopColor(theme, g)
}
