import { LABELS, type Thread } from './model.ts'
export type ReviewFilter = 'open' | 'resolved' | 'all'
export type SeenThreads = Record<string, string>
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

export function threadFromHash(hash: string, templateKey: string): string | null {
  const [pathname, query] = hash.replace(/^#/, '').split('?')
  try {
    if (decodeURIComponent(pathname.replace(/\/$/, '')) !== '/t/' + templateKey) return null
    const id = new URLSearchParams(query).get('comment')
    return id && UUID.test(id) ? id.toLowerCase() : null
  } catch { return null }
}
export function threadUrl(base: string, templateKey: string, id: string) {
  if (!UUID.test(id)) throw new Error('코멘트 링크를 만들 수 없습니다.')
  const parts = templateKey.split('/')
  if (parts.length !== 2 || parts.some(part => !part)) throw new Error('템플릿 경로가 올바르지 않습니다.')
  const url = new URL(base)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('페이지 주소를 확인해 주세요.')
  const theme = url.searchParams.get('theme')
  url.search = ''
  url.username = ''; url.password = ''
  if (theme === 'light' || theme === 'dark') url.searchParams.set('theme', theme)
  url.hash = '/t/' + parts.map(encodeURIComponent).join('/') + '?comment=' + id.toLowerCase()
  return url.toString()
}
export function filterThreads(threads: Thread[], filter: ReviewFilter, query: string) {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return threads.filter(thread => {
    if (filter === 'open' && thread.resolved || filter === 'resolved' && !thread.resolved) return false
    const text = [String(thread.number), '#' + thread.number, LABELS[thread.label], thread.anchor.quote, ...thread.messages.flatMap(m => [m.author, m.body])].join(' ').normalize('NFKC').toLocaleLowerCase()
    return words.every(word => text.includes(word))
  })
}
export function isUnread(thread: Thread, actorId: string | null, seen: SeenThreads) {
  const last = thread.messages[thread.messages.length - 1]
  return !!actorId && !!last && last.authorId !== actorId && seen[thread.id] !== last.id
}
export function startsComment(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing: boolean }, editable: boolean) {
  return event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.isComposing && !editable
}
