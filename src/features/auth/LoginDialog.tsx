import type { AuthUser } from './client'

export type LoginDialogProps = { open: boolean; available: boolean; onClose(): void; onSuccess(user: AuthUser): void }

/** Task 8에서 구현한다(두 단계 로그인 창). */
export function LoginDialog(_props: LoginDialogProps) {
  return null
}
