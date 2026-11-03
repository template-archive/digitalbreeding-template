import { useMemo } from 'react'
import { AlertTriangle, Search, X } from 'lucide-react'
import { Button, Tabs } from '@/design-system'
import { useThemeMode } from '@/design-system/themeMode'
import { templatePaths, type TemplateListState } from './registry'
import { categoryLabel, countByCategory, groupTemplates } from './order'
import { libraryHref, templateHref } from './router'
import { TemplateCard } from './TemplateCard'
import { CATEGORIES, type TemplateCategory } from './types'

type Filter = 'all' | TemplateCategory
const PATHS = templatePaths().filter(path => !path.hidden).map(path => path.path)
const PATH_COUNTS = countByCategory(PATHS)
const GRID = 'grid grid-cols-1 gap-x-6 gap-y-8 @xl:grid-cols-2 @4xl:grid-cols-3 @min-[85rem]:grid-cols-4'

export function Gallery({ list, category, search }: { list: TemplateListState; category: string; search: string }) {
  const filter: Filter = CATEGORIES.includes(category as TemplateCategory) ? category as TemplateCategory : 'all'
  const mode = useThemeMode()
  const loading = list.status === 'loading'
  const needle = search.trim().toLowerCase()
  const matched = useMemo(() => list.visible.filter(template => !needle || [template.meta.title, template.meta.description, template.meta.slug, template.meta.organism ?? '', ...template.meta.tags].join(' ').toLowerCase().includes(needle)), [list.visible, needle])
  const groups = useMemo(() => groupTemplates(matched), [matched])
  const countOf = (value: string) => loading ? PATH_COUNTS.get(value) ?? 0 : groups.find(group => group.category === value)?.items.length ?? 0
  const shownGroups = groups.filter(group => (filter === 'all' || group.category === filter) && group.items.length > 0)
  const shownCount = shownGroups.reduce((total, group) => total + group.items.length, 0)
  const failures = list.failed.filter(failure => !failure.hidden)
  const updateSearch = (value: string) => {
    window.history.replaceState(null, '', libraryHref(filter, value))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  return (
    <div className="@container">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">템플릿 라이브러리</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">필요한 화면을 찾고, 미리보기에서 구성과 동작을 확인하세요.</p>
      </header>
      <section aria-label="템플릿 탐색">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">템플릿 검색</span>
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={search} onChange={event => updateSearch(event.target.value)} placeholder="제목, 태그, 작물로 검색" className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-11 text-sm text-text placeholder:text-muted hover:border-muted" />
            {search && <button type="button" onClick={() => updateSearch('')} aria-label="검색어 지우기" className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-md text-muted hover:text-text"><X size={16} aria-hidden="true" /></button>}
          </label>
          <p role="status" className="text-[13px] tabular-nums text-muted">{loading ? '템플릿 불러오는 중…' : `${shownCount}개 템플릿`}</p>
        </div>
        <label className="mt-5 flex flex-col gap-2 text-[13px] text-muted sm:hidden">
          카테고리
          <select value={filter} onChange={event => { window.location.hash = libraryHref(event.target.value, search) }} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text">
            <option value="all">전체 {loading ? PATHS.length : matched.length}</option>
            {CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value)} {countOf(value)}</option>)}
          </select>
        </label>
        <Tabs<Filter>
          items={[{ id: 'all', label: `전체 ${loading ? PATHS.length : matched.length}` }, ...CATEGORIES.map(value => ({ id: value, label: `${categoryLabel(value)} ${countOf(value)}` }))]}
          value={filter}
          onChange={value => { window.location.hash = libraryHref(value, search) }}
          ariaLabel="카테고리"
          className="mt-5 gap-6! max-sm:hidden! [&>[role=tab]]:px-0!"
        />
        {failures.length > 0 && (
          <div role="alert" data-template-load-failed="" className="mt-6 rounded-md border border-negative/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-negative"><AlertTriangle size={16} aria-hidden="true" />불러오지 못한 템플릿 {failures.length}개</p>
            <ul className="mt-2 space-y-2">{failures.map(failure => <li key={failure.file}><a href={templateHref(failure.path.category, failure.path.slug)} className="break-all underline underline-offset-4">{failure.file}</a><p className="break-all text-muted">{failure.message}</p></li>)}</ul>
          </div>
        )}
        {loading ? (
          <ul aria-hidden="true" className={`${GRID} mt-8`}>{Array.from({ length: 6 }, (_, index) => <li key={index}><div className="aspect-[16/10] rounded-md bg-surface-2" /><div className="mt-4 h-4 w-2/3 rounded-sm bg-active" /></li>)}</ul>
        ) : shownCount === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center">
            <h2 className="text-base font-semibold text-text">{list.visible.length === 0 ? '아직 등록된 템플릿이 없습니다' : '조건에 맞는 템플릿이 없습니다'}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted">{list.visible.length === 0 ? '템플릿을 등록하면 이곳에서 확인할 수 있습니다.' : '검색어를 바꾸거나 카테고리를 전체로 변경해 보세요.'}</p>
            {(search || filter !== 'all') && <Button onClick={() => { window.location.hash = libraryHref() }}>필터 초기화</Button>}
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {shownGroups.map(group => (
              <section key={group.category} aria-label={group.label}>
                {filter === 'all' && <h2 className="mb-4 text-base font-semibold text-text">{group.label}<span className="ml-2 text-[13px] font-normal tabular-nums text-muted">{group.items.length}</span></h2>}
                <ul className={GRID}>{group.items.map(template => <TemplateCard key={template.path.slug} template={template} mode={mode} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </section>
      <p className="mt-12 border-t border-border pt-5 text-[13px] text-muted">미리보기의 데이터는 목업입니다. 실제 데이터 연결 방법은 각 템플릿의 README에서 확인하세요.</p>
    </div>
  )
}
