import { MODELS, OPERATING_MODEL, type ModelKey } from '../data'

export const modelColorVar = (m: ModelKey) => `var(--viz-cat-${MODELS.indexOf(m) + 1})`

/**
 * 모델 범례 겸 표시 토글. 켜짐 = 회색 채움, 꺼짐 = 표면색(공통 FilterChip과 같은 문법, 강조색 없음).
 * 좁은 화면·터치에서 높이 36px, 세로 누르는 영역 44px. 마지막 하나 남은 모델은 숨길 수 없다(버튼 비활성).
 */
export function ModelLegend({ visible, onToggle, ariaLabel, className }: { visible: ModelKey[]; onToggle: (m: ModelKey) => void; ariaLabel: string; className?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className={['flex flex-wrap items-center gap-1.5 touch:gap-2', className ?? ''].join(' ')}>
      {MODELS.map(m => {
        const on = visible.includes(m)
        const last = on && visible.length === 1
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            disabled={last}
            title={last ? '모델을 하나 이상 표시해야 합니다' : on ? `${m} 숨기기` : `${m} 표시`}
            onClick={() => onToggle(m)}
            className={[
              'touch-hit-y inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors touch:h-9',
              on ? 'border-text/40 bg-active text-text' : 'border-border bg-surface text-muted hover:bg-surface-2',
              last ? 'cursor-not-allowed' : '',
            ].join(' ')}
          >
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: modelColorVar(m), opacity: on ? 1 : 0.35 }} />
            {m}
            {m === OPERATING_MODEL && <span className="font-normal">(운영)</span>}
          </button>
        )
      })}
    </div>
  )
}
