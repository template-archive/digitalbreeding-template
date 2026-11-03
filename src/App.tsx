import { useEffect, useRef } from 'react'
import { Gallery } from '@/gallery/Gallery'
import { Home } from '@/gallery/Home'
import { TemplateView } from '@/gallery/TemplateView'
import { TemplatePage } from '@/gallery/TemplatePage'
import { MobileBar, Sidebar } from '@/gallery/Shell'
import { hasTemplate, loadTemplate, useTemplateList } from '@/gallery/registry'
import { isEmbed, parseHash, useHash } from '@/gallery/router'

/** 목록·찾을 수 없음 캔버스: 사이드바 오른쪽 영역, 좌우 16/24/32px, 내용은 최대 1600px로 영역 가운데 */
const CANVAS = 'min-w-0 flex-1 px-4 pb-12 pt-6 md:px-6 lg:px-8'
const CANVAS_INNER = 'mx-auto w-full max-w-[1600px]'

export default function App() {
  const hash = useHash()
  const route = parseHash(hash)
  const routeCategory = route.name === 'template' ? route.category : ''
  const routeSlug = route.name === 'template' ? route.slug : ''
  // 사이드바·목록이 함께 쓰는 템플릿 목록. 임베드 모드는 목록을 로드하지 않는다.
  const list = useTemplateList(!isEmbed)

  useEffect(() => {
    if (!routeSlug) {
      document.title = route.name === 'home' ? '디지털육종 템플릿' : route.name === 'notfound' ? '페이지 없음 · 디지털육종 템플릿' : '라이브러리 · 디지털육종 템플릿'
      return
    }
    if (!hasTemplate(routeCategory, routeSlug)) {
      document.title = '템플릿 없음 · 디지털육종 템플릿'
      return
    }
    let alive = true
    loadTemplate(routeCategory, routeSlug).then(
      t => alive && (document.title = `${t.meta.title} · 디지털육종 템플릿`),
      () => alive && (document.title = `로드 실패 · 디지털육종 템플릿`),
    )
    return () => {
      alive = false
    }
  }, [route.name, routeCategory, routeSlug])

  // 다른 화면으로 가면 맨 위에서 시작한다(해시 라우팅은 브라우저가 스크롤을 옮기지 않는다)
  const prevHash = useRef(hash)
  useEffect(() => {
    if (prevHash.current === hash) return
    const previousPath = prevHash.current.split('?')[0]
    prevHash.current = hash
    if (previousPath !== hash.split('?')[0]) {
      window.scrollTo(0, 0)
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [hash])

  // 임베드: 템플릿만, 여백 24px
  if (isEmbed) {
    return (
      <main data-print-flat="" className="min-h-screen bg-bg p-6">
        {route.name === 'template' ? (
          <TemplateView category={route.category} slug={route.slug} />
        ) : (
          <div data-template-missing={route.name === 'notfound' ? route.hash : ''} className="text-sm text-muted">
            임베드 모드에는 /#/t/{'{category}'}/{'{slug}'} 경로가 필요합니다.
          </div>
        )}
      </main>
    )
  }

  const nav = {
    list,
    activeKey: route.name === 'template' ? `${route.category}/${route.slug}` : null,
    listActive: route.name === 'list',
    homeActive: route.name === 'home',
    category: route.name === 'list' ? route.category : routeCategory,
  }

  if (route.name === 'home') return <Home list={list} />

  return (
    <div data-print-flat="" className="min-h-screen bg-bg lg:flex">
      <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }} className="skip-link">본문으로 건너뛰기</a>
      <MobileBar {...nav} />
      <Sidebar {...nav} />
      {route.name === 'list' && (
        <main id="main-content" tabIndex={-1} data-print-flat="" className={CANVAS}>
          <div className={CANVAS_INNER}>
            <Gallery list={list} category={route.category} search={route.search} />
          </div>
        </main>
      )}
      {route.name === 'template' && <TemplatePage category={route.category} slug={route.slug} list={list} />}
      {route.name === 'notfound' && (
        <main id="main-content" tabIndex={-1} data-template-missing={route.hash} className={CANVAS}>
          <div className={CANVAS_INNER}>
            <h1 className="text-2xl font-bold tracking-tight text-text">페이지를 찾을 수 없습니다.</h1>
            <p className="mt-1 text-sm text-muted">
              <code className="font-mono">#{route.hash}</code> 경로에 해당하는 화면이 없습니다.
            </p>
            <a href="#/library" className="mt-4 inline-block text-sm font-semibold text-text underline underline-offset-4">
              목록으로 돌아가기
            </a>
          </div>
        </main>
      )}
    </div>
  )
}
