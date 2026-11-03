import type { StageId } from '../data'

/** 단계별 색: 범주형 팔레트 토큰을 단계 번호 순서로 쓴다. 흐름도 카드와 타임라인이 같은 색을 공유한다. */
export const stageColor = (id: StageId) => `var(--viz-cat-${id})`
