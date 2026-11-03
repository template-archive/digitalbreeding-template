/**
 * 템플릿 자동 등록: src/templates/{category}/{slug}/index.tsx
 *
 * 템플릿 모듈은 지연 로드한다(import.meta.glob lazy). 템플릿 하나의 import·평가 오류가
 * 갤러리 전체나 다른 템플릿 화면으로 번지지 않게 하기 위해서다.
 * - slug 존재 여부: glob 키(파일 경로)로 동기 판단 → hasTemplate()
 * - 상세 화면: 해당 모듈만 로드 → loadTemplate()
 * - 목록·사이드바: 모듈을 개별로 로드해 allSettled로 모음 → loadTemplateList() / useTemplateList()
 */
import { useEffect, useState, type ComponentType } from 'react'
import type { TemplateCategory, TemplateMeta } from './types'

interface TemplateModule {
  meta?: TemplateMeta
  default?: ComponentType
}

export interface TemplatePath {
  category: string
  slug: string
}

export interface TemplateEntry {
  meta: TemplateMeta
  Component: ComponentType
  /** 폴더 경로 기준 category/slug */
  path: TemplatePath
  /** 내부 검증용(_ 접두) — 목록에서 숨김 */
  hidden: boolean
  /** meta와 폴더 불일치 등 등록 경고 */
  warnings: string[]
}

/** 모듈 로드(import·평가)에 실패한 템플릿 */
export interface FailedTemplate {
  path: TemplatePath
  /** 예: src/templates/kpi/_starter/index.tsx */
  file: string
  hidden: boolean
  /** 원래 오류 메시지(경로 제외 — 목록은 file을 따로 보인다) */
  message: string
}

export interface TemplateList {
  /** title 정렬, 숨김 포함 */
  templates: TemplateEntry[]
  /** 목록에 보일 템플릿(_ 접두 제외) */
  visible: TemplateEntry[]
  /** 로드 실패(숨김 포함, 폴더 경로 정렬) */
  failed: FailedTemplate[]
}

const loaders = import.meta.glob<TemplateModule>('../templates/*/*/index.tsx')

interface Source {
  key: string
  file: string
  path: TemplatePath
  hidden: boolean
  load: () => Promise<TemplateModule>
}

const sources = new Map<string, Source>()
for (const [glob, load] of Object.entries(loaders)) {
  const m = glob.match(/\.\.\/templates\/([^/]+)\/([^/]+)\/index\.tsx$/)
  if (!m) continue
  const category = m[1]!
  const slug = m[2]!
  const key = `${category}/${slug}`
  sources.set(key, { key, file: `src/templates/${key}/index.tsx`, path: { category, slug }, hidden: slug.startsWith('_'), load })
}

/** URL의 category/slug(폴더 기준)에 해당하는 템플릿 폴더가 있는지 동기 판단한다. 숨김 템플릿도 포함. */
export function hasTemplate(category: string, slug: string): boolean {
  return sources.has(`${category}/${slug}`)
}

/**
 * 템플릿 폴더 목록(glob 키로 동기 판단, 모듈은 로드하지 않음). 숨김 템플릿 포함.
 * 목록을 모으는 동안 자리 표시(카테고리별 칸 수)를 실제 배치와 같게 그리는 데 쓴다.
 */
export function templatePaths(): { path: TemplatePath; hidden: boolean }[] {
  return [...sources.values()].map(s => ({ path: s.path, hidden: s.hidden }))
}

/** 템플릿 모듈 파일 경로(오류 메시지용) */
export function templateFile(category: string, slug: string): string {
  return `src/templates/${category}/${slug}/index.tsx`
}

