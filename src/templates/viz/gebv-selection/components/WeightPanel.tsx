import { ChevronDown, Info } from 'lucide-react'
import { Card, Select, Slider, Tooltip } from '@/design-system'
import { PRESETS, STATS, TRAITS, TRAIT_KEYS, type PresetKey, type Weights } from '../data'
import { formatSigned } from '@/lib/format'

export type PresetValue = PresetKey | 'custom'

interface Props {
  weights: Weights
  wn: Weights | null
  preset: PresetValue
  onWeight: (key: keyof Weights, v: number) => void
  onPreset: (p: PresetKey) => void
  /** 수량 모드면 비활성 */
  disabled: boolean
  /** 좁은 화면에서 접이식 */
  collapsible: boolean
  open: boolean
  onToggle: () => void
  className?: string
}

const PRESET_OPTIONS: { value: PresetValue; label: string }[] = [
  ...(Object.keys(PRESETS) as PresetKey[]).map(k => ({ value: k as PresetValue, label: PRESETS[k].label })),
  { value: 'custom', label: '사용자 지정' },
]

/** 경제적 가중치(w) 패널 — 형질별 슬라이더 + 정규화 % + 프리셋 */
export function WeightPanel({ weights, wn, preset, onWeight, onPreset, disabled, collapsible, open, onToggle, className }: Props) {
  const showBody = !collapsible || open
  const title = collapsible ? (
    <button type="button" aria-expanded={open} onClick={onToggle} className="touch-hit-y inline-flex items-center gap-1.5 text-left">
      경제적 가중치(w)
      <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180 text-muted transition-transform' : 'text-muted transition-transform'} />
    </button>
  ) : (
    '경제적 가중치(w)'
  )
  return (
    <Card title={title} subtitle="표준화 GEBV 1 SD당 상대 가치 · 합 1로 정규화" className={className}>
      {showBody && (
        <fieldset disabled={disabled} className={disabled ? 'flex flex-col gap-4 opacity-55' : 'flex flex-col gap-4'}>
          <legend className="sr-only">경제적 가중치</legend>
          {disabled && (
            <p className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-text">
              <Info size={14} aria-hidden="true" className="text-info" />
              다형질 선발 지수 모드에서 적용됩니다
            </p>
          )}
          <Select
            label="프리셋"
            value={preset}
            onChange={v => {
              if (v !== 'custom') onPreset(v)
            }}
            options={PRESET_OPTIONS}
          />
          {TRAIT_KEYS.map(t => {
            const def = TRAITS[t]
            const wt = wn ? wn[t] : 0
            const a = (wt * def.d) / STATS[t].sd
            return (
              <div key={t} className="flex flex-col gap-1">
                <Slider label={`${def.label}`} min={0} max={1} step={0.05} value={weights[t]} onChange={v => onWeight(t, v)} format={v => v.toFixed(2)} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-muted">
                  <span>방향: {def.d > 0 ? '높을수록 좋음' : '낮을수록 좋음'}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    정규화 <b className="font-semibold text-text">{wn ? `${Math.round(wt * 100)}%` : '–'}</b>
                    <Tooltip
                      content={
                        <>
                          단위당 가중치 a = w·d / SD = {wn ? formatSigned(a, 3) : '–'} / {def.unit}
                          <br />
                          (GEBV SD {STATS[t].sd.toFixed(def.digits === 2 ? 3 : 2)} {def.unit})
                        </>
                      }
                    >
                      <button type="button" aria-label={`${def.label} 단위당 가중치 설명`} className="touch-hit rounded-sm text-muted hover:text-text">
                        <Info size={12} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </span>
                </div>
              </div>
            )
          })}
        </fieldset>
      )}
    </Card>
  )
}
