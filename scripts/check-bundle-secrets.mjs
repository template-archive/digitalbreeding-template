// 빌드 결과물(dist/)에 서버 전용 이름이나 값이 들어갔는지 확인한다(로그인 설계 6절 번들 점검, npm run build의 postbuild).
// Vercel 빌드에는 그 환경의 변수 값이 있으므로, 실제 허용 도메인·비밀값이 새면 배포 전에 빌드가 실패한다.
// 출력에는 파일 경로와 변수 이름만 쓰고 값은 쓰지 않는다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const NAMES = ['AUTH_ALLOWED_DOMAINS', 'AUTH_SECRET', 'AUTH_DATABASE_URL', 'SMTP_USER', 'SMTP_PASS']

/** @param {{ path: string, text: string }[]} files @param {Record<string, string | undefined>} env @returns {string[]} */
export function findLeaks(files, env) {
  const values = NAMES.flatMap(name => {
    const raw = env[name]
    if (!raw) return []
    const parts = name === 'AUTH_ALLOWED_DOMAINS' ? raw.split(',').map(v => v.trim().replace(/^@/, '')) : [raw]
    return parts.filter(v => v.length >= 4).map(value => ({ name, value }))
  })
  const leaks = new Set()
  for (const file of files) {
    for (const name of NAMES) if (file.text.includes(name)) leaks.add(`${file.path}: ${name}`)
    for (const { name, value } of values) if (file.text.includes(value)) leaks.add(`${file.path}: ${name} 값`)
  }
  return [...leaks]
}

function listFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? listFiles(path) : /\.(js|css|html)$/.test(entry) ? [path] : []
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = listFiles('dist').map(path => ({ path: path.split(sep).join('/'), text: readFileSync(path, 'utf8') }))
  const leaks = findLeaks(files, process.env)
  if (leaks.length) {
    console.error('번들 점검 실패: 서버 전용 값이 공개 번들에 들어갔습니다.\n' + leaks.map(l => '  - ' + l).join('\n'))
    process.exit(1)
  }
  console.log(`번들 점검: 서버 전용 값 없음 (${files.length}개 파일)`)
}
