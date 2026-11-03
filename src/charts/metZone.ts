/**
 * 벼 지역 적응 시험(MET) 권역 라벨·색(템플릿 간 공통). 범주형 팔레트 인덱스로 고정해 어느 템플릿에서든 같은 권역이 같은 색이다.
 * 중부 평야지 파랑 cat[0], 남부 평야지 주황 cat[1], 중북부지 청록 cat[2]. 목록 밖 값은 회청 cat[7].
 * met-gxe-stability(메가 환경 = 권역)와 trial-site-environment(시험지 권역)가 함께 쓴다.
 */
import type { ChartTheme } from './theme'

export type MetZoneKey = 'central' | 'south' | 'north'

export interface MetZone {
  key: MetZoneKey
  /** 전체 이름(범례·표 머리) */
  label: string
  /** 짧은 이름(축·배지) */
  short: string
}

/** 권역 목록. 순서가 곧 범주형 팔레트 인덱스다 */
export const MET_ZONES: MetZone[] = [
  { key: 'central', label: '중부 평야지', short: '중부' },
  { key: 'south', label: '남부 평야지', short: '남부' },
  { key: 'north', label: '중북부지', short: '중북부' },
]

export const MET_ZONE_BY_KEY = Object.fromEntries(MET_ZONES.map(z => [z.key, z])) as Record<MetZoneKey, MetZone>

export function metZoneColor(theme: Pick<ChartTheme, 'categorical'>, zone: MetZoneKey): string {
  return theme.categorical[MET_ZONES.findIndex(z => z.key === zone)] ?? theme.categorical[7]!
}
