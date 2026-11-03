import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeftRight, Ban, Keyboard, Search, X } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  Toast,
  useMediaQuery,
  useToast,
  HATCH_MISSING_DENSE,
  type AlertListItem,
} from '@/design-system'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import {
  AS_OF,
  DRAFT,
  ENTRY_BY_NO,
  INITIAL_ACTIVE,
  PLOTS,
  PLOT_BY_NO,
  PLOTS_BY_ENTRY,
  REMOTE,
  SAVED,
  SESSION,
  SOWING,
  TOTAL_CELLS,
  TRAITS,
  TRAIT_KEYS,
  TRIAL,
  cellKey,
  normalizeQuery,
  parseInput,
  parseKey,
  sameValue,
  validateAll,
  type CellMap,
  type CellValue,
  type RemoteChange,
  type TraitKey,
} from './data'
import { EntryGrid, displayStatus, type ActiveCell, type GridCol } from './components/EntryGrid'
import { CellDetail } from './components/CellDetail'
import { SaveBar, type SaveState } from './components/SaveBar'
import { RepProgress, TraitProgressList, type TraitProgress } from './components/ProgressBars'
import { STATUS_GLYPH, formatCell, type DisplayStatus } from './components/cells'

export const meta: TemplateMeta = {
  slug: 'phenotype-entry',
  category: 'workflow',
  title: '표현형 데이터 입력',
  description: '생산력 검정 시험포장의 조사 형질 값을 야장 순서대로 입력하고, 불가능 값·허용 범위·반복 간 편차를 즉시 검증해 저장·충돌 상태까지 관리한다.',
  tags: ['표현형', '야장 입력', '생산력 검정', 'AYT', '데이터 검증', '결측', '시험포장', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type DevState = 'ready' | 'loading' | 'empty' | 'error'
function readQuery() {
  if (typeof window === 'undefined') return { state: 'ready' as DevState, saveError: false }
  const q = new URLSearchParams(window.location.search)
  const s = q.get('state')
  return {
    state: (s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready') as DevState,
    saveError: q.get('save') === 'error',
  }
}

type RepFilter = 'all' | '1' | '2' | '3'
type StatusFilter = 'all' | 'error' | 'warn' | 'missing' | 'empty' | 'dirty' | 'conflict'
type Change = { key: string; next: CellValue | undefined }
type UndoEntry = { key: string; prev: CellValue | undefined }[]

const DESKTOP_COLS: GridCol[] = [
  { id: 'plot', width: 52, left: 0 },
  { id: 'rep', width: 36, left: 52 },
  { id: 'block', width: 40, left: 88 },
  { id: 'entry', width: 44, left: 128 },
  { id: 'name', width: 150, left: 172 },
  ...TRAIT_KEYS.map(t => ({ id: t, width: 86, trait: t })),
]
const MOBILE_COLS: GridCol[] = [
  { id: 'plot', width: 88, left: 0 },
  { id: 'rep', width: 40 },
  ...TRAIT_KEYS.map(t => ({ id: t, width: 76, trait: t })),
]

const delay = 900
/** 768~1279px 셀 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const query0 = useMemo(readQuery, [])
  const devState = query0.state
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (devState === 'loading') return
    const t = window.setTimeout(() => setLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [devState])

  const narrow = useMediaQuery('(max-width: 767px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const columns = narrow ? MOBILE_COLS : DESKTOP_COLS
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  // ---- 칸 상태 ----
  const [server, setServer] = useState<CellMap>(SAVED)
  const [values, setValues] = useState<CellMap>(() => ({ ...SAVED, ...DRAFT }))
  const [remote, setRemote] = useState<Record<string, RemoteChange>>(REMOTE)
  const [conflicts, setConflicts] = useState<Record<string, RemoteChange>>({})
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState<Set<string>>(() => new Set())
  const [savedAt, setSavedAt] = useState(SESSION.savedAt)
  const [draftNote, setDraftNote] = useState<string | null>(`로컬 초안 ${Object.keys(DRAFT).length}칸 복원됨(${SESSION.draftAt} 자동 임시 저장)`)
  const [undo, setUndo] = useState<UndoEntry[]>([])
  const [message, setMessage] = useState('')
  const valuesRef = useRef(values)
  valuesRef.current = values

  // ---- 필터·활성 칸 ----
  const [rep, setRep] = useState<RepFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ActiveCell>({ plot: INITIAL_ACTIVE.plot, col: INITIAL_ACTIVE.trait })
  const [focusSignal, setFocusSignal] = useState(0)

  const checks = useMemo(() => validateAll(values), [values])
  const dirty = useMemo(() => {
    const s = new Set<string>()
    for (const p of PLOTS)
      for (const t of TRAIT_KEYS) {
        const k = cellKey(p.no, t)
        if (!conflicts[k] && !sameValue(values[k], server[k])) s.add(k)
      }
    return s
  }, [values, server, conflicts])

  const status = useCallback((k: string): DisplayStatus => displayStatus(k, checks, conflicts), [checks, conflicts])

  // ---- 집계(모두 칸 상태에서 계산) ----
  const stats = useMemo(() => {
    const cnt: Record<DisplayStatus, number> = { ok: 0, range: 0, dev: 0, error: 0, missing: 0, empty: 0, conflict: 0 }
    for (const k of checks.keys()) cnt[status(k)]++
    const filled = TOTAL_CELLS - cnt.empty
    const saved = Object.keys(server).length
    const traits: TraitProgress[] = TRAIT_KEYS.map(t => {
      let f = 0
      let un = 0
      for (const p of PLOTS) {
        const k = cellKey(p.no, t)
        if (values[k] === undefined) continue
        f++
        if (dirty.has(k) || conflicts[k]) un++
      }
      return { trait: t, filled: f, saved: f - un, unsaved: un, total: PLOTS.length }
    })
    const reps = [1, 2, 3].map(r => {
      const ps = PLOTS.filter(p => p.rep === r)
      let f = 0
      for (const p of ps) for (const t of TRAIT_KEYS) if (values[cellKey(p.no, t)] !== undefined) f++
      return { filled: f, total: ps.length * TRAIT_KEYS.length }
    })
    const dirtyErrors = [...dirty].filter(k => checks.get(k)!.status === 'error').length
    return { cnt, filled, saved, traits, reps, dirtyErrors }
  }, [checks, status, server, values, dirty, conflicts])

  const conflictCount = Object.keys(conflicts).length
  const dirtyCount = dirty.size
  const saveState: SaveState = saving ? 'saving' : conflictCount ? 'conflict' : dirtyCount ? 'unsaved' : 'saved'
  const canSave = !saving && dirtyCount > 0 && stats.dirtyErrors === 0
  const blockReason = stats.dirtyErrors > 0 ? `오류 ${stats.dirtyErrors}칸을 고친 뒤 저장할 수 있습니다` : null

  // ---- 행 필터 ----
  const rowMatches = useCallback(
    (no: number, f: StatusFilter) => {
      if (f === 'all') return true
      return TRAIT_KEYS.some(t => {
        const k = cellKey(no, t)
        const s = status(k)
        if (f === 'error') return s === 'error'
        if (f === 'warn') return s === 'range' || s === 'dev'
        if (f === 'missing') return s === 'missing'
        if (f === 'empty') return s === 'empty'
        if (f === 'dirty') return dirty.has(k)
        return s === 'conflict'
      })
    },
    [status, dirty],
  )
  const rowCounts = useMemo(() => {
    const out = {} as Record<StatusFilter, number>
    for (const f of ['all', 'error', 'warn', 'missing', 'empty', 'dirty', 'conflict'] as StatusFilter[]) out[f] = PLOTS.filter(p => rowMatches(p.no, f)).length
    return out
  }, [rowMatches])
  const visibleRows = useMemo(() => {
    const q = normalizeQuery(search)
    return PLOTS.filter(
      p =>
        (rep === 'all' || p.rep === Number(rep)) &&
        rowMatches(p.no, statusFilter) &&
        (!q || normalizeQuery(ENTRY_BY_NO.get(p.entry)!.name).includes(q)),
    )
  }, [rep, statusFilter, search, rowMatches])

  // 활성 셀이 필터로 숨으면 보이는 첫 행의 같은 열로
  useEffect(() => {
    if (!visibleRows.length) return
    if (!visibleRows.some(p => p.no === active.plot)) setActive(a => ({ plot: visibleRows[0]!.no, col: a.col }))
  }, [visibleRows, active.plot])
  // 좁은 화면에는 계통명 열이 없다
  useEffect(() => {
    if (!columns.some(c => c.id === active.col)) setActive(a => ({ ...a, col: 'plot' }))
  }, [columns, active.col])

  const resetFilters = () => {
    setRep('all')
    setStatusFilter('all')
    setSearch('')
  }

  // ---- 값 변경 ----
  const applyChanges = (changes: Change[], record = true) => {
    if (!changes.length) return
    const cur = valuesRef.current
    if (record) setUndo(u => [...u.slice(-49), changes.map(c => ({ key: c.key, prev: cur[c.key] }))])
    const next = { ...cur }
    for (const c of changes) {
      if (c.next === undefined) delete next[c.key]
      else next[c.key] = c.next
    }
    valuesRef.current = next
    setValues(next)
  }

  const onCommit = (key: string, text: string) => {
    const { trait } = parseKey(key)
    const next = parseInput(text, trait)
    if (sameValue(next, valuesRef.current[key])) return
    applyChanges([{ key, next }])
    setMessage('')
  }

  const onPaste = (cells: { key: string; text: string }[], ignored: number) => {
    const changes = cells.map(c => ({ key: c.key, next: parseInput(c.text, parseKey(c.key).trait) })).filter(c => !sameValue(c.next, valuesRef.current[c.key]))
    applyChanges(changes)
    toast.show(`붙여넣기 ${cells.length}칸${ignored ? ` · 그리드 밖 ${ignored}칸 무시` : ''}`, { tone: 'info' })
  }

  const doUndo = () => {
    const last = undo[undo.length - 1]
    if (!last) {
      setMessage('되돌릴 변경이 없습니다')
      return
    }
    setUndo(u => u.slice(0, -1))
    applyChanges(
      last.map(c => ({ key: c.key, next: c.prev })),
      false,
    )
    const first = parseKey(last[0]!.key)
    setMessage(`되돌림: 구 ${first.plot} ${TRAITS[first.trait].short}${last.length > 1 ? ` 외 ${last.length - 1}칸` : ''}`)
  }

  const revert = () => {
    if (!dirtyCount) return
    if (!window.confirm(`미저장 ${dirtyCount}칸을 서버 값으로 되돌릴까요? Ctrl+Z로 다시 살릴 수 있습니다.`)) return
    applyChanges([...dirty].map(k => ({ key: k, next: server[k] })))
    toast.show(`미저장 ${dirtyCount}칸을 서버 값으로 되돌렸습니다`, { tone: 'info' })
  }

  // ---- 저장(목업) ----
  const save = () => {
    if (!canSave) {
      if (blockReason) setMessage(blockReason)
      return
    }
    const snap = { ...valuesRef.current }
    const keys = [...dirty]
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      if (query0.saveError) {
        toast.show('저장하지 못했습니다 — 네트워크 오류(목업). 다시 시도하세요', { tone: 'negative', duration: 0 })
        return
      }
      const conf = keys.filter(k => remote[k])
      const ok = keys.filter(k => !remote[k])
      setServer(s => {
        const n = { ...s }
        for (const k of ok) {
          if (snap[k] === undefined) delete n[k]
          else n[k] = snap[k]!
        }
        return n
      })
      if (conf.length) setConflicts(c => ({ ...c, ...Object.fromEntries(conf.map(k => [k, remote[k]!])) }))
      setSavedAt(SESSION.nextSavedAt)
      setDraftNote(null)
      if (conf.length) toast.show(`${ok.length}칸 저장 · ${conf.length}칸 충돌 — 다른 사용자가 먼저 저장했습니다`, { tone: 'warning' })
      else toast.show(`${ok.length}칸을 저장했습니다`)
    }, delay)
  }
  const saveRef = useRef(save)
  saveRef.current = save
  const undoRef = useRef(doUndo)
  undoRef.current = doUndo

  const resolve = (key: string, how: 'server' | 'mine') => {
    const rc = conflicts[key]
    if (!rc) return
    const { plot, trait } = parseKey(key)
    const finish = () => {
      setConflicts(c => {
        const n = { ...c }
        delete n[key]
        return n
      })
      setRemote(r => {
        const n = { ...r }
        delete n[key]
        return n
      })
    }
    if (how === 'server') {
      applyChanges([{ key, next: rc.value }])
      setServer(s => ({ ...s, [key]: rc.value }))
      finish()
      toast.show(`구 ${plot} ${TRAITS[trait].short}: 서버 값 ${formatCell(rc.value, trait)}을 받았습니다`, { tone: 'info' })
      return
    }
    setResolving(r => new Set(r).add(key))
    window.setTimeout(() => {
      const mine = valuesRef.current[key]
      setServer(s => {
        const n = { ...s }
        if (mine === undefined) delete n[key]
        else n[key] = mine
        return n
      })
      finish()
      setResolving(r => {
        const n = new Set(r)
        n.delete(key)
        return n
      })
      toast.show(`구 ${plot} ${TRAITS[trait].short}: 내 값 ${formatCell(mine, trait)}으로 덮어썼습니다`)
    }, delay)
  }

  // ---- 전역 단축키·떠나기 경고 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        window.setTimeout(() => saveRef.current(), 0)
        return
      }
      if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const el = e.target as HTMLElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
        e.preventDefault()
        undoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hasUnsaved = dirtyCount > 0 || conflictCount > 0
  useEffect(() => {
    if (!hasUnsaved) return
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    // 갤러리 이동(해시 링크)도 확인 — 사용자가 링크를 눌렀을 때만
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]')
      if (!a) return
      if (!window.confirm('저장하지 않은 입력이 있습니다. 이 화면을 떠날까요?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBefore)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBefore)
      document.removeEventListener('click', onClick, true)
    }
  }, [hasUnsaved])

  // ---- 이동 ----
  const jumpTo = (plot: number, trait: TraitKey | null) => {
    if (!visibleRows.some(p => p.no === plot)) resetFilters()
    setActive({ plot, col: trait ?? 'plot' })
    setFocusSignal(s => s + 1)
  }
  // 셀 상세 시트: 입력 중에 저절로 열리지 않게 버튼으로만 연다. 시트 안 이동은 포커스를 격자로 뺏지 않는다
  const openDetail = () => {
    openerRef.current = document.activeElement as HTMLElement | null
    setSheetOpen(true)
  }
  const closeDetail = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.({ preventScroll: true }), 0)
  }
  const jumpInSheet = (plot: number, trait: TraitKey | null) => {
    if (!visibleRows.some(p => p.no === plot)) resetFilters()
    setActive({ plot, col: trait ?? 'plot' })
  }

  const othersText = useCallback(
    (plot: number, trait: TraitKey) => {
      const p = PLOT_BY_NO.get(plot)!
      return PLOTS_BY_ENTRY.get(p.entry)!
        .filter(q => q.no !== plot)
        .map(q => `${q.no} ${values[cellKey(q.no, trait)] === undefined ? '미입력' : formatCell(values[cellKey(q.no, trait)], trait)}`)
        .join(' · ')
    },
    [values],
  )

  // ---- 검증 목록 ----
  const alerts: AlertListItem[] = useMemo(() => {
    const items: (AlertListItem & { sortKey: number })[] = []
    for (const p of PLOTS)
      TRAIT_KEYS.forEach((t, ti) => {
        const k = cellKey(p.no, t)
        const s = status(k)
        if (s !== 'error' && s !== 'range' && s !== 'dev' && s !== 'conflict') return
        const T = TRAITS[t]
        const v = values[k]
        const c = checks.get(k)!
        const critical = s === 'error' || s === 'conflict'
        const rc = conflicts[k]
        items.push({
          id: k,
          severity: critical ? 'critical' : 'warning',
          title: `구 ${p.no} · ${T.short} ${formatCell(v, t)}${typeof v === 'number' ? ` ${T.unit}` : ''}`,
          value: s === 'conflict' ? '충돌' : c.tag,
          description: `${ENTRY_BY_NO.get(p.entry)!.name} — ${rc ? `서버 값 ${formatCell(rc.value, t)}(${rc.by}, ${rc.at})와 다름` : c.reason}`,
          icon: s === 'error' ? Ban : s === 'dev' ? NotEqualIcon : s === 'conflict' ? ArrowLeftRight : undefined,
          onClick: () => jumpTo(p.no, t),
          actionLabel: '— 이 칸으로 이동',
          sortKey: (critical ? 0 : 1) * 1e6 + p.no * 10 + ti,
        })
      })
    return items.sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey: _s, ...it }) => it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks, conflicts, values, status, visibleRows])

  const activePlot = PLOT_BY_NO.get(active.plot)!
  const activeTrait = columns.find(c => c.id === active.col)?.trait ?? null
  const warnCount = stats.cnt.range + stats.cnt.dev

  // 머리(공통 PageHeader): 범위·소속 회색 한 줄 → 제목 + 기준일 → 데이터 한 문장
  const header = (
    <PageHeader
      context={[`${TRIAL.crop} · ${TRIAL.name}`, TRIAL.program, TRIAL.field]}
      title={meta.title}
      scope={`${TRIAL.design} · ${PLOTS.length}구 × 조사 형질 ${TRAIT_KEYS.length}개 = ${TOTAL_CELLS}칸 · 야장 순서(구 번호 순) · 목업 데이터`}
      asOf={formatDate(AS_OF)}
    />
  )

  if (devState === 'error')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="조사 자료를 불러오지 못했습니다"
          description="시험포장 A-3의 조사 형질·저장값 서버에 연결할 수 없습니다. 입력한 로컬 초안은 브라우저에 남아 있습니다."
          action={<Button onClick={() => window.location.reload()}>다시 시도</Button>}
        />
      </div>
    )

  if (loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={56} />
        <KpiRow loading hero count={4} skeletonHeight={116} />
        <Skeleton height={120} />
        <div className="grid gap-4 xl:grid-cols-4">
          <Skeleton height={560} className="xl:col-span-3" />
          <Skeleton height={560} />
        </div>
        <span className="sr-only">조사 자료를 불러오는 중</span>
      </div>
    )

  if (devState === 'empty')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="이 시험에 등록된 조사 형질이 없습니다" description="시험 설계에서 조사 형질(야장 항목)을 등록하면 입력 그리드가 여기에 나옵니다." />
      </div>
    )

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: `전체 (${rowCounts.all}행)` },
    { value: 'error', label: `오류 (${rowCounts.error}행)` },
    { value: 'warn', label: `주의 (${rowCounts.warn}행)` },
    { value: 'missing', label: `결측 (${rowCounts.missing}행)` },
    { value: 'empty', label: `미입력 (${rowCounts.empty}행)` },
    { value: 'dirty', label: `미저장 (${rowCounts.dirty}행)` },
    { value: 'conflict', label: `충돌 (${rowCounts.conflict}행)` },
  ]

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0">
      {header}

      {/* B. 저장 상태 */}
      <SaveBar
        state={saveState}
        dirtyCount={dirtyCount}
        conflictCount={conflictCount}
        savedAt={savedAt}
        draftNote={draftNote}
        blockReason={blockReason}
        canSave={canSave}
        onSave={save}
        onRevert={revert}
        message={message}
        errorCount={stats.dirtyErrors}
      />

      {/* C. 진척·검증 요약(공통 KpiRow: 1440 대표 2칸 + 3 · 390 2열) — 오류·주의는 목표 없는 심각도 태그 */}
      <KpiRow hero>
        <KpiTile
          size="hero"
          label="입력 진척률"
          value={formatNumber((stats.filled / TOTAL_CELLS) * 100, { digits: 1 })}
          unit="%"
          sub={`${stats.filled}/${TOTAL_CELLS}칸 · 저장 ${stats.saved}(${formatPercent(stats.saved / TOTAL_CELLS)})`}
          info={`값 또는 결측 표시가 있는 칸 / 전체 칸(${PLOTS.length}구 × ${TRAIT_KEYS.length}형질 = ${TOTAL_CELLS}칸). 미저장·오류 칸 포함. 저장 진척은 서버에 저장된 칸만 셉니다.`}
        />
        <KpiTile
          label="오류"
          value={stats.cnt.error}
          unit="칸"
          sub={stats.cnt.error ? '저장 차단 — 불가능 값·형식 위반' : '저장을 막는 칸 없음'}
          severity={stats.cnt.error ? 'critical' : undefined}
        />
        <KpiTile
          label="주의"
          value={warnCount}
          unit="칸"
          sub={`범위 밖 ${stats.cnt.range} · 반복 편차 ${stats.cnt.dev}`}
          severity={warnCount ? 'warning' : undefined}
          info="주의 칸은 저장할 수 있습니다. 범위 밖 = 허용 범위를 벗어난 값, 반복 편차 = 같은 처리 다른 반복 평균과 차이가 형질별 기준(D)을 넘는 값. 기준은 추정값입니다."
        />
        <KpiTile label="결측 표시" value={stats.cnt.missing} unit="칸" sub={`미입력 ${stats.cnt.empty}칸 · 결측(NA) ≠ 빈칸`} />
      </KpiRow>

      <Card
        title="형질별 입력 진척"
        subtitle={`열 순서 = 조사 시기(야장 순서) · 진한 막대 = 저장, 빗금 = 미저장 · 충돌 ${conflictCount}칸 포함`}
      >
        <TraitProgressList items={stats.traits} />
        <div className="mt-3 border-t border-border pt-3">
          <RepProgress reps={stats.reps} />
        </div>
      </Card>

      {/* D. 도구 막대 */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5">
          <ToolField label="반복">
            <Segmented<RepFilter>
              ariaLabel="반복"
              value={rep}
              onChange={setRep}
              options={[
                { value: 'all', label: '전체' },
                { value: '1', label: 'Ⅰ' },
                { value: '2', label: 'Ⅱ' },
                { value: '3', label: 'Ⅲ' },
              ]}
            />
          </ToolField>
          <div className="lg:w-48">
            <Select<StatusFilter> label="검증 상태" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:w-60">
            <label htmlFor="pe-search" className="text-xs font-medium text-muted">
              계통 검색
            </label>
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="pe-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setSearch('')
                }}
                placeholder="예: YR22-0331, 가람솔"
                className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-8 text-[13px] text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="검색어 지우기"
                  className="touch-hit absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-text"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <p role="status" aria-live="polite" className="text-[13px] text-text tabular-nums lg:pb-2">
            표시 행 <b className="font-semibold">{visibleRows.length}</b> / {PLOTS.length}
          </p>
          <details className="group hidden md:block lg:ml-auto lg:pb-1.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-surface-2 hover:text-text [&::-webkit-details-marker]:hidden">
              <Keyboard size={14} aria-hidden="true" /> 키보드 단축키
            </summary>
            <ShortcutList />
          </details>
        </div>
      </Card>

      {/* E + F·G */}
      <div className="grid gap-4 xl:grid-cols-4">
        <Card
          className="min-w-0 self-start xl:col-span-3"
          title="입력 그리드 · 구 번호 순(야장 순서)"
          subtitle="머리글 = 형질 · 단위 · 허용 범위. 굵은 가로선 = 반복 경계. 숫자를 치면 바로 입력, Enter 아래 · Tab 오른쪽, NA = 결측."
        >
          {visibleRows.length === 0 ? (
            <EmptyState
              title="조건에 맞는 구가 없습니다"
              description="반복·검증 상태·검색어 조건을 함께(AND) 적용합니다."
              action={<Button onClick={resetFilters}>필터 초기화</Button>}
            />
          ) : (
            <EntryGrid
              rows={visibleRows}
              columns={columns}
              narrow={narrow}
              active={active}
              onActive={setActive}
              values={values}
              checks={checks}
              conflicts={conflicts}
              dirty={dirty}
              focusSignal={focusSignal}
              onCommit={onCommit}
              onPaste={onPaste}
              onReadOnly={() => setMessage('읽기 전용 열입니다 — 형질 칸으로 이동해 입력하세요')}
              othersText={othersText}
            />
          )}
          <GridLegend />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            * 출수기 = 파종({SOWING}) 후 일수{narrow && ' · 칸을 누르면 바로 입력합니다'}
          </p>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {xlUp ? (
            <Card padding="md" className="min-w-0">
              <details open className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                  <h2 className="text-[15px] font-semibold text-text">셀 상세</h2>
                  <span className="text-xs text-muted group-open:hidden">펼치기</span>
                  <span className="hidden text-xs text-muted group-open:inline">접기</span>
                </summary>
                <div className="mt-3">
                  <CellDetail
                    plot={activePlot}
                    trait={activeTrait}
                    values={values}
                    server={server}
                    checks={checks}
                    conflicts={conflicts}
                    dirty={dirty}
                    resolving={resolving}
                    onResolve={resolve}
                    onJump={jumpTo}
                  />
                </div>
              </details>
            </Card>
          ) : (
            <Card padding="sm" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-[13px] text-text tabular-nums">
                  <span className="text-muted">활성 칸</span> 구 {activePlot.no}
                  {activeTrait ? ` · ${TRAITS[activeTrait].short}` : ''}
                </p>
                <Button data-action="open-cell-detail" onClick={openDetail} className="touch:min-h-11">
                  셀 상세
                </Button>
              </div>
            </Card>
          )}
          <Card title={`검증 문제 ${alerts.length}건`} subtitle="경보 = 오류·충돌(저장 전 처리) · 주의 = 범위 밖·반복 편차(확인 후 저장 가능)" className="min-w-0">
            <AlertList
              items={alerts}
              ariaLabel={`검증 문제 ${alerts.length}건`}
              density="compact"
              emptyText="검증 문제가 없습니다"
              // relative: 스크롤 영역 안 버튼의 sr-only(absolute) 보조 문구가 잘린 목록 아래 페이지 높이를 늘리지 않게(페이지 끝 빈 영역 340~380px의 원인)
              className="relative max-h-[420px] overflow-y-auto"
            />
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted">
        계통명·품종명·조사자명은 모두 가상이며 실존 계통·품종·인물과 관계없습니다. 쌀 수량은 백미 기준 kg/10a입니다. 불가능 값·허용 범위·반복 편차 기준은 추정값이므로 기관 기준에 맞춰 조정하세요. 저장은 목업(지연 0.9초)입니다.
      </p>

      {/* 셀 상세: 390px 하단 시트, 768~1279px 오른쪽 서랍. 시트를 닫지 않고 저장한다 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeDetail}
        labelledBy="pe-sheet-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={<span id="pe-sheet-title">{`구 ${activePlot.no}${activeTrait ? ` ${TRAITS[activeTrait].short}` : ''} · 셀 상세`}</span>}
        footer={
          <>
            <span className={`text-xs tabular-nums ${blockReason ? 'font-semibold text-negative' : 'text-muted'}`} aria-live="polite">
              {blockReason ?? (conflictCount ? `충돌 ${conflictCount}칸 · 미저장 ${dirtyCount}칸` : `미저장 ${dirtyCount}칸`)}
            </span>
            <Button variant="primary" data-action="save" onClick={save} disabled={!canSave} className="min-h-11 px-6">
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        <CellDetail
          plot={activePlot}
          trait={activeTrait}
          values={values}
          server={server}
          checks={checks}
          conflicts={conflicts}
          dirty={dirty}
          resolving={resolving}
          onResolve={resolve}
          onJump={jumpInSheet}
        />
      </BottomSheet>

      <Toast {...toast.toastProps} className="bottom-28! md:bottom-6!" />
    </div>
  )
}

/** 반복 편차 아이콘(≠) — AlertList icon 계약(ComponentType)에 맞춘 글자 아이콘 */
function NotEqualIcon({ size = 14, className }: { size?: string | number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-center justify-center font-bold leading-none ${className ?? ''}`} style={{ width: size, height: size, fontSize: Number(size) }}>
      ≠
    </span>
  )
}

function ToolField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {/* 가로 스크롤 줄 안 Segmented의 누르는 영역(세로 44px)이 줄 높이로 잘리지 않게 터치에서 여유 */}
      <div className="max-w-full overflow-x-auto touch:py-2">{children}</div>
    </div>
  )
}

function Swatch({ style, className, glyph, glyphClass }: { style?: CSSProperties; className?: string; glyph?: string; glyphClass?: string }) {
  return (
    <span className={`relative inline-flex h-4 w-6 shrink-0 items-start rounded-sm border border-border ${className ?? ''}`} style={style} aria-hidden="true">
      {glyph && <span className={`pl-0.5 text-[11px] font-bold leading-none ${glyphClass ?? ''}`}>{glyph}</span>}
    </span>
  )
}

function GridLegend() {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted" aria-label="칸 표시 범례">
      <li className="inline-flex items-center gap-1.5">
        <Swatch className="border-2 border-negative!" style={{ background: 'color-mix(in oklab, var(--color-negative) 14%, var(--color-surface))' }} glyph={STATUS_GLYPH.error} glyphClass="text-negative" />
        오류(저장 차단)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Swatch style={{ background: 'color-mix(in oklab, var(--color-warning) 16%, var(--color-surface))' }} glyph={STATUS_GLYPH.range} glyphClass="text-warning" />
        범위 밖
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Swatch className="border-dashed border-warning!" glyph={STATUS_GLYPH.dev} glyphClass="text-warning" />
        반복 편차
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Swatch className="border-[3px] border-double border-negative!" glyph={STATUS_GLYPH.conflict} glyphClass="text-negative" />
        충돌
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Swatch style={{ background: HATCH_MISSING_DENSE }} />
        결측(NA)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Swatch className="border-dotted" />
        미입력(빈칸)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="relative inline-block h-4 w-6 rounded-sm border border-border" aria-hidden="true">
          <span className="absolute right-0 top-0 size-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-text" />
        </span>
        미저장
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-6 rounded-sm outline-2 -outline-offset-2 outline-text" aria-hidden="true" />
        활성 칸
      </li>
    </ul>
  )
}

function ShortcutList() {
  const rows: [string, string][] = [
    ['숫자·문자', '기존 값을 바꾸며 입력 시작'],
    ['F2 · 더블클릭', '기존 값 유지 편집'],
    ['Enter / Shift+Enter', '확정 후 아래 / 위 칸'],
    ['Tab / Shift+Tab', '확정 후 오른쪽 / 왼쪽 형질 칸'],
    ['화살표', '칸 이동(편집 중 ↑↓는 확정 후 이동)'],
    ['Home / End', '행의 첫 / 마지막 형질 칸'],
    ['Ctrl+Home / End', '첫 / 마지막 행'],
    ['PageUp / PageDown', '15행 이동'],
    ['Esc', '편집 취소'],
    ['NA · . · Ctrl+Shift+M', '결측 표시'],
    ['Delete · Backspace', '빈칸으로'],
    ['Ctrl+V', '탭·줄바꿈 텍스트를 활성 칸부터 붙여넣기'],
    ['Ctrl+Z', '마지막 변경 되돌리기'],
    ['Ctrl+S', '저장'],
  ]
  return (
    <dl className="absolute right-4 z-30 mt-1 grid w-[360px] grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-surface p-3 text-xs shadow-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>
            <kbd className="rounded-sm border border-border bg-surface-2 px-1 font-mono text-[11px] text-text">{k}</kbd>
          </dt>
          <dd className="text-muted">{v}</dd>
        </div>
      ))}
      <p className="col-span-2 mt-1 text-muted">이동은 현재 필터에 보이는 행만 따릅니다. 읽기 전용 열(구·반복·블록·처리·계통명)은 입력할 수 없습니다.</p>
    </dl>
  )
}

