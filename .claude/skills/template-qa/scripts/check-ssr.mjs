#!/usr/bin/env node
// 다운로드 스타터 준비(scripts/prepare-downloads.mjs)는 npm run dev·build 직전(predev·prebuild)에 모든 템플릿의
// index.tsx·data.ts를 Vite SSR로 불러오고 README.md를 읽고 data.ts 내보내기를 JSON으로 스냅샷한다.
// 템플릿 하나라도 여기서 실패하면 dev·build 전체가 멈추는데, verify-templates.mjs는 Vite를 직접 띄워 이 실패를 잡지 못한다.
// 이 스크립트는 지정한 템플릿만 같은 방식으로 불러 본다. public/downloads에 쓰지 않으므로 빌더 여러 명이 동시에 돌려도
// 서로의 출력을 덮어쓰지 않고, 다른 빌더가 작성 중인 템플릿 때문에 실패하지 않는다.
// 사용: node .claude/skills/template-qa/scripts/check-ssr.mjs [--slug a,b]   (종료 코드: 0 통과 · 1 실패 · 2 사용법 오류)
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'
import { discoverTemplates } from './lint-templates.mjs'

// 연결형 템플릿: prepare-downloads.mjs가 data.ts의 이 내보내기로 실제 데이터 계약(sample-data·schema·CSV)을 만든다.
// 이름을 바꾸거나 지우면 다운로드 준비가 깨진다. prepare-downloads.mjs의 connected 조건이 바뀌면 함께 고친다.
const CONNECTED = { 'kpi/program-overview': ['MU', 'YEARS', 'I', 'R', 'SIGMA_A', 'L', 'dGTargetPct'] }

const argv = process.argv.slice(2)
const unknown = argv.filter(a => a.startsWith('--') && a !== '--slug')
if (unknown.length || (argv.includes('--slug') && !argv[argv.indexOf('--slug') + 1])) {
  console.error(`${unknown.length && !unknown.includes('--help') ? `알 수 없는 옵션: ${unknown.join(', ')}\n` : ''}사용: node .claude/skills/template-qa/scripts/check-ssr.mjs [--slug a,b]`)
  process.exit(2)
}
const filter = argv.includes('--slug') ? argv[argv.indexOf('--slug') + 1].split(',').map(s => s.trim()) : null
const templates = discoverTemplates(filter).filter(t => !t.slug.startsWith('_'))
if (!templates.length) {
  console.error(filter ? `slug ${filter.join(', ')}에 해당하는 템플릿 폴더가 없습니다.` : 'src/templates에 템플릿이 없습니다.')
  process.exit(2)
}

// prepare-downloads.mjs의 snapshot()과 같은 직렬화. 여기서 던지면 다운로드 준비도 같은 이유로 실패한다.
function snapshot(module) {
  const serializable = Object.fromEntries(Object.entries(module).filter(([key, value]) => !key.startsWith('__') && typeof value !== 'function'))
  return JSON.stringify(serializable, (_key, value) => {
    if (typeof value === 'function' || typeof value === 'undefined' || (typeof value === 'number' && !Number.isFinite(value))) return undefined
    if (value instanceof Map) return Object.fromEntries(value)
    if (value instanceof Set) return [...value]
    return value
  })
}

const firstLine = e => String(e?.message ?? e).split('\n')[0].slice(0, 300)
const server = await createServer({ mode: 'production', server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom', logLevel: 'error' })
let failed = 0
try {
  for (const t of templates) {
    const key = `${t.category}/${t.slug}`
    const problems = []
    if (!existsSync(join(t.dir, 'README.md'))) problems.push('README.md 없음(다운로드 안내 guide.md의 원문)')
    try {
      const entry = await server.ssrLoadModule(`/src/templates/${key}/index.tsx`)
      if (!entry.meta?.title) problems.push('index.tsx: meta.title 없음')
      if (typeof entry.default !== 'function') problems.push('index.tsx: default export 컴포넌트 없음')
    } catch (e) {
      problems.push(`index.tsx SSR 로드 실패: ${firstLine(e)} — 모듈 최상위에서 window·document·location·localStorage를 쓰지 말고 컴포넌트·훅 안으로 옮긴다`)
    }
    try {
      const data = await server.ssrLoadModule(`/src/templates/${key}/data.ts`)
      try { snapshot(data) } catch (e) { problems.push(`data.ts 내보내기를 JSON으로 만들 수 없음: ${firstLine(e)}`) }
      for (const name of CONNECTED[key] ?? []) if (!(name in data)) problems.push(`data.ts: 연결형 템플릿 내보내기 ${name} 없음(prepare-downloads.mjs 데이터 계약)`)
    } catch (e) {
      problems.push(`data.ts SSR 로드 실패: ${firstLine(e)} — 모듈 최상위에서 window·document·location·localStorage를 쓰지 않는다`)
    }
    if (problems.length) failed++
    console.log(`${problems.length ? '✗' : '✓'} ${key}${problems.length ? '\n  - ' + problems.join('\n  - ') : ''}`)
  }
} finally {
  await server.close()
}
console.log(`\n템플릿 ${templates.length}개 · 실패 ${failed}`)
process.exit(failed ? 1 : 0)
