import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from './Button'

export type SaveBarPlacement = 'bottom' | 'responsive'

export interface SaveBarProps {
  /**
   * 바 위치.
   * - 'bottom': 본문 흐름 안의 둥근 카드형 바. `pinned`면 화면 아래에 sticky. sm 이상에서 가로 배치.
   * - 'responsive': md 미만은 화면 아래 fixed(가장자리까지), md 이상은 화면 위 16px(top-4) sticky(2026-11-02 갤러리 상단 바 제거로 옛 헤더 기준 top-14에서 변경). md 이상에서 가로 배치.
   *   md 미만에서 본문 끝이 가려지지 않도록 템플릿 루트에 아래 여백(예: `pb-40 md:pb-0`)을 둔다.
   */
  placement: SaveBarPlacement
  /** placement='bottom'에서 sticky로 붙일지(예: 미저장 변경이 있거나 저장 중일 때) */
  pinned?: boolean
  /** 왼쪽 상태 영역(상태 문구·저장 막는 이유·보조 메시지). 13px 글자 크기를 물려받는다 */
  children: ReactNode
  /** 미저장 변경 수. 0이면 「변경 취소」 비활성 */
  dirty: number
  /** 저장 중. 「변경 취소」 비활성, `saveSpinner`면 저장 버튼 아이콘이 스피너 */
  saving: boolean
  /** 저장 버튼 활성 여부 */
  canSave: boolean
  onSave: () => void
  onRevert: () => void
  /** 저장을 막는 이유 요소의 id(저장 버튼 aria-describedby). 이유가 없으면 생략 */
  blockReasonId?: string
  /** 저장 중 저장 버튼 아이콘을 스피너로 바꾼다(기본 true) */
  saveSpinner?: boolean
  /** 단축키 표시: aria-keyshortcuts 값과 md 이상에서 보이는 kbd 글자(예: { aria: 'Control+S', label: 'Ctrl+S' }) */
  shortcut?: { aria: string; label: string }
  /**
   * 저장 버튼에 더 붙일 속성(예: `{ 'data-action': 'save' }` QA 선택자, `title`). 동작·상태 속성(onClick·disabled·aria-describedby·
   * aria-keyshortcuts·className·type)은 SaveBar가 정하므로 받지 않는다.
   */
  saveButtonProps?: SaveButtonProps
  /** 주 동작 문구. 기본 '저장'. 되돌리기 어려운 동작은 '확정'으로 쓰고 onSave에서 확인 절차를 연다 */
  saveLabel?: ReactNode
  /** 주 동작 아이콘. 기본 저장 아이콘 */
  saveIcon?: ReactNode
  /** 변경 취소와 주 동작 사이의 보조 동작(임시 저장 등) */
  secondary?: ReactNode
  /** false면 「변경 취소」를 숨긴다. 기본 true */
  showRevert?: boolean
}

/** SaveBar 저장 버튼에 넘길 수 있는 추가 속성 */
export type SaveButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'disabled' | 'aria-describedby' | 'aria-keyshortcuts' | 'className' | 'type' | 'children'
> & { [key: `data-${string}`]: string | undefined }

const CONTAINER: Record<SaveBarPlacement, string> = {
  bottom: 'rounded-lg border border-border bg-surface px-3 py-2.5 shadow-2',
  responsive:
    'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-2.5 shadow-2 md:sticky md:top-4 md:z-20 md:rounded-lg md:border md:px-4 md:py-2.5',
}

// Tailwind가 정적으로 찾을 수 있도록 중단점별 클래스를 문자열 그대로 둔다
const BP = {
  bottom: {
    row: 'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4',
    revert: 'flex-1 max-sm:min-h-11 sm:flex-none',
    save: 'flex-[2] max-sm:min-h-11 sm:flex-none',
  },
  responsive: {
    row: 'flex flex-col gap-2 md:flex-row md:items-center md:gap-4',
    revert: 'flex-1 max-md:min-h-11 md:flex-none',
    save: 'flex-[2] max-md:min-h-11 md:flex-none',
  },
} as const

/**
 * 업무 화면 저장 바 — 왼쪽 상태 영역(템플릿이 채움) + 오른쪽 「변경 취소」(ghost)·「저장」(primary).
 * 인쇄 시 숨는다(data-print-hide). 좁은 화면에서는 세로로 쌓이고 버튼이 44px 높이로 1:2 폭을 나눠 가진다.
 */
export function SaveBar({
  placement,
  pinned = false,
  children,
  dirty,
  saving,
  canSave,
  onSave,
  onRevert,
  blockReasonId,
  saveSpinner = true,
  shortcut,
  saveButtonProps,
  saveLabel = '저장',
  saveIcon,
  secondary,
  showRevert = true,
}: SaveBarProps) {
  const bp = BP[placement]
  const container = placement === 'bottom' ? `${pinned ? 'sticky bottom-0 z-20' : ''} ${CONTAINER.bottom}` : CONTAINER.responsive
  return (
    <div data-print-hide="" data-save-bar="" className={container}>
      <div className={bp.row}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">{children}</div>
        <div className="flex shrink-0 gap-2">
          {showRevert && (
            <Button
              variant="ghost"
              icon={<RotateCcw size={14} aria-hidden="true" />}
              onClick={onRevert}
              disabled={dirty === 0 || saving}
              className={bp.revert}
            >
              변경 취소
            </Button>
          )}
          {secondary}
          <Button
            {...saveButtonProps}
            variant="primary"
            icon={
              saving && saveSpinner ? (
                <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              ) : (
                (saveIcon ?? <Save size={14} aria-hidden="true" />)
              )
            }
            onClick={onSave}
            disabled={!canSave}
            aria-describedby={blockReasonId}
            aria-keyshortcuts={shortcut?.aria}
            className={bp.save}
          >
            {saveLabel}
            {shortcut && (
              <kbd className="ml-1 hidden rounded-sm border border-current/30 px-1 text-[11px] font-normal opacity-80 md:inline">{shortcut.label}</kbd>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