function toEntry(src: Source, mod: TemplateModule): TemplateEntry {
  const { category, slug } = src.path
  const warnings: string[] = []
  if (!mod.default) warnings.push('default export 없음')
  if (!mod.meta) warnings.push('meta export 없음')
  if (mod.meta && mod.meta.slug !== slug) warnings.push(`meta.slug(${mod.meta.slug}) ≠ 폴더(${slug})`)
  if (mod.meta && mod.meta.category !== category) warnings.push(`meta.category(${mod.meta.category}) ≠ 폴더(${category})`)
  if (warnings.length) console.warn(`[gallery] ${category}/${slug}: ${warnings.join(', ')}`)
  const meta: TemplateMeta = mod.meta ?? {
    slug,
    category: category as TemplateCategory,
    title: slug,
    description: '',
    tags: [],
    status: 'draft',
  }
  return { meta, Component: mod.default ?? (() => null), path: src.path, hidden: src.hidden, warnings }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  return String(e)
}

/** 템플릿 모듈 로드 실패. message에는 모듈 경로가 들어간다(오류 화면 계약). reason은 원래 오류 메시지. */
export class TemplateLoadError extends Error {
  constructor(
    readonly file: string,
    readonly reason: string,
  ) {
    super(`${file} 모듈을 불러오지 못했습니다: ${reason}`)
    this.name = 'TemplateLoadError'
  }
}

const cache = new Map<string, Promise<TemplateEntry>>()

/**
 * 템플릿 모듈 하나를 로드한다. 실패하면 모듈 경로를 포함한 Error로 reject한다.
 * 성공 결과만 캐시한다(실패는 다음 호출에서 다시 시도 — 작성 중인 템플릿을 고친 뒤 새로고침 없이 재시도 가능).
 */
export function loadTemplate(category: string, slug: string): Promise<TemplateEntry> {
  const key = `${category}/${slug}`
  const src = sources.get(key)
  if (!src) return Promise.reject(new TemplateLoadError(templateFile(category, slug), '템플릿 폴더 없음'))
  let p = cache.get(key)
  if (!p) {
    p = src.load().then(
      mod => toEntry(src, mod),
      e => {
        cache.delete(key)
        throw new TemplateLoadError(src.file, errorMessage(e))
      },
    )
    cache.set(key, p)
  }
  return p
}

let listPromise: Promise<TemplateList> | null = null

/** 모든 템플릿 모듈을 개별로 로드해 성공·실패를 나눠 모은다(allSettled). 한 모듈의 실패가 나머지를 막지 않는다. */
export function loadTemplateList(): Promise<TemplateList> {
  if (!listPromise) {
    const all = [...sources.values()]
    listPromise = Promise.allSettled(all.map(s => loadTemplate(s.path.category, s.path.slug))).then(results => {
      const templates: TemplateEntry[] = []
      const failed: FailedTemplate[] = []
      results.forEach((r, i) => {
        const s = all[i]!
        if (r.status === 'fulfilled') templates.push(r.value)
        else {
          const reason = r.reason instanceof TemplateLoadError ? r.reason.reason : errorMessage(r.reason)
          failed.push({ path: s.path, file: s.file, hidden: s.hidden, message: reason })
          console.warn(`[gallery] ${s.file} 로드 실패: ${reason}`)
        }
      })
      templates.sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'ko'))
      failed.sort((a, b) => a.file.localeCompare(b.file))
      // 실패가 있으면 목록 결과를 캐시하지 않는다(다음 마운트에서 실패한 모듈만 다시 시도, 성공 모듈은 loadTemplate 캐시 사용).
      if (failed.length) listPromise = null
      return { templates, visible: templates.filter(t => !t.hidden), failed }
    })
  }
  return listPromise
}

export type TemplateListState = { status: 'loading' | 'ready' } & TemplateList

const EMPTY: TemplateList = { templates: [], visible: [], failed: [] }

/** 목록·사이드바용 훅. 첫 렌더는 status 'loading'(빈 목록). enabled=false면 로드하지 않는다(임베드 모드). */
export function useTemplateList(enabled = true): TemplateListState {
  const [state, setState] = useState<TemplateListState>({ status: 'loading', ...EMPTY })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadTemplateList().then(list => {
      if (alive) setState({ status: 'ready', ...list })
    })
    return () => {
      alive = false
    }
  }, [enabled])
  return state
}
