import { Info } from 'lucide-react'
import { KpiRow, SummaryTile, Tooltip } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { TARGET_SEEDS, fmtRate, type Derived, type Summary } from '../data'

/** B. 요약 줄 — 모든 숫자는 파생값에서 계산. 타일은 공통 SummaryTile(와플·다중 숫자·재교배 비중 막대는 children 칸) */
export function SummaryRow({ s, rows, dirty }: { s: Summary; rows: Derived[]; dirty: boolean }) {
  const pct = fmtRate(s.progress)
  const def = `조합별 min(유효 F1, ${TARGET_SEEDS})의 합 / ${formatNumber(s.target)}. 자식 의심 조합은 0으로 셈. 대기 조합은 결실 립수를 그대로 셈(진위 미확인). 재판독 대기 조합은 KASP 판정 기준 값으로 셈`
  return (
    <KpiRow hero ariaLabel="요약">
      {/* ① 진행률 — 가장 큰 숫자(대표: 크기로만 구분) */}
      <SummaryTile
        hero
        label="F1 목표 진행률"
        info={
          <Tooltip content={def}>
            <button type="button" aria-label={`진행률 정의: ${def}`} className="touch-hit inline-flex rounded-sm text-muted hover:text-text">
              <Info size={13} aria-hidden="true" />
            </button>
          </Tooltip>
        }
      >
        {/* 넓은 대표 타일(내용 400px 이상): 와플을 값 오른쪽에 둬 대표 타일 높이를 형제 타일(값 + 보조 줄 + 얇은 막대)과 맞춘다.
            와플이 값 아래에 쌓이면 대표만 와플·캡션 높이만큼 길어져 형제 타일 안에 50~65px 빈 띠가 남았다(panel-void, KpiRow 대표 막대 규칙과 같은 처리).
            좁은 폭(390 전체 폭 등)에서는 값 → 보조 줄 → 와플 순서 */}
        <div className="@container">
          <div className="flex flex-col gap-1.5 @min-[25rem]:flex-row @min-[25rem]:flex-wrap @min-[25rem]:items-end @min-[25rem]:gap-x-6">
            <p className="flex shrink-0 items-baseline gap-1 text-text">
              <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums">{pct}</span>
              <span className="text-sm font-semibold text-muted">%</span>
              {dirty && <span className="ml-1 rounded-sm border border-warning/40 px-1 text-[11px] font-medium text-warning">저장 전</span>}
            </p>
            <p className="text-xs text-muted tabular-nums @min-[25rem]:order-3 @min-[25rem]:basis-full">
              유효 F1 {formatNumber(s.effCapped)} / 목표 {formatNumber(s.target)}립 · 달성 {s.reached}/{s.n}조합(확인 {s.reachedBy.confirmed} · 대기 {s.reachedBy.pending}{s.reachedBy.suspect > 0 ? ` · 자식 의심 ${s.reachedBy.suspect}` : ''}){s.reread > 0 ? ` · 재판독 대기 ${s.reread}` : ''}
            </p>
            {/* 조합별 기여(상한 40) — 칸 하나 = 1조합 */}
            <div className="flex min-w-0 flex-col gap-1 @min-[25rem]:order-2 @min-[25rem]:flex-1">
              <div className="mt-1 flex h-2.5 gap-px overflow-hidden rounded-sm @min-[25rem]:mt-0" aria-hidden="true">
                {rows.map(r => {
                  const frac = Math.min(r.eff, TARGET_SEEDS) / TARGET_SEEDS
                  return (
                    <span key={r.cross.id} className="relative flex-1 bg-surface-2">
                      <span className={`absolute inset-y-0 left-0 ${frac >= 1 ? 'bg-muted' : 'bg-warning'}`} style={{ width: `${frac * 100}%` }} />
                    </span>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted">칸 하나 = 1조합(목표 {TARGET_SEEDS}립 채움 비율) · 주황 = 목표 미달</p>
            </div>
          </div>
        </div>
      </SummaryTile>

      {/* ② 결실 립수 — 입력 진행 막대는 두지 않는다: 라벨 없는 막대가 결실 립수 밑에 있으면 결실률·F1 목표 진행률로 읽힌다(도메인 검토 M1). 입력 진행은 보조 줄과 「입력 필요」 칩이 말한다 */}
      <SummaryTile
        label="결실 립수"
        value={formatNumber(s.seedsSum)}
        unit="립"
        sub={`합산 결실률 ${s.pooledRate == null ? '—' : `${fmtRate(s.pooledRate)}%`} · 입력 ${s.entered}/${s.n}조합`}
      />

      {/* ③ F1 진위 — 상태 색은 표 배지·차트와 같다: 확인 positive · 자식 의심 negative · 대기 info(검토 R1) */}
      <SummaryTile label="F1 진위 확인">
        <p className="flex flex-wrap items-baseline gap-x-2 text-text tabular-nums">
          <span>
            <span className="text-[28px] font-bold leading-none sm:text-[30px]">{s.status.confirmed}</span> <span className="text-sm">확인</span>
          </span>
          <span className="text-muted" aria-hidden="true">·</span>
          <span>
            <span className="text-[22px] font-bold leading-none text-negative">{s.status.suspect}</span> <span className="text-sm">자식 의심</span>
          </span>
          <span className="text-muted" aria-hidden="true">·</span>
          <span>
            <span className="text-[22px] font-bold leading-none">{s.status.pending}</span> <span className="text-sm">대기</span>
          </span>
        </p>
        <div className="mt-auto flex h-2.5 overflow-hidden rounded-sm" aria-hidden="true">
          <span className="bg-positive" style={{ flex: s.status.confirmed }} />
          <span className="bg-negative" style={{ flex: s.status.suspect }} />
          <span className="bg-info" style={{ flex: s.status.pending }} />
        </div>
      </SummaryTile>

      {/* ④ 재교배 필요 — 재교배 조합 비중(자식 의심 · 종자 부족 / 전체 조합), 분모는 보조 줄 「/ n조합」이 말한다 */}
      <SummaryTile
        label="재교배 필요"
        value={s.recross.total}
        unit="조합"
        severity={s.recross.total > 0 ? 'warning' : undefined}
        sub={
          <>
            자식 의심 {s.recross.suspect} · 종자 부족 {s.recross.short} / {s.n}조합
            {s.recross.needInput > 0 && <span className="font-medium text-text"> · 입력 필요 {s.recross.needInput}</span>}
          </>
        }
      >
        <div className="mt-auto flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <span className="bg-negative" style={{ width: `${(s.recross.suspect / s.n) * 100}%` }} />
          <span className="bg-warning" style={{ width: `${(s.recross.short / s.n) * 100}%` }} />
        </div>
      </SummaryTile>
    </KpiRow>
  )
}
