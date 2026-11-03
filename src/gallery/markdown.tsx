/**
 * 의존성 없는 작은 마크다운 변환기(템플릿 README용). 문자열을 React 요소로 만든다(dangerouslySetInnerHTML 없음).
 * 지원 범위(README 34개가 쓰는 것): `#`~`###` 제목, 문단, `-` 목록(한 단계 들여쓴 하위 목록·이어지는 줄 포함), `1.` 목록,
 * 표(`|`, 머리 구분 줄 필수, `\|` 이스케이프), 인라인 코드, `**굵게**`, `*기울임*`. 그 밖의 문법은 글자 그대로 보인다.
 * 제목 단계는 한 단계씩 낮춰 그린다(# → h3, ## → h4, ### → h5): 패널 제목이 h2이고, 상세 화면의 h1은 템플릿 자신의 것이다.
 */
import { Fragment, type ReactNode } from 'react'
import { ScrollRegion } from '@/design-system'

export type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: MdListItem[] }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface MdListItem {
  text: string
  children: MdBlock[]
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const TABLE_SEP_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

function isTableStart(lines: string[], i: number) {
  return lines[i]!.trimStart().startsWith('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]!)
}

function isBlockStart(lines: string[], i: number) {
  const line = lines[i]!
  return HEADING_RE.test(line) || LIST_RE.test(line) || isTableStart(lines, i)
}

/** 표 한 줄을 칸으로 나눈다. 인라인 코드 안의 `|`와 `\|`는 칸 구분이 아니다 */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  let inCode = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
      continue
    }
    if (c === '`') inCode = !inCode
    if (c === '|' && !inCode) {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  cells.push(cur.trim())
  return cells
}

function parseList(lines: string[], start: number): [MdBlock, number] {
  const first = LIST_RE.exec(lines[start]!)!
  const baseIndent = first[1]!.length
  const ordered = /\d/.test(first[2]!)
  const items: MdListItem[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      // 빈 줄: 다음 내용이 같은 들여쓰기·같은 종류의 항목이면 목록이 이어진다
      let j = i + 1
      while (j < lines.length && !lines[j]!.trim()) j++
      const m = j < lines.length ? LIST_RE.exec(lines[j]!) : null
      if (m && m[1]!.length === baseIndent && /\d/.test(m[2]!) === ordered) {
        i = j
        continue
      }
      break
    }
    const m = LIST_RE.exec(line)
    if (m) {
      const indent = m[1]!.length
      if (indent < baseIndent) break
      if (indent >= baseIndent + 2 && items.length) {
        const [sub, next] = parseList(lines, i)
        items[items.length - 1]!.children.push(sub)
        i = next
        continue
      }
      if (/\d/.test(m[2]!) !== ordered) break
      items.push({ text: m[3]!, children: [] })
      i++
      continue
    }
    if (HEADING_RE.test(line) || isTableStart(lines, i)) break
    // 이어지는 줄(들여쓴 줄, 또는 빈 줄 없이 붙은 줄)은 마지막 항목의 글에 붙인다
    if (!items.length) break
    items[items.length - 1]!.text += ' ' + line.trim()
    i++
  }
  return [{ type: 'list', ordered, start: ordered ? parseInt(first[2]!, 10) || 1 : 1, items }, i]
}

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const h = HEADING_RE.exec(line)
    if (h) {
      blocks.push({ type: 'heading', level: Math.min(3, h[1]!.length) as 1 | 2 | 3, text: h[2]! })
      i++
      continue
    }
    if (isTableStart(lines, i)) {
      const head = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trimStart().startsWith('|')) {
        rows.push(splitRow(lines[i]!))
        i++
      }
      blocks.push({ type: 'table', head, rows })
      continue
    }
    if (LIST_RE.test(line)) {
      const [list, next] = parseList(lines, i)
      blocks.push(list)
      i = next
      continue
    }
    const buf = [line.trim()]
    i++
    while (i < lines.length && lines[i]!.trim() && !isBlockStart(lines, i)) {
      buf.push(lines[i]!.trim())
      i++
    }
    blocks.push({ type: 'paragraph', text: buf.join(' ') })
  }
  return blocks
}

