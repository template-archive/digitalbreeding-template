// Vite 개발 서버가 .env 파일 값을 서버 코드(process.env)로 넘길 때 쓴다.
// process.env에 undefined를 넣으면 문자열 "undefined"가 되어 '설정 있음'으로 읽히므로, 값이 있을 때만 넣는다.
// 이미 셸 환경에 있는 값이 .env 파일보다 우선한다.
export function copyServerEnv(target: Record<string, string | undefined>, source: Record<string, string>, keys: readonly string[]): void {
  for (const key of keys) {
    const value = source[key]
    if (value && !target[key]) target[key] = value
  }
}
