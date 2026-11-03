// 피드백 API가 받는 템플릿 목록(server/feedback-templates.ts)을 src/templates 폴더에서 다시 만든다.
// 서버는 이 목록에 없는 템플릿의 코멘트를 404로 거절하므로, 템플릿을 추가·삭제한 PR은 이 스크립트를 돌린 결과를 함께 커밋한다.
// tests/feedback-templates.test.mjs(npm run test:feedback → build)가 목록과 폴더가 어긋나면 실패한다.
// 사용: npm run sync:feedback-templates          목록 파일을 다시 쓴다
//       node scripts/sync-feedback-templates.mjs --check   다시 쓰지 않고 어긋나면 종료 코드 1
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const templatesDir = join(root, 'src/templates')
const target = join(root, 'server/feedback-templates.ts')

/** `{category}/{slug}` 목록. `_`로 시작하는 내부 검증용 템플릿과 index.tsx가 없는 폴더는 뺀다. */
export function templateKeys() {
  const keys = []
  for (const category of readdirSync(templatesDir).sort()) {
    const cdir = join(templatesDir, category)
    if (!statSync(cdir).isDirectory()) continue
    for (const slug of readdirSync(cdir).sort()) {
      if (slug.startsWith('_')) continue
      if (existsSync(join(cdir, slug, 'index.tsx'))) keys.push(`${category}/${slug}`)
    }
  }
  return keys
}

export function render(keys) {
  return [
    '// 생성 파일: npm run sync:feedback-templates (scripts/sync-feedback-templates.mjs). 직접 고치지 않는다.',
    '// 피드백 API는 이 목록에 있는 템플릿의 코멘트만 받는다.',
    'export const FEEDBACK_TEMPLATES = new Set([',
    keys.map(k => `  ${JSON.stringify(k)}`).join(',\n'),
    '])',
    '',
  ].join('\n')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const keys = templateKeys()
  if (process.argv.includes('--check')) {
    const current = new Set([...readFileSync(target, 'utf8').matchAll(/^\s*"([^"]+)"/gm)].map(m => m[1]))
    const missing = keys.filter(k => !current.has(k))
    const stale = [...current].filter(k => !keys.includes(k))
    if (missing.length || stale.length) {
      if (missing.length) console.error(`목록에 없는 템플릿: ${missing.join(', ')}`)
      if (stale.length) console.error(`폴더가 없는 목록 항목: ${stale.join(', ')}`)
      console.error('npm run sync:feedback-templates를 실행하고 결과를 커밋한다.')
      process.exit(1)
    }
    console.log(`피드백 템플릿 목록 ${keys.length}개 · 폴더와 일치`)
  } else {
    writeFileSync(target, render(keys))
    console.log(`피드백 템플릿 목록 ${keys.length}개 → server/feedback-templates.ts`)
  }
}
