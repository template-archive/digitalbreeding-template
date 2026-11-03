/**
 * 벼 하위 집단 색(템플릿 간 공통). 범주형 팔레트 인덱스로 고정해 어느 템플릿에서든 같은 집단이 같은 색이다.
 * TEJ(온대 자포니카) 파랑 cat[0], IND(인디카) 주황 cat[1], TRJ(열대 자포니카) 청록 cat[2], AUS 보라 cat[3], ADM(혼합형) 회청 cat[7].
 * cat[4](IND-도입)·cat[5](TEJ-도입)·cat[6]은 비워 두어 조상 성분 색(population-structure)이 쓸 수 있다.
 * '전체 패널'처럼 집단이 아닌 계열은 이 함수에 넣지 말고 theme.text 같은 중립색을 템플릿이 정한다.
 */
import type { ChartTheme } from './theme'

export type RiceSubpop = 'TEJ' | 'TRJ' | 'IND' | 'AUS' | 'ADM'

export const RICE_SUBPOP_CAT_INDEX: Record<RiceSubpop, number> = { TEJ: 0, IND: 1, TRJ: 2, AUS: 3, ADM: 7 }

export function riceSubpopColor(theme: Pick<ChartTheme, 'categorical'>, g: RiceSubpop): string {
  return theme.categorical[RICE_SUBPOP_CAT_INDEX[g]]!
}
