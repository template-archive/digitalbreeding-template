// CI 브라우저 검증 범위를 정하고 병렬 작업 조각(shard)으로 나눈다. 출력은 GITHUB_OUTPUT 형식(shards=…, count=…, reason=…)이다.
// - 문서·하네스 문서만 바뀌면 브라우저 검증을 건너뛴다(count=0)
// - 공통 모듈·갤러리·빌드 설정·QA 스크립트가 바뀌면 전체 템플릿(모든 화면에 영향)
// - CI 설정(.github/workflows·scripts)이 바뀌어도 전체: 조각 나누기·범위 판정이 실제로 동작하는지 _starter 하나로는 확인할 수 없다
// - 템플릿 폴더만 바뀌면 그 템플릿들(README.md만 바뀐 템플릿은 화면이 같으므로 뺀다)
// - 그 밖(서버·CI 스크립트 등)은 _starter 하나로 서버·브라우저·스크립트가 동작하는지만 확인
// 템플릿 하나가 약 1분(6화면 + 상태 화면)이라, 6개씩 최대 6조각으로 나눠 동시에 돌린다(전체 34개 ≈ 7분).
// 사용: node .github/scripts/verify-scope.mjs <기준 커밋 SHA>
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PER_SHARD = 6
const MAX_SHARDS = 6

const FULL = [
  /^src\/(design-system|charts|lib|gallery|features)\//,
  /^src\/(index\.css|main\.tsx|App\.tsx)$/,
  /^(vite\.config\.ts|package-lock\.json|tsconfig(\.node)?\.json|index\.html)$/,
  /^\.claude\/skills\/template-qa\/scripts\//,
  /^\.github\/(workflows|scripts)\//,
]
// 화면에 영향이 없는 변경: 명세·backlog·문서, 하네스 에이전트·스킬 문서(QA 스크립트 제외), 모든 .md
const DOC_ONLY = f => /\.md$/.test(f) || /^docs\//.test(f) || (/^\.claude\/(agents|skills)\//.test(f) && !/^\.claude\/skills\/template-qa\/scripts\//.test(f))

function changedFiles(base) {
  if (!base || !/^[0-9a-f]{7,40}$/.test(base) || /^0+$/.test(base)) return null
  try {
    return execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch {
    return null
  }
}

function allSlugs() {
  const out = []
  for (const c of readdirSync('src/templates').sort()) {
    if (!statSync(join('src/templates', c)).isDirectory()) continue
    for (const s of readdirSync(join('src/templates', c)).sort()) if (!s.startsWith('_') && existsSync(join('src/templates', c, s, 'index.tsx'))) out.push(s)
  }
  return out
}

/** 이웃한 템플릿(같은 카테고리)이 한 조각에 몰리지 않게 번갈아 나눈다. 업무 화면은 상태 화면이 많아 오래 걸린다. */
function shard(slugs) {
  const n = Math.min(MAX_SHARDS, Math.max(1, Math.ceil(slugs.length / PER_SHARD)))
  const groups = Array.from({ length: n }, () => [])
  slugs.forEach((s, i) => groups[i % n].push(s))
  return groups.map((g, i) => ({ i: i + 1, n, slugs: g.join(',') }))
}

const all = allSlugs()
const files = changedFiles(process.argv[2])
let slugs
let reason
if (!files) {
  slugs = all
  reason = '기준 커밋을 비교할 수 없어 전체 검증'
} else if (files.length && files.every(DOC_ONLY)) {
  slugs = []
  reason = '문서·하네스 문서만 변경 → 브라우저 검증 생략'
} else if (files.some(f => FULL.some(re => re.test(f)))) {
  slugs = all
  reason = `공통 영역 변경(${files.filter(f => FULL.some(re => re.test(f))).slice(0, 3).join(', ')}) → 전체 검증`
} else {
  const changed = [...new Set(files
    .filter(f => !/\/README\.md$/.test(f))
    .map(f => f.match(/^src\/templates\/[^/]+\/([a-z0-9-]+)\//)?.[1])
    .filter(Boolean))].filter(s => all.includes(s))
  slugs = changed.length ? changed : ['_starter']
  reason = changed.length ? `바뀐 템플릿 ${changed.length}개` : '템플릿 화면 변경 없음 → _starter로 동작만 확인'
}
const shards = slugs.length ? shard(slugs) : []
console.log(`shards=${JSON.stringify(shards)}`)
console.log(`count=${shards.length}`)
console.log(`reason=${reason}${shards.length > 1 ? ` · ${shards.length}개 작업으로 나눠 동시에` : ''}`)
