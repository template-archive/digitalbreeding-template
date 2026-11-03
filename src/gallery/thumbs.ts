/**
 * 목록 카드 미리보기 썸네일: src/gallery/thumbs/{category}-{slug}-{light|dark}.webp
 * (template-qa gen-thumbs.mjs가 임베드 화면 1440×900 첫 화면을 1080×675로 줄여 만든다.)
 * 있는 파일만 지도로 만든다. 없는 템플릿은 카드가 빈 자리(면 2 색 + 카테고리 라벨)를 보인다. 404 요청은 만들지 않는다.
 */
import type { ThemeMode } from '@/design-system/themeMode'

const files = import.meta.glob<string>('./thumbs/*.webp', { eager: true, query: '?url', import: 'default' })

const map = new Map<string, string>()
for (const [key, url] of Object.entries(files)) {
  const m = key.match(/\.\/thumbs\/(.+)\.webp$/)
  if (m) map.set(m[1]!, url)
}

/** 썸네일 원본 크기(16:10). img width/height 속성에 써서 로드 전에도 자리를 잡는다 */
export const THUMB_SIZE = { width: 1080, height: 675 } as const

/** 현재 테마에 맞는 썸네일 URL. 없으면 undefined */
export function thumbUrl(category: string, slug: string, mode: ThemeMode): string | undefined {
  return map.get(`${category}-${slug}-${mode}`)
}
