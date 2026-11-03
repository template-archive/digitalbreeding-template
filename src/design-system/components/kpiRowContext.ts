import { createContext } from 'react'

/** KpiRow → KpiTile(내부): 같은 줄 배치에서 정한 대표 타일 표시 방식 */
export interface KpiRowContextValue {
  /**
   * 넓은 대표 타일의 달성 막대를 값 오른쪽에 둘지. 형제 타일 가운데 달성 막대·정상 범위 눈금(바닥 줄)이 있는 것이 절반 이하일 때 true.
   * 형제 대부분이 바닥에 막대를 가지면 대표 막대도 바닥에 두어 줄의 막대 높이를 맞춘다.
   */
  heroSideBar: boolean
}

export const KpiRowContext = createContext<KpiRowContextValue | null>(null)
