#!/usr/bin/env node
// 템플릿 폴더의 규약을 정적으로 검사한다. 오류가 하나라도 있으면 종료 코드 1.
// 사용: node .claude/skills/template-qa/scripts/lint-templates.mjs [--slug a,b] [--json out.json]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CATEGORIES = ['kpi', 'viz', 'infographic', 'workflow']
const root = process.cwd()
const templatesDir = join(root, 'src', 'templates')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i]
  }
  return out
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

// fontSize 식(ECharts·style 객체 `fontSize: 10`, SVG·JSX `fontSize={10}`·`fontSize="10"`, 조건식 `narrow ? 10 : 11`, `u(10)`, CSS `font-size: 10px`)에서
// 단독 피연산자로 쓴 11 미만 숫자를 찾는다. 사칙연산의 오른쪽 피연산자(`w * 0.04`, `valFont - 2`)는 크기가 아니라 세지 않는다.
// 첫 판(`fontSize: 10`만)은 SVG 속성·조건식을 놓쳐 trait-correlation의 11px 미만 36곳이 경고 0이었다(디자인 개선 B단계).
export function smallFontLiteral(line) {
  const m = line.match(/(?:fontSize\s*[:=]|font-size\s*:)\s*(.*)$/)
  if (!m) return false
  let expr = m[1]
  if (expr.startsWith('{')) expr = expr.slice(1)
  let depth = 0
  let end = expr.length
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (depth === 0 && (c === ',' || c === ';' || c === '}')) {
      end = i
      break
    }
  }
  expr = expr.slice(0, end)
  for (const t of expr.matchAll(/(^|[\s(?:"'])(\d+(?:\.\d+)?)(?=\s*(?:px)?\s*(?:[)"':?]|$))/g)) {
    const prev = expr.slice(0, t.index + t[1].length).trimEnd().slice(-1)
    if ('*/+-'.includes(prev) && prev !== '') continue
    const n = Number(t[2])
    if (n > 0 && n < 11) return true
  }
  return false
}

export function discoverTemplates(filter) {
  if (!existsSync(templatesDir)) return []
  const found = []
  for (const category of readdirSync(templatesDir)) {
    const cdir = join(templatesDir, category)
    if (!statSync(cdir).isDirectory()) continue
    for (const slug of readdirSync(cdir)) {
      const dir = join(cdir, slug)
      if (!statSync(dir).isDirectory()) continue
      if (filter && !filter.includes(slug)) continue
      found.push({ category, slug, dir })
    }
  }
  return found
}

function lintOne(t) {
  const errors = []
  const warnings = []
  const rel = p => relative(root, p).replaceAll('\\', '/')

  if (!CATEGORIES.includes(t.category)) errors.push(`알 수 없는 카테고리 폴더: ${t.category}`)
  if (!/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) errors.push(`slug가 kebab-case가 아님: ${t.slug}`)

  const index = join(t.dir, 'index.tsx')
  if (!existsSync(index)) {
    errors.push('index.tsx 없음')
    return { ...t, dir: rel(t.dir), errors, warnings }
  }
  const src = readFileSync(index, 'utf8')
  if (!/export\s+const\s+meta\b/.test(src)) errors.push('index.tsx에 `export const meta` 없음')
  if (!/export\s+default\s+/.test(src)) errors.push('index.tsx에 default export 없음')
  const slugMatch = src.match(/slug:\s*['"]([^'"]+)['"]/)
  if (slugMatch && slugMatch[1] !== t.slug) errors.push(`meta.slug(${slugMatch[1]})가 폴더 이름(${t.slug})과 다름`)
  const catMatch = src.match(/category:\s*['"]([^'"]+)['"]/)
  if (catMatch && catMatch[1] !== t.category) errors.push(`meta.category(${catMatch[1]})가 상위 폴더(${t.category})와 다름`)
  for (const field of ['title', 'description']) {
    if (!new RegExp(`${field}:\\s*['"\`]`).test(src)) errors.push(`meta.${field} 없음`)
  }
  if (/description:\s*['"]TODO/.test(src)) warnings.push('meta.description이 TODO 상태')

  if (!existsSync(join(t.dir, 'data.ts'))) warnings.push('data.ts 없음(정적 인포그래픽이 아니라면 데이터 분리 필요)')
  if (!existsSync(join(t.dir, 'README.md'))) warnings.push('README.md 없음')
  // 업무 화면은 선택·입력 뒤에야 나오는 패널·경고 문구가 많아 기본 화면 검증만으로는 넘침을 못 잡는다(정리 회차 3, seed-inventory).
  if (t.category === 'workflow' && !t.slug.startsWith('_') && !existsSync(join(t.dir, 'qa-states.json'))) warnings.push('qa-states.json 없음 — 업무 화면은 선택·경고 상태를 verify가 열 수 있게 선언(template-authoring 「상태 검증 선언」)')

  const codeFiles = walk(t.dir).filter(p => /\.(tsx?|css)$/.test(p))
  for (const file of codeFiles) {
    const code = readFileSync(file, 'utf8')
    const lines = code.split(/\r?\n/)
    lines.forEach((line, i) => {
      const loc = `${rel(file)}:${i + 1}`
      if (/^\s*(\/\/|\*)/.test(line)) return
      if (/Math\.random\s*\(/.test(line)) errors.push(`${loc} Math.random() 사용 — @/lib/rng의 createRng를 쓴다`)
      if (/echarts\.use\s*\(/.test(line)) errors.push(`${loc} echarts.use() 직접 호출 — @/charts가 등록을 담당한다`)
      if (/(['"`])#[0-9a-fA-F]{3,8}\1|:\s*#[0-9a-fA-F]{3,8}\b/.test(line)) warnings.push(`${loc} 하드코딩 hex 색 — 토큰/palettes 사용 권장`)
      if (/\brgba?\(\s*\d/.test(line)) warnings.push(`${loc} 하드코딩 rgb 색 — 토큰/palettes 사용 권장`)
      // 글자 하한 11px(visual-language 보조·캡션 12, 앱 화면 규칙의 하한 11). 인포그래픽 캔버스 안은 축소되므로 더 작아진다.
      if (/text-\[(?:[0-9]|10)(?:\.\d+)?px\]/.test(line) || smallFontLiteral(line)) warnings.push(`${loc} 11px 미만 글자 — 보조 글자도 11px 이상(캔버스 안은 계약 최소 크기)`)
      if (/<EChart\b/.test(line)) {
        const block = lines.slice(i, i + 15).join(' ')
        if (!/ariaLabel=/.test(block.split('/>')[0])) errors.push(`${loc} <EChart>에 ariaLabel 없음`)
      }
      const imp = line.match(/from\s+['"]([^'"]+)['"]/)
      if (imp) {
        const spec = imp[1]
        let target = null
        if (spec.startsWith('.')) target = resolve(dirname(file), spec)
        else if (spec.startsWith('@/templates/')) target = join(root, 'src', spec.slice(2))
        if (target) {
          const inTemplates = target.startsWith(templatesDir)
          const inOwn = target.startsWith(t.dir)
          if (inTemplates && !inOwn) errors.push(`${loc} 다른 템플릿 import 금지: ${spec}`)
          const shared = ['design-system', 'charts', 'lib', 'gallery'].map(d => join(root, 'src', d))
          if (spec.startsWith('.') && shared.some(s => target.startsWith(s))) warnings.push(`${loc} 공통 모듈은 상대 경로 대신 @/ 별칭으로 import`)
        }
      }
    })
  }
  return { ...t, dir: rel(t.dir), errors, warnings }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const filter = typeof args.slug === 'string' ? args.slug.split(',').map(s => s.trim()) : null
  const templates = discoverTemplates(filter)
  if (filter && templates.length === 0) {
    console.error(`slug ${filter.join(', ')}에 해당하는 템플릿 폴더가 없습니다.`)
    process.exit(1)
  }
  const results = templates.map(lintOne)
  const errorCount = results.reduce((n, r) => n + r.errors.length, 0)
  const warnCount = results.reduce((n, r) => n + r.warnings.length, 0)
  const report = { templates: results, summary: { templates: results.length, errors: errorCount, warnings: warnCount } }
  if (typeof args.json === 'string') {
    mkdirSync(dirname(resolve(args.json)), { recursive: true })
    writeFileSync(args.json, JSON.stringify(report, null, 2), 'utf8')
  }
  for (const r of results) {
    const mark = r.errors.length ? '✗' : '✓'
    console.log(`${mark} ${r.category}/${r.slug}  오류 ${r.errors.length} · 경고 ${r.warnings.length}`)
    r.errors.forEach(e => console.log(`   [오류] ${e}`))
    r.warnings.forEach(w => console.log(`   [경고] ${w}`))
  }
  console.log(`\n템플릿 ${results.length}개 · 오류 ${errorCount} · 경고 ${warnCount}`)
  process.exit(errorCount ? 1 : 0)
}
