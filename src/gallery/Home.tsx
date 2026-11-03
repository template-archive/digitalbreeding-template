import { ArrowRight, Moon, Sun } from 'lucide-react'
import { setThemeOverride, useThemeMode } from '@/design-system/themeMode'
import { Logo } from './Shell'
import { UsageQuestions } from './ListSections'
import { categoryLabel, countByCategory } from './order'
import { templatePaths, type TemplateListState } from './registry'
import { libraryHref, templateHref } from './router'
import { THUMB_SIZE, thumbUrl } from './thumbs'
import { CATEGORIES, type TemplateCategory } from './types'

const PURPOSE: Record<TemplateCategory, { title: string; description: string }> = {
  kpi: { title: '프로그램 현황 파악', description: '선발 현황, 유전적 이득, 시험 진행률을 한눈에 확인합니다.' },
  viz: { title: '육종 데이터 분석', description: 'GWAS, 유전체 관계, 다환경 시험 결과를 탐색합니다.' },
  infographic: { title: '결과 정리와 보고', description: '품종 특성과 연구 성과를 보고서와 인쇄물로 정리합니다.' },
  workflow: { title: '포장·분석실 업무', description: '교배 계획부터 표현형 기록, 시료와 종자 관리까지 연결합니다.' },
}

export function Home({ list }: { list: TemplateListState }) {
  const mode = useThemeMode()
  const counts = countByCategory(list.status === 'loading' ? templatePaths().filter(path => !path.hidden).map(path => path.path) : list.visible.map(template => template.path))
  const preview = thumbUrl('viz', 'gwas-manhattan', mode)
  return (
    <div className="min-h-screen bg-surface text-text">
      <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }} className="skip-link">본문으로 건너뛰기</a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
          <Logo />
          <nav aria-label="주 메뉴" className="flex items-center gap-6 text-sm">
            <a href="#/" aria-current="page" className="hidden py-2 font-semibold sm:block">홈</a>
            <a href={libraryHref()} className="py-2 text-muted hover:text-text">라이브러리</a>
            <button type="button" onClick={() => setThemeOverride(mode === 'dark' ? 'light' : 'dark')} aria-label={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text">{mode === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <section aria-labelledby="home-title" className="grid items-center gap-10 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-20">
          <div>
            <h1 id="home-title" className="max-w-xl break-keep text-4xl font-semibold leading-[1.25] tracking-tight sm:text-5xl">육종 연구에 필요한<br />화면을 모았습니다.</h1>
            <p className="mt-6 max-w-md break-keep text-base leading-7 text-muted">지표 대시보드, 유전체 시각화, 보고서, 현장 업무 화면. 필요한 템플릿을 살펴보고 프로젝트에 맞게 가져다 쓰세요.</p>
            <a href={libraryHref()} className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-contrast hover:opacity-90">라이브러리 둘러보기<ArrowRight size={17} aria-hidden="true" /></a>
            <p className="mt-4 text-[13px] text-muted">모든 예제는 목업 데이터로 동작합니다.</p>
          </div>
          <figure className="min-w-0">
            <a href={templateHref('viz', 'gwas-manhattan')} className="block overflow-hidden rounded-md border border-border bg-bg hover:border-muted" aria-label="GWAS 맨해튼 플롯 미리보기 열기">
              {preview ? <img src={preview} alt="염색체별 연관 신호를 보여주는 GWAS 맨해튼 플롯 템플릿" width={THUMB_SIZE.width} height={THUMB_SIZE.height} className="block aspect-[16/10] w-full object-cover object-left-top" /> : <div className="flex aspect-[16/10] items-center justify-center text-sm text-muted">GWAS 맨해튼 플롯 보기</div>}
            </a>
            <figcaption className="mt-3 flex justify-between gap-4 text-[13px] text-muted"><span>GWAS 맨해튼 플롯</span><span>시각화 템플릿 예시</span></figcaption>
          </figure>
        </section>
        <section aria-labelledby="purpose-title" className="border-t border-border py-10 sm:py-12">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 id="purpose-title" className="text-xl font-semibold tracking-tight">어떤 화면이 필요한가요?</h2><a href={libraryHref()} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text">전체 템플릿<ArrowRight size={15} aria-hidden="true" /></a></div>
          <ul className="grid gap-x-12 md:grid-cols-2">
            {CATEGORIES.map(category => <li key={category} className="border-t border-border"><a href={libraryHref(category)} className="group flex min-h-36 items-start justify-between gap-5 py-6"><div><p className="text-[13px] text-muted">{categoryLabel(category)} · {counts.get(category) ?? 0}개</p><h3 className="mt-2 text-lg font-semibold group-hover:underline underline-offset-4">{PURPOSE[category].title}</h3><p className="mt-2 max-w-md break-keep text-sm leading-relaxed text-muted">{PURPOSE[category].description}</p></div><ArrowRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-muted" /></a></li>)}
          </ul>
        </section>
        <div className="border-t border-border py-10 sm:py-12"><UsageQuestions /></div>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-5 py-6 text-[13px] text-muted sm:px-8"><p>디지털육종 템플릿 라이브러리</p><p>사용 전 각 템플릿의 지표 정의와 데이터 구조를 확인하세요.</p></div></footer>
    </div>
  )
}
