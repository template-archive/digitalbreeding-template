import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ScrollRegion, Segmented, SeverityTag } from '@/design-system'
import { PLATE_ALERT_PCT, PLATE_SUMMARIES, PLATFORMS, isUnresolved, type FailSample, type Month, type PlatformKey, type PlateSummary } from '../data'
import { STATUS_TONE, d1, pct1, platformVar } from './shared'

export type StatusFilter = 'all' | 'open' | 'done'
export type PlatformFilter = 'all' | PlatformKey

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'open', label: '미해결' },
  { value: 'done', label: '완료' },
]
const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '6K', label: '6K' },
  { value: 'KASP', label: 'KASP' },
  { value: 'GBS', label: 'GBS' },
]

/** 한 쪽의 플레이트 수: 샘플 행을 펼쳐도 표 높이가 페이지 나눔으로 끊기게(안쪽 세로 스크롤 없음) */
const PAGE_SIZE = 10

/** 미해결 → 경보 → 결과일 내림차순 */
const SORTED = [...PLATE_SUMMARIES].sort(
  (a, b) => Number(b.unresolved > 0) - Number(a.unresolved > 0) || Number(b.alert) - Number(a.alert) || b.resulted.localeCompare(a.resulted) || a.id.localeCompare(b.id),
)

function callLabel(f: FailSample) {
  if (f.kind === 'KASP_PI9') return `${f.called}/16(Pi9 미호출)`
  if (f.platform === 'KASP') return `${f.called}/16`
  return `${f.callRate.toFixed(2)}%`
}
function reCallLabel(f: FailSample) {
  if (f.platform === 'KASP') return f.reCalled ? `${f.reCalled}/16` : '–'
  return f.reCallRate !== undefined ? `${f.reCallRate.toFixed(2)}%` : '–'
}
function causeLabel(f: FailSample) {
  if (f.kind === 'ID' && f.nonParent !== undefined) return `${f.cause}(비부모 대립유전자 ${f.nonParent.toFixed(1)}%)`
  return f.cause
}

export interface FailTableProps {
  month: Month | null
  onClearMonth: () => void
  crOnly: boolean
  onClearCr: () => void
  status: StatusFilter
  onStatus: (s: StatusFilter) => void
  platform: PlatformFilter
  onPlatform: (p: PlatformFilter) => void
  className?: string
}

