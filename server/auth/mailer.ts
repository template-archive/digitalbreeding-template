import nodemailer from 'nodemailer'

// 로그인 코드 메일 발송. 지금은 허브 전용 Gmail 계정의 SMTP를 쓰고, 도메인이 생기면 SMTP_*·MAIL_FROM만 바꿔
// 다른 발송 서비스(Resend·SES 등의 SMTP)로 옮긴다. 미리보기·로컬은 console(서버 로그)로 코드를 보인다(로그인 설계 5.3·5.5).

export type SmtpSettings = { kind: 'smtp'; host: string; port: number; user: string; pass: string; from: string; fromName: string }
export type Mailer = { sendLoginCode(to: string, code: string, hubUrl: string): Promise<void> }
type Transport = { sendMail(message: object): Promise<unknown> }

/** Vercel 함수 시간 제한(기본 10초) 전에 우리 쪽에서 끝낸다. */
export const SEND_TIMEOUT_MS = 8000

export function readSmtpSettings(env: Record<string, string | undefined>): SmtpSettings | null {
  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASS
  if (!user || !pass) return null
  const port = Number(env.SMTP_PORT) || 465
  return {
    kind: 'smtp',
    host: env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    user,
    pass,
    from: env.MAIL_FROM?.trim() || user,
    fromName: env.MAIL_FROM_NAME?.trim() || '템플릿 허브',
  }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function loginCodeMail(code: string, hubUrl: string): { subject: string; text: string; html: string } {
  const subject = `[템플릿 허브] 로그인 코드 ${code}`
  const text = [`템플릿 허브 로그인 코드: ${code}`, '', '10분 안에 입력해 주세요.', '직접 요청하지 않았다면 이 메일을 무시하세요.', '', hubUrl].join('\n')
  const url = escapeHtml(hubUrl)
  const html = [
    `<p>템플릿 허브 로그인 코드: <strong style="font-size:20px;letter-spacing:2px">${escapeHtml(code)}</strong></p>`,
    '<p>10분 안에 입력해 주세요.<br>직접 요청하지 않았다면 이 메일을 무시하세요.</p>',
    `<p><a href="${url}">${url}</a></p>`,
  ].join('\n')
  return { subject, text, html }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('mail send timeout')), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function createSmtpMailer(settings: SmtpSettings, transport?: Transport, timeoutMs = SEND_TIMEOUT_MS): Mailer {
  const sender: Transport = transport ?? nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  })
  return {
    async sendLoginCode(to, code, hubUrl) {
      const mail = loginCodeMail(code, hubUrl)
      // 주소는 객체로 넘긴다. 문자열이면 nodemailer가 주소 목록으로 다시 해석한다.
      await withTimeout(sender.sendMail({ from: { name: settings.fromName, address: settings.from }, to: { name: '', address: to }, ...mail }), timeoutMs)
    },
  }
}

export function createConsoleMailer(log: (line: string) => void = console.info): Mailer {
  return {
    async sendLoginCode(to, code) {
      log(`[auth] 로그인 코드 ${code} → ${to} (메일 대신 로그에 표시: 미리보기·로컬 전용)`)
    },
  }
}
