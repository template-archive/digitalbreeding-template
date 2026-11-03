import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, MapPin, MessageSquare, Search, Send, Tag, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { createAnchor, locateAnchor } from './anchors'
import { LABELS, MAX_BODY, type Anchor, type FeedbackData, type FeedbackLabel, type Identity, type Thread } from './model'
import { displayName, loadSharedFeedback, rememberName, sendFeedback } from './client'
import type { FeedbackAction, FeedbackSnapshot } from './protocol'
import { FeedbackDock } from './FeedbackDock'
import { filterThreads, isUnread, startsComment, threadFromHash, threadUrl, type ReviewFilter } from './review'
import { readDock, readSeen, saveDock, saveSeen } from './preferences'
import './feedback.css'

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return '브라우저 저장 공간이 부족합니다. 작성 내용을 복사한 뒤 저장 공간을 확보해 주세요.'
  if (error instanceof DOMException && error.name === 'SecurityError') return '브라우저가 저장을 차단했습니다. 사이트의 저장 권한을 확인해 주세요.'
  return error instanceof Error ? error.message : '저장하지 못했습니다. 작성 내용을 복사한 뒤 다시 시도해 주세요.'
}
type Rect = { left: number; top: number; width: number; height: number }
type Position = { x: number; y: number; rect: Rect }
function getPanelDocument() {
  // Width previews scroll inside a sticky iframe. Keep review controls in the outer viewport.
  try {
    const frame = window.frameElement
    if (frame?.hasAttribute('data-template-preview')) return frame.ownerDocument
  } catch { /* Standalone or cross-origin embeds keep their own panel. */ }
  return document
}
const initialData: FeedbackData = { version: 1, nextNumber: 1, threads: [] }
const date = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Shared gallery wrapper: template code and starter downloads remain independent of review tools. */
export function FeedbackOverlay({ templateKey, templateTitle = '현재 템플릿', children }: { templateKey: string; templateTitle?: string; children: ReactNode }) {
  const hostDocument = getPanelDocument()
  const hostWindow = hostDocument.defaultView || window
  const [requestedId, setRequestedId] = useState(() => threadFromHash(hostWindow.location.hash, templateKey))
  const [active, setActive] = useState(() => !!threadFromHash(hostWindow.location.hash, templateKey))
  const [side, setSide] = useState(readDock)
  const [search, setSearch] = useState('')
  const [seen, setSeen] = useState(() => readSeen(templateKey))
  const seenRef = useRef(seen)
  const [hoverRect, setHoverRect] = useState<Rect | null>(null)
  const hoverFrame = useRef(0)
  const [linkNotice, setLinkNotice] = useState('')
  const [manualLink, setManualLink] = useState('')
  const [copied, setCopied] = useState(false)
  const manualLinkRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<FeedbackData>(initialData)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(active)
  const [panel, setPanel] = useState(active)
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [body, setBody] = useState('')
  const [name, setName] = useState(displayName)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const revision = useRef(-1)
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null)
  const [label, setLabel] = useState<FeedbackLabel>('fix')
  const [filter, setFilter] = useState<ReviewFilter>('open')
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [notice, setNotice] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const nameId = useId()
  const labelId = useId()
  const selected = data.threads.find(t => t.id === selectedId)
  const openCount = data.threads.filter(t => !t.resolved).length
  const shown = useMemo(() => filterThreads(data.threads, filter, search), [data.threads, filter, search])
  const unreadCount = data.threads.filter(t => isUnread(t, identity?.id ?? null, seen)).length
  const selectedIndex = shown.findIndex(t => t.id === selectedId)
  const markRead = useCallback((thread: Thread) => {
    if (hostDocument.visibilityState !== 'visible' || hostDocument.querySelector('dialog[open]')) return
    const last = thread.messages[thread.messages.length - 1]
    if (!last || seenRef.current[thread.id] === last.id) return
    const next = { ...seenRef.current, [thread.id]: last.id }
    seenRef.current = next; setSeen(next); saveSeen(templateKey, next)
  }, [templateKey, hostDocument])
  const replaceThreadLink = useCallback((id: string | null) => {
    const url = new URL(hostWindow.location.href)
    const [path, query] = url.hash.slice(1).split('?')
    try { if (decodeURIComponent(path.replace(/\/$/, '')) !== '/t/' + templateKey) return } catch { return }
    const params = new URLSearchParams(query)
    if (id) params.set('comment', id); else params.delete('comment')
    url.hash = path + (params.size ? '?' + params.toString() : '')
    hostWindow.history.replaceState(hostWindow.history.state, '', url)
  }, [hostWindow, templateKey])
  const canCreate = connected && !busy && identity !== null && data.threads.length < 500
  const accept = useCallback((snapshot: FeedbackSnapshot) => {
    if (!alive.current) return
    if (snapshot.revision >= revision.current) {
      revision.current = snapshot.revision
      setData(snapshot.data)
    }
    setIdentity(previous => ({ id: snapshot.actorId, name: previous?.name ?? displayName() }))
    setConnected(true); setError('')
  }, [])
  const reload = useCallback(async () => {
    if (busyRef.current) return
    try { accept(await loadSharedFeedback(templateKey)) }
    catch (e) { if (alive.current) { setConnected(false); setError(errorMessage(e)) } }
  }, [templateKey, accept])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (!active) return
    void reload()
    const focus = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    const timer = window.setInterval(focus, 15000)
    return () => {
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      window.clearInterval(timer)
    }
  }, [active, reload])
  async function mutate(action: FeedbackAction) {
    if (busyRef.current) return null
    busyRef.current = true; setBusy(true)
    try {
      const snapshot = await sendFeedback(templateKey, action)
      accept(snapshot)
      return snapshot
    } catch (e) { if (alive.current) setError(errorMessage(e)); return null }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  const discard = useCallback(() => !busyRef.current && (!body.trim() || window.confirm('작성 중인 코멘트를 버릴까요?')), [body])
  const close = useCallback(() => {
    if (!discard()) return
    setPanel(false); setPicking(false); setAnchor(null); setBody(''); setDeleteArmed(false); setSelectedId(null)
    setRequestedId(null); setManualLink(''); replaceThreadLink(null)
    toggle.current?.focus()
  }, [discard, replaceThreadLink])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modalOwnsKey = event.composedPath().some(node => {
        const element = node as HTMLElement
        return element.tagName === 'DIALOG' || element.getAttribute?.('aria-modal') === 'true'
      })
      if (modalOwnsKey) return
      const editable = event.composedPath().some(node => {
        const element = node as HTMLElement
        return /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName || '') || element.isContentEditable || element.getAttribute?.('role') === 'textbox'
      })
      if (startsComment(event, editable) && !busyRef.current) { event.preventDefault(); beginPicking(); return }
      if (event.key === 'Escape' && (panel || picking)) { event.preventDefault(); close() }
    }
    document.addEventListener('keydown', onKey)
    if (hostDocument !== document) hostDocument.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (hostDocument !== document) hostDocument.removeEventListener('keydown', onKey)
    }
  })
  useEffect(() => {
    const onHash = () => {
      const id = threadFromHash(hostWindow.location.hash, templateKey)
      if (!id) return
      if (!discard()) { replaceThreadLink(selectedId); return }
      setBody(''); setAnchor(null); setSelectedId(null); setRequestedId(id); setActive(true); setVisible(true); setPanel(true)
    }
    hostWindow.addEventListener('hashchange', onHash)
    return () => hostWindow.removeEventListener('hashchange', onHash)
  }, [hostWindow, templateKey, discard, replaceThreadLink, selectedId])
  useEffect(() => {
    if (!requestedId || !active) return
    let canceled = false
    loadSharedFeedback(templateKey).then(snapshot => {
      if (canceled || !alive.current) return
      accept(snapshot)
      const thread = snapshot.data.threads.find(t => t.id === requestedId)
      setRequestedId(null)
      if (thread) { setFilter(thread.resolved ? 'resolved' : 'open'); setSearch(''); select(thread) }
      else setLinkNotice('코멘트를 찾을 수 없습니다. 삭제되었거나 다른 배포 환경의 링크일 수 있습니다.')
    }).catch(e => { if (!canceled && alive.current) setError(errorMessage(e)) })
    return () => { canceled = true }
  }, [requestedId, active, templateKey, accept, connected])
  useEffect(() => { if (panel && selected) markRead(selected) }, [selected, panel, markRead])
  useEffect(() => {
    if (picking) return
    setHoverRect(null)
    if (hoverFrame.current) cancelAnimationFrame(hoverFrame.current)
    hoverFrame.current = 0
  }, [picking])
  useEffect(() => () => { if (hoverFrame.current) cancelAnimationFrame(hoverFrame.current) }, [])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2500)
    return () => window.clearTimeout(timer)
  }, [copied])
  useEffect(() => {
    if (!panel) return
    const frame = requestAnimationFrame(() => {
      if (anchor || selectedId) composer.current?.focus()
      else panelRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [panel, anchor, selectedId, identity?.id])

  useEffect(() => {
    if (!panel) return
    const revealFocusedControl = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      const overlay = panelRef.current
      if (!target?.getBoundingClientRect || !overlay || overlay.contains(target) || target.closest?.('.fb-dock-stack, dialog[open], [role="dialog"][aria-modal="true"]')) return
      const rect = target.getBoundingClientRect(), box = overlay.getBoundingClientRect()
      const frame = target.ownerDocument !== hostDocument ? window.frameElement?.getBoundingClientRect() : null
      const dx = frame?.left ?? 0, dy = frame?.top ?? 0
      const focus = { left: rect.left + dx, right: rect.right + dx, top: rect.top + dy, bottom: rect.bottom + dy, width: rect.width, height: rect.height }
      if (focus.width && focus.height && focus.left >= box.left && focus.right <= box.right && focus.top >= box.top && focus.bottom <= box.bottom) {
        // Keep the draft in component state and reveal the control that received keyboard focus.
        setPanel(false); setPicking(false)
        setNotice('가려진 조작을 볼 수 있도록 패널을 접었습니다. 피드백 도구에서 이어 쓸 수 있습니다.')
      }
    }
    hostDocument.addEventListener('focusin', revealFocusedControl)
    if (hostDocument !== document) document.addEventListener('focusin', revealFocusedControl)
    return () => {
      hostDocument.removeEventListener('focusin', revealFocusedControl)
      if (hostDocument !== document) document.removeEventListener('focusin', revealFocusedControl)
    }
  }, [panel, hostDocument])
  useEffect(() => {
    if (!body.trim()) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [body])

  useEffect(() => {
    const root = content.current
    if (!root || !active || (!visible && !selectedId)) return
    let frame = 0
    const measure = () => {
      frame = 0
      const next: Record<string, Position> = {}
      for (const t of data.threads) {
        const point = locateAnchor(root, t.anchor)
        if (point) {
          const box = point.target.getBoundingClientRect(), outer = root.getBoundingClientRect()
          next[t.id] = { x: point.x, y: point.y, rect: { left: box.left - outer.left, top: box.top - outer.top, width: box.width, height: box.height } }
        }
      }
      setPositions(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const resize = new ResizeObserver(schedule)
    resize.observe(root)
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', schedule, true)
    schedule()
    return () => {
      resize.disconnect(); observer.disconnect()
      window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [data, visible, active, selectedId])

  function beginPicking() {
    if (!discard()) return
    if (data.threads.length >= 500) { setActive(true); setPanel(true); setNotice('템플릿당 최대 500개 코멘트를 저장할 수 있습니다.'); return }
    setActive(true); setBody(''); setAnchor(null); setSelectedId(null); setPanel(false); setVisible(true); setPicking(true); setDeleteArmed(false)
    setRequestedId(null); setLinkNotice(''); setManualLink(''); replaceThreadLink(null)
    setNotice('코멘트를 남길 부분을 클릭해 주세요. Esc로 취소할 수 있습니다.')
  }
  function pick(event: MouseEvent<HTMLDivElement>) {
    if (!picking || !content.current || !(event.target instanceof Element)) return
    event.preventDefault(); event.stopPropagation()
    setAnchor(createAnchor(content.current, event.target, event.clientX, event.clientY))
    setPicking(false); setPanel(true); setSelectedId(null); setBody('')
    setNotice('위치를 선택했습니다. 코멘트를 입력해 주세요.')
  }
  function select(thread: Thread) {
    if (!discard()) return
    setActive(true); setBody(''); setAnchor(null); setPicking(false); setVisible(true); setPanel(true); setSelectedId(thread.id); setDeleteArmed(false)
    markRead(thread); setRequestedId(null); setLinkNotice(''); setManualLink(''); setCopied(false); replaceThreadLink(thread.id)
    const point = content.current && locateAnchor(content.current, thread.anchor)
    if (point) point.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!identity || !body.trim() || busyRef.current || !connected) return
    const author = rememberName(name)
    setName(author)
    const payload = anchor ? { type: 'create' as const, anchor, label, author, body: body.trim() } : selectedId ? { type: 'reply' as const, threadId: selectedId, author, body: body.trim() } : null
    if (!payload) return
    const fingerprint = JSON.stringify(payload)
    const previousRequest = pendingRequest.current
    const requestId = previousRequest && previousRequest.fingerprint === fingerprint ? previousRequest.id : crypto.randomUUID()
    pendingRequest.current = { fingerprint, id: requestId }
    const result = await mutate({ ...payload, requestId })
    if (!result || !alive.current) return
    if (anchor) { setSelectedId(requestId); setAnchor(null); setFilter('open'); setSearch(''); replaceThreadLink(requestId) }
    pendingRequest.current = null
    setBody(''); setNotice('코멘트를 팀 공유 저장소에 저장했습니다.')
    composer.current?.focus()
  }
  async function changeThread(action: FeedbackAction) {
    if (!connected) return false
    return !!await mutate(action)
  }
  function openInbox() {
    if (!panel && (anchor || selectedId || body.trim())) { setActive(true); setPanel(true); return }
    if (!discard()) return
    if (!active) setVisible(true)
    if (panel && !selected && !anchor) { close(); return }
    setActive(true); setPanel(true); setPicking(false); setSelectedId(null); setAnchor(null); setBody(''); setManualLink(''); setLinkNotice('')
    setRequestedId(null); replaceThreadLink(null)
    if (unreadCount) setFilter('all')
  }
  function sleep() {
    if (!discard()) return
    setActive(false); setPanel(false); setPicking(false); setVisible(false); setSelectedId(null); setAnchor(null); setBody(''); setRequestedId(null); setManualLink(''); setLinkNotice('')
    replaceThreadLink(null)
    requestAnimationFrame(() => toggle.current?.focus())
  }
  function hover(event: PointerEvent<HTMLDivElement>) {
    if (!picking || event.pointerType === 'touch' || !content.current || !(event.target instanceof Element) || hoverFrame.current) return
    const root = content.current, target = event.target, x = event.clientX, y = event.clientY
    hoverFrame.current = requestAnimationFrame(() => {
      hoverFrame.current = 0
      const point = locateAnchor(root, createAnchor(root, target, x, y))
      if (!point) { setHoverRect(null); return }
      const box = point.target.getBoundingClientRect(), outer = root.getBoundingClientRect()
      setHoverRect({ left: box.left - outer.left, top: box.top - outer.top, width: box.width, height: box.height })
    })
  }
  async function copyLink() {
    if (!selected) return
    try {
      const link = threadUrl(hostWindow.location.href, templateKey, selected.id)
      try {
        await hostWindow.navigator.clipboard.writeText(link)
        setCopied(true); setManualLink(''); setNotice('코멘트 링크를 복사했습니다.')
      } catch {
        setManualLink(link)
        requestAnimationFrame(() => { manualLinkRef.current?.focus(); manualLinkRef.current?.select() })
      }
    } catch (e) { setLinkNotice(errorMessage(e)) }
  }
  const form = (isReply: boolean) => (
    <form className="fb-compose" aria-busy={busy} onSubmit={submit}>
      {!isReply && (
        <div className="fb-field"><label htmlFor={labelId}>라벨</label>
          <select disabled={busy} id={labelId} value={label} onChange={e => setLabel(e.target.value as FeedbackLabel)}>
            {Object.entries(LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </div>
      )}
      <div className="fb-field"><label htmlFor={nameId}>표시 이름 <span className="fb-muted">(선택)</span></label>
        <input disabled={busy} id={nameId} value={name} maxLength={30} autoComplete="nickname" onChange={e => setName(e.target.value)} />
      </div>
      <div className="fb-field"><label htmlFor={bodyId}>{isReply ? '답글' : '코멘트'}</label>
        <textarea disabled={busy} ref={composer} id={bodyId} value={body} maxLength={MAX_BODY} rows={4} required placeholder={isReply ? '의견을 이어서 남겨 주세요.' : '어떤 부분을 어떻게 바꾸면 좋을까요?'} onChange={e => setBody(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.form?.requestSubmit() }} />
      </div>
      <div className="fb-compose-bottom"><span className="fb-muted">{body.length.toLocaleString()} / 2,000</span>
        <button className="fb-button fb-primary" type="submit" disabled={!connected || !identity || !body.trim() || busy}><Send size={14} aria-hidden="true" />{busy ? '저장 중…' : isReply ? '답글 남기기' : '코멘트 남기기'}</button>
      </div>
    </form>
  )

  return (
    <section className="fb-wrapper" data-feedback-template={templateKey} data-feedback-storage="shared" data-feedback-active={active} data-feedback-connection={!active ? 'sleeping' : connected ? 'ready' : error ? 'error' : 'loading'}>
      <div className="fb-surface" data-feedback-picking={picking || undefined}>
        <div ref={content} onPointerMoveCapture={hover} onPointerLeave={() => setHoverRect(null)} onClickCapture={pick} onPointerDownCapture={e => { if (picking) { e.preventDefault(); e.stopPropagation() } }}>{children}</div>
        {picking && hoverRect && <div className="fb-target-highlight" data-feedback-highlight="hover" style={hoverRect} aria-hidden="true" />}
        {active && visible && selectedId && !picking && positions[selectedId] && <div className="fb-target-highlight fb-target-selected" data-feedback-highlight="selected" style={positions[selectedId].rect} aria-hidden="true" />}
        {active && visible && data.threads.filter(t => filter === 'all' || (filter === 'resolved' ? t.resolved : !t.resolved)).map(thread => {
          const point = positions[thread.id]
          if (!point) return null
          return <button data-print-hide="" data-feedback-pin={thread.number} key={thread.id} type="button" className={'fb-pin' + (selectedId === thread.id ? ' fb-pin-selected' : '') + (thread.resolved ? ' fb-pin-resolved' : '')} style={{ left: point.x, top: point.y }} aria-label={'코멘트 ' + thread.number + ', ' + LABELS[thread.label] + ': ' + thread.messages[0].body.slice(0, 80)} aria-pressed={selectedId === thread.id} onClick={() => select(thread)}>{thread.number}</button>
        })}
      </div>
      {createPortal(<>
        <FeedbackDock active={active} panel={panel} picking={picking} visible={visible} connected={connected} canCreate={canCreate} busy={busy} loaded={!!identity} openCount={openCount} unreadCount={unreadCount} side={side} toggleRef={toggle} onWake={openInbox} onInbox={openInbox} onPick={beginPicking} onPins={() => setVisible(v => !v)} onSide={() => { const next = side === 'right' ? 'left' : 'right'; setSide(next); saveDock(next) }} onSleep={sleep} onCancel={() => { setPicking(false); setPanel(true); toggle.current?.focus() }} />
        <span className="fb-sr-only" role="status" aria-live="polite">{notice}</span>
        {panel && <aside ref={panelRef} tabIndex={-1} className="fb-panel" data-dock={side} data-print-hide="" id={titleId + '-panel'} role="region" aria-labelledby={titleId}>
          <header className="fb-panel-header">
            {(anchor || selected) && <button type="button" className="fb-icon" aria-label="코멘트 목록으로" onClick={() => { if (discard()) { setAnchor(null); setSelectedId(null); setBody(''); setDeleteArmed(false); setManualLink(''); replaceThreadLink(null) } }}><ArrowLeft size={18} aria-hidden="true" /></button>}
            <div className="fb-panel-heading"><h2 id={titleId}>{anchor ? '새 코멘트' : selected ? '코멘트 #' + selected.number : '코멘트 보관함'}</h2><p title={templateTitle}>{templateTitle}</p></div>

            <button type="button" className="fb-icon" aria-label="피드백 패널 닫기" disabled={busy} onClick={close}><X size={18} aria-hidden="true" /></button>
          </header>
            {selected && <div className="fb-thread-nav" role="group" aria-label="코멘트 탐색">
              <span className="fb-nav-caption">{search ? '검색 결과에서 이동' : '현재 목록에서 이동'}</span>
              <button type="button" className="fb-icon" aria-label="이전 코멘트" title="이전 코멘트" disabled={selectedIndex <= 0 || busy} onClick={() => select(shown[selectedIndex - 1])}><ArrowUp size={16} aria-hidden="true" /></button>
              <span className="fb-nav-position">{selectedIndex >= 0 ? (selectedIndex + 1) + '/' + shown.length : '–'}</span>
              <button type="button" className="fb-icon" aria-label="다음 코멘트" title="다음 코멘트" disabled={selectedIndex < 0 || selectedIndex >= shown.length - 1 || busy} onClick={() => select(shown[selectedIndex + 1])}><ArrowDown size={16} aria-hidden="true" /></button>
              <button type="button" className="fb-icon" aria-label="코멘트 링크 복사" title={copied ? '복사했습니다' : '코멘트 링크 복사'} onClick={copyLink}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button>
            </div>}
          <div className="fb-storage-note"><span className="fb-connection-dot" data-connected={connected} aria-hidden="true" /><span>{busy ? '저장 중…' : connected ? '팀과 공유 중' : error ? '연결 확인 필요' : '코멘트 불러오는 중…'}</span><span>로그인 없이 작성</span></div>
          {linkNotice && <div className="fb-location-note fb-link-notice" role="alert">{linkNotice}<button type="button" className="fb-button" onClick={() => { setLinkNotice(''); replaceThreadLink(null); panelRef.current?.focus() }}>목록 확인</button></div>}
          {error && <div className="fb-error" role="alert">{error}<button className="fb-button" type="button" onClick={reload}>다시 읽기</button></div>}
          <div className="fb-panel-body">
            {manualLink && <div className="fb-link-copy"><label htmlFor={titleId + '-link'}>코멘트 링크</label><input ref={manualLinkRef} id={titleId + '-link'} value={manualLink} readOnly onFocus={e => e.currentTarget.select()} /><p>선택한 주소를 복사해 공유해 주세요.</p></div>}
            {!identity ? <p role="status" className="fb-muted">{error ? '연결 후 코멘트를 확인할 수 있습니다.' : '공유 코멘트를 불러오는 중…'}</p> : anchor ? <>
              <div className="fb-context"><MapPin size={14} aria-hidden="true" /><span>{anchor.selector ? (anchor.quote || '선택한 영역') : '페이지 전체'}<small>{anchor.width}px에서 작성</small></span></div>
              {form(false)}
            </> : selected ? <>
              <div className="fb-thread-meta"><Tag size={14} aria-hidden="true" /><select disabled={busy || !connected} aria-label="코멘트 라벨 변경" value={selected.label} onChange={e => { void changeThread({ type: 'label', threadId: selected.id, label: e.target.value as FeedbackLabel }) }}>{Object.entries(LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><span className="fb-muted">{selected.resolved ? '해결됨' : '미해결'}</span></div>
              <p className="fb-context-text">{selected.anchor.selector ? (selected.anchor.quote || '선택한 영역') : '페이지 전체'} · {selected.anchor.width}px</p>
              {selected.anchor.selector && !positions[selected.id] && <p className="fb-location-note">현재 화면에서 위치를 찾을 수 없습니다. 작성 당시의 탭이나 필터를 확인해 주세요.</p>}
              <ol className="fb-messages">{selected.messages.map(message => <li key={message.id}>
                <div className="fb-message-head"><strong>{message.author}</strong><time dateTime={message.createdAt}>{date(message.createdAt)}</time></div>
                <p>{message.body}</p>
              </li>)}</ol>
              <div className="fb-thread-actions">
                <button type="button" className="fb-button" disabled={busy || !connected} onClick={async () => { if (discard()) { setBody(''); if (await changeThread({ type: 'resolve', threadId: selected.id, resolved: !selected.resolved })) setNotice(selected.resolved ? '코멘트를 다시 열었습니다.' : '코멘트를 해결 처리했습니다.') } }}><Check size={14} aria-hidden="true" />{selected.resolved ? '다시 열기' : '해결 처리'}</button>
                {selected.messages[0].authorId === identity?.id && <button type="button" className="fb-button fb-danger" disabled={busy || !connected} onClick={() => setDeleteArmed(!deleteArmed)}>삭제</button>}
              </div>
              {deleteArmed && <div className="fb-delete-confirm"><p>이 코멘트와 답글을 모두 삭제할까요?</p><button className="fb-button" type="button" onClick={() => setDeleteArmed(false)}>취소</button><button className="fb-button fb-danger" disabled={busy || !connected} type="button" onClick={async () => {
                if (!discard() || !selectedId) return
                if (await changeThread({ type: 'delete', threadId: selectedId })) { setSelectedId(null); setBody(''); setDeleteArmed(false); replaceThreadLink(null); setNotice('코멘트를 삭제했습니다.'); panelRef.current?.focus() }
              }}>삭제하기</button></div>}
              {!selected.resolved && selected.messages.length < 100 && form(true)}
            </> : <>
              <div className="fb-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="코멘트 검색" value={search} placeholder="내용 · 작성자 · 라벨 검색" onChange={e => setSearch(e.target.value)} />{search && <button type="button" className="fb-icon" aria-label="검색 초기화" onClick={() => setSearch('')}><X size={14} aria-hidden="true" /></button>}</div>
              <div className="fb-filters" role="group" aria-label="코멘트 상태">
                {([['open', '미해결'], ['resolved', '해결됨'], ['all', '전체']] as const).map(([value, text]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{text} <span>{data.threads.filter(t => value === 'all' || (value === 'resolved' ? t.resolved : !t.resolved)).length}</span></button>)}
              </div>
              <p className="fb-result-count" role="status">현재 템플릿 · {search ? '검색 결과 ' : ''}{shown.length}개 코멘트{unreadCount > 0 ? ' · 새 코멘트 ' + unreadCount + '개' : ''}</p>
              {shown.length ? <ol className="fb-thread-list">{shown.map(thread => <li key={thread.id}><button type="button" onClick={() => select(thread)}>
                <div className="fb-thread-row"><span className="fb-number">#{thread.number}</span>{isUnread(thread, identity?.id ?? null, seen) && <span className="fb-unread">{thread.messages.length > 1 ? '새 답글' : '새 코멘트'}</span>}<span className={'fb-label fb-label-' + thread.label}>{LABELS[thread.label]}</span><span className="fb-muted">{thread.resolved ? '해결됨' : ''}</span></div>
                <p>{thread.messages[0].body}</p><div className="fb-list-context"><MapPin size={11} aria-hidden="true" /><span>{thread.anchor.selector ? thread.anchor.quote || '선택한 영역' : '페이지 전체'} · {thread.anchor.width}px</span></div><div className="fb-list-byline">{thread.messages[0].author} · {date(thread.messages[0].createdAt)}{thread.messages.length > 1 ? ' · 답글 ' + (thread.messages.length - 1) : ''}</div>
              </button></li>)}</ol> : <div className="fb-empty"><MessageSquare size={24} strokeWidth={1.5} aria-hidden="true" /><h3>{search ? '검색 결과가 없습니다' : filter === 'resolved' ? '해결된 코멘트가 없습니다' : '아직 코멘트가 없습니다'}</h3><p>{search ? '검색어나 상태 필터를 바꿔 보세요.' : '화면에서 바꾸고 싶은 부분을 찍어 주세요.'}</p></div>}
              <div className="fb-new-actions"><button type="button" className="fb-button fb-primary" onClick={beginPicking} disabled={!canCreate}><MapPin size={14} aria-hidden="true" />위치 선택하기</button>
                <button type="button" className="fb-button" disabled={!canCreate} onClick={() => { setSelectedId(null); setAnchor({ selector: null, quote: '', x: 0, y: 0, width: Math.round(content.current?.getBoundingClientRect().width ?? 0) }); setBody('') }}>페이지 전체에 코멘트</button>
              </div>
            </>}
          </div>
        </aside>}</>, hostDocument.body)}
    </section>
  )
}
