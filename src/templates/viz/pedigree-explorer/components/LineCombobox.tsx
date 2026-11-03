import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { KIND_LABEL, KIND_ORDER, PEDIGREE, type PedNode } from '../data'

const optLabel = (p: PedNode) => (p.name ? `${p.name} (${p.id})` : p.id)

/** 검색 가능한 기준 계통 콤보박스(ARIA combobox + listbox, 구분별 묶음) */
export function LineCombobox({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const current = PEDIGREE.find(p => p.id === value)!

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (p: PedNode) => !q || p.id.toLowerCase().includes(q) || (p.name ?? '').includes(q)
    return KIND_ORDER.map(k => ({
      kind: k,
      items: PEDIGREE.filter(p => p.kind === k && hit(p)).sort((a, b) => b.year - a.year || (a.id < b.id ? -1 : 1)),
    })).filter(g => g.items.length > 0)
  }, [query])
  const flat = groups.flatMap(g => g.items)

  const commit = (p: PedNode) => {
    onChange(p.id)
    setOpen(false)
    setQuery('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActive(a => Math.min(flat.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      if (open && flat[active]) {
        e.preventDefault()
        commit(flat[active]!)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery('')
      }
    }
  }

  return (
    <div className="relative flex w-full min-w-0 flex-col gap-1 sm:w-auto">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        기준 계통
      </label>
      <div className="relative">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? `${id}-o-${flat[active]!.id}` : undefined}
          value={open ? query : optLabel(current)}
          placeholder={open ? '계통명·품종명 검색' : undefined}
          onFocus={() => {
            setOpen(true)
            setActive(
              Math.max(
                0,
                flat.findIndex(p => p.id === value),
              ),
            )
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={e => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={onKey}
          className="h-9 w-full min-w-0 rounded-md border border-border bg-surface pl-8 pr-8 text-[13px] font-semibold text-text placeholder:font-normal placeholder:text-muted hover:border-muted sm:w-64"
        />
        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="기준 계통 목록"
          className="absolute left-0 top-full z-30 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-2 sm:w-72"
        >
          {flat.length === 0 && <li className="px-3 py-2 text-xs text-muted">일치하는 계통이 없습니다</li>}
          {groups.map(g => (
            <li key={g.kind} role="presentation">
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted">
                {KIND_LABEL[g.kind]} · {g.items.length}
              </div>
              <ul role="group" aria-label={KIND_LABEL[g.kind]}>
                {g.items.map(p => {
                  const i = flat.indexOf(p)
                  const selected = p.id === value
                  return (
                    <li
                      key={p.id}
                      id={`${id}-o-${p.id}`}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={e => {
                        e.preventDefault()
                        commit(p)
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-[13px] ${i === active ? 'bg-surface-2' : ''}`}
                    >
                      <span className={selected ? 'font-bold text-text' : 'text-text'}>{p.name ?? p.id}</span>
                      <span className="text-[11px] text-muted tabular-nums">
                        {p.name ? `${p.id} · ` : ''}
                        {p.year}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
