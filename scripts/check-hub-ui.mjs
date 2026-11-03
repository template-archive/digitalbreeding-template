// 허브 셸 화면 점검(로그인 창·사이드바 계정 영역). 템플릿 verify는 갤러리 셸을 보지 않으므로 따로 둔다(로그인 설계 6절).
// /api/auth/*는 가짜 응답으로 바꿔 DB·메일 없이 돈다. 390·768·1440 × 라이트·다크마다 상태 4개를 찍고
// 가로 넘침, axe 위반, 키보드 조작, 세션 만료, 임베드에서 로그인 호출 없음, 화면의 '@' 문자를 검사한다.
// 사용: npm run check:hub-ui   (스크린샷: _workspace/qa/hub-ui/)
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const OUT = '_workspace/qa/hub-ui'
const WIDTHS = [390, 768, 1440]
const THEMES = ['light', 'dark']
const USER = { id: 'u1', name: '홍길동' }
const failures = []
let shots = 0
const fail = (where, what) => failures.push(`${where}: ${what}`)

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
    srv.on('error', reject)
  })
}
async function waitForHttp(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(url)).ok) return true } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}
/** 띄운 서버만 PID(프로세스 트리)로 끈다. 이름으로 끄지 않는다. */
function killTree(child) {
  if (!child || child.exitCode !== null) return
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    else process.kill(-child.pid, 'SIGTERM')
  } catch { /* already gone */ }
}

function fakeAuth(state) {
  return async route => {
    const request = route.request()
    const action = new URL(request.url()).pathname.split('/').pop()
    const body = request.method() === 'POST' ? JSON.parse(request.postData() || '{}') : {}
    const json = (status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (action === 'me') { state.meCalls++; return json(200, { user: state.signedIn ? USER : null, available: true }) }
    if (action === 'code') return json(200, { message: '코드를 보냈습니다. 메일이 오지 않으면 주소를 확인해 주세요.', resendAfter: 60 })
    if (action === 'verify') {
      state.verifyCalls++
      if (!body.name) return json(200, { needsName: true })
      state.signedIn = true
      return json(200, { user: USER })
    }
    if (action === 'name') return state.nameStatus === 401 ? json(401, { error: '로그인이 필요합니다.' }) : json(200, { user: { ...USER, name: body.name } })
    if (action === 'logout') { state.signedIn = false; return json(200, { ok: true }) }
    return json(404, { error: 'not found' })
  }
}

async function checkPage(page, where) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth, text: document.body.innerText }))
  if (m.scroll > m.width) fail(where, `가로 넘침 ${m.scroll}px > ${m.width}px`)
  if (m.text.includes('@')) fail(where, "화면 글자에 '@'가 있음(메일 주소·도메인 노출 의심)")
}
async function axe(page, where) {
  const result = await new AxeBuilder({ page }).include('[data-auth-dialog]').analyze()
  for (const v of result.violations) fail(where, `axe ${v.id}(${v.impact}): ${v.help}`)
}
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name + '.png') })
  shots++
}
/** 1024 미만은 계정 영역이 메뉴 시트 안에 있다. */
async function showAccount(page, width) {
  if (width >= 1024) return
  if (await page.locator('[role="dialog"][aria-label="템플릿 메뉴"]').count()) return
  await page.getByRole('button', { name: '템플릿 메뉴 열기' }).click()
  await page.locator('[role="dialog"][aria-label="템플릿 메뉴"]').waitFor()
  await page.waitForTimeout(400) // 시트가 미끄러져 들어오는 애니메이션이 끝난 뒤 찍는다
}
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first()

async function flow(browser, base, width, theme) {
  const tag = `${width}-${theme}`
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const state = { signedIn: false, verifyCalls: 0, meCalls: 0, nameStatus: 200 }
  await page.route('**/api/auth/**', fakeAuth(state))
  try {
    await page.goto(`${base}/?theme=${theme}#/library`)
    await showAccount(page, width)
    await visible(page, '[data-auth-account="signed-out"]').waitFor({ timeout: 8000 })
    await checkPage(page, tag + ' signed-out')
    await shot(page, `signed-out-${tag}`)

    await visible(page, '[data-auth-login]').click()
    const dialog = page.locator('[data-auth-dialog]')
    await dialog.locator('[data-auth-step="email"]').waitFor()
    await checkPage(page, tag + ' dialog-email')
    await axe(page, tag + ' dialog-email')
    await shot(page, `dialog-email-${tag}`)

    await dialog.locator('input[type="email"]').fill('kim@example.test')
    await dialog.getByRole('button', { name: '코드 받기' }).click()
    await dialog.locator('[data-auth-step="code"]').waitFor()
    await dialog.locator('input[autocomplete="one-time-code"]').fill('123 456')
    await dialog.getByRole('button', { name: '확인' }).click()
    await dialog.locator('[data-auth-name-field]').waitFor()
    await checkPage(page, tag + ' dialog-code')
    await axe(page, tag + ' dialog-code')
    await shot(page, `dialog-code-${tag}`)

    await dialog.locator('[data-auth-name-field] input').fill('홍길동')
    await dialog.getByRole('button', { name: '확인' }).click()
    await dialog.waitFor({ state: 'detached' })
    await showAccount(page, width)
    await visible(page, '[data-auth-account="signed-in"]').waitFor()
    if (!(await visible(page, '[data-auth-account="signed-in"]').innerText()).includes('홍길동')) fail(tag, '로그인 뒤 표시 이름이 보이지 않음')
    await checkPage(page, tag + ' signed-in')
    await shot(page, `signed-in-${tag}`)
  } catch (error) {
    fail(tag, `흐름 중단: ${error.message.split('\n')[0]}`)
  }
  await context.close()
}

