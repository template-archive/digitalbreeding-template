import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { BottomSheet, Button, SaveBar, useMediaQuery } from '@/design-system'

export interface BarAction {
  id: string
  label: string
  icon?: ReactNode
  /** null이면 실행 가능, 문자열이면 불가 이유 */
  disabledReason: string | null
  onClick: () => void
}

/**
 * 일괄 작업 바(공통 SaveBar 문법): 왼쪽 선택 요약·막는 이유 → 선택 해제·보조 동작 → 오른쪽 주 동작. 선택이 있을 때 화면 아래에 붙는다.
 * actions는 지금 선택에 해당하는 동작만 우선순위대로 받는다. 할 수 있는 첫 동작이 주 동작이고, 할 수 없는 동작은 버튼을 늘어놓는 대신 첫 이유를 문구로 보인다
 * (검토 S2: 비활성 사유가 hover 툴팁뿐이라 터치에서 알 수 없었고, 390px에서 버튼 4개가 2줄로 감겼다).
 * 일괄 작업은 되돌리기 전까지 상태가 바뀌는 확정이라 주 동작은 ConfirmDialog(기존 확인 절차)를 연다.
 */
export function ActionBar({
  summary,
  actions,
  onClear,
  saving,
  selection,
}: {
  summary: ReactNode
  actions: BarAction[]
  onClear: () => void
  saving: boolean
  /** 선택 개수(QA 상태 검증 선택자 data-sel-*) */
  selection?: { plates: number; groups: number; wells: number }
}) {
  const reasonId = useId()
  const ready = actions.filter(a => a.disabledReason === null)
  const primary = ready[0] ?? actions[0]
  const blocked = actions.find(a => a.disabledReason !== null)
  const stop = ready.length === 0
  return (
    <div
      role="region"
      aria-label="일괄 작업"
      data-sel-plates={selection?.plates}
      data-sel-groups={selection?.groups}
      data-sel-wells={selection?.wells}
      className="sticky bottom-0 z-30"
    >
      <SaveBar
        placement="bottom"
        dirty={0}
        saving={saving}
        canSave={!stop && !saving}
        onSave={() => primary?.onClick()}
        onRevert={onClear}
        showRevert={false}
        saveSpinner={false}
        saveLabel={primary?.label ?? '작업 없음'}
        saveIcon={primary?.icon}
        blockReasonId={stop && blocked ? reasonId : undefined}
        saveButtonProps={{ 'data-action': primary?.id }}
        secondary={
          <>
            <Button variant="ghost" icon={<X size={14} aria-hidden="true" />} onClick={onClear} className="flex-1 max-sm:min-h-11 sm:flex-none">
              선택 해제
            </Button>
            {ready.slice(1).map(a => (
              <Button key={a.id} icon={a.icon} data-action={a.id} onClick={a.onClick} className="flex-1 max-sm:min-h-11 sm:flex-none">
                {a.label}
              </Button>
            ))}
          </>
        }
      >
        <span aria-live="polite" className="font-semibold text-text">
          {summary}
        </span>
        {blocked && (
          <span id={reasonId} data-bar-block={blocked.id} className={stop ? 'text-xs font-medium text-negative' : 'text-xs text-muted'}>
            {blocked.label} 불가 · {blocked.disabledReason}
          </span>
        )}
      </SaveBar>
    </div>
  )
}

/**
 * 확인 대화상자: 넓은 화면 = 중앙 모달, 좁은 화면 = 공통 BottomSheet(버튼 44px, 시트 아래 줄).
 * Esc·취소로 닫힘, 열리면 확인 버튼에 포커스.
 */
export function ConfirmDialog({
  title,
  kind,
  children,
  confirmLabel,
  saving,
  onConfirm,
  onCancel,
}: {
  title: string
  /** 대화상자 종류(QA 상태 검증 선택자 data-dialog) */
  kind?: string
  children: ReactNode
  confirmLabel: string
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const prev = useRef<Element | null>(null)
  const narrow = useMediaQuery('(max-width: 639px)')
  useEffect(() => {
    prev.current = document.activeElement
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (prev.current instanceof HTMLElement) prev.current.focus()
    }
  }, [onCancel])
  const body = (
    <div data-dialog={kind}>
      <h2 id={`${id}-t`} className="text-base font-semibold text-text">
        {title}
      </h2>
      <div className="mt-2 text-[13px] leading-relaxed text-text">{children}</div>
    </div>
  )
  if (narrow)
    return (
      <BottomSheet
        open
        onClose={onCancel}
        labelledBy={`${id}-t`}
        header="확인"
        backdropLabel="취소"
        footer={
          <>
            <Button onClick={onCancel} disabled={saving} className="min-h-11 flex-1">
              취소
            </Button>
            <Button ref={ref} variant="primary" onClick={onConfirm} disabled={saving} aria-busy={saving} className="min-h-11 flex-[2]">
              {saving ? '저장 중…' : confirmLabel}
            </Button>
          </>
        }
      >
        {body}
      </BottomSheet>
    )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4" onMouseDown={e => e.target === e.currentTarget && !saving && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-2">
        {body}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={saving}>
            취소
          </Button>
          <Button ref={ref} variant="primary" onClick={onConfirm} disabled={saving} aria-busy={saving}>
            {saving ? '저장 중…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
