import { useId, useState } from 'react'
import { ArrowRight, Ban, Check, Loader2, PackageCheck, Send, Undo2, X } from 'lucide-react'
import { Badge, Button, Card, DataTable, SaveBar, Select, Switch, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { AS_OF, REJECT_REASONS, REQ_STATUS_LABEL, lineLabel, toG, toGrains, type Derived, type ItemEval, type Req, type ReqEval } from '../data'
import { CheckBadges, GermCell, ReqStatusBadge, UseBadge, fmtG, fmtQty, fmtSmallG, reqG } from './ui'

export interface RequestHandlers {
  onQty: (line: string, qty: number) => void
  onLot: (line: string, lotId: string) => void
  onExclude: (line: string, excluded: boolean) => void
  onMta: (signed: boolean) => void
  onApprove: () => void
  onReject: (reason: string) => void
  onShip: () => void
  onCancel: () => void
  onOpenLot: (lotId: string) => void
}

/** 승인·출고를 막는 사유 문장 */
export function blockSentences(req: Req, ev: ReqEval): string[] {
  const out: string[] = []
  for (const e of ev.active) {
    const name = lineLabel(e.item.line)
    for (const b of e.blocks) {
      if (b === 'short') out.push(`${name}: 재고 ${fmtG(e.lot?.bal ?? 0)} g < 요청 ${reqG(e)} g. 요청량을 줄이거나 품목을 제외하세요`)
      else if (b === 'fail') out.push(`${name}: 발아 불합격 ${e.lot?.germ.last?.germ ?? ''}% — 재증식이 필요합니다. 반려하거나 품목을 제외하세요`)
      else if (b === 'unreleased') out.push(`${name}: 출원 전 계통은 외부 분양할 수 없습니다`)
      else if (b === 'invalidQty') out.push(`${name}: 요청량을 1 이상의 정수로 입력하세요`)
      else out.push(`${name}: 사용 가능한 로트가 없습니다`)
    }
  }
  if (ev.mtaBlock) out.push('물질이전계약(MTA) 체결을 확인해야 승인·출고할 수 있습니다')
  if (ev.active.length === 0) out.push(`모든 품목(${req.items.length}개)이 제외되었습니다`)
  return out
}

/** 승인·출고는 화면 아래 결정 바(RequestBar)·시트 아래 줄(RequestFooter)이 맡는다. plain = 시트·서랍 안(카드 틀 없음) */
export function RequestDetail({ req, ev, d, saving, h, plain, titleId }: { req: Req; ev: ReqEval; d: Derived; saving: boolean; h: RequestHandlers; plain?: boolean; titleId?: string }) {
  const open = req.status === 'pending' || req.status === 'approved'
  const body = (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className="text-lg font-bold tabular-nums text-text">{req.id}</h3>
          <ReqStatusBadge status={req.status} />
          <UseBadge use={req.use} />
          {req.external && <Badge tone="neutral">외부 기관</Badge>}
        </div>
        <p className="text-[13px] font-semibold text-text">{req.requester}</p>
        <p className="text-[13px] leading-relaxed text-muted">{req.purpose}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted">요청일</dt>
            <dd className="font-semibold tabular-nums text-text">{req.date}</dd>
          </div>
          <div>
            <dt className="text-muted">필요일</dt>
            <dd className="font-semibold tabular-nums text-text">{req.need}</dd>
          </div>
          <div>
            <dt className="text-muted">품목</dt>
            <dd className="font-semibold tabular-nums text-text">{ev.active.length === req.items.length ? `${req.items.length}개` : `${ev.active.length} / ${req.items.length}개`}</dd>
          </div>
        </dl>
      </header>

      {open ? <OpenItems req={req} ev={ev} saving={saving} h={h} /> : <ClosedItems req={req} d={d} onOpenLot={h.onOpenLot} />}

      {open && <BlockNotice req={req} ev={ev} />}

      <History req={req} />
    </>
  )
  return plain ? (
    <div className="flex flex-col gap-4">{body}</div>
  ) : (
    <Card padding="md" className="flex flex-col gap-4" as="section">
      {body}
    </Card>
  )
}

// ---------------------------------------------------------------- 열린 요청: 품목 점검

function OpenItems({ req, ev, saving, h }: { req: Req; ev: ReqEval; saving: boolean; h: RequestHandlers }) {
  const editable = req.status === 'pending' && !saving
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  return (
    <section aria-label="품목 점검" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-bold text-text">품목 점검</h4>
        <span className="text-xs text-muted">
          차단 <b className={ev.blockCount ? 'text-negative' : 'text-text'}>{ev.blockCount}</b> · 주의 <b className="text-text">{ev.warnCount}</b>
        </span>
      </div>
      {req.external && (
        <div className={`rounded-md border px-3 py-2 ${ev.mtaBlock ? 'border-negative/40 bg-negative/5' : 'border-border bg-surface-2'}`}>
          <Switch
            checked={req.mta === 'signed'}
            onChange={h.onMta}
            disabled={!editable}
            label="MTA 체결 확인"
            description={req.mta === 'signed' ? `물질이전계약(MTA) 체결 ${req.mtaDate ?? ''}` : '물질이전계약(MTA) 미체결 — 체결을 확인하면 차단이 풀립니다'}
          />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {ev.items.map(e => (
          <ItemRow
            key={e.item.line}
            e={e}
            editable={editable}
            draft={drafts[e.item.line]}
            onDraft={v => {
              setDrafts(prev => ({ ...prev, [e.item.line]: v }))
              h.onQty(e.item.line, /^\d+$/.test(v.trim()) ? Number(v) : NaN)
            }}
            h={h}
          />
        ))}
      </ul>
    </section>
  )
}

function ItemRow({ e, editable, draft, onDraft, h }: { e: ItemEval; editable: boolean; draft?: string; onDraft: (v: string) => void; h: RequestHandlers }) {
  const qtyId = useId()
  const it = e.item
  const lot = e.lot
  const blocked = e.blocks.length > 0 && !it.excluded
  const conv = lot && Number.isFinite(it.qty) && it.qty >= 1 ? (it.unit === 'g' ? `≈ ${formatNumber(toGrains(it.qty, lot.lot.tgw))}립` : `≈ ${fmtSmallG(toG(lot.lot, it))} g`) : null
  const optionIds = e.options.map(o => o.lot.id)
  return (
    <li className={`rounded-md border p-2.5 text-[13px] ${it.excluded ? 'border-dashed border-border opacity-60' : blocked ? 'border-negative/50 bg-negative/5' : 'border-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-semibold text-text">{lineLabel(it.line)}</span>
          {it.excluded && <Badge tone="neutral">제외</Badge>}
        </span>
        {editable && (
          <label className="touch-hit inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs text-muted">
            <input type="checkbox" className="size-4 accent-[var(--color-text)]" checked={!!it.excluded} onChange={ev => h.onExclude(it.line, ev.target.checked)} />
            제외
          </label>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={qtyId} className="text-xs text-muted">
            요청량
          </label>
          {editable ? (
            <input
              id={qtyId}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={draft ?? String(it.qty)}
              onChange={ev => onDraft(ev.target.value)}
              aria-invalid={e.blocks.includes('invalidQty') || undefined}
              className="h-7 w-20 rounded-md border border-border bg-surface px-2 text-right text-[13px] tabular-nums text-text touch:h-11"
            />
          ) : (
            <span id={qtyId} className="font-semibold tabular-nums">
              {formatNumber(it.qty)}
            </span>
          )}
          <span className="text-muted">{it.unit}</span>
          {conv && <span className="text-xs text-muted tabular-nums">{conv}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">제안 로트</span>
          {lot && optionIds.includes(lot.lot.id) && editable && e.options.length > 1 ? (
            <Select
              label={`${it.line} 제안 로트`}
              hideLabel
              value={lot.lot.id}
              onChange={v => h.onLot(it.line, v)}
              options={e.options.map(o => ({
                value: o.lot.id,
                label: `${o.lot.id} · ${o.bal != null ? fmtQty(o.bal, o.lot.unit) : '—'}`,
              }))}
            />
          ) : lot ? (
            <span className="font-semibold tabular-nums">{lot.lot.id}</span>
          ) : (
            <span className="text-muted">—</span>
          )}
          {lot && (
            <button type="button" onClick={() => h.onOpenLot(lot.lot.id)} className="inline-flex items-center gap-0.5 rounded-sm text-xs font-semibold text-accent underline-offset-2 hover:underline">
              로트 보기
              <ArrowRight size={11} aria-hidden="true" />
              <span className="sr-only">{lot.lot.id} 상세</span>
            </button>
          )}
        </div>
        {lot && (
          <div className="text-xs text-muted">
            로트 재고 → 출고 후{' '}
            <span className="font-semibold tabular-nums text-text">
              {fmtG(lot.bal ?? 0)}
              {e.after != null && !e.blocks.includes('fail') && !e.blocks.includes('short') && (
                <>
                  {' → '}
                  {fmtG(e.after)}
                </>
              )}{' '}
              g
            </span>
            {e.blocks.includes('short') && e.need != null && (
              <span className="font-semibold text-negative"> · 부족 {fmtG(e.need - (lot.bal ?? 0))} g</span>
            )}
            {e.blocks.includes('fail') && <span> (사용 불가)</span>}
            <span className="ml-1">
              · 계통 가용 {fmtG(e.lineAvail)} / {formatNumber(e.min)} g
            </span>
          </div>
        )}
        {lot && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>
              천립중(정조) <b className="tabular-nums text-text">{lot.lot.tgw.toFixed(1)} g</b>
            </span>
            <span className="inline-flex items-center gap-1">
              발아 <GermCell germ={lot.germ} />
            </span>
            {lot.germ.due && <span className="whitespace-nowrap tabular-nums">기한 {lot.germ.due}</span>}
          </div>
        )}
      </div>
      {!it.excluded && (
        <div className="mt-2">
          <CheckBadges e={e} />
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- 동작

/** 상세 안: 승인·출고를 막는 사유 전문과 출고 안내. 동작 버튼은 결정 바에 있다 */
function BlockNotice({ req, ev }: { req: Req; ev: ReqEval }) {
  const reasons = blockSentences(req, ev)
  if (reasons.length === 0 && (req.status !== 'approved' || ev.blocked)) return null
  return (
    <section aria-label="요청 처리" className="flex flex-col gap-2 border-t border-border pt-3">
      {reasons.length > 0 && (
        <div data-block-reasons="" className="flex flex-col gap-1 rounded-md border border-negative/40 bg-negative/5 px-3 py-2 text-xs text-text">
          <span className="inline-flex items-center gap-1 font-bold">
            <Ban size={12} aria-hidden="true" className="text-negative" />
            {req.status === 'pending' ? '승인할 수 없습니다' : '출고할 수 없습니다'}
          </span>
          <ul className="list-disc pl-4">
            {reasons.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {req.status === 'approved' && !ev.blocked && (
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <PackageCheck size={12} aria-hidden="true" />
          출고하면 제안 로트에서 차감하고 원장에 {AS_OF} 출고 행을 남깁니다
        </span>
      )}
    </section>
  )
}

export interface RequestDecisionProps {
  req: Req
  ev: ReqEval
  saving: boolean
  h: RequestHandlers
  rejecting: boolean
  onRejecting: (v: boolean) => void
}

/** 반려 사유 입력: 반려(되돌리기 어려운 확정)의 기존 확인 절차. 사유를 골라야 확정할 수 있다 */
function RejectForm({ req, saving, h, onRejecting }: Pick<RequestDecisionProps, 'req' | 'saving' | 'h' | 'onRejecting'>) {
  const [reason, setReason] = useState<string>('')
  const [memo, setMemo] = useState('')
  const memoNeeded = reason === '기타' && !memo.trim()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3 shadow-1" data-reject-form={req.id}>
      <Select label="반려 사유(필수)" value={reason} onChange={setReason} options={[{ value: '', label: '사유 선택' }, ...REJECT_REASONS.map(r => ({ value: r, label: r }))]} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        메모{reason === '기타' ? '(필수)' : '(선택)'}
        <input value={memo} onChange={ev => setMemo(ev.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-text touch:h-11" />
      </label>
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={!reason || memoNeeded || saving}
          icon={saving ? <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : undefined}
          onClick={() => {
            h.onReject(memo.trim() ? `${reason} — ${memo.trim()}` : reason)
            onRejecting(false)
          }}
          className="touch:min-h-11"
        >
          반려 확정
        </Button>
        <Button variant="ghost" onClick={() => onRejecting(false)} className="touch:min-h-11">
          닫기
        </Button>
      </div>
    </div>
  )
}

/** 보조 동작: 승인 대기 = 반려(사유 입력을 연다), 출고 대기 = 승인 취소 */
function SecondaryAction({ req, saving, h, rejecting, onRejecting, className }: Pick<RequestDecisionProps, 'req' | 'saving' | 'h' | 'rejecting' | 'onRejecting'> & { className: string }) {
  return req.status === 'pending' ? (
    <Button variant="danger" data-action="reject" icon={<X size={14} aria-hidden="true" />} disabled={saving} aria-expanded={rejecting} onClick={() => onRejecting(!rejecting)} className={className}>
      반려
    </Button>
  ) : (
    <Button variant="ghost" data-action="cancel-approval" icon={<Undo2 size={14} aria-hidden="true" />} disabled={saving} onClick={h.onCancel} className={className}>
      승인 취소
    </Button>
  )
}

const verb = (req: Req) => (req.status === 'pending' ? '승인' : '출고')

/**
 * 요청 결정 바(공통 SaveBar 문법, 화면 아래 고정): 왼쪽 요청 상태·점검 수 → 보조(반려·승인 취소) → 오른쪽 주 동작(승인·출고).
 * 9품목 요청에서 버튼이 상세 머리보다 약 1,780px 아래에 있던 문제(검토 V2)를 푼다. 사유 전문은 상세 안에 남는다.
 */
export function RequestBar({ req, ev, saving, h, rejecting, onRejecting }: RequestDecisionProps) {
  const pending = req.status === 'pending'
  const n = blockSentences(req, ev).length
  return (
    <div data-decision-bar={req.id} className="sticky bottom-0 z-20 flex flex-col gap-2">
      {rejecting && pending && <RejectForm req={req} saving={saving} h={h} onRejecting={onRejecting} />}
      <SaveBar
        placement="bottom"
        dirty={0}
        saving={saving}
        canSave={!ev.blocked && !saving}
        onSave={pending ? h.onApprove : h.onShip}
        onRevert={() => undefined}
        showRevert={false}
        saveLabel={verb(req)}
        saveIcon={pending ? <Check size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
        blockReasonId={ev.blocked ? 'si-decision-block' : undefined}
        saveButtonProps={{ 'data-action': pending ? 'approve' : 'ship' }}
        secondary={<SecondaryAction req={req} saving={saving} h={h} rejecting={rejecting} onRejecting={onRejecting} className="flex-1 max-sm:min-h-11 sm:flex-none" />}
      >
        <span aria-live="polite" className="font-semibold tabular-nums text-text">
          {saving ? '처리 중…' : `${req.id} ${REQ_STATUS_LABEL[req.status]}`}
        </span>
        <span className="tabular-nums text-muted">
          차단 {ev.blockCount} · 주의 {ev.warnCount}
        </span>
        {ev.blocked && (
          <span id="si-decision-block" className="text-xs font-medium text-negative">
            {verb(req)}할 수 없습니다 · 사유 {n}건
          </span>
        )}
      </SaveBar>
    </div>
  )
}

/** 시트·서랍 아래 줄: 결정 바와 같은 동작(시트를 닫지 않고 결정한다, 390px은 44px) */
export function RequestFooter({ req, ev, saving, h, rejecting, onRejecting }: RequestDecisionProps) {
  const pending = req.status === 'pending'
  const n = blockSentences(req, ev).length
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {rejecting && pending && <RejectForm req={req} saving={saving} h={h} onRejecting={onRejecting} />}
      <div className="flex items-center justify-between gap-2">
        <span className={`min-w-0 text-xs tabular-nums ${ev.blocked ? 'font-semibold text-negative' : 'text-muted'}`} aria-live="polite">
          {ev.blocked ? `${verb(req)}할 수 없습니다 · 사유 ${n}건` : `차단 ${ev.blockCount} · 주의 ${ev.warnCount}`}
        </span>
        <span className="flex shrink-0 gap-2">
          <SecondaryAction req={req} saving={saving} h={h} rejecting={rejecting} onRejecting={onRejecting} className="min-h-11" />
          <Button
            variant="primary"
            data-action={pending ? 'approve' : 'ship'}
            icon={saving ? <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : pending ? <Check size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            disabled={ev.blocked || saving}
            onClick={pending ? h.onApprove : h.onShip}
            className="min-h-11 px-5"
          >
            {verb(req)}
          </Button>
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 닫힌 요청

interface ShippedRow {
  key: string
  line: string
  qty: string
  lot: string
  date: string
}

function ClosedItems({ req, d, onOpenLot }: { req: Req; d: Derived; onOpenLot: (id: string) => void }) {
  if (req.status === 'rejected')
    return (
      <section aria-label="품목" className="flex flex-col gap-2 text-[13px]">
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
          <span className="font-semibold">반려 사유</span> · {req.rejectReason}
        </div>
        <ul className="flex flex-col gap-1">
          {req.items.map(it => (
            <li key={it.line} className="flex justify-between gap-2 border-b border-border py-1 last:border-b-0">
              <span>{lineLabel(it.line)}</span>
              <span className="tabular-nums">{fmtQty(it.qty, it.unit)}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  const rows: ShippedRow[] = []
  for (const r of d.rows)
    for (const e of r.lot.events)
      if (e.kind === 'out' && e.req === req.id)
        rows.push({
          key: `${r.lot.id}-${e.date}`,
          line: r.lot.line,
          qty: e.g != null ? fmtQty(e.g, 'g') : fmtQty(e.grains ?? 0, '립'),
          lot: r.lot.id,
          date: e.date,
        })
  const cols: DataTableColumn<ShippedRow>[] = [
    { key: 'line', header: '계통', format: v => lineLabel(String(v)) },
    { key: 'qty', header: '수량', numeric: true },
    {
      key: 'lot',
      header: '출고 로트',
      format: v => (
        <button type="button" className="font-semibold tabular-nums text-accent hover:underline" onClick={() => onOpenLot(String(v))}>
          {String(v)}
        </button>
      ),
    },
    {
      key: 'date',
      header: '출고일',
      numeric: true,
      format: v => <span className="tabular-nums">{String(v)}</span>,
    },
  ]
  return (
    <section aria-label="출고 품목" className="flex flex-col gap-2">
      <h4 className="text-[13px] font-bold text-text">출고 품목 {rows.length}개</h4>
      <DataTable columns={cols} rows={rows} rowKey="key" dense maxHeight={320} caption={`${req.id} 출고 품목`} />
    </section>
  )
}

function History({ req }: { req: Req }) {
  const steps: { label: string; date?: string; note?: string }[] = [
    { label: '요청', date: req.date },
    ...(req.external && req.mta === 'signed' ? [{ label: 'MTA 체결', date: req.mtaDate }] : []),
    ...(req.approved ? [{ label: '승인', date: req.approved }] : []),
    ...(req.shipped ? [{ label: '출고', date: req.shipped }] : []),
    ...(req.rejected ? [{ label: '반려', date: req.rejected, note: req.rejectReason }] : []),
  ]
  return (
    <section aria-label="처리 이력" className="border-t border-border pt-3">
      <h4 className="mb-1.5 text-[13px] font-bold text-text">처리 이력</h4>
      <ol className="flex flex-col gap-1 text-xs">
        {steps.map(s => (
          <li key={s.label} className="flex flex-wrap gap-x-2">
            <span className="w-16 shrink-0 font-semibold text-text">{s.label}</span>
            <span className="tabular-nums text-muted">{s.date}</span>
            {s.note && <span className="text-muted">· {s.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
