import { useState } from 'react'
import { AlertTriangle, Ban, CircleCheck, CircleDot, Loader2 } from 'lucide-react'
import { SaveBar as SaveBarShell, cn } from '@/design-system'

export type SaveState = 'unsaved' | 'saving' | 'saved' | 'conflict'

interface Props {
  state: SaveState
  dirtyCount: number
  conflictCount: number
  savedAt: string
  draftNote: string | null
  blockReason: string | null
  canSave: boolean
  onSave: () => void
  onRevert: () => void
  /** 상태 막대 아래 보조 메시지(읽기 전용 열 안내 등) */
  message: string
  /** 저장을 막는 오류 칸 수(QA 상태 검증 선택자 data-error-count) */
  errorCount?: number
}

const ICON_TONE: Record<SaveState, string> = {
  unsaved: 'text-warning',
  saving: 'text-info',
  saved: 'text-positive',
  conflict: 'text-negative',
}

/**
 * B. 저장 상태 막대 — 바 틀·버튼은 공통 SaveBar. 연속 입력 격자는 responsive(md 이상 위쪽 고정, md 미만 화면 아래 고정),
 * 결정·편집 화면은 bottom을 쓴다(업무 화면 그룹 규칙, 검토 P5: 입력 내내 저장 상태가 보여야 한다).
 * md 미만은 「미저장 n칸 · 오류 n칸」 한 줄 + 버튼으로 접고 나머지 상태는 「자세히」로 펼친다(검토 P4: 3줄이면 화면의 15%를 차지했다).
 */
export function SaveBar({ state, dirtyCount, conflictCount, savedAt, draftNote, blockReason, canSave, onSave, onRevert, message, errorCount = 0 }: Props) {
  const [more, setMore] = useState(false)
  const Icon = state === 'saving' ? Loader2 : state === 'saved' ? CircleCheck : state === 'conflict' ? AlertTriangle : CircleDot
  const label =
    state === 'saving'
      ? '저장 중…'
      : state === 'saved'
        ? `저장됨 · ${savedAt}`
        : state === 'conflict'
          ? `충돌 ${conflictCount}칸`
          : `미저장 ${dirtyCount}칸`
  const extra = state === 'conflict' && dirtyCount > 0 ? ` · 미저장 ${dirtyCount}칸` : ''
  // 좁은 화면에서 접히는 보조 상태
  const fold = !more && 'max-md:hidden'
  const hasMore = !!(draftNote || blockReason || message)

  return (
    <SaveBarShell
      placement="responsive"
      dirty={dirtyCount}
      saving={state === 'saving'}
      canSave={canSave}
      onSave={onSave}
      onRevert={onRevert}
      blockReasonId={blockReason ? 'pe-save-reason' : undefined}
      saveSpinner={false}
      shortcut={{ aria: 'Control+S', label: 'Ctrl+S' }}
      saveButtonProps={{ 'data-action': 'save' }}
    >
      <span
        role="status"
        aria-live="polite"
        aria-busy={state === 'saving'}
        data-save-state={state}
        data-error-count={errorCount}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text tabular-nums"
      >
        <Icon size={15} aria-hidden="true" className={`${ICON_TONE[state]} ${state === 'saving' ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        {label}
        {extra}
        {errorCount > 0 && <span className="text-negative md:hidden">· 오류 {errorCount}칸</span>}
      </span>
      {hasMore && (
        <button type="button" aria-expanded={more} onClick={() => setMore(v => !v)} className="touch-hit-y text-xs font-medium text-muted underline underline-offset-2 md:hidden">
          {more ? '접기' : '자세히'}
        </button>
      )}
      <span className={cn('text-xs text-muted tabular-nums', fold)}>마지막 저장 {savedAt}</span>
      {draftNote && <span className={cn('text-xs text-muted', fold)}>{draftNote}</span>}
      {blockReason && (
        <span id="pe-save-reason" className={cn('inline-flex items-center gap-1 text-xs font-medium text-negative', fold)}>
          <Ban size={12} aria-hidden="true" className="shrink-0" />
          {blockReason}
        </span>
      )}
      {message && (
        <span className={cn('text-xs text-muted', fold)} aria-live="polite">
          {message}
        </span>
      )}
    </SaveBarShell>
  )
}
