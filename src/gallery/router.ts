import { useSyncExternalStore } from 'react'

export type Route = { name: 'home' } | { name: 'list'; category: string; search: string } | { name: 'template'; category: string; slug: string } | { name: 'notfound'; hash: string }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/'
  if (h === '/' || h === '') return { name: 'home' }
  const [pathname, queryString] = h.split('?')
  if (pathname === '/library' || pathname === '/library/') {
    const params = new URLSearchParams(queryString)
    return { name: 'list', category: params.get('category') ?? 'all', search: params.get('q') ?? '' }
  }
  const m = pathname.match(/^\/t\/([^/]+)\/([^/?#]+)\/?$/)
  if (m) {
    try {
      return { name: 'template', category: decodeURIComponent(m[1]!), slug: decodeURIComponent(m[2]!) }
    } catch {
      return { name: 'notfound', hash: h }
    }
  }
  return { name: 'notfound', hash: h }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '')
}

export function templateHref(category: string, slug: string) {
  return `#/t/${category}/${slug}`
}

export function libraryHref(category = 'all', search = '') {
  const params = new URLSearchParams()
  if (category !== 'all') params.set('category', category)
  if (search) params.set('q', search)
  return `#/library${params.size ? `?${params}` : ''}`
}

/** 쿼리 파라미터(?embed=1, ?theme=) */
export const query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
export const isEmbed = query.get('embed') === '1'