/** G. 실패 샘플 목록 — 플레이트 단위 행, 펼치면 샘플 행 */
export function FailTable({ month, onClearMonth, crOnly, onClearCr, status, onStatus, platform, onPlatform, className }: FailTableProps) {
  // 기본은 접는다: 경보 플레이트 샘플 15행이 표를 차지하던 문제. 경보 플레이트는 버튼 하나로 펼친다
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(0)

  const sampleFilter = (f: FailSample) => {
    if (status === 'open' && !isUnresolved(f.status)) return false
    if (status === 'done' && isUnresolved(f.status)) return false
    if (crOnly && f.kind !== 'CR') return false
    return true
  }

  const rows = useMemo(() => {
    const pf: PlatformFilter = crOnly ? '6K' : platform
    return SORTED.flatMap(p => {
      if (pf !== 'all' && p.platform !== pf) return []
      if (month !== null && p.month !== month) return []
      const samples = p.samplesFailed.filter(sampleFilter)
      if (samples.length === 0) return []
      return [{ plate: p, samples }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, platform, month, crOnly])

  useEffect(() => setPage(0), [status, platform, month, crOnly])

  const sampleCount = rows.reduce((a, r) => a + r.samples.length, 0)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cur = Math.min(page, pages - 1)
  const pageRows = rows.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE)
  const alertIds = rows.filter(r => r.plate.alert && r.plate.unresolved > 0).map(r => r.plate.id)
  const alertOpen = alertIds.length > 0 && alertIds.every(id => expanded.has(id))
  // 미해결 필터에서는 모든 플레이트를 펼쳐 샘플 행을 바로 센다
  const isOpen = (id: string) => status === 'open' || expanded.has(id)
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOpen = rows.length > 0 && rows.every(r => isOpen(r.plate.id))

  return (
    <Card
      className={className}
      title="실패 샘플 목록"
      subtitle="1차 QC 미통과 샘플이 있는 플레이트 · 미해결 → 경보 → 결과일 최신순 · 행을 누르면 샘플 행을 펼칩니다"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 touch:gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">재분석 상태</span>
          <Segmented size="sm" ariaLabel="재분석 상태 필터" options={STATUS_OPTIONS} value={status} onChange={onStatus} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">플랫폼</span>
          <Segmented size="sm" ariaLabel="플랫폼 필터" options={PLATFORM_OPTIONS} value={crOnly ? '6K' : platform} onChange={v => { onClearCr(); onPlatform(v) }} />
        </div>
        {(month !== null || crOnly) && (
          <div className="flex flex-wrap items-center gap-2">
            {month !== null && (
              <button type="button" onClick={onClearMonth} className="touch-hit inline-flex items-center gap-1 rounded-full border border-text/40 bg-active px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-2">
                결과일 {month}월 <X size={12} aria-hidden="true" />
                <span className="sr-only">필터 해제</span>
              </button>
            )}
            {crOnly && (
              <button type="button" onClick={onClearCr} className="touch-hit inline-flex items-center gap-1 rounded-full border border-text/40 bg-active px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-2">
                6K · 콜레이트 미달 <X size={12} aria-hidden="true" />
                <span className="sr-only">필터 해제</span>
              </button>
            )}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted tabular-nums touch:gap-y-3">
          <span aria-live="polite" className="whitespace-nowrap">
            플레이트 <b className="text-text">{rows.length}</b>장 · 실패 샘플 <b className="text-text">{sampleCount}</b>개
          </span>
          {status !== 'open' && alertIds.length > 0 && (
            <button
              type="button"
              className="touch-hit whitespace-nowrap rounded-sm px-1 font-medium text-text underline decoration-border underline-offset-2 hover:decoration-text"
              onClick={() =>
                setExpanded(prev => {
                  const next = new Set(prev)
                  for (const id of alertIds) {
                    if (alertOpen) next.delete(id)
                    else next.add(id)
                  }
                  return next
                })
              }
            >
              {alertOpen ? '경보 플레이트 접기' : '경보 플레이트 펼치기'}
            </button>
          )}
          {status !== 'open' && rows.length > 0 && (
            <button
              type="button"
              className="touch-hit whitespace-nowrap rounded-sm px-1 font-medium text-text underline decoration-border underline-offset-2 hover:decoration-text"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(rows.map(r => r.plate.id)))}
            >
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="조건에 맞는 실패 샘플이 없습니다" description="필터를 바꾸거나 해제해 보세요." />
      ) : (
        <ScrollRegion label="실패 샘플 목록" hint="옆으로 밀어 나머지 열 보기 →" className="rounded-md border border-border">
          {/* 로컬 표 머리는 DataTable과 같은 모양: 채운 띠 없음, 12px 회색, 머리 아래 선이 가장 진함, 숫자·날짜 오른쪽 정렬.
              390px는 플레이트 · 실패율 · 재분석 상태만(결론 열이 화면 안), 나머지 열은 sm 이상 */}
          <table className="w-full border-separate border-spacing-0 text-[13px] tabular-nums sm:min-w-[980px]">
            <caption className="sr-only">2026년 1차 QC 실패 샘플이 있는 플레이트 목록. 행을 펼치면 실패 샘플이 나온다.</caption>
            <thead className="text-xs text-muted">
              <tr className="text-left [&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-text/25 [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                <th scope="col" className="w-8"><span className="sr-only">펼치기</span></th>
                <th scope="col">플레이트 ID</th>
                <th scope="col" className="hidden sm:table-cell">플랫폼</th>
                <th scope="col" className="hidden text-right sm:table-cell">접수일</th>
                <th scope="col" className="hidden text-right sm:table-cell">결과일</th>
                <th scope="col" className="hidden text-right sm:table-cell">시료</th>
                <th scope="col" className="hidden text-right sm:table-cell">실패</th>
                <th scope="col" className="text-right">실패율</th>
                <th scope="col" className="hidden sm:table-cell">주요 원인</th>
                <th scope="col">재분석 상태</th>
                <th scope="col" className="hidden text-right sm:table-cell">완료·예정일</th>
              </tr>
            </thead>
            <tbody className="[&>tr:not(:first-child)>td]:border-t [&>tr>td]:border-border/70">
              {pageRows.map(({ plate, samples }) => (
                <PlateRows key={plate.id} plate={plate} samples={samples} open={isOpen(plate.id)} onToggle={() => toggle(plate.id)} locked={status === 'open'} />
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}
      {pages > 1 && (
        // 모양은 공통 DataTable 페이지 나눔과 같다(로컬 표라 직접 둔다)
        <nav aria-label="실패 샘플 목록 페이지" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted tabular-nums">
          <span>
            {cur * PAGE_SIZE + 1}–{Math.min((cur + 1) * PAGE_SIZE, rows.length)} / {rows.length}장
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} aria-hidden="true" />} disabled={cur === 0} onClick={() => setPage(cur - 1)}>
              이전
            </Button>
            <span aria-live="polite">
              {cur + 1} / {pages}쪽
            </span>
            <Button size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
              다음
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
      <p className="mt-2 text-xs text-muted">
        플레이트 경보: 실패율 &gt; {PLATE_ALERT_PCT}% · 웰은 시료 웰 A01~H10(H11 양성 대조, H12 음성 대조(NTC) 제외) · KASP 콜레이트 = 호출 마커/16(미호출 1개 이하 통과, 단 MAS 대상 유전자 마커(Pi9 등)는 1개만 미호출이어도 실패) · GBS 콜레이트 = 1 − 결측률
      </p>
    </Card>
  )
}

function PlateRows({ plate, samples, open, onToggle, locked }: { plate: PlateSummary; samples: FailSample[]; open: boolean; onToggle: () => void; locked: boolean }) {
  const unresolved = plate.unresolved > 0
  return (
    <Fragment>
      <tr
        className={[
          plate.alert ? 'bg-negative/5' : '',
          locked ? '' : 'cursor-pointer hover:bg-surface-2',
        ].join(' ')}
        onClick={locked ? undefined : onToggle}
      >
        <td className="px-2 py-2">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${plate.id} 실패 샘플 ${samples.length}개 ${open ? '접기' : '펼치기'}`}
            disabled={locked}
            onClick={e => {
              e.stopPropagation()
              onToggle()
            }}
            className="touch-hit grid size-6 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
          >
            <ChevronRight size={14} aria-hidden="true" className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </button>
        </td>
        <td className="whitespace-nowrap px-2 py-2 font-mono text-xs font-semibold text-text">{plate.id}</td>
        <td className="hidden whitespace-nowrap px-2 py-2 text-text sm:table-cell">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-2 rounded-[2px]" style={{ background: platformVar(plate.platform) }} />
            {PLATFORMS[plate.platform].name}
          </span>
        </td>
        <td className="hidden whitespace-nowrap px-2 py-2 text-right text-muted sm:table-cell">{plate.received}</td>
        <td className="hidden whitespace-nowrap px-2 py-2 text-right text-text sm:table-cell">{plate.resulted}</td>
        <td className="hidden px-2 py-2 text-right text-text sm:table-cell">{plate.samples}</td>
        <td className="hidden px-2 py-2 text-right font-semibold text-text sm:table-cell">{plate.fails}</td>
        <td className="whitespace-nowrap px-2 py-2 text-right">
          {plate.alert ? (
            // 플레이트 경보 태그는 숫자 앞(숫자 끝 정렬 유지), 공통 심각도 태그 규격. 390px는 아이콘만(결론 열 재분석 상태가 화면 안에 남게)
            <span className="inline-flex items-center gap-1.5">
              <span className="hidden sm:inline-flex">
                <SeverityTag severity="critical" label="플레이트 경보" />
              </span>
              <span className="inline-flex sm:hidden">
                <AlertOctagon size={14} aria-hidden="true" className="text-negative" />
                <span className="sr-only">플레이트 경보</span>
              </span>
              <span className="font-bold text-negative">{pct1(plate.failRate)}</span>
            </span>
          ) : (
            <span className="text-text">{pct1(plate.failRate)}</span>
          )}
        </td>
        <td className="hidden max-w-[240px] px-2 py-2 text-text sm:table-cell">{plate.mainCause}</td>
        <td className="px-2 py-2">
          <span className="flex flex-col items-start gap-0.5">
            <Badge tone={STATUS_TONE[plate.status]}>{plate.status}{unresolved ? ` ${plate.unresolved}` : ''}</Badge>
            {plate.statusDetail.includes('·') && <span className="text-[11px] text-muted">{plate.statusDetail}</span>}
          </span>
        </td>
        <td className={['hidden whitespace-nowrap px-2 py-2 text-right sm:table-cell', unresolved ? 'font-semibold text-text' : 'text-muted'].join(' ')}>
          {plate.date ?? '–'}
          {unresolved && <span className="ml-1 text-[11px] font-normal text-muted">예정</span>}
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-2/50">
          <td />
          <td colSpan={10} className="px-2 pb-3 pt-1">
            <table className="w-full border-collapse text-xs tabular-nums">
              <caption className="sr-only">{plate.id} 실패 샘플</caption>
              <thead className="text-muted">
                <tr className="text-left [&>th]:whitespace-nowrap [&>th]:border-b [&>th]:border-text/25 [&>th]:py-1.5 [&>th]:font-medium">
                  <th scope="col" className="pr-3">샘플 ID</th>
                  <th scope="col" className="hidden pr-3 sm:table-cell">웰</th>
                  <th scope="col" className="pr-3 text-right">콜레이트</th>
                  <th scope="col" className="hidden pr-3 text-right sm:table-cell">이형접합도</th>
                  <th scope="col" className="hidden pr-3 sm:table-cell">실패 원인</th>
                  <th scope="col" className="hidden pr-3 sm:table-cell">조치</th>
                  <th scope="col" className="pr-3">상태</th>
                  <th scope="col" className="hidden text-right sm:table-cell">재분석 콜레이트</th>
                </tr>
              </thead>
              <tbody>
                {samples.map(f => (
                  <tr key={`${f.id}-${f.well}`} className="border-b border-border/70 last:border-b-0">
                    <td className="py-1.5 pr-3 align-top">
                      <span className="block whitespace-nowrap font-mono text-text">{f.id}</span>
                      {/* 390px: 실패 원인 열 대신 샘플 ID 아래 한 줄 */}
                      <span className="mt-0.5 block text-[11px] text-muted sm:hidden">{causeLabel(f)}</span>
                    </td>
                    <td className="hidden py-1.5 pr-3 font-mono text-muted sm:table-cell">{f.well}</td>
                    <td className={['py-1.5 pr-3 text-right align-top sm:whitespace-nowrap', f.kind === 'CR' ? 'font-semibold text-warning' : 'text-text'].join(' ')}>{callLabel(f)}</td>
                    <td className={['hidden whitespace-nowrap py-1.5 pr-3 text-right sm:table-cell', f.kind === 'HET' ? 'font-semibold text-negative' : 'text-text'].join(' ')}>
                      {f.het !== undefined ? `${d1(f.het)}%` : '–'}
                    </td>
                    <td className="hidden py-1.5 pr-3 text-text sm:table-cell">{causeLabel(f)}</td>
                    <td className="hidden py-1.5 pr-3 text-muted sm:table-cell">{f.action}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3">
                      <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
                      {f.date && <span className="ml-1.5 hidden text-[11px] text-muted sm:inline">{f.date}</span>}
                    </td>
                    <td className="hidden whitespace-nowrap py-1.5 text-right text-text sm:table-cell">{reCallLabel(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