const ESCAPABLE = /[\\`*_|#[\]()<>!-]/

/** 인라인: `코드`, **굵게**, *기울임*, 백슬래시 이스케이프 */
export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let buf = ''
  let k = 0
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.test(text[i + 1]!)) {
      buf += text[i + 1]
      i += 2
      continue
    }
    if (ch === '`') {
      let n = 1
      while (text[i + n] === '`') n++
      const fence = '`'.repeat(n)
      const end = text.indexOf(fence, i + n)
      if (end > i) {
        flush()
        out.push(
          <code key={`${keyPrefix}${k++}`} className="rounded-sm bg-surface-2 px-1 py-px font-mono text-[0.9em] text-text">
            {text.slice(i + n, end)}
          </code>,
        )
        i = end + n
        continue
      }
      buf += fence
      i += n
      continue
    }
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        const key = `${keyPrefix}${k++}`
        out.push(
          <strong key={key} className="font-semibold text-text">
            {renderInline(text.slice(i + 2, end), `${key}-`)}
          </strong>,
        )
        i = end + 2
        continue
      }
    }
    if (ch === '*' && text[i + 1] && text[i + 1] !== ' ' && text[i + 1] !== '*') {
      let end = text.indexOf('*', i + 1)
      while (end > 0 && (text[end - 1] === ' ' || text[end + 1] === '*')) end = text.indexOf('*', end + 1)
      if (end > i + 1) {
        flush()
        const key = `${keyPrefix}${k++}`
        out.push(<em key={key}>{renderInline(text.slice(i + 1, end), `${key}-`)}</em>)
        i = end + 1
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: 'text-base font-semibold text-text',
  2: 'mt-7 text-sm font-semibold text-text',
  3: 'mt-5 text-[13px] font-semibold text-text',
}

function Block({ block, k }: { block: MdBlock; k: string }) {
  switch (block.type) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1]!
      return <Tag className={HEADING_CLASS[block.level]}>{renderInline(block.text, `${k}-`)}</Tag>
    }
    case 'paragraph':
      return <p className="mt-2 break-keep text-sm leading-relaxed text-text">{renderInline(block.text, `${k}-`)}</p>
    case 'list': {
      const items = block.items.map((it, j) => (
        <li key={j} className="break-keep pl-0.5">
          {renderInline(it.text, `${k}-${j}-`)}
          {it.children.map((c, ci) => (
            <Block key={ci} block={c} k={`${k}-${j}-${ci}`} />
          ))}
        </li>
      ))
      const cls = 'mt-2 flex flex-col gap-1 pl-5 text-sm leading-relaxed text-text'
      return block.ordered ? (
        <ol start={block.start === 1 ? undefined : block.start} className={`${cls} list-decimal`}>
          {items}
        </ol>
      ) : (
        <ul className={`${cls} list-disc marker:text-muted`}>{items}</ul>
      )
    }
    case 'table': {
      const cols = Math.max(block.head.length, ...block.rows.map(r => r.length))
      const pad = (r: string[]) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')]
      return (
        <ScrollRegion label="표(가로 스크롤)" wrapperClassName="mt-3" className="rounded-md border border-border">
          <table className="w-full border-collapse text-left text-[13px] leading-normal">
            <thead>
              <tr>
                {pad(block.head).map((c, j) => (
                  <th key={j} scope="col" className="whitespace-nowrap border-b border-border px-3 py-2 font-medium text-muted">
                    {renderInline(c, `${k}-h${j}-`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} className={ri ? 'border-t border-border/60' : undefined}>
                  {pad(r).map((c, j) => (
                    <td key={j} className="min-w-[96px] break-keep px-3 py-2 align-top text-text">
                      {renderInline(c, `${k}-${ri}-${j}-`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )
    }
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="[&>*:first-child]:mt-0">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          <Block block={b} k={`b${i}`} />
        </Fragment>
      ))}
    </div>
  )
}
