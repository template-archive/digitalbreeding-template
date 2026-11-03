/**
 * 색 규칙(토큰만): 공여친 = 범주형 주황, 반복친(가람솔) = 염색체 중립 회청.
 * 흑백 인쇄에서는 동형(채움)·이형(빗금·반 높이)·가람솔형(바탕)과 범례 문자로 구분한다.
 */
export const DONOR_COLOR = 'var(--viz-cat-2)'
export const RECUR_COLOR = 'var(--viz-chr-b)'
export const HERO_COLOR = 'var(--color-accent)'

export type SelKey = 'fg' | 'rec' | 'bg'
/** 세 선발: 번호 + 아이콘 + 색 + 한 줄 풀이(외부 청중용) */
export const SEL: Record<SelKey, { no: string; name: string; short: string; plain: string; color: string }> = {
  fg: { no: '①', name: '전경 선발', short: '전경', plain: '유전자가 들어왔나', color: 'var(--viz-cat-1)' },
  rec: { no: '②', name: '재조합 선발', short: '재조합', plain: '주변 군더더기를 잘라 냈나', color: 'var(--viz-cat-3)' },
  bg: { no: '③', name: '배경 선발', short: '6K 분석', plain: '나머지는 가람솔로 돌아왔나', color: 'var(--viz-cat-4)' },
}

/** 연한 채움: 토큰색을 표면색에 섞는다 */
export const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, var(--color-surface))`
