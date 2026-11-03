import type { ReactNode } from 'react'
import { CalendarClock, FlaskConical, Info, RotateCcw, TriangleAlert } from 'lucide-react'
import { Badge, Segmented, Select } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  ALLELE_DIRECTION_NOTE,
  BATCHES,
  GENO_LABEL,
  GROUP_LABEL,
  MARKERS,
  NEXT_ROUND_LABEL,
  NURSERY_SOW,
  PARENTS,
  PARENT_GENO,
  RATE_HIGH,
  FIELD_LABEL,
  REASON_LABEL,
  SELF_SUSPECT_RATIO,
  STATUS_LABEL,
  TARGET_SEEDS,
  addDays,
  fmtRate,
  mSlashD,
  mmdd,
  plantGenotype,
  type Derived,
  type F1Status,
  type FieldIssues,
  type FieldKey,
  type Override,
  type OverrideReason,
} from '../data'
import { BandBadge, RecrossBadge, StatusBadge } from './badges'

interface Props {
  row: Derived
  /** 이 조합의 입력 점검(표 칸에는 짧은 표식만 있어 전체 문구를 여기서 보인다) */
  issues?: FieldIssues
  override: Override | undefined
  onStatus: (s: F1Status) => void
  onReason: (r: OverrideReason) => void
  /** 시트 등에서 제목 id */
  titleId?: string
}

function ParentLine({ role, name }: { role: string; name: string }) {
  const p = PARENTS[name]!
  const heading = addDays(NURSERY_SOW, p.heading)
  return (
    <div className="min-w-0 rounded-md bg-surface-2 px-2.5 py-2">
      <p className="text-[11px] text-muted">{role}</p>
      <p className="text-sm font-semibold tabular-nums text-text">{name}</p>
      <p className="text-[11px] leading-snug text-muted">
        {GROUP_LABEL[p.group]} · 출수 {mmdd(heading)} · {p.pi ?? 'Pi 없음'}
      </p>
    </div>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-xs text-muted">{k}</dt>
      <dd className="min-w-0 text-right text-[13px] tabular-nums text-text">{children}</dd>
    </div>
  )
}

