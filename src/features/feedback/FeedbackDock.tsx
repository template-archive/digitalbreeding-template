import type { RefObject } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, MapPin, MessageSquare, PanelLeft, PanelRight, X } from 'lucide-react'
import type { FeedbackDockSide } from './preferences'

interface Props {
  active: boolean
  panel: boolean
  picking: boolean
  visible: boolean
  connected: boolean
  canCreate: boolean
  busy: boolean
  loaded: boolean
  openCount: number
  unreadCount: number
  side: FeedbackDockSide
  toggleRef: RefObject<HTMLButtonElement>
  onWake: () => void
  onInbox: () => void
  onPick: () => void
  onPins: () => void
  onSide: () => void
  onSleep: () => void
  onCancel: () => void
}
export function FeedbackDock(p: Props) {
  return <div className="fb-dock-stack" data-dock={p.side} data-print-hide="">
    {p.picking && <div className="fb-mode-hint" role="status"><MapPin size={16} aria-hidden="true" /><span>코멘트를 남길 부분을 클릭하세요.</span><button className="fb-icon" type="button" onClick={p.onCancel} aria-label="위치 선택 취소" title="취소 (Esc)"><X size={16} aria-hidden="true" /></button></div>}
    {!p.active ? <button ref={p.toggleRef} type="button" className="fb-launcher" onClick={p.onWake} aria-expanded={false} title="피드백 도구 열기 · C로 위치 코멘트">
      <MessageSquare size={17} aria-hidden="true" /><span>피드백</span>{p.loaded && <span className="fb-count">{p.openCount}</span>}{p.unreadCount > 0 && <span className="fb-new-count">새 {p.unreadCount}</span>}<ChevronUp size={14} aria-hidden="true" />
    </button> : <div className="fb-dock" role="group" aria-label="템플릿 피드백 도구">
      <button ref={p.toggleRef} type="button" className="fb-dock-inbox" aria-label={'코멘트 보관함, 미해결 ' + p.openCount + '개, 새 코멘트 ' + p.unreadCount + '개'} disabled={p.busy} aria-expanded={p.panel} aria-pressed={p.panel} onClick={p.onInbox} title="현재 템플릿 코멘트 보관함"><MessageSquare size={17} aria-hidden="true" /><span>코멘트</span><span className="fb-count">{p.loaded ? p.openCount : '…'}</span>{p.unreadCount > 0 && <span className="fb-new-count">새 {p.unreadCount}</span>}</button>
      <span className="fb-dock-divider" aria-hidden="true" />
      <button type="button" className="fb-icon" onClick={p.onPick} aria-label="위치에 코멘트" aria-pressed={p.picking} aria-keyshortcuts="C" title="위치에 코멘트 (C)" disabled={p.busy || (p.loaded && !p.canCreate)}><MapPin size={18} aria-hidden="true" /></button>
      <button type="button" className="fb-icon" onClick={p.onPins} aria-label={p.visible ? '코멘트 핀 숨기기' : '코멘트 핀 표시'} aria-pressed={p.visible} title={p.visible ? '코멘트 핀 숨기기' : '코멘트 핀 표시'}>{p.visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}</button>
      <button type="button" className="fb-icon" onClick={p.onSide} aria-label={p.side === 'right' ? '피드백 도구를 왼쪽으로 이동' : '피드백 도구를 오른쪽으로 이동'} title="도구와 보관함의 좌우 위치 변경">{p.side === 'right' ? <PanelLeft size={18} aria-hidden="true" /> : <PanelRight size={18} aria-hidden="true" />}</button>
      <button type="button" className="fb-icon" onClick={p.onSleep} disabled={p.busy} aria-label="피드백 도구 접기" title="도구 접기"><ChevronDown size={18} aria-hidden="true" /></button>
    </div>}
  </div>
}
