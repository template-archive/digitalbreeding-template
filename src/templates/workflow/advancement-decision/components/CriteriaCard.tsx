import { Card } from '@/design-system'
import { GEBV_RESCUE, INDEX_KEYS, INDEX_LABEL, LIMITS, STD, WEIGHTS, Y_HOLD, Y_PROMOTE, dayToDate } from '../data'
import { f1, fGebv } from './ui'

const SUBTITLE = '① 필수 형질 → ② 수량 지수 → ③ GEBV 보완 순서로 판정'

/**
 * D. 판정 기준 카드 — 자동 판정 순서(필수 형질 → 수량 지수 → GEBV 보완)와 진급 지수 가중치.
 * collapsed: 1280px 미만은 접어 두어 작업 목록을 밀어내지 않는다(검토 A4, 판정 근거 문장은 계통 상세에도 있다).
 */
export function CriteriaCard({ className = '', collapsed = false }: { className?: string; collapsed?: boolean }) {
  const rows: { label: string; value: string; note: string }[] = [
    { label: '출수기', value: `≤ ${LIMITS.heading}일(${dayToDate(LIMITS.heading)})`, note: `가람솔 ${STD.d.heading}일 + ${LIMITS.heading - STD.d.heading}` },
    { label: '간장', value: `≤ ${LIMITS.culm} cm`, note: `도복 · 가람솔 ${STD.d.culm} + ${LIMITS.culm - STD.d.culm}` },
    { label: '잎도열병', value: `≤ ${f1(LIMITS.blast)}`, note: '중도 저항성 이상 · 0~3 저항 · 4~5 중도 저항 · 6~9 감수' },
    { label: '밥맛(식미치)', value: `≥ ${f1(LIMITS.taste)}`, note: `가람솔 ${f1(STD.d.taste)} − ${f1(STD.d.taste - LIMITS.taste)}` },
  ]
  const content = (
      <div className="flex flex-col gap-4 text-[13px]">
        <section aria-labelledby="crit-1">
          <h3 id="crit-1" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text">
            <Step n={1} />
            필수 형질 한계 — 하나라도 어기면 탈락 권고
          </h3>
          <dl className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 tabular-nums">
            {rows.map(r => (
              <div key={r.label} className="contents">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-semibold text-text">{r.value}</dd>
                <dd className="text-xs text-muted">
                  {/* 구간 단위로만 줄바꿈(0~3 저항 같은 묶음이 갈라지지 않게) */}
                  {r.note.split(' · ').map((seg, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <span className="whitespace-nowrap">{seg}</span>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="crit-2">
          <h3 id="crit-2" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text">
            <Step n={2} />
            수량 기준(대비 품종 대비 지수, 가람솔 A-3 = 100)
          </h3>
          <div className="flex overflow-hidden rounded-md border border-border text-xs tabular-nums">
            <span className="flex-1 border-r border-border bg-negative/10 px-2 py-1.5">
              <b className="block text-text">탈락</b>
              <span className="text-muted">&lt; {f1(Y_HOLD)}</span>
            </span>
            <span className="flex-1 border-r border-border bg-warning/10 px-2 py-1.5">
              <b className="block text-text">보류</b>
              <span className="text-muted">
                {f1(Y_HOLD)}~{f1(Y_PROMOTE - 0.1)}
              </span>
            </span>
            <span className="flex-1 bg-positive/10 px-2 py-1.5">
              <b className="block text-text">진급</b>
              <span className="text-muted">≥ {f1(Y_PROMOTE)}</span>
            </span>
          </div>
        </section>
        <section aria-labelledby="crit-3">
          <h3 id="crit-3" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text">
            <Step n={3} />
            GEBV 보완
          </h3>
          <p className="text-xs leading-relaxed text-muted">
            보류 구간에서 수량 GEBV <b className="text-text">≥ {fGebv(GEBV_RESCUE)}</b>이면 진급 권고 — GEBV 기반 선발 화면의 부모 선발 컷오프(상위 10%)
          </p>
        </section>
        <section aria-labelledby="crit-4" className="border-t border-border pt-3">
          <h3 id="crit-4" className="mb-1.5 text-xs font-semibold text-text">진급 지수(selection index) 가중치</h3>
          <ul className="flex flex-wrap gap-1.5">
            {INDEX_KEYS.map(k => (
              <li key={k} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
                {INDEX_LABEL[k]}
                <b className="tabular-nums text-text">{Math.round(WEIGHTS[k] * 100)}%</b>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">진급 지수는 정렬용이며 자동 판정에 쓰지 않습니다. 간장·도열병은 낮을수록 +.</p>
        </section>
        <p className="text-[11px] leading-relaxed text-muted">판정은 표시값 기준입니다(출수기·간장 정수, 도열병·밥맛·지수 소수 1자리).</p>
      </div>
  )
  if (collapsed)
    return (
      <Card padding="md" className={className}>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug text-text">자동 판정 기준</span>
              <span className="block break-keep text-xs text-muted">{SUBTITLE}</span>
            </span>
            <span className="shrink-0 text-xs text-muted group-open:hidden">펼치기</span>
            <span className="hidden shrink-0 text-xs text-muted group-open:inline">접기</span>
          </summary>
          <div className="mt-3">{content}</div>
        </details>
      </Card>
    )
  return (
    <Card title="자동 판정 기준" subtitle={SUBTITLE} className={className}>
      {content}
    </Card>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-text/40 bg-surface text-[11px] font-bold leading-none text-text">
      {n}
    </span>
  )
}
