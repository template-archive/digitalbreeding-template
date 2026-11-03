import { Badge } from '@/design-system'
import { OPERATING_MODEL, PRACTICAL_DELTA, RECS, TRAIT_BY_KEY, fmtCi, fmtSigned3, type TraitKey } from '../data'

/** B. 모델 선택 근거 요약 — 형질 6행 카드 목록 */
export function RecommendationList({ selected, onSelect }: { selected: TraitKey; onSelect: (t: TraitKey) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5" aria-label="형질별 다음 재학습 모델 판정">
        {RECS.map(r => {
          const t = TRAIT_BY_KEY[r.trait]
          const sel = r.trait === selected
          const d = r.switch ? r.diffs.find(x => x.model === r.rec)! : r.best
          return (
            <li key={r.trait}>
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => onSelect(r.trait)}
                // 교체 권장은 배지(info '… 교체')로만, 선택 형질은 글자색 테두리(select-ring) — 강조색은 쓰지 않는다
                className={['w-full rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2', sel ? 'select-ring' : ''].join(' ')}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold text-text">{t.name}</span>
                  {r.switch ? <Badge tone="info">{r.rec} 교체</Badge> : <Badge tone="neutral">{OPERATING_MODEL} 유지</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums text-text">
                  <span>
                    {d.model} Δr <b>{fmtSigned3(d.delta)}</b>
                  </span>
                  <span className="text-muted">95% CI {fmtCi(d)}</span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted">{r.reason}</p>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs leading-relaxed text-muted">
        판정 규칙: Δr ≥ {PRACTICAL_DELTA.toFixed(2)} 그리고 95% CI 하한 &gt; 0(같은 분할의 쌍체 차이). 반복 분할이 서로 겹쳐 CI는 낙관적이므로 실용 기준을 함께 씁니다.
      </p>
    </div>
  )
}
