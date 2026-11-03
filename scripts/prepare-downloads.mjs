import { readdir, readFile, mkdir, writeFile, unlink } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createServer } from 'vite'
import { createZip } from './zip.mjs'
import { PROGRAM_FIELDS, programSchema, validateProgramData } from '../src/features/template-data/contract.ts'

const root = process.cwd()
const output = join(root, 'public/downloads')
const json = value => JSON.stringify(value, null, 2) + '\n'

async function collect(directory) {
  const files = new Map()
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [name, content] of await collect(path)) files.set(name, content)
    } else if (entry.isFile() && /\.(tsx?|css|json|md|svg|png|webp)$/.test(entry.name)) files.set(relative(root, path).replaceAll('\\', '/'), await readFile(path))
  }
  return files
}

function referenceSchema(value) {
  if (value === null) return { type: 'null' }
  if (Array.isArray(value)) return { type: 'array', ...(value.length ? { items: referenceSchema(value[0]) } : {}) }
  if (typeof value === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, referenceSchema(item)])) }
  return { type: typeof value }
}

function snapshot(module) {
  const serializable = Object.fromEntries(Object.entries(module).filter(([key, value]) => !key.startsWith('__') && typeof value !== 'function'))
  return JSON.parse(JSON.stringify(serializable, (_key, value) => {
    if (typeof value === 'function' || typeof value === 'undefined' || (typeof value === 'number' && !Number.isFinite(value))) return undefined
    if (value instanceof Map) return Object.fromEntries(value)
    if (value instanceof Set) return [...value]
    return value
  }))
}

function guideFor(category, slug, title, connected, readme) {
  return `# ${title} — 프로젝트 적용 가이드

## 실행
Node.js 24, npm을 사용하세요.
1. starter.zip을 새 폴더에 압축 해제합니다.
2. npm ci
3. npm run dev
4. 배포 파일 생성: npm run build (결과: dist)

## 기존 React 프로젝트에 적용
- src/templates/${category}/${slug}와 src/design-system, src/charts, src/lib를 함께 옮깁니다.
- src/features/template-data와 src/gallery/types.ts도 포함합니다.
- package.json의 런타임 의존성, Tailwind 설정, src/index.css 및 Pretendard 폰트를 확인하세요.
- @/ 경로 별칭은 src/를 가리킵니다. 프레임워크가 다르면 프로젝트 설정에 맞게 바꾸세요.
- 기본 가져오기: import Template from '@/templates/${category}/${slug}'
- 화면에 <Template />를 렌더하면 목업으로 실행됩니다.

## 데이터 연결
${connected ? `sample-data.json과 sample-data.csv는 구현된 연간 개량량 데이터 계약입니다. schema.json에 필수 필드·단위·범위를 명시했습니다. 연도는 중복될 수 없습니다.
CSV는 UTF-8, 쉼표 구분입니다. 기준 수량 μ(kg/10a)는 업로드 화면에서 별도로 입력합니다. 자동 단위 변환은 하지 않습니다.
JSON/API 사용 예:

\x60\x60\x60tsx
import Template from '@/templates/${category}/${slug}'
import { validateProgramData } from '@/features/template-data/contract'

const response = await fetch('/api/my-program')
if (!response.ok) throw new Error('데이터 조회 실패')
const data = validateProgramData(await response.json())
// 로딩·오류 상태를 처리한 뒤 렌더합니다.
<Template data={data} />
\x60\x60\x60

연결 미리보기는 ΔG, 목표 달성률, r, L과 연도별 차트·표만 표시합니다. 목업의 파이프라인·출원·형질별 결과를 사용자 데이터에 섞지 않습니다.` : `sample-data.json은 data.ts가 내보내는 JSON 직렬화 가능 목업 상수의 스냅샷입니다. 함수는 제외하고 Map/Set은 객체/배열로 바꿨습니다. schema.json은 해당 스냅샷에서 자동 추출한 참고 구조이며, 필수값·단위·범위까지 검증하는 런타임 API 계약이 아닙니다.
이 템플릿에는 아직 외부 파일 업로드 어댑터가 없습니다. data.ts와 아래 지표 정의를 검토하고, 실제 응답 → 형식/단위 검증 → 화면 입력으로 이어지는 어댑터를 작성해야 합니다. JSON을 다운로드하거나 업로드하는 것만으로 자동 연결되지는 않습니다.`}

## 운영 전 확인
- 업무 화면의 저장·충돌·승인은 목업 동작입니다. 실제 API·권한·버전 관리가 별도로 필요합니다.
- DB 비밀번호와 비밀 API 키를 브라우저 또는 VITE_* 환경변수에 넣지 마세요.
- 제공된 목업은 실험·기관의 실제 성적이 아닙니다. 기관 지표 정의와 허용 범위를 확인하세요.
- ZIP과 다운로드 URL에는 소스가 포함됩니다. 사내 배포 전 운영 도메인과 다운로드 경로의 접근 권한을 설정하세요.
- 업로드 미리보기는 서버 저장·전송 없이 메모리에서 처리하며 새로고침 시 사라집니다.

---
## 템플릿별 지표와 데이터 구조
${readme}
`
}

