/**
 * 갤러리 정렬·묶음 규칙: 카테고리(CATEGORIES 순서, 그 밖의 폴더는 뒤에 이름순) → 묶음 안은 제목(ko) 순.
 * 사이드바·목록 구획·이전/다음이 모두 이 순서를 쓴다.
 */
import type { TemplateEntry } from './registry'
import { CATEGORIES, CATEGORY_LABELS, type TemplateCategory } from './types'

export function categoryLabel(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category
}

export interface TemplateGroup {
  category: string
  label: string
  items: TemplateEntry[]
}

const byTitle = (a: TemplateEntry, b: TemplateEntry) => a.meta.title.localeCompare(b.meta.title, 'ko')

/** 카테고리 순서로 묶는다. 알려진 카테고리 4개는 항목이 없어도 묶음을 만든다(빈 묶음 숨김은 호출 측). */
export function groupTemplates(list: TemplateEntry[]): TemplateGroup[] {
  const by = new Map<string, TemplateEntry[]>()
  for (const t of list) {
    const c = t.path.category
    const arr = by.get(c)
    if (arr) arr.push(t)
    else by.set(c, [t])
  }
  const extra = [...by.keys()].filter(c => !CATEGORIES.includes(c as TemplateCategory)).sort()
  return [...CATEGORIES, ...extra].map(c => ({ category: c, label: categoryLabel(c), items: (by.get(c) ?? []).slice().sort(byTitle) }))
}

/** 사이드바·이전/다음 순서(카테고리 → 제목) */
export function orderedTemplates(list: TemplateEntry[]): TemplateEntry[] {
  return groupTemplates(list).flatMap(g => g.items)
}

/** 카테고리별 개수(폴더 기준). 목록을 모으는 동안 자리 표시 칸 수에 쓴다 */
export function countByCategory(paths: { category: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of paths) m.set(p.category, (m.get(p.category) ?? 0) + 1)
  return m
}