async function keyboard(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const state = { signedIn: false, verifyCalls: 0, meCalls: 0, nameStatus: 200 }
  await page.route('**/api/auth/**', fakeAuth(state))
  try {
    await page.goto(`${base}/#/library`)
    const login = visible(page, '[data-auth-login]')
    await login.waitFor({ timeout: 8000 })
    await login.focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-auth-dialog]').waitFor()
    if (!(await page.evaluate(() => !!document.activeElement?.closest('[data-auth-dialog]')))) fail('keyboard', '창이 열렸는데 포커스가 창 밖에 있음')
    await page.keyboard.press('Escape')
    await page.locator('[data-auth-dialog]').waitFor({ state: 'detached' })
    if (!(await page.evaluate(() => document.activeElement?.hasAttribute('data-auth-login')))) fail('keyboard', 'Esc로 닫은 뒤 포커스가 「로그인」으로 돌아오지 않음')

    // 세션 만료: 로그인 상태에서 이름 저장이 401이면 로그아웃 상태 + 로그인 창
    state.signedIn = true
    await page.reload()
    await visible(page, '[data-auth-account="signed-in"]').waitFor()
    state.nameStatus = 401
    await visible(page, '[data-auth-account="signed-in"] [data-auth-name]').click()
    await visible(page, '[data-auth-account="signed-in"] input').fill('김철수')
    await visible(page, '[data-auth-account="signed-in"]').getByRole('button', { name: '저장' }).click()
    await page.locator('[data-auth-dialog]').waitFor({ timeout: 5000 })
    if (!(await page.locator('[data-auth-account="signed-out"]').count())) fail('session-expired', '401 뒤에도 로그인 상태로 보임')
  } catch (error) {
    fail('keyboard', `흐름 중단: ${error.message.split('\n')[0]}`)
  }
  await context.close()
}

async function embed(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 800 } })
  const page = await context.newPage()
  let calls = 0
  page.on('request', r => { if (r.url().includes('/api/auth/')) calls++ })
  try {
    await page.goto(`${base}/?embed=1#/t/kpi/program-overview`)
    await page.waitForTimeout(2000)
    if (calls) fail('embed', `임베드에서 /api/auth 요청 ${calls}번`)
    if (await page.locator('[data-auth-account]').count()) fail('embed', '임베드에 계정 영역이 보임')
  } catch (error) {
    fail('embed', `흐름 중단: ${error.message.split('\n')[0]}`)
  }
  await context.close()
}

mkdirSync(OUT, { recursive: true })
const port = await freePort()
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  env: { ...process.env, VERIFY_SERVER: '1', VERIFY_CACHE_DIR: join(tmpdir(), `db-hub-ui-vite-${port}`) },
  detached: process.platform !== 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', d => (serverLog += d))
server.stderr.on('data', d => (serverLog += d))
let browser
try {
  if (!(await waitForHttp(base + '/', 60_000))) {
    console.error('개발 서버가 60초 안에 응답하지 않았습니다.\n' + serverLog.slice(-1500))
    process.exitCode = 2
  } else {
    browser = await chromium.launch()
    for (const width of WIDTHS) for (const theme of THEMES) await flow(browser, base, width, theme)
    await keyboard(browser, base)
    await embed(browser, base)
    if (failures.length) {
      console.error(`화면 점검 실패 ${failures.length}건 (스크린샷 ${shots}장, ${OUT})\n` + failures.map(f => '  - ' + f).join('\n'))
      process.exitCode = 1
    } else {
      console.log(`화면 점검 통과: ${shots}장, 위반 0 (${OUT})`)
    }
  }
} finally {
  await browser?.close()
  killTree(server)
}
