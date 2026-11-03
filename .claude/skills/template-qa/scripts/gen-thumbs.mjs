#!/usr/bin/env node
// 갤러리 목록의 템플릿 미리보기 썸네일을 만든다: 임베드 화면(?embed=1)을 1440×900 첫 화면으로 찍고 브라우저 캔버스로 줄여 webp로 저장한다.
// 갤러리 목록은 이 폴더에 있는 파일만 import.meta.glob으로 읽고, 없으면 빈 자리를 보인다(gallery-redesign 2026-11-02).
// 템플릿 화면이 바뀌면 썸네일도 낡으므로 전체 회귀 때 다시 만든다(template-qa 「썸네일」).
// 사용: node .claude/skills/template-qa/scripts/gen-thumbs.mjs [--slug a,b] [--themes light,dark] [--width 1080] [--quality 0.78]
//        [--out src/gallery/thumbs] [--base-url http://localhost:5173]
// 결과: {out}/{category}-{slug}-{theme}.webp. --slug 없이 돌리면 지금 없는 템플릿의 옛 썸네일을 지운다.
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

const USAGE =
  '사용: node .claude/skills/template-qa/scripts/gen-thumbs.mjs [--slug a,b] [--themes light,dark] [--width 1080] [--quality 0.78] [--out src/gallery/thumbs] [--base-url URL]'
const args = parseArgs(process.argv.slice(2))
// verify와 같은 이유로 모르는 옵션은 실행 전에 멈춘다(--help가 전체 생성으로 이어지지 않게).
const KNOWN = ['slug', 'themes', 'width', 'quality', 'out', 'base-url']
const unknown = Object.keys(args).filter(k => !KNOWN.includes(k))
if (unknown.length) {
  console.error(`${unknown.includes('help') ? '' : `알 수 없는 옵션: --${unknown.join(', --')}\n`}${USAGE}`)
  process.exit(unknown.includes('help') ? 0 : 2)
}
const filter = typeof args.slug === 'string' ? args.slug.split(',').map(s => s.trim()) : null
const themes = (typeof args.themes === 'string' ? args.themes : 'light,dark').split(',')
const outDir = resolve(typeof args.out === 'string' ? args.out : 'src/gallery/thumbs')
const thumbWidth = Number(typeof args.width === 'string' ? args.width : 1080)
const quality = Number(typeof args.quality === 'string' ? args.quality : 0.78)
const SHOT = { width: 1440, height: 900 } // 16:10, 썸네일 비율과 같다
const SETTLE_MS = 1200 // 차트 초기 애니메이션·스켈레톤이 끝날 시간(verify와 같은 값)

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

// 갤러리 피드백 도구(src/features/feedback)는 템플릿 루트 안에 화면 고정으로 그려져 미리보기 오른쪽 아래를 가린다. 썸네일은 템플릿만 보인다(verify-templates.mjs와 같은 규칙).
const HIDE_GALLERY_TOOLS = '.fb-dock-stack, .fb-panel, [data-feedback-pin], .fb-target-highlight { display: none !important; }'
async function hideGalleryTools(context) {
  await context.addInitScript(css => {
    const add = () => { const s = document.createElement('style'); s.setAttribute('data-qa-hide', ''); s.textContent = css; document.head.appendChild(s) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add, { once: true })
  }, HIDE_GALLERY_TOOLS)
}

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

// PNG(base64)를 반씩 줄이다가 마지막에 목표 폭으로 맞춘다. 한 번에 1/2보다 많이 줄이면 글자·가는 선이 깨진다.
async function downscale(page, pngBase64, width, q) {
  return page.evaluate(
    async ({ b64, width, q }) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      let src = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const height = Math.round((src.height * width) / src.width)
      while (src.width / 2 >= width) {
        const c = new OffscreenCanvas(Math.round(src.width / 2), Math.round(src.height / 2))
        const ctx = c.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(src, 0, 0, c.width, c.height)
        src = c
      }
      const out = new OffscreenCanvas(width, height)
      const ctx = out.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src, 0, 0, width, height)
      const blob = await out.convertToBlob({ type: 'image/webp', quality: q })
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return { b64: btoa(s), type: blob.type }
    },
    { b64: pngBase64, width, q },
  )
}

