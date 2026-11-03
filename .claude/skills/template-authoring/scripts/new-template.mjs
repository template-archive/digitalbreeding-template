#!/usr/bin/env node
// 템플릿 폴더 스캐폴드를 만든다. 이미 있는 파일은 덮어쓰지 않는다.
// 사용: node .claude/skills/template-authoring/scripts/new-template.mjs --category viz --slug gwas-manhattan --title "GWAS 결과 뷰어" [--seed 20261023]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CATEGORIES = ['kpi', 'viz', 'infographic', 'workflow']

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const { category, slug } = args
const title = args.title ?? slug
const seed = Number(args.seed ?? 20261023)

if (!CATEGORIES.includes(category)) {
  console.error(`--category는 ${CATEGORIES.join(', ')} 중 하나여야 합니다.`)
  process.exit(1)
}
if (!slug || !/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('--slug는 kebab-case여야 합니다. 예: gwas-manhattan')
  process.exit(1)
}

const dir = join(process.cwd(), 'src', 'templates', category, slug)
mkdirSync(dir, { recursive: true })

const today = new Date().toISOString().slice(0, 10)
const files = {
  'index.tsx': `import type { TemplateMeta } from '@/gallery/types'
import { Card, SectionHeader } from '@/design-system'
import { data } from './data'

export const meta: TemplateMeta = {
  slug: '${slug}',
  category: '${category}',
  title: '${title}',
  description: 'TODO: 이 템플릿이 답하는 질문을 한 문장으로',
  tags: [],
  status: 'draft',
  updatedAt: '${today}',
}

export default function Template() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title={meta.title} description={meta.description} />
      <Card title="TODO">
        <pre className="text-muted text-xs">{JSON.stringify(data.summary, null, 2)}</pre>
      </Card>
    </div>
  )
}
`,
  'data.ts': `import { createRng } from '@/lib/rng'

// 시드를 바꾸면 화면이 바뀐다. 명세(docs/specs/${slug}.md)의 시드와 맞춘다.
const rng = createRng(${seed})

export const data = {
  summary: { sample: rng.int(100, 999) },
}
`,
  'README.md': `# ${title}

- 카테고리: ${category}
- 명세: \`docs/specs/${slug}.md\`

## 목적
TODO

## 사용 지표
TODO

## 실제 데이터로 교체하기
\`data.ts\`의 export 형태를 유지한 채 API 응답으로 바꾼다.

## 변경 이력
- ${today} 스캐폴드 생성
`,
}

for (const [name, content] of Object.entries(files)) {
  const p = join(dir, name)
  if (existsSync(p)) {
    console.log(`건너뜀(이미 있음): ${p}`)
    continue
  }
  writeFileSync(p, content, 'utf8')
  console.log(`생성: ${p}`)
}
