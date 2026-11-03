#!/usr/bin/env node
// 템플릿을 실제 브라우저로 렌더해 검증한다: 뷰포트 × 테마별 렌더 오류, 콘솔 오류, 가로 넘침, 카드 밖 텍스트, 차트 수, 접근성(axe).
// 개발 서버를 직접 띄우고(빈 포트 자동 선택) 끝나면 종료한다. --base-url을 주면 기존 서버를 쓴다.
// 사용: node .claude/skills/template-qa/scripts/verify-templates.mjs [--slug a,b] [--out _workspace/qa]
//        [--viewports 390,768,1440] [--themes light,dark] [--base-url http://localhost:5173] [--no-axe]
// 결과: {out}/{slug}/{width}-{theme}.png, {out}/report.json (또는 --slug 하나면 {out}/{slug}/report.json)
// 상태 검증: 템플릿 폴더에 qa-states.json이 있으면 기본 화면 뒤에 그 상태들도 라이트 테마·모든 뷰포트로 열어
//   가로 넘침·콘솔 오류·빈 차트를 같은 기준으로 검사하고 {width}-light-{state}.png를 남긴다(template-qa 「상태 검증」).
//   기본 화면에 없는 긴 문구(선택 후 상세 패널의 경고 배지)가 넘친 것을 기본 화면 검증은 잡지 못했다(정리 회차 3, seed-inventory RQ26-045).
import { spawn, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverTemplates } from './lint-templates.mjs'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[++i]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
// 모르는 옵션(--help 포함)은 전체 검증을 기본 경로로 돌려 다른 템플릿 산출물을 덮어쓸 수 있으므로, 실행 전에 사용법을 보이고 멈춘다.
const KNOWN = ['slug', 'out', 'viewports', 'themes', 'base-url', 'no-axe']
const unknown = Object.keys(args).filter(k => !KNOWN.includes(k))
if (unknown.length) {
  console.error(`${unknown.includes('help') ? '' : `알 수 없는 옵션: --${unknown.join(', --')}\n`}사용: node .claude/skills/template-qa/scripts/verify-templates.mjs [--slug a,b] [--out _workspace/qa] [--viewports 390,768,1440] [--themes light,dark] [--base-url URL] [--no-axe]`)
  process.exit(unknown.includes('help') ? 0 : 2)
}
const filter = typeof args.slug === 'string' ? args.slug.split(',').map(s => s.trim()) : null
const outDir = resolve(typeof args.out === 'string' ? args.out : '_workspace/qa')
const viewports = (typeof args.viewports === 'string' ? args.viewports : '390,768,1440').split(',').map(Number)
const themes = (typeof args.themes === 'string' ? args.themes : 'light,dark').split(',')
const useAxe = !args['no-axe']
const SETTLE_MS = 1200 // 차트 초기 애니메이션이 끝날 시간

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => res(port))
    })
    srv.on('error', rej)
  })
}

