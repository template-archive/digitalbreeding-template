import { CircleAlert, CircleCheck, CircleDot, Loader2 } from 'lucide-react'
import { SaveBar as SaveBarShell } from '@/design-system'

interface Props {
  dirty: number
  errors: number
  saving: boolean
  onSave: () => void
  onRevert: () => void
}

/** G. 저장 바 — 바 틀·버튼은 공통 SaveBar. 화면 아래 고정(sticky)은 오류 띠와 함께 묶는 index.tsx 바깥 틀이 맡는다 */
export function SaveBar({ dirty, errors, saving, onSave, onRevert }: Props) {
  const canSave = dirty > 0 && errors === 0 && !saving
  const Icon = saving ? Loader2 : errors > 0 ? CircleAlert : dirty > 0 ? CircleDot : CircleCheck
  const tone = errors > 0 ? 'text-negative' : dirty > 0 ? 'text-warning' : 'text-positive'
  return (
    <SaveBarShell
      placement="bottom"
      dirty={dirty}
      saving={saving}
      canSave={canSave}
      onSave={onSave}
      onRevert={onRevert}
      blockReasonId={errors > 0 ? 'cr-save-reason' : undefined}
      saveButtonProps={{ 'data-action': 'save' }}
    >
      <span
        className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-text"
        aria-live="polite"
        aria-busy={saving}
        data-save-state={saving ? 'saving' : errors > 0 ? 'error' : dirty > 0 ? 'dirty' : 'clean'}
      >
        <Icon size={15} aria-hidden="true" className={`${tone} ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        {saving ? '저장 중…' : `변경 ${dirty}건 · 오류 ${errors}건`}
      </span>
      {errors > 0 && (
        <span id="cr-save-reason" className="text-xs font-medium text-negative">
          오류 {errors}건을 고쳐야 저장할 수 있습니다
        </span>
      )}
      {errors === 0 && dirty === 0 && !saving && <span className="text-xs text-muted">모든 변경을 저장했습니다</span>}
    </SaveBarShell>
  )
}
