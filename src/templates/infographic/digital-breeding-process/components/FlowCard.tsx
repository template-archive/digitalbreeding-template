import { stageSaved, stageSavedPct, type Stage } from '../data'
import { u } from '@/design-system'
import { stageColor } from './stageColor'

const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦']

/** 단계 이름의 괄호 부분은 작게 줄을 나눠 카드 머리 높이를 맞춘다 */
function splitName(name: string) {
  const m = name.match(/^(.*?)(\(.*\))$/)
  return m ? { main: m[1], aside: m[2] } : { main: name, aside: null }
}

function SavedPill({ stage }: { stage: Stage }) {
  const saved = stageSaved(stage)
  const pct = stageSavedPct(stage)
  const base = 'inline-flex items-center whitespace-nowrap rounded-sm border font-bold leading-none'
  const pad = { fontSize: u(17), padding: `${u(5)} ${u(8)}` }
  if (stage.isNew) {
    return (
      <span className={`${base} border-info/40 bg-info/10 text-info`} style={pad}>
        {`+${stage.digital.toFixed(1)}년`}
      </span>
    )
  }
  if (saved === 0) {
    return (
      <span className={`${base} border-border bg-surface-2 text-muted`} style={pad}>
        기간 같음
      </span>
    )
  }
  return (
    <span className={`${base} border-positive/40 bg-positive/10 text-positive`} style={pad} title={`−${(pct ?? 0).toFixed(1)}%`}>
      {`−${saved.toFixed(1)}년`}
    </span>
  )
}

function conventionalText(stage: Stage) {
  if (stage.conventional == null) return '전통 해당 없음'
  const pct = stageSavedPct(stage)
  return pct ? `전통 ${stage.conventional.toFixed(1)}년(−${pct.toFixed(1)}%)` : `전통 ${stage.conventional.toFixed(1)}년`
}

export function FlowCard({ stage }: { stage: Stage }) {
  const { main, aside } = splitName(stage.name)
  return (
    <article
      aria-label={`${CIRCLED[stage.id]} ${stage.name}`}
      className={`relative flex h-full min-w-0 flex-col rounded-lg border bg-surface ${stage.isNew ? 'border-dashed border-info' : 'border-border'}`}
      style={{ padding: `${u(14)} ${u(16)} ${u(14)}`, borderWidth: u(stage.isNew ? 2 : 1.5), borderRadius: u(12) }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0" style={{ height: u(6), background: stageColor(stage.id), borderTopLeftRadius: u(11), borderTopRightRadius: u(11) }} />
      {/* 머리: 번호 + 단계명 */}
      <header className="flex items-start" style={{ gap: u(8), minHeight: u(48), marginTop: u(2) }}>
        <span className="font-extrabold text-text" style={{ fontSize: u(26), lineHeight: 1 }}>
          {CIRCLED[stage.id]}
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-text" style={{ fontSize: u(20), lineHeight: 1.15 }}>
            {main}
          </span>
          {aside && (
            <span className="block font-semibold text-muted" style={{ fontSize: u(16), lineHeight: 1.3 }}>
              {aside}
            </span>
          )}
          {stage.isNew && (
            <span className="block font-bold text-info" style={{ fontSize: u(16), lineHeight: 1.3 }}>
              디지털 신규 단계
            </span>
          )}
        </span>
      </header>

      {/* 기간: 디지털(크게) / 전통(작게) + 단축 배지 */}
      <div className="flex items-end justify-between" style={{ gap: u(6), marginTop: u(6) }}>
        <div className="tabular-nums font-extrabold" style={{ fontSize: u(40), lineHeight: 1, color: 'var(--color-accent)' }}>
          {stage.digital.toFixed(1)}
          <span className="text-text" style={{ fontSize: u(22), marginLeft: u(2) }}>
            년
          </span>
        </div>
        <SavedPill stage={stage} />
      </div>
      <div className="tabular-nums text-muted" style={{ fontSize: u(17), lineHeight: 1.35, marginTop: u(6) }}>
        <span className="font-semibold text-text">{conventionalText(stage)}</span>
        <span>{` · ${stage.digitalNote}`}</span>
      </div>

      <hr className="border-border" style={{ margin: `${u(8)} 0 ${u(6)}`, borderTopWidth: u(1.5) }} />

      {/* 핵심 데이터: 처리량은 보조 숫자(강조색은 기간에만) */}
      <div className="font-semibold text-text" style={{ fontSize: u(18), lineHeight: 1.25 }}>
        <span className="tabular-nums font-extrabold" style={{ fontSize: u(26), lineHeight: 1.1, marginRight: u(6) }}>
          {stage.kpi.value}
        </span>
        {stage.kpi.label}
      </div>
      <p className="text-muted" style={{ fontSize: u(17), lineHeight: 1.38, marginTop: u(6) }}>
        {stage.kpi.sub.join(' · ')}
      </p>
    </article>
  )
}
