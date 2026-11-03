import type { SeenThreads } from './review'
export type FeedbackDockSide = 'left' | 'right'
const dockKey = 'db-feedback:dock:v1'
export function readDock(): FeedbackDockSide {
  try { return localStorage.getItem(dockKey) === 'left' ? 'left' : 'right' } catch { return 'right' }
}
export function saveDock(side: FeedbackDockSide) {
  try { localStorage.setItem(dockKey, side) } catch { /* Preferences never block shared feedback. */ }
}
export function readSeen(template: string): SeenThreads {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('db-feedback:seen:v1:' + template) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([key, value]) => key.length <= 100 && typeof value === 'string' && value.length <= 100).slice(-500)) as SeenThreads
  } catch { return {} }
}
export function saveSeen(template: string, seen: SeenThreads) {
  try { localStorage.setItem('db-feedback:seen:v1:' + template, JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-500)))) } catch { /* Read state is optional. */ }
}
