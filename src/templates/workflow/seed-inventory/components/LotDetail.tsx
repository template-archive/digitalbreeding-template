import type { ReactNode } from 'react'
import { Card, Badge, DataTable, useMediaQuery, type DataTableColumn } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { CAT_LABEL, GERM_FAIL, GERM_LABEL, GERM_PASS, LINES, eventG, lineLabel, type Derived, type LotRow } from '../data'
import { CatBadge, DueCell, GermCell, LotStatusBadge, StockBar, fmtG, fmtGrains, fmtQty, fmtSmallG } from './ui'

interface LedgerRow {
  key: string
  date: string
  kind: string
  qty: string
  balance: string
  req?: string
  note: string
}

const KIND: Record<string, string> = {
  test: '발아 검사',
  out: '출고',
  sow: 'F1 파종',
}

/** plain = 시트·서랍 안(카드 틀 없음) */
export function LotDetail({ r, d, onOpenLot, onOpenReq, plain, titleId }: { r: LotRow; d: Derived; onOpenLot: (id: string) => void; onOpenReq: (id: string) => void; plain?: boolean; titleId?: string }) {
  const narrow = useMediaQuery('(max-width: 639px)')
  const L = r.lot
  const ln = d.lines.get(L.line)!
  const def = LINES.get(L.line)!
  const unit = L.unit
  // 이력 원장: 반입량에서 차례로 뺀 잔량(마지막 잔량 = 표의 재고)
  const ledger: LedgerRow[] = []
  if (L.intake != null) {
    let b = L.intake
    ledger.push({
      key: 'in',
      date: L.intakeDate ?? '',
      kind: '입고',
      qty: `+${fmtQty(L.intake, unit)}`,
      balance: fmtQty(b, unit),
      note: L.source,
    })
    L.events.forEach((e, i) => {
      const dq = unit === '립' ? (e.kind === 'test' ? 0 : (e.grains ?? 0)) : eventG(L, e)
      b -= dq
      const q = unit === '립' ? `−${formatNumber(dq)}립` : e.g != null ? `−${fmtG(dq)} g` : `−${formatNumber(e.grains ?? 0)}립(${fmtSmallG(dq)} g)`
      ledger.push({
        key: String(i),
        date: e.date,
        kind: KIND[e.kind] ?? e.kind,
        qty: q,
        balance: fmtQty(b, unit),
        req: e.req,
        note: [e.use, e.note].filter(Boolean).join(' · '),
      })
    })
  }
  const cols: DataTableColumn<LedgerRow>[] = [
    {
      key: 'date',
      header: '날짜 · 구분',
      format: (v, row) => (
        <span className="inline-flex flex-col">
          <span className="whitespace-nowrap tabular-nums">{String(v)}</span>
          <span className="text-[11px] text-muted">{row.kind}</span>
        </span>
      ),
    },
    {
      key: 'qty',
      header: '수량',
      numeric: true,
      format: v => <span className="whitespace-nowrap tabular-nums">{String(v)}</span>,
    },
    {
      key: 'balance',
      header: '잔량',
      numeric: true,
      format: v => <span className="whitespace-nowrap font-semibold tabular-nums">{String(v)}</span>,
    },
    {
      key: 'note',
      header: '요청 ID · 비고',
      sortable: false,
      format: (v, row) => (
        <span className="block min-w-[6rem] whitespace-normal text-xs">
          {row.req && (
            <button type="button" className="mr-1 font-semibold tabular-nums text-accent hover:underline" onClick={() => onOpenReq(row.req!)}>
              {row.req}
            </button>
          )}
          <span className="text-muted [overflow-wrap:anywhere]">{String(v)}</span>
        </span>
      ),
    },
  ]
  const others = ln.lots.filter(l => l.id !== L.id)
  const tests = L.tests
  const body = (
    <>
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className="text-lg font-bold tabular-nums text-text">{L.id}</h3>
          <LotStatusBadge status={r.status} />
          <CatBadge cat={L.cat} />
        </div>
        <p className="text-[13px] font-semibold text-text">
          {lineLabel(L.line)}
          {def.group && (
            <span className="ml-1 font-normal text-muted">
              · 그룹 {def.group} · 가계 {def.family}
            </span>
          )}
          {L.female && <span className="ml-1 font-normal text-muted">· 모본 {L.female}</span>}
        </p>
        {L.memo && <p className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-1.5 text-xs text-text">메모 · {L.memo}</p>}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <Info label="재고">
          {r.bal == null ? '입고 대기' : fmtQty(r.bal, unit)}
          {r.bal != null && unit === 'g' && <span className="block font-normal text-muted">{fmtGrains(r.bal, L.tgw)}</span>}
        </Info>
        <Info label="천립중(정조)">{L.tgw.toFixed(1)} g</Info>
        <Info label="수확 연도 · 세대">
          {L.harvestYear} · {L.gen}
        </Info>
        <Info label="생산 포장">{L.source}</Info>
        <Info label="입고일">{L.intakeDate ?? '—'}</Info>
        <Info label="보관 위치">
          저장고 {L.storage} · 선반 R{String(L.shelf).padStart(2, '0')} · {L.box}
          <span className="block font-normal tabular-nums text-muted">{L.barcode}</span>
        </Info>
      </dl>

      <section aria-label="계통 가용 재고" className={`rounded-md border px-3 py-2 text-xs ${ln.below ? 'border-negative/40 bg-negative/5' : 'border-border bg-surface-2'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold text-text">
            계통 가용 재고 / 최소 보유량 <span className="font-normal text-muted">({CAT_LABEL[ln.minCat]} 기준)</span>
          </span>
          <span className="font-bold tabular-nums text-text">{ln.unit === 'g' ? `${fmtG(ln.avail)} / ${formatNumber(ln.min)} g` : `${formatNumber(ln.avail)} / ${formatNumber(ln.min)}립`}</span>
        </div>
        <StockBar value={ln.avail} min={ln.min} alarm={ln.below} />
        <p className="mt-1 text-muted">
          {ln.below ? '최소 보유량 미달 — ' : ''}가용 = 이 계통의 &lsquo;사용 가능&rsquo; 로트 재고 합(검사 중 로트 포함)
          {ln.hold ? ' · 사용 보류 로트는 제외' : ''}
        </p>
      </section>

      <section aria-label="발아 검사 이력">
        <h4 className="mb-1 text-[13px] font-bold text-text">발아 검사</h4>
        {L.unit === '립' ? (
          <p className="text-xs text-muted">F1 소량 종자는 발아 검사 제외(진위 검정 후 파종)</p>
        ) : (
          <>
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <GermCell germ={r.germ} />
              <span className="text-muted">재검사 기한</span>
              <DueCell germ={r.germ} />
            </div>
            <ul className="flex flex-col gap-0.5 text-xs">
              {tests.map(t => (
                <li key={t.date} className="flex flex-wrap gap-x-2 tabular-nums">
                  <span className="text-muted">{t.date !== t.resultDate ? `치상 ${t.date} → 판정 ${t.resultDate}` : `판정 ${t.resultDate}`}</span>
                  <span className="font-semibold text-text">{t.germ == null ? '검사 중' : `${t.germ}%`}</span>
                  {t.germ != null && <span className="text-muted">{GERM_LABEL[t.germ >= GERM_PASS ? 'pass' : t.germ >= GERM_FAIL ? 'caution' : 'fail']}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="이력 원장" className="flex flex-col gap-1.5">
        <h4 className="text-[13px] font-bold text-text">이력 원장</h4>
        {ledger.length ? (
          narrow ? (
            // 390px: 표 대신 2줄 항목(요청 ID 열이 가로 스크롤 뒤에 잘리지 않게, 검토 V5)
            <ul aria-label={`${L.id} 이력 원장`} className="flex flex-col">
              {ledger.map(row => (
                <li key={row.key} data-ledger-row="" className="flex flex-col gap-0.5 border-b border-border py-1.5 text-xs last:border-b-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 text-muted">
                      <span className="whitespace-nowrap tabular-nums text-text">{row.date}</span> · {row.kind}
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-text">
                      {row.qty} · <b className="font-semibold">{row.balance}</b>
                    </span>
                  </span>
                  {(row.req || row.note) && (
                    <span className="min-w-0 text-muted">
                      {row.req && (
                        <button type="button" className="touch-hit-y mr-1 font-semibold tabular-nums text-accent hover:underline" onClick={() => onOpenReq(row.req!)}>
                          {row.req}
                        </button>
                      )}
                      <span className="[overflow-wrap:anywhere]">{row.note}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <DataTable columns={cols} rows={ledger} rowKey="key" dense caption={`${L.id} 이력 원장`} maxHeight={360} />
          )
        ) : (
          <p className="text-xs text-muted">결실 립수가 입력되지 않아 원장이 없습니다. 교배 실적 기록에서 립수를 입력하면 입고됩니다.</p>
        )}
      </section>

      {others.length > 0 && (
        <section aria-label="같은 계통의 다른 로트" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">같은 계통의 다른 로트</span>
          {others.map(o => (
            <button key={o.id} type="button" onClick={() => onOpenLot(o.id)} className="rounded-sm">
              <Badge tone="info">
                {o.id} · {o.harvestYear}
              </Badge>
            </button>
          ))}
        </section>
      )}
    </>
  )
  return plain ? (
    <div data-lot-id={L.id} className="flex flex-col gap-4">
      {body}
    </div>
  ) : (
    <Card padding="md" className="flex flex-col gap-4">
      {body}
    </Card>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-text">{children}</dd>
    </div>
  )
}