/** F. 조합 상세 — 부모, 결실 계산, KASP 다형 마커 표, 진위 상태 관리 */
export function CrossDetail({ row, issues, override, onStatus, onReason, titleId }: Props) {
  const c = row.cross
  const issueList = (Object.keys(FIELD_LABEL) as FieldKey[]).flatMap(k => (issues?.[k] ? [{ k, issue: issues[k]! }] : []))
  const batch = BATCHES[c.batch]
  const fg = PARENT_GENO[c.female]!
  const mg = PARENT_GENO[c.male]!
  const plants = c.plants
  const isPending = row.kaspStatus === 'pending'
  const pctTxt = row.rate == null ? null : fmtRate(row.rate)

  return (
    <div className="flex flex-col gap-3" data-detail-id={c.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-lg font-bold tabular-nums text-text">
          {c.id}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <BandBadge band={row.band} />
          <StatusBadge status={row.status} discard={row.status === 'confirmed' && !row.manual ? row.nSelf : 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ParentLine role="모본(♀)" name={c.female} />
        <ParentLine role="부본(♂)" name={c.male} />
      </div>

      <dl className="divide-y divide-border">
        <Row k="교배일 · 수확일">
          {row.date} · {row.harvest}
        </Row>
        <Row k="진위 묶음">
          {batch.no}차 · {batch.plate}
          {batch.done ? ` (결과 ${mmdd(batch.resulted)})` : ' (예정)'}
        </Row>
        <Row k="결실 계산">
          {row.seeds == null ? (
            <span className="text-muted">결실 립수 미입력 / {formatNumber(row.florets)}</span>
          ) : (
            <>
              {formatNumber(row.seeds)} / {formatNumber(row.florets)} = <b>{pctTxt}%</b>
            </>
          )}
        </Row>
        <Row k="유효 F1 진행">
          <b>{formatNumber(Math.round(row.eff))}</b> / {TARGET_SEEDS}립
          {row.status === 'confirmed' && plants && row.nSelf > 0 && row.seeds != null && (
            <span className="block text-[11px] text-muted">
              {formatNumber(row.seeds)} × {row.nF1}/{plants.length} = {String(row.eff)}
            </span>
          )}
        </Row>
      </dl>

      {issueList.length > 0 && (
        <ul aria-label="입력 점검" data-detail-issues={issueList.length} className="flex flex-col gap-1 text-xs">
          {issueList.map(({ k, issue }) => (
            <li key={k} className={`flex items-start gap-1.5 ${issue.level === 'error' ? 'font-medium text-negative' : 'text-warning'}`}>
              <TriangleAlert size={13} aria-hidden="true" className="mt-px shrink-0" />
              {FIELD_LABEL[k]}: {issue.message}
            </li>
          ))}
        </ul>
      )}

      {/* 결실 과다 + 진위 경고 */}
      {row.band === 'high' && row.status === 'suspect' && (
        <p className="flex items-start gap-1.5 rounded-md border border-negative/40 bg-negative/5 px-2.5 py-2 text-xs text-text">
          <TriangleAlert size={14} aria-hidden="true" className="mt-px shrink-0 text-negative" />
          결실 과다({pctTxt}% &gt; {RATE_HIGH}%)와 자식 의심이 함께 나타납니다. 제웅이 불완전해 모본 꽃가루로 자가수분된 것으로 보입니다.
        </p>
      )}
      {row.band === 'high' && isPending && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning/50 bg-warning/5 px-2.5 py-2 text-xs text-text">
          <TriangleAlert size={14} aria-hidden="true" className="mt-px shrink-0 text-warning" />
          결실률이 높아 자식 가능성이 있습니다. KASP 결과({mSlashD(BATCHES[2].resulted)} 예정)를 확인하기 전에 F1을 세대 진전에 쓰지 마세요.
        </p>
      )}
      {c.memo && (
        <p className="text-xs text-muted">
          <span className="font-medium text-text">메모</span> {c.memo}
        </p>
      )}

      {/* KASP 다형 마커 표 */}
      <section aria-labelledby={`${c.id}-kasp`} className="rounded-md border border-border">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-2.5 py-2">
          <h4 id={`${c.id}-kasp`} className="flex items-center gap-1 text-[13px] font-semibold text-text">
            <FlaskConical size={14} aria-hidden="true" className="text-muted" />
            KASP 다형 마커 {c.poly.length}개
          </h4>
          <span className="text-[11px] text-muted">
            {batch.done ? `출처 ${batch.plate} · 결과 ${batch.resulted}` : `${batch.plate} 접수 전`}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <caption className="sr-only">
              {c.id} 부모 간 다형 마커별 모본·부본 유전형과 F1 개체 결과
            </caption>
            <thead>
              <tr className="border-b border-text/25 text-muted">
                <th scope="col" className="px-2 py-1 text-left font-medium">
                  마커
                </th>
                <th scope="col" className="px-1.5 py-1 font-medium">
                  ♀
                </th>
                <th scope="col" className="px-1.5 py-1 font-medium">
                  ♂
                </th>
                <th scope="col" className="px-1.5 py-1 font-medium">
                  F1 기대
                </th>
                {plants?.map((_, i) => (
                  <th key={i} scope="col" className="px-1.5 py-1 font-medium">
                    F1-{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.poly.map(mi => (
                <tr key={mi} className="border-t border-border/70 first:border-t-0">
                  <th scope="row" className="px-2 py-1 text-left font-medium text-text">
                    {MARKERS[mi]}
                  </th>
                  <td className="px-1.5 py-1 text-center text-text">{GENO_LABEL[fg[mi]!]}</td>
                  <td className="px-1.5 py-1 text-center text-text">{GENO_LABEL[mg[mi]!]}</td>
                  <td className="px-1.5 py-1 text-center text-muted">AB</td>
                  {plants?.map((p, i) => {
                    const g = plantGenotype(c, p, mi)
                    const ok = g === 'AB'
                    return (
                      <td key={i} className="px-1 py-0.5 text-center">
                        <span className={`inline-block min-w-7 rounded-sm px-1 py-px ${ok ? 'bg-positive/10 text-positive' : 'bg-negative/10 font-semibold text-negative'}`}>{g}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            {plants && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <th scope="row" colSpan={4} className="px-2 py-1.5 text-left font-medium text-muted">
                    개체 판정
                  </th>
                  {plants.map((p, i) => (
                    <td key={i} className={`px-1 py-1.5 text-center font-semibold ${p === 'self' ? 'text-negative' : 'text-positive'}`}>
                      {p === 'self' ? '자식' : 'F1'}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!plants && (
          <p className="flex items-start gap-1.5 border-t border-border px-2.5 py-2 text-xs text-text">
            <CalendarClock size={14} aria-hidden="true" className="mt-px shrink-0 text-info" />
            잎 채취 예정 {mSlashD(batch.sampled)} · {batch.plate} 접수 예정 {mSlashD(batch.received)} · 결과 예정 {mSlashD(batch.resulted)}
          </p>
        )}
        <p className="border-t border-border px-2.5 py-1.5 text-[11px] leading-snug text-muted">
          모든 다형 마커가 이형(AB)이면 진성 F1, 모두 모본 동형이면 자식(모본형). 자식 비율 ≥ {Math.round(SELF_SUSPECT_RATIO * 100)}%이면 자식 의심.
        </p>
        <p className="px-2.5 pb-1.5 text-[11px] leading-snug text-muted" data-allele-direction>
          {ALLELE_DIRECTION_NOTE}
        </p>
      </section>

      {/* 진위 상태 관리 */}
      <section className="flex flex-col gap-2" aria-label="F1 진위 상태 관리">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text">F1 진위 상태</span>
          <Segmented<F1Status>
            size="sm"
            ariaLabel={`${c.id} F1 진위 상태`}
            options={(['pending', 'confirmed', 'suspect'] as F1Status[]).map(s => ({ value: s, label: STATUS_LABEL[s] }))}
            value={row.status}
            onChange={onStatus}
          />
        </div>
        {row.manual && override && (
          <div className="flex flex-wrap items-center gap-2" data-manual-override={c.id}>
            <Badge tone="warning">수동 변경 · KASP 판정: {STATUS_LABEL[row.kaspStatus]}</Badge>
            <Select<OverrideReason>
              label="사유"
              value={override.reason}
              onChange={onReason}
              options={(Object.keys(REASON_LABEL) as OverrideReason[]).map(r => ({ value: r, label: REASON_LABEL[r] }))}
            />
          </div>
        )}
        {row.manual && isPending && (
          <p role="note" className="flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert size={13} aria-hidden="true" className="mt-px shrink-0" />
            KASP 결과({mSlashD(BATCHES[2].resulted)} 예정) 전입니다.
          </p>
        )}
      </section>

      {/* 재교배 */}
      <section className="flex flex-col gap-1.5 rounded-md border border-border px-2.5 py-2" aria-label="재교배 판단">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text">재교배</span>
          <RecrossBadge row={row} />
        </div>
        {(row.recross === 'suspect' || row.recross === 'short') && (
          <p className="flex items-start gap-1.5 text-xs text-text">
            <RotateCcw size={13} aria-hidden="true" className="mt-px shrink-0 text-warning" />
            {NEXT_ROUND_LABEL}에서 다시 교배 권장
          </p>
        )}
        {row.recross === 'needInput' && (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Info size={13} aria-hidden="true" className="mt-px shrink-0" />
            결실 립수를 입력해야 재교배 여부를 판정할 수 있습니다.
          </p>
        )}
        {row.recross === null && <p className="text-xs text-muted">목표 {TARGET_SEEDS}립을 확보해 재교배가 필요 없습니다.</p>}
      </section>
    </div>
  )
}
