import { Fragment, useEffect, useId, useRef, type ReactNode } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Badge, Button, KinBadge } from '@/design-system'
import { kinLevel } from '@/lib/genomics'
import { EXTRA, GENE_PANEL, KIND_LABEL, NODES, NO_GENO_REASON, SIBLING, YEAR_LABEL, coancestry, fParents, hasPheno, purdy } from '../data'
import { fmtF, fmtGebv } from './style'

interface Props {
  id: string
  isRoot: boolean
  /** 현재 계통도에서 등장 횟수 */
  count: number
  onClose: () => void
  onRedraw: (id: string) => void
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-border py-2 text-[13px] last:border-b-0">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </div>
  )
}

/** 노드 상세(오른쪽 서랍, 좁은 화면은 아래 시트) */
export function DetailPanel({ id, isRoot, count, onClose, onRedraw }: Props) {
  const p = NODES[id]!
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const f = fParents(id)
  const extra = EXTRA[id]
  const sib = SIBLING[id]

  useEffect(() => {
    closeRef.current?.focus()
  }, [id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[78vh] flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-2 md:inset-x-auto md:bottom-0 md:right-0 md:top-0 md:max-h-none md:w-[380px] md:rounded-none md:border-l md:border-t-0"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={p.kind === 'V' ? 'info' : 'neutral'}>{KIND_LABEL[p.kind]}</Badge>
            {isRoot && <Badge tone="neutral">기준 계통</Badge>}
          </div>
          <h2 id={titleId} className="mt-1 text-lg font-bold leading-tight text-text">
            {p.name ?? p.id}
          </h2>
          {p.name && <p className="text-[13px] text-muted tabular-nums">{p.id}</p>}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="상세 닫기(Esc)" className="touch-hit rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <dl>
          <Row k={`${YEAR_LABEL[p.kind]} 연도`}>{p.year}</Row>
          <Row k="교배 조합">
            {purdy(p) ? (
              <span className="font-semibold">{purdy(p)}</span>
            ) : (
              <span className="text-muted">{p.kind === 'G' ? '도입 유전자원(계보 기록 없음)' : '기초 계통(계보 기록 없음)'}</span>
            )}
          </Row>
          {p.filing && <Row k="출원·등록">{p.filing}</Row>}
          <Row k="주요 형질">{p.trait}</Row>
          <Row k="보유 유전자">
            {p.genes.length ? (
              <span className="flex flex-wrap gap-1">
                {p.genes.map(g => (
                  <span key={g} className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-semibold italic text-text">
                    {g}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted">
                {p.kind === 'V' ? (
                  <>
                    조사 {GENE_PANEL.length}좌위(
                    {GENE_PANEL.map((g, i) => (
                      <Fragment key={g}>
                        {i > 0 && '·'}
                        <i>{g}</i>
                      </Fragment>
                    ))}
                    ) 비보유
                  </>
                ) : (
                  '기록 없음'
                )}
              </span>
            )}
          </Row>
          <Row k="GEBV(쌀 수량)">
            {p.gebv === null ? (
              <span className="text-muted">{NO_GENO_REASON}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
                <b className="text-base font-bold">{fmtGebv(p.gebv)}</b> kg/10a
                <span className="text-muted">r² {p.r2!.toFixed(2)}</span>
                {hasPheno(p) && <Badge tone="info">표현형 포함</Badge>}
              </span>
            )}
            {p.gebv !== null && <p className="mt-0.5 text-[11px] text-muted">2026-10 GBLUP 재추정 · 훈련 집단 평균 0 기준</p>}
          </Row>
          {extra?.gebvHistory && (
            <Row k="GEBV 이력">
              <ul className="flex flex-col gap-1">
                {extra.gebvHistory.map(h => (
                  <li key={h.k}>
                    <span className="mr-1 font-semibold">{h.k}</span>
                    <span className="tabular-nums">{h.v}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {extra?.rows.map(r => (
            <Row key={r.k} k={r.k}>
              <span className="tabular-nums">{r.v}</span>
            </Row>
          ))}
          <Row k="부모 간 공조계수">
            {f === null ? (
              <span className="text-muted">해당 없음(부모 기록 없음)</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
                <b className="text-base font-bold">f {fmtF(f)}</b>
                <span className="text-muted">({fmtF(f, 4)})</span>
                <KinBadge level={kinLevel(f)} />
              </span>
            )}
          </Row>
          {sib && (
            <Row k="형제 계통">
              <span className="tabular-nums">
                {sib}와의 공조계수 <b className="font-bold">{fmtF(coancestry(id, sib))}</b>
                <span className="text-muted"> ({fmtF(coancestry(id, sib), 4)})</span>
              </span>
              <p className="mt-0.5 text-[11px] text-muted">같은 교배 조합({purdy(p)})의 형제 계통 · 교배 조합 설계 화면의 값과 같음</p>
            </Row>
          )}
          <Row k="이 계통도에서">{isRoot ? '기준 계통' : `×${count}`}</Row>
        </dl>
      </div>

      <footer className="border-t border-border px-4 py-3">
        <Button variant="primary" className="w-full" disabled={isRoot} icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => onRedraw(id)}>
          {isRoot ? '현재 기준 계통입니다' : '이 계통을 기준으로 다시 그리기'}
        </Button>
      </footer>
    </aside>
  )
}