async function main() {
  // `_` 접두(내부 검증용)는 갤러리 목록에 없으므로 만들지 않는다.
  const templates = discoverTemplates(filter).filter(t => !t.slug.startsWith('_'))
  if (!templates.length) {
    console.error(filter ? `slug ${filter.join(', ')}에 해당하는 템플릿 폴더가 없습니다.` : 'src/templates에 템플릿이 없습니다.')
    process.exit(1)
  }

  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    console.error('playwright를 불러올 수 없습니다. 프로젝트 루트에서 다음을 실행하세요:\n  npm i -D playwright && npx playwright install chromium')
    process.exit(2)
  }

  let server = null
  let cacheDir = null
  let base = typeof args['base-url'] === 'string' ? args['base-url'].replace(/\/$/, '') : null
  if (!base) {
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    // 감시·HMR 끄기와 실행별 의존성 캐시는 vite.config.ts의 VERIFY_SERVER 분기가 맡는다.
    server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: process.cwd(),
      env: { ...process.env, VERIFY_SERVER: '1', VERIFY_CACHE_DIR: (cacheDir = join(tmpdir(), `db-template-thumbs-vite-${port}`)) },
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let serverLog = ''
    server.stdout.on('data', d => (serverLog += d))
    server.stderr.on('data', d => (serverLog += d))
    if (!(await waitForHttp(base + '/', 60_000))) {
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

  mkdirSync(outDir, { recursive: true })
  const browser = await playwright.chromium.launch()
  const written = []
  const skipped = []
  let bytes = 0
  try {
    for (const t of templates) {
      for (const theme of themes) {
        const name = `${t.category}-${t.slug}-${theme}.webp`
        const context = await browser.newContext({ viewport: SHOT, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' })
        await hideGalleryTools(context)
        const page = await context.newPage()
        try {
          await gotoWithRetry(page, `${base}/?embed=1&theme=${theme}#/t/${t.category}/${t.slug}`)
          const rootSel = `[data-template-root="${t.slug}"]`
          await page.waitForSelector(`${rootSel}, [data-template-error], [data-template-missing]`, { timeout: 15_000 })
          // 오류·없음 화면을 썸네일로 남기면 목록이 깨진 그림을 정상처럼 보인다. 이때는 만들지 않고(목록은 빈 자리) 알린다.
          if ((await page.$('[data-template-error]')) || (await page.$('[data-template-missing]'))) {
            skipped.push(`${name}: 템플릿 오류·없음 화면`)
            continue
          }
          await page.waitForTimeout(SETTLE_MS)
          const ready = await page
            .waitForFunction(() => !document.querySelector('[data-chart-ready="false"]'), null, { timeout: 10_000 })
            .then(() => true, () => false)
          if (!ready) {
            skipped.push(`${name}: 10초 안에 렌더가 끝나지 않은 차트`)
            continue
          }
          await page.waitForTimeout(300)
          const png = await page.screenshot({ type: 'png' })
          const { b64, type } = await downscale(page, png.toString('base64'), thumbWidth, quality)
          if (type !== 'image/webp') throw new Error(`webp 인코딩을 지원하지 않음(${type})`)
          const buf = Buffer.from(b64, 'base64')
          writeFileSync(join(outDir, name), buf)
          bytes += buf.length
          written.push(name)
        } catch (e) {
          skipped.push(`${name}: ${String(e.message ?? e).split('\n')[0].slice(0, 200)}`)
        } finally {
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
    cleanup()
  }

  // 전체 실행에서만 지금 없는 템플릿(이름이 바뀌었거나 지운 폴더)의 옛 썸네일을 지운다.
  const removed = []
  if (!filter) {
    const keep = new Set(templates.flatMap(t => themes.map(th => `${t.category}-${t.slug}-${th}.webp`)))
    for (const f of readdirSync(outDir)) {
      if (!f.endsWith('.webp') || keep.has(f) || !statSync(join(outDir, f)).isFile()) continue
      if (themes.some(th => f.endsWith(`-${th}.webp`))) {
        rmSync(join(outDir, f))
        removed.push(f)
      }
    }
  }

  console.log(`썸네일 ${written.length}장 저장(${(bytes / 1024).toFixed(0)} KB, 평균 ${written.length ? (bytes / 1024 / written.length).toFixed(1) : 0} KB) → ${outDir}`)
  if (removed.length) console.log(`옛 썸네일 ${removed.length}장 삭제: ${removed.join(', ')}`)
  if (skipped.length) {
    console.log(`건너뜀 ${skipped.length}장:\n  ${skipped.join('\n  ')}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
