import type { Anchor, FeedbackData, FeedbackLabel } from './model'

export type FeedbackAction =
  | { type: 'create'; requestId: string; anchor: Anchor; label: FeedbackLabel; author: string; body: string }
  | { type: 'reply'; requestId: string; threadId: string; author: string; body: string }
  | { type: 'label'; threadId: string; label: FeedbackLabel }
  | { type: 'resolve'; threadId: string; resolved: boolean }
  | { type: 'delete'; threadId: string }

export interface FeedbackSnapshot {
  storage: 'shared'
  actorId: string
  revision: number
  data: FeedbackData
}