async function main() {
  await mkdir(output, { recursive: true })
  const previous = await readFile(join(output, 'manifest.json'), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const shared = new Map()
  for (const directory of ['src/design-system', 'src/charts', 'src/lib', 'src/features/template-data']) {
    for (const [name, content] of await collect(join(root, directory))) shared.set(name, content)
  }
  for (const file of ['src/index.css', 'src/gallery/types.ts', 'tsconfig.json', 'tsconfig.node.json', 'package-lock.json']) shared.set(file, await readFile(join(root, file)))
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  packageJson.scripts = { dev: 'vite', build: 'npm run typecheck && vite build', typecheck: 'tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json', preview: 'vite preview' }
  shared.set('package.json', json(packageJson))
  shared.set('vite.config.ts', "import { fileURLToPath, URL } from 'node:url'\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'\nexport default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } })\n")
  shared.set('.gitignore', 'node_modules\ndist\n.env*\n')
  shared.set('src/main.tsx', "import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport './index.css'\nimport App from './App'\nconst theme = new URLSearchParams(window.location.search).get('theme')\nif (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme)\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)\n")
  const server = await createServer({ mode: 'production', server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom', logLevel: 'error' })
  const manifest = []
  try {
    for (const category of await readdir(join(root, 'src/templates'))) {
      for (const slug of await readdir(join(root, 'src/templates', category))) {
        if (slug.startsWith('_')) continue
        const directory = join(root, 'src/templates', category, slug)
        const entry = await server.ssrLoadModule(`/src/templates/${category}/${slug}/index.tsx`)
        const module = await server.ssrLoadModule(`/src/templates/${category}/${slug}/data.ts`)
        const connected = category === 'kpi' && slug === 'program-overview'
        const sample = connected ? validateProgramData({ projectName: '벼 육종 연간 지표 예제', baselineYield: module.MU, rows: module.YEARS.map(year => ({ year, selectionIntensity: module.I[year], accuracy: module.R[year], geneticSd: module.SIGMA_A[year], generationInterval: module.L[year], targetGainPct: module.dGTargetPct(year) })) }) : snapshot(module)
        const schema = connected ? programSchema : { $schema: 'https://json-schema.org/draft/2020-12/schema', title: `${entry.meta.title} 목업 참고 구조`, description: '목업 스냅샷에서 자동 추출한 구조입니다. 런타임 API 계약·입력 검증 명세가 아닙니다. 배열 항목은 첫 항목을 기준으로 설명합니다.', ...referenceSchema(sample) }
        const guide = guideFor(category, slug, entry.meta.title, connected, await readFile(join(directory, 'README.md'), 'utf8'))
        const files = new Map([...shared, ...await collect(directory)])
        files.set('README.md', guide)
        files.set('sample-data.json', json(sample))
        files.set('schema.json', json(schema))
        files.set('index.html', `<!doctype html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${entry.meta.title}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`)
        files.set('src/App.tsx', `${connected ? "import { useState } from 'react'\nimport { DataImport } from './features/template-data/DataImport'\nimport type { ProgramDataset } from './features/template-data/contract'\n" : ''}import Template from './templates/${category}/${slug}'\nexport default function App() {\n${connected ? '  const [data, setData] = useState<ProgramDataset | null>(null)\n' : ''}  return <main className="min-h-screen bg-bg p-4 sm:p-6"><div className="mx-auto max-w-[1600px]">${connected ? '<DataImport onApply={setData} /><div className="mt-5"><Template data={data ?? undefined} /></div>' : '<Template />'}</div></main>\n}\n`)
        const destination = join(output, category, slug)
        await mkdir(destination, { recursive: true })
        await writeFile(join(destination, 'sample-data.json'), json(sample))
        await writeFile(join(destination, 'schema.json'), json(schema))
        await writeFile(join(destination, 'guide.md'), guide)
        if (connected) {
          const csv = PROGRAM_FIELDS.map(field => field.key).join(',') + '\r\n' + sample.rows.map(row => PROGRAM_FIELDS.map(field => row[field.key]).join(',')).join('\r\n') + '\r\n'
          files.set('sample-data.csv', csv)
          await writeFile(join(destination, 'sample-data.csv'), csv)
        }
        await writeFile(join(destination, 'starter.zip'), createZip(files))
        manifest.push({ category, slug, title: entry.meta.title, preview: connected, sampleKind: connected ? 'runtime-contract' : 'mock-reference', files: files.size })
      }
    }
    const currentKeys = new Set(manifest.map(template => `${template.category}/${template.slug}`))
    for (const template of previous) {
      if (!/^[a-z0-9-]+$/.test(template.category) || !/^[a-z0-9-]+$/.test(template.slug) || currentKeys.has(`${template.category}/${template.slug}`)) continue
      for (const file of ['starter.zip', 'sample-data.json', 'sample-data.csv', 'schema.json', 'guide.md']) {
        await unlink(join(output, template.category, template.slug, file)).catch(error => { if (error.code !== 'ENOENT') throw error })
      }
    }
    await writeFile(join(output, 'manifest.json'), json(manifest))
    console.log(`Prepared ${manifest.length} starter ZIPs, samples, schemas and guides → public/downloads`)
  } finally { await server.close() }
}

await main()
