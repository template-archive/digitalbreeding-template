import { useId } from 'react'
import { AlertTriangle, CalendarClock, Dna, Info, Lock } from 'lucide-react'
import { Badge, ScrollRegion, Segmented, cn } from '@/design-system'
import {
  AS_OF,
  BEDS,
  BED_CAP,
  P27_DAYLENGTH_NOTE,
  CLEAN,
  CROSS27,
  DEADLINE_LABEL,
  DEADLINE_TONE,
  EDIT_GEN,
  LINES_PER_CROSS,
  METHOD,
  POTS_PER_SOWING,
  POT_CELLS,
  SAMPLE_DAS,
  crossRange,
  fmtD,
  genDays,
  maintOn,
  parseIso,
  remainingAt,
  type Batch,
  type BedId,
  type Draft,
  type Gen,
  type MethodKey,
  type ParentBlock,
  type Plan,
  type Validation,
} from '../data'

const METHODS: MethodKey[] = ['standard', 'embryo']
/** 세대별 일정 표 머리(날짜·셀 수는 오른쪽 정렬) */
const GEN_HEADERS: { label: string; numeric?: boolean }[] = [
  { label: '세대' },
  { label: '파종', numeric: true },
  { label: '출수', numeric: true },
  { label: '수확', numeric: true },
  { label: '베드' },
  { label: '셀', numeric: true },
  { label: '방법' },
]

