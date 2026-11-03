import type { Anchor } from './storage'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
export const quoteOf = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)

export function createAnchor(root: HTMLElement, target: Element, clientX: number, clientY: number): Anchor {
  const preferred = target.closest('td,th,h1,h2,h3,h4,p,label,button,a,[data-feedback-anchor]')
  const element = preferred && root.contains(preferred) ? preferred : target
  const parts: string[] = []
  let node: Element | null = element
  while (node && node !== root) {
    const tag = node.tagName.toLowerCase()
    const siblings: Element[] = node.parentElement ? [...node.parentElement.children].filter(s => s.tagName === node!.tagName) : []
    parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
    node = node.parentElement
  }
  const rect = element.getBoundingClientRect()
  return {
    selector: parts.length ? parts.join(' > ') : null,
    quote: quoteOf(element),
    x: clamp((clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp((clientY - rect.top) / Math.max(1, rect.height)),
    width: Math.round(root.getBoundingClientRect().width),
  }
}
export function locateAnchor(root: HTMLElement, anchor: Anchor) {
  if (!anchor.selector) return null
  try {
    const target = root.querySelector(anchor.selector)
    // Do not pin a comment to unrelated content when a filter or a tab changes the DOM.
    if (!target || (anchor.quote && quoteOf(target) !== anchor.quote)) return null
    const rect = target.getBoundingClientRect()
    const outer = root.getBoundingClientRect()
    if (!rect.width || !rect.height || !target.getClientRects().length) return null
    const x = rect.left - outer.left + rect.width * anchor.x
    const y = rect.top - outer.top + rect.height * anchor.y
    if (x < 0 || y < 0 || x > outer.width || y > outer.height) return null
    // Nested horizontal scroll containers can hide a still-mounted table cell.
    let parent = target.parentElement
    while (parent && parent !== root) {
      const style = getComputedStyle(parent)
      const box = parent.getBoundingClientRect()
      const px = outer.left + x, py = outer.top + y
      if ((/(auto|scroll|hidden|clip)/.test(style.overflowX) && (px < box.left || px > box.right)) ||
          (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (py < box.top || py > box.bottom))) return null
      parent = parent.parentElement
    }
    return { x, y, target }
  } catch { return null }
}