async function waitForHttp(url, timeoutMs) {
  const start = performance.now()
  while (performance.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

function killTree(child) {
  if (!child || child.exitCode !== null) return
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    else process.kill(-child.pid, 'SIGTERM')
  } catch {}
}

// 열린 페이지의 레이아웃 지표를 재고 문제를 run.issues에 더한다(기본 화면·상태 화면 공통).
async function measure(page, rootSel, run, found) {
  const m = await page.evaluate(sel => {
    const rootEl = document.querySelector(sel)
    const rect = rootEl?.getBoundingClientRect()
    const doc = document.documentElement
    const charts = rootEl ? rootEl.querySelectorAll('canvas, svg[role="img"], [_echarts_instance_]').length : 0
    const emptyCharts = rootEl ? [...rootEl.querySelectorAll('[_echarts_instance_]')].filter(el => el.clientHeight < 40 || el.clientWidth < 40).length : 0
    const allowed = el => el.closest('[data-allow-overflow], .overflow-x-auto, .overflow-auto')
    const label = el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}`
    const overflowers = []
    if (doc.scrollWidth > window.innerWidth + 1 && rootEl) {
      for (const el of rootEl.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.right > window.innerWidth + 1 && !allowed(el)) {
          overflowers.push(`${label(el)} right=${Math.round(r.right)}`)
          if (overflowers.length >= 5) break
        }
      }
      // 요소 상자는 안에 있어도 줄바꿈되지 않는 텍스트가 상자 밖으로 넘칠 수 있다(whitespace-nowrap 배지 등). 이때는 그 텍스트와 부모를 적는다.
      if (!overflowers.length) {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
        const range = document.createRange()
        for (let n = walker.nextNode(); n && overflowers.length < 5; n = walker.nextNode()) {
          if (!n.textContent.trim()) continue
          range.selectNodeContents(n)
          const el = n.parentElement
          if (range.getBoundingClientRect().right > window.innerWidth + 1 && el && !allowed(el))
            overflowers.push(`텍스트 "${n.textContent.trim().slice(0, 24)}" in ${label(el)} right=${Math.round(range.getBoundingClientRect().right)}`)
        }
      }
    }
    // 페이지는 넘치지 않아도 텍스트가 카드(양옆 테두리가 있는 상자) 밖으로 나갈 수 있다(390 KPI 2열 칸의 큰 값, 디자인 검토 2026-10-30).
    // 사이에 잘라 내거나 스크롤되는 조상(overflow ≠ visible)이 있으면 보이는 넘침이 아니므로 뺀다.
    const cardOverflows = []
    if (rootEl) {
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      for (let n = walker.nextNode(); n && cardOverflows.length < 5; n = walker.nextNode()) {
        const text = n.textContent.trim()
        const el = n.parentElement
        if (!text || !el || el.closest('[data-allow-overflow], .sr-only')) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') continue
        range.selectNodeContents(n)
        const r = range.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        let frame = null
        for (let a = el; a && a !== rootEl.parentElement; a = a.parentElement) {
          const s = getComputedStyle(a)
          if (a !== el && (s.overflowX !== 'visible' || s.overflowY !== 'visible')) break
          if (parseFloat(s.borderLeftWidth) > 0 && parseFloat(s.borderRightWidth) > 0 && s.borderLeftStyle !== 'none') {
            frame = a
            break
          }
        }
        if (!frame) continue
        const f = frame.getBoundingClientRect()
        const over = Math.max(r.right - f.right, f.left - r.left)
        if (over > 1) cardOverflows.push(`"${text.slice(0, 24)}" in ${label(el)} → ${label(frame)} 밖 ${Math.round(over)}px`)
      }
    }
    return { rootHeight: rect ? Math.round(rect.height) : 0, scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, charts, emptyCharts, overflowers, cardOverflows }
  }, rootSel)
  run.metrics = m
  if (found && m.rootHeight < 50) run.issues.push(`템플릿 높이가 ${m.rootHeight}px — 사실상 빈 화면`)
  if (m.scrollWidth > m.innerWidth + 1) run.issues.push(`가로 넘침 ${m.scrollWidth}px > ${m.innerWidth}px: ${m.overflowers.join(', ')}`)
  if (m.cardOverflows.length) run.issues.push(`카드 밖으로 나간 텍스트: ${m.cardOverflows.join(', ')}`)
  if (m.emptyCharts) run.issues.push(`크기가 0에 가까운 차트 ${m.emptyCharts}개`)
}

// 기본 화면 전체 페이지 캡처. Chromium의 fullPage 캡처는 찍는 동안 뷰포트를 바꿔, 큰 ECharts 산점도(gwas-manhattan 맨해튼)가
// 카드 400px 중 위쪽 60%에만 그려진 채 찍혔다(디자인 개선 B단계, 요소 스크린샷·화면은 정상). 뷰포트를 문서 높이로 먼저 늘리고
// 차트가 다시 그려질 시간을 준 뒤 찍고 되돌린다. 상태 화면은 열린 시트(85vh 등)가 함께 커지므로 이 방식을 쓰지 않는다.
async function fullPageShot(page, path, width) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  const grow = h > 900
  if (grow) {
    await page.setViewportSize({ width, height: Math.min(h, 16_000) })
    await page.waitForTimeout(800)
    await page.waitForFunction(() => !document.querySelector('[data-chart-ready="false"]'), null, { timeout: 10_000 }).catch(() => {})
  }
  await page.screenshot({ path, fullPage: true })
  if (grow) await page.setViewportSize({ width, height: 900 })
}

// qa-states.json 형식: [{ "name": "rq045-selected", "note": "왜 이 상태인가", "steps": [{ "click": "RQ26-045" }, { "clickSelector": "[aria-label='…']" }, { "wait": 500 }], "viewports": [390, 1440] }]
// click은 화면 텍스트의 첫 일치(정확 일치 우선), clickSelector는 CSS 선택자(둘 다 "modifiers": ["Shift"] 가능),
// fill은 입력 요소 선택자 + "value", press는 키("Enter", "Control+A"), expect는 상태가 적용됐을 때만 보이는 요소 선택자(마지막 단계).
// viewports를 생략하면 검증 뷰포트 전체.
function loadStates(t) {
  const p = join(t.dir, 'qa-states.json')
  if (!existsSync(p)) return { states: [] }
  try {
    const states = JSON.parse(readFileSync(p, 'utf8'))
    if (!Array.isArray(states)) return { states: [], error: 'qa-states.json이 배열이 아님' }
    const bad = states.filter(st => !st?.name || !/^[a-z0-9-]+$/.test(st.name) || !Array.isArray(st.steps))
    return bad.length ? { states: [], error: `qa-states.json 항목 형식 오류(name은 kebab-case, steps 배열 필수): ${bad.map(b => b?.name ?? '?').join(', ')}` } : { states }
  } catch (e) {
    return { states: [], error: `qa-states.json을 읽지 못함: ${String(e.message ?? e).slice(0, 200)}` }
  }
}

// 갤러리 피드백 도구(src/features/feedback, 2026-11-03)는 템플릿 루트 안에서 화면 고정 위치로 그려진다. 템플릿 검증 대상이 아니고
// (기능은 npm run test:feedback이 검사), 문서 높이로 늘린 스크린샷에서 템플릿 내용을 가린다. 템플릿을 감싸는 .fb-wrapper·.fb-surface는 숨기지 않는다.
const HIDE_GALLERY_TOOLS = '.fb-dock-stack, .fb-panel, [data-feedback-pin], .fb-target-highlight { display: none !important; }'
async function hideGalleryTools(context) {
  await context.addInitScript(css => {
    const add = () => { const s = document.createElement('style'); s.setAttribute('data-qa-hide', ''); s.textContent = css; document.head.appendChild(s) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add, { once: true })
  }, HIDE_GALLERY_TOOLS)
}

// 전체 회귀(28개 × 6조합 + 상태)에서 Windows 소켓 버퍼 고갈(net::ERR_NO_BUFFER_SPACE)이 가끔 나 템플릿과 무관한 실패가 된다(14차·회고 3). net:: 오류만 잠시 쉬고 2번까지 다시 연다.
async function gotoWithRetry(page, url) {
  for (let i = 0; ; i++) {
    try {
      return await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    } catch (e) {
      if (i >= 2 || !/net::ERR_/.test(String(e.message ?? e))) throw e
      await new Promise(r => setTimeout(r, 2000 * (i + 1)))
    }
  }
}

// Vite HMR 웹소켓 연결 실패(net::ERR_NO_BUFFER_SPACE 등)는 개발 서버·OS 환경 문제라 템플릿 문제로 세지 않는다(15차 배치 전체 회귀에서 haplotype-viewer 390 1회).
const isDevServerNoise = text => /^WebSocket connection to 'ws:\/\/[^']*' failed/.test(text) && /net::ERR_/.test(text)

async function runSteps(page, steps) {
  for (const st of steps) {
    if (st.wait) await page.waitForTimeout(Number(st.wait))
    else if (st.clickSelector) await page.locator(st.clickSelector).first().click({ timeout: 10_000, modifiers: st.modifiers })
    else if (st.fill) await page.locator(st.fill).first().fill(String(st.value ?? ''), { timeout: 10_000 })
    else if (st.press) await page.keyboard.press(st.press)
    // 상태가 실제로 적용됐는지 확인한다. 안 보이면 '상태 재현 실패'(첫 클릭이 빗나가 기본 화면을 상태 화면으로 통과시키던 빈틈, 15차 배치)
    else if (st.expect) await page.locator(st.expect).first().waitFor({ state: 'visible', timeout: Number(st.timeout ?? 5_000) })
    else if (st.click) {
      const exact = page.getByText(st.click, { exact: true })
      await ((await exact.count()) ? exact : page.getByText(st.click)).first().click({ timeout: 10_000, modifiers: st.modifiers })
    }
  }
}

async function main() {
  const templates = discoverTemplates(filter)
  if (!templates.length) {
    console.error(filter ? `slug ${filter.join(', ')}에 해당하는 템플릿 폴더가 없습니다.` : 'src/templates에 템플릿이 없습니다.')
    process.exit(1)
  }

  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    console.error('playwright를 불러올 수 없습니다. 프로젝트 루트에서 다음을 실행하세요:\n  npm i -D playwright @axe-core/playwright && npx playwright install chromium')
    process.exit(2)
  }
  let AxeBuilder = null
  if (useAxe) {
    try {
      AxeBuilder = (await import('@axe-core/playwright')).default
    } catch {
      console.warn('[경고] @axe-core/playwright가 없어 접근성 검사를 건너뜁니다.')
    }
  }

  let server = null
  let cacheDir = null
  let base = typeof args['base-url'] === 'string' ? args['base-url'].replace(/\/$/, '') : null
  if (!base) {
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    // 감시·HMR 끄기와 실행별 의존성 캐시는 vite.config.ts의 VERIFY_SERVER 분기가 맡는다(동시 실행 시 일시 실패 방지).
    server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: process.cwd(),
      env: { ...process.env, VERIFY_SERVER: '1', VERIFY_CACHE_DIR: (cacheDir = join(tmpdir(), `db-template-verify-vite-${port}`)) },
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let serverLog = ''
    server.stdout.on('data', d => (serverLog += d))
    server.stderr.on('data', d => (serverLog += d))
    const up = await waitForHttp(base + '/', 60_000)
    if (!up) {
      killTree(server)
      console.error(`개발 서버가 60초 안에 응답하지 않았습니다.\n${serverLog.slice(-2000)}`)
      process.exit(2)
    }
  }

  const cleanup = () => {
    killTree(server)
    if (cacheDir) try { rmSync(cacheDir, { recursive: true, force: true }) } catch {}
  }
  process.on('SIGINT', () => { cleanup(); process.exit(130) })

  const browser = await playwright.chromium.launch()
  const results = []
  try {
    for (const t of templates) {
      const tDir = join(outDir, t.slug)
      mkdirSync(tDir, { recursive: true })
      const entry = { slug: t.slug, category: t.category, runs: [], a11y: null, errors: [] }
      for (const theme of themes) {
        for (const width of viewports) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
          await hideGalleryTools(context)
          const page = await context.newPage()
          const consoleErrors = []
          const foreignConsole = []
          // error와 함께 템플릿 DEV 검산 실패도 문제로 센다: console.assert 실패('assert' 타입)와 '[검산]' 태그가 붙은 메시지.
          // 다른 템플릿 폴더에서 나온 메시지는 이 템플릿의 문제로 세지 않고 따로 적는다(갤러리는 템플릿을 지연 로드하므로 임베드에서는 드물지만, 공유 모듈 HMR 등으로 섞일 수 있다).
          const ownDir = `/src/templates/${t.category}/${t.slug}/`
          page.on('console', m => {
            const text = m.text()
            if (!(m.type() === 'error' || m.type() === 'assert' || text.includes('[검산]'))) return
            if (isDevServerNoise(text)) return
            const src = m.location()?.url ?? ''
            const line = `${m.type()}: ${text.slice(0, 500)}`
            if (src.includes('/src/templates/') && !src.includes(ownDir)) foreignConsole.push(`${line} (출처 ${src.replace(/^.*\/src\//, 'src/').split('?')[0]})`)
            else consoleErrors.push(line)
          })
          page.on('pageerror', e => consoleErrors.push(`pageerror: ${String(e.message ?? e).slice(0, 500)}`))
          const url = `${base}/?embed=1&theme=${theme}#/t/${t.category}/${t.slug}`
          const run = { width, theme, url, screenshot: null, consoleErrors, foreignConsole, issues: [] }
          try {
            await gotoWithRetry(page, url)
            const rootSel = `[data-template-root="${t.slug}"]`
            // 갤러리는 템플릿 모듈을 지연 로드한다. 로딩 중에는 data-template-loading만 있고 루트·오류·missing은 없으므로 아래 대기가 로드 완료를 기다린다.
            const found = await page.waitForSelector(`${rootSel}, [data-template-error], [data-template-missing]`, { timeout: 15_000 }).catch(() => null)
            await page.waitForTimeout(SETTLE_MS)
            // EChart 래퍼는 렌더가 끝나면 data-chart-ready="true"로 바꾼다(대용량 시리즈 부분 렌더 방지). 최대 10초 기다린다.
            await page
              .waitForFunction(() => !document.querySelector('[data-chart-ready="false"]'), null, { timeout: 10_000 })
              .catch(() => run.issues.push('렌더가 10초 안에 끝나지 않은 차트가 있음(data-chart-ready="false")'))
            if (!found) run.issues.push('템플릿 루트 요소를 찾지 못함(갤러리 계약 data-template-root 확인)')
            if (await page.$('[data-template-missing]')) run.issues.push('갤러리가 slug를 찾지 못함(registry 등록·meta.slug 확인)')
            const errEl = await page.$('[data-template-error]')
            if (errEl) run.issues.push(`렌더 오류: ${(await errEl.innerText()).slice(0, 300)}`)
            await measure(page, rootSel, run, found)
            if (consoleErrors.length) run.issues.push(`콘솔 오류 ${consoleErrors.length}건`)
            const shot = join(tDir, `${width}-${theme}.png`)
            await fullPageShot(page, shot, width)
            run.screenshot = shot

            if (AxeBuilder && width === Math.max(...viewports) && !entry.a11y?.[theme]) {
              const axe = await new AxeBuilder({ page }).include(rootSel).analyze()
              const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
              entry.a11y = { ...(entry.a11y ?? {}), [theme]: serious.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })) }
            }
          } catch (e) {
            run.issues.push(`페이지 실행 실패: ${String(e.message ?? e).slice(0, 300)}`)
          }
          entry.runs.push(run)
          await context.close()
        }
      }
      const { states, error: stateError } = loadStates(t)
      entry.states = states.map(st => st.name)
      for (const st of states) {
        for (const width of (st.viewports ?? viewports).filter(w => viewports.includes(w))) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' })
          await hideGalleryTools(context)
          const page = await context.newPage()
          const consoleErrors = []
          const ownDir = `/src/templates/${t.category}/${t.slug}/`
          page.on('console', m => {
            const text = m.text()
            const src = m.location()?.url ?? ''
            if (!(m.type() === 'error' || m.type() === 'assert' || text.includes('[검산]'))) return
            if (isDevServerNoise(text)) return
            if (src.includes('/src/templates/') && !src.includes(ownDir)) return
            consoleErrors.push(`${m.type()}: ${text.slice(0, 500)}`)
          })
          page.on('pageerror', e => consoleErrors.push(`pageerror: ${String(e.message ?? e).slice(0, 500)}`))
          const url = `${base}/?embed=1&theme=light#/t/${t.category}/${t.slug}`
          const run = { width, theme: 'light', state: st.name, url, screenshot: null, consoleErrors, issues: [] }
          try {
            await gotoWithRetry(page, url)
            const rootSel = `[data-template-root="${t.slug}"]`
            const found = await page.waitForSelector(rootSel, { timeout: 15_000 }).catch(() => null)
            await page.waitForTimeout(SETTLE_MS)
            await runSteps(page, st.steps)
            await page.waitForTimeout(SETTLE_MS)
            await page
              .waitForFunction(() => !document.querySelector('[data-chart-ready="false"]'), null, { timeout: 10_000 })
              .catch(() => run.issues.push('렌더가 10초 안에 끝나지 않은 차트가 있음(data-chart-ready="false")'))
            const errEl = await page.$('[data-template-error]')
            if (errEl) run.issues.push(`렌더 오류: ${(await errEl.innerText()).slice(0, 300)}`)
            await measure(page, rootSel, run, found)
            if (consoleErrors.length) run.issues.push(`콘솔 오류 ${consoleErrors.length}건`)
            const shot = join(tDir, `${width}-light-${st.name}.png`)
            await page.screenshot({ path: shot, fullPage: true })
            run.screenshot = shot
          } catch (e) {
            run.issues.push(`상태 재현 실패(steps 확인): ${String(e.message ?? e).slice(0, 300)}`)
          }
          entry.runs.push(run)
          await context.close()
        }
      }
      entry.errors = entry.runs.flatMap(r => r.issues.map(i => `[${r.width}px/${r.theme}${r.state ? `/${r.state}` : ''}] ${i}`))
      if (stateError) entry.errors.push(stateError)
      for (const [theme, list] of Object.entries(entry.a11y ?? {})) {
        for (const v of list) entry.errors.push(`[a11y/${theme}] ${v.impact} ${v.id}: ${v.help} (${v.nodes}곳, 예: ${v.sample})`)
      }
      entry.foreignConsole = [...new Set(entry.runs.flatMap(r => r.foreignConsole ?? []))]
      results.push(entry)
    }
  } finally {
    await browser.close()
    cleanup()
  }

  const report = { base, viewports, themes, templates: results, summary: { templates: results.length, failed: results.filter(r => r.errors.length).length } }
  mkdirSync(outDir, { recursive: true })
  const reportPath = filter?.length === 1 ? join(outDir, filter[0], 'report.json') : join(outDir, 'report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  for (const r of results) {
    console.log(`${r.errors.length ? '✗' : '✓'} ${r.category}/${r.slug}  문제 ${r.errors.length}건`)
    r.errors.forEach(e => console.log(`   ${e}`))
    r.foreignConsole.forEach(e => console.log(`   [참고·다른 템플릿] ${e}`))
  }
  console.log(`\n보고서: ${reportPath}\n스크린샷: ${outDir}`)
  process.exit(report.summary.failed ? 1 : 0)
}

main().catch(e => {
  console.error(e)
  process.exit(2)
})