export function BatchDetail({
  b,
  plan,
  saved,
  draft,
  v,
  dirty,
  onDraft,
}: {
  b: Batch
  plan: Plan
  saved: Plan
  draft: Draft
  v: Validation
  dirty: boolean
  onDraft: (d: Draft) => void
}) {
  const uid = useId()
  const gens = plan.scheds.get(b.id)!
  const sgens = saved.scheds.get(b.id)!
  const g = EDIT_GEN[b.id]!
  const dl = v.deadline
  const sowIso = parseIso(draft.sowText) ?? gens[g - 1]!.sow
  const sowErr = v.format ?? v.early
  const bedErrs = [v.maint, v.capacity].filter(Boolean) as string[]
  const changed = (x: Gen) => {
    const s = sgens[x.g - 1]!
    return s.sow !== x.sow || s.bed !== x.bed || s.method !== x.method
  }

  return (
    <div data-batch-detail={b.id} className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-text">
          {b.id} <span className="font-semibold text-muted">· {crossRange(b)}</span>
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          {b.round} · 기본 베드 {b.bed} · F1 {b.f1Crosses}조합 → 단립계통법(SSD) {b.ssdCrosses}조합 × {LINES_PER_CROSS}계통 = {b.ssdCrosses * LINES_PER_CROSS}계통 · {b.gs} GS 1차 대상
        </p>
      </div>

      {/* 마감 요약 */}
      <div data-deadline-status={dl.status} className={cn('rounded-md border border-l-4 px-3 py-2 text-[13px]', dl.status === 'late' ? 'border-negative/40 border-l-negative' : dl.status === 'caution' ? 'border-warning/40 border-l-warning' : 'border-positive/40 border-l-positive')}>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock size={14} aria-hidden="true" className="text-muted" />
          <b className="text-text">
            {b.gs} GS 1차 시료 채취 {DEADLINE_LABEL[dl.status]}
          </b>
          <Badge tone={DEADLINE_TONE[dl.status]}>
            {dl.slack < 0 ? `${-dl.slack}일 늦음` : `여유 ${dl.slack}일`}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted tabular-nums">
          F6 종자 준비 {fmtD(dl.f6Ready)} · F1→F6 종자 {dl.f1ToF6}일({(dl.f1ToF6 / 365).toFixed(1)}년) · 잎 채취 {fmtD(dl.sample)}(F6 파종 {SAMPLE_DAS}일) · 마감 {dl.deadline}
          {b.gs === 2028 ? '(추정)' : ''}
        </p>
        {v.deadlineMsg && (
          <p className={cn('mt-1 flex items-start gap-1 text-xs font-semibold', dl.status === 'late' ? 'text-negative' : 'text-warning')}>
            <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            {v.deadlineMsg}
          </p>
        )}
      </div>

      {/* F1 → F2 진입 */}
      {b.kasp && (
        <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2 text-[13px]">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-text">
            <Dna size={14} aria-hidden="true" className="text-muted" />
            F1 → F2 진입 {fmtD(gens[1]!.sow)} · {b.f2Note}
          </p>
          <p className="mt-1 text-xs text-muted">
            F1 진위: KASP(경쟁적 대립유전자 특이 PCR) {b.kasp.id} · {b.kasp.summary}
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-text">
            {b.kasp.items.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 세대별 일정 */}
      <div>
        <h4 id={`${uid}-gens`} className="mb-1 text-xs font-semibold text-text">
          세대별 일정{dirty ? ' (미저장 미리보기 포함)' : ''}
        </h4>
        <ScrollRegion label="세대별 일정(가로 스크롤)" hint="옆으로 밀어 베드·셀·방법 보기 →">
          <table aria-labelledby={`${uid}-gens`} className="w-full min-w-[420px] text-left text-xs tabular-nums">
            <thead className="text-muted">
              <tr className="border-b border-text/25">
                {GEN_HEADERS.map(h => (
                  <th key={h.label} scope="col" className={cn('py-1 pr-2 font-medium', h.numeric && 'text-right')}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gens.map(x => {
                const ch = dirty && changed(x)
                const done = x.harvest < AS_OF
                return (
                  <tr key={x.g} className={cn('border-b border-border/70', x.g === g && 'bg-surface-2')}>
                    <th scope="row" className="whitespace-nowrap py-1 pr-2 font-semibold text-text">
                      F{x.g}
                      {x.g === g && <span className="ml-1 text-[11px] font-semibold text-muted">편집</span>}
                    </th>
                    <td className={cn('whitespace-nowrap py-1 pr-2 text-right', ch && 'font-semibold text-text underline decoration-dashed underline-offset-2')}>{fmtD(x.sow)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right">{fmtD(x.heading)}</td>
                    <td className="py-1 pr-2 text-right">
                      <span className="whitespace-nowrap">
                        {fmtD(x.harvest)}
                        {done && <span className="text-muted"> 완료</span>}
                      </span>
                      {x.sample && <span className="block whitespace-nowrap text-[11px] text-muted">잎 채취 {fmtD(x.sample)}</span>}
                    </td>
                    <td className={cn('py-1 pr-2', ch && x.bed !== sgens[x.g - 1]!.bed && 'font-semibold text-text')}>{x.bed}</td>
                    <td className="py-1 pr-2 text-right">{x.cells}</td>
                    <td className="whitespace-nowrap py-1 pr-2">
                      {METHOD[x.method].label}
                      <span className="text-muted"> {genDays(x.method)}일</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </div>

      {/* 편집 폼 */}
      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-[13px] font-semibold text-text">
          다음 세대 F{g} 파종({b.id}) 일정 고치기
        </legend>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-sow`} className="text-xs font-medium text-muted">
            파종일(YYYY-MM-DD)
          </label>
          <input
            id={`${uid}-sow`}
            data-field="sow"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft.sowText}
            aria-invalid={!!sowErr}
            aria-describedby={sowErr ? `${uid}-sow-err` : undefined}
            onChange={e => onDraft({ ...draft, sowText: e.target.value })}
            className={cn('h-9 w-full max-w-[200px] rounded-md border bg-surface px-2 text-[13px] tabular-nums text-text', sowErr ? 'border-negative' : 'border-border')}
          />
          {sowErr && (
            <p id={`${uid}-sow-err`} data-field-error="sow" className="flex items-start gap-1 text-xs font-semibold text-negative">
              <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
              {sowErr}
            </p>
          )}
          {v.storage && (
            <p className="flex items-start gap-1 text-xs font-semibold text-warning">
              <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
              주의 · {v.storage}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-1" aria-describedby={bedErrs.length ? `${uid}-bed-err` : undefined}>
          <legend className="text-xs font-medium text-muted">베드(파종일 {fmtD(sowIso)} 기준 남은 셀)</legend>
          <div className="grid grid-cols-5 gap-1">
            {BEDS.map(bed => {
              const left = remainingAt(plan, b.id, bed, sowIso)
              const m = maintOn(bed, sowIso)
              const sel = draft.bed === bed
              return (
                <label
                  key={bed}
                  data-bed-option={bed}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-md border px-1.5 py-1 text-[11px] leading-tight has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                    sel ? 'border-text/40 bg-active font-semibold' : 'border-border hover:bg-surface-2',
                  )}
                >
                  <input type="radio" name={`${uid}-bed`} value={bed} checked={sel} onChange={() => onDraft({ ...draft, bed: bed as BedId })} className="sr-only" />
                  <span className="text-[12px] font-bold text-text">{bed}</span>
                  <span className={cn('tabular-nums', m || left < (b.ssdCrosses * LINES_PER_CROSS) ? 'font-semibold text-negative' : 'text-muted')}>{m ? '정비' : `${Math.max(0, left)}셀 남음`}</span>
                </label>
              )
            })}
          </div>
          {bedErrs.length > 0 && (
            <div id={`${uid}-bed-err`} data-field-error="bed" data-conflict="true" role="alert" className="mt-1 flex flex-col gap-1">
              {bedErrs.map(t => (
                <p key={t} className="flex items-start gap-1 text-xs font-semibold text-negative">
                  <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {t}
                </p>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-1">
          <span id={`${uid}-method`} className="text-xs font-medium text-muted">
            세대 단축 방법(F{g}부터 적용)
          </span>
          <Segmented<MethodKey>
            ariaLabelledBy={`${uid}-method`}
            value={draft.method}
            onChange={m => onDraft({ ...draft, method: m })}
            options={METHODS.map(m => ({ value: m, label: `${METHOD[m].label}(${genDays(m)}일)`, data: { 'data-method-option': m } }))}
          />
        </div>
      </fieldset>
    </div>
  )
}

export function ParentDetail({ p }: { p: ParentBlock }) {
  return (
    <div data-batch-detail={p.id} className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-text">
          {p.id} <span className="font-semibold text-muted">· {p.label}</span>
        </h3>
        <p className="mt-0.5 text-xs text-muted tabular-nums">
          {p.bed} · {p.cells}셀(부모 {p.parents!.length}계통 × {CROSS27.stagger.length}회 분할 파종) · 점유 {fmtD(p.from)}~{fmtD(p.until)} · 단일 처리 없이 자연 일장
        </p>
      </div>
      <p className="flex items-start gap-1.5 rounded-md border border-border bg-surface-2/60 px-3 py-2 text-xs text-text">
        <Lock size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
        편집 불가 — 파종일은 교배 기간({CROSS27.start}~{CROSS27.end})에서 부모 출수 일수를 거꾸로 빼서 정합니다.
      </p>
      <p className="text-[11px] leading-relaxed text-muted">{P27_DAYLENGTH_NOTE}</p>
      <ScrollRegion label="부모별 분할 파종(가로 스크롤)">
        <table className="w-full min-w-[360px] text-left text-xs tabular-nums">
          <caption className="mb-1 text-left text-xs font-semibold text-text">부모별 분할 파종({CROSS27.stagger.map(d => `+${d}`).join('·')}일)</caption>
          <thead className="text-muted">
            <tr className="border-b border-text/25">
              {['계통', '출수 일수', '1회째', '3회째'].map((h, i) => (
                <th key={h} scope="col" className={cn('py-1 pr-2 font-medium', i > 0 && 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.parents!.map(s => (
              <tr key={s.name} className="border-b border-border/70">
                <th scope="row" className="py-1 pr-2 font-semibold text-text">
                  {s.name}
                </th>
                <td className="py-1 pr-2 text-right">{s.heading}일</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right">{fmtD(s.sow1)}</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right">{fmtD(s.sow3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <p className="text-[11px] text-muted">
        부모 포트 회차당 {POTS_PER_SOWING}포트 × {POT_CELLS}셀. 베드 점유 = 첫 파종 ~ 교배 종료 + 조기 수확 {CROSS27.earlyHarvest}일 + 정리 {CLEAN}일. 수용량 {BED_CAP}셀.
      </p>
    </div>
  )
}
