import { Wrench } from 'lucide-react'
import { AS_OF, BED_CAP, CELLS_PER_TRAY, CLEAN, MAINT, TRAYS_PER_BED, WIN, cellsAt, emptyRuns, fmtD, type BedId, type Plan } from '../data'

/** H. 베드 상세 */
export function BedDetail({ bed, plan, onSelectBatch }: { bed: BedId; plan: Plan; onSelectBatch: (id: string) => void }) {
  const now = cellsAt(plan, bed, AS_OF)
  const owners = plan.iv.filter(x => x.bed === bed && x.to >= AS_OF && x.from <= WIN.to)
  const byOwner = [...new Set(owners.map(x => x.owner))].map(id => {
    const xs = owners.filter(x => x.owner === id)
    return { id, xs, nowCells: xs.filter(x => x.from <= AS_OF && AS_OF <= x.to).reduce((a, x) => a + x.cells, 0) }
  })
  const runs = emptyRuns(plan, bed)
  const maint = MAINT.filter(m => m.bed === bed)
  const pctNow = (100 * now) / BED_CAP
  return (
    <div data-bed-detail={bed} className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">베드 {bed}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {TRAYS_PER_BED}트레이 × {CELLS_PER_TRAY}공 = {BED_CAP}셀 · 차광 커튼·보광 LED 베드별 제어
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-text">기준일({fmtD(AS_OF)}) 점유</span>
          <span className="tabular-nums text-text">
            <b className="text-lg">{now}</b> / {BED_CAP}셀 ({pctNow.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={BED_CAP} aria-valuenow={now} aria-label={`${bed} 기준일 점유 셀`}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pctNow)}%` }} />
        </div>
      </div>

      <section>
        <h4 className="text-xs font-semibold text-text">이 베드의 묶음({fmtD(AS_OF)} 이후)</h4>
        {byOwner.length === 0 ? (
          <p className="mt-1 text-xs text-muted">없음</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {byOwner.map(o => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                {o.id.startsWith('P26') ? (
                  <b className="text-text">{o.id}</b>
                ) : (
                  <button type="button" className="touch-hit-y font-semibold text-text underline decoration-muted underline-offset-2 hover:decoration-text" onClick={() => onSelectBatch(o.id)}>
                    {o.id}
                  </button>
                )}
                <span className="tabular-nums text-muted">
                  {o.xs.map(x => (x.g ? `F${x.g}` : '부모')).join('·')} · {fmtD(o.xs[0]!.from)}~{fmtD(o.xs[o.xs.length - 1]!.to)} · 기준일 {o.nowCells}셀
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold text-text">빈 기간({fmtD(AS_OF)} ~ {WIN.to}, 5일 이상)</h4>
        {runs.length === 0 ? (
          <p className="mt-1 text-xs text-muted">없음 — 창 끝까지 빈 날이 없습니다</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-xs tabular-nums">
            {runs.map(r => (
              <li key={r.from} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-semibold text-text">
                  {fmtD(r.from)}~{r.open ? `${fmtD(r.to)}(창 끝)` : fmtD(r.to)}
                </span>
                <span className="text-muted">
                  {r.days}일{r.turnover ? ` · 세대 교체(정리 ${CLEAN}일 + 대기)` : ''}
                  {r.maint ? ` · 정비 ${fmtD(r.maint.from)}~${fmtD(r.maint.to)} 포함` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {maint.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-text">정비 일정</h4>
          <ul className="mt-1 flex flex-col gap-1 text-xs">
            {maint.map(m => (
              <li key={m.from} className="flex items-center gap-1.5 text-text">
                <Wrench size={12} aria-hidden="true" className="text-muted" />
                {fmtD(m.from)}~{fmtD(m.to)} · {m.label} — 이 기간에는 어떤 묶음도 둘 수 없습니다
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
