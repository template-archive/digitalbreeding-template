import type { ChartTheme } from '@/charts'
import type { BadgeTone } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { PLATFORMS, type PlatformKey, type ReStatus } from '../data'

export const int = (v: number) => formatNumber(v, { digits: 0 })
export const d1 = (v: number) => formatNumber(v, { digits: 1 })
export const pct1 = (v: number) => `${formatNumber(v, { digits: 1 })}%`

/** 차트 색(테마에서 읽은 실제 색값) */
export const platformColor = (theme: ChartTheme, k: PlatformKey) => theme.categorical[PLATFORMS[k].colorIndex]
/** HTML 요소용 CSS 변수 */
export const platformVar = (k: PlatformKey) => `var(--viz-cat-${PLATFORMS[k].colorIndex + 1})`

export const STATUS_TONE: Record<ReStatus | '재분석 완료', BadgeTone> = {
  '재분석 통과': 'positive',
  '재분석 완료': 'positive',
  '폐기·대체 개체 사용': 'neutral',
  '진행 중': 'info',
  대기: 'warning',
  '재채취 요청': 'warning',
  '재시퀀싱 대기': 'warning',
}
