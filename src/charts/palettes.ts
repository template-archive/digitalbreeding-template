/**
 * 데이터 색 팔레트. 호출 시점의 CSS 변수 값을 읽으므로 테마가 바뀐 뒤 다시 호출하면 새 색을 얻는다.
 * 렌더 중에는 useChartTheme()의 값을 쓰는 편이 테마 전환에 안전하다.
 */
import { readToken } from '@/design-system/themeMode'

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => readToken(`${prefix}${i + 1}`))

export const palettes = {
  /** --viz-cat-1..8 */
  categorical: (): string[] => range('--viz-cat-', 8),
  /** --viz-seq-1..7 (낮음 → 높음) */
  sequential: (): string[] => range('--viz-seq-', 7),
  /** --viz-div-neg-3 … --viz-div-0 … --viz-div-pos-3 (7색) */
  diverging: (): string[] => [
    readToken('--viz-div-neg-3'),
    readToken('--viz-div-neg-2'),
    readToken('--viz-div-neg-1'),
    readToken('--viz-div-0'),
    readToken('--viz-div-pos-1'),
    readToken('--viz-div-pos-2'),
    readToken('--viz-div-pos-3'),
  ],
  /** 맨해튼 교대 2색 */
  chromosome: (): [string, string] => [readToken('--viz-chr-a'), readToken('--viz-chr-b')],
  /** 유의선 */
  threshold: (): string => readToken('--viz-threshold'),
}
