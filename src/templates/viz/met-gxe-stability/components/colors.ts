import { metZoneColor, type ChartTheme } from '@/charts'
import { GENO_BY_ID, MEGA_BY_WINNER, MEGA_ENVS, UNSTABLE_REF, type MegaEnv, type ZoneKey } from '../data'

/** 메가 환경(= 권역) 색: 중부 파랑 cat[0], 남부 주황 cat[1], 중북부 청록 cat[2](@/charts metZoneColor) */
export const zoneColor = (theme: Pick<ChartTheme, 'categorical'>, zone: ZoneKey): string => metZoneColor(theme, zone)
export function megaColor(theme: Pick<ChartTheme, 'categorical'>, m: MegaEnv): string {
  return zoneColor(theme, m.zone)
}

/** 강조 계통(후보 3 + 대비 2 + 불안정 비교 계통) */
export const FEATURED_IDS = [...MEGA_ENVS.map(m => m.winnerId), UNSTABLE_REF, 'YR07-0231', 'YR13-0819']

/**
 * 계통 색. 출원 후보는 자기 메가 환경 색, YR20-0815는 자홍 cat[6], 가람솔은 text, 온새미로는 회청 cat[7],
 * 나머지는 null(호출부가 회색으로 그림).
 */
export function lineColor(theme: ChartTheme, id: string): string | null {
  const mega = MEGA_BY_WINNER[id]
  if (mega) return megaColor(theme, mega)
  if (id === UNSTABLE_REF) return theme.categorical[6]!
  const g = GENO_BY_ID[id]
  if (g?.role === 'check') return g.checkKind === '표준' ? theme.text : theme.categorical[7]!
  return null
}
