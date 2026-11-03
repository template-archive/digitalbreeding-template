import type { ReactNode } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { Badge } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import { INDEX_RULE, LSD, N_G, PASSED, RULE_TARGETS, W_RULE, type Genotype } from '../data'
import { RULE_TEXT, indexOnlyText } from './verdict'

const f1 = (v: number) => formatFixed(v, 1)

/** 규칙 항목 하나(그리고 조건): 충족 = 녹색 ✓, 미충족 = 빨간 ✕ */
function Crit({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${ok ? 'text-text' : 'text-muted'}`}>
      {ok ? <Check size={13} aria-hidden className="text-positive" /> : <X size={13} aria-hidden className="text-negative" />}
      <span className="sr-only">{ok ? '충족' : '미충족'}:</span>
      {children}
    </span>
  )
}

/**
 * 「또는」 묶음: 묶음 전체의 충족 여부만 ✓/✕로 판정하고, 묶음 안에서 미충족인 쪽은 빨간 ✕ 대신 회색 '–'로 낮춘다.
 * 한쪽만 맞아도 통과하는 규칙(W ≤ 기준 또는 메가 환경 승자)이 통과 계통에서 실패처럼 읽히지 않게 한다.
 */
function OrGroup({ parts }: { parts: { ok: boolean; text: string }[] }) {
  const ok = parts.some(p => p.ok)
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${ok ? 'text-text' : 'text-muted'}`}>
      {ok ? <Check size={13} aria-hidden className="text-positive" /> : <X size={13} aria-hidden className="text-negative" />}
      <span className="sr-only">{ok ? '충족' : '미충족'}:</span>
      {parts.map((p, i) => (
        <span key={p.text} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted">또는</span>}
          <span className={`inline-flex items-center gap-0.5 whitespace-nowrap ${p.ok ? 'font-medium text-text' : 'text-muted'}`}>
            {i === 0 && <span aria-hidden="true">(</span>}
            {!p.ok && <Minus size={12} aria-hidden className="text-muted" />}
            {p.text}
            <span className="sr-only">{p.ok ? '(충족)' : '(미충족)'}</span>
            {i === parts.length - 1 && <span aria-hidden="true">)</span>}
          </span>
        </span>
      ))}
    </span>
  )
}

export function RuleBox({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-text">
        <span className="font-semibold">출원 후보 규칙:</span> {RULE_TEXT}
        <span className="block text-xs text-muted">
          대비 품종 제외 · W 기준 = 100/{N_G} · 가람솔 대비 차가 LSD(5%) {f1(LSD)} kg/10a보다 큰지 함께 표시(판정 조건 아님)
        </span>
      </p>
      <ul className="flex flex-col gap-1.5" aria-label={`지수 ${f1(INDEX_RULE)}% 이상 시험 계통 ${RULE_TARGETS.length}개의 규칙 판정`}>
        {RULE_TARGETS.map((g: Genotype) => {
          const pass = g.verdict === 'pass'
          const active = g.id === selectedId
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onSelect(g.id)}
                aria-pressed={active}
                className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                  active ? 'border-text' : 'border-border'
                } ${pass ? '' : 'border-dashed'}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-text">{g.id}</span>
                  {pass ? <Badge tone="positive">통과 · 출원 후보</Badge> : <Badge tone="warning">{indexOnlyText(g)}</Badge>}
                  <span className={`ml-auto tabular-nums ${g.overLsd ? 'text-text' : 'text-muted'}`}>
                    {formatSigned(g.diffVsCheck, 1)} {g.overLsd ? '>' : '≤'} LSD
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
                  <Crit ok={g.index >= INDEX_RULE}>지수 {f1(g.index)}%</Crit>
                  <OrGroup
                    parts={[
                      { ok: g.wPct <= W_RULE, text: `W ${f1(g.wPct)}%` },
                      { ok: g.mega !== null, text: g.mega ? `${g.mega.label} 승자` : '메가 환경 승자 아님' },
                    ]}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted">
        통과 {PASSED.length}계통 = 표의 「출원 후보」 배지. 괄호 안은 둘 중 하나만 맞아도 되는 조건(– = 그쪽은 미충족). 그 밖의 시험 계통은 지수 {f1(INDEX_RULE)}% 미만입니다.
      </p>
    </div>
  )
}
