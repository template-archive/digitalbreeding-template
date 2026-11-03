import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { handleFeedback } from './server/feedback-handler.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// verify-templates.mjs가 직접 띄우는 서버(VERIFY_SERVER=1)는 파일 감시·HMR을 끄고 의존성 캐시를 따로 쓴다.
// 여러 빌더가 동시에 템플릿을 고치며 verify를 돌리면 HMR 새로고침으로 '높이 0px'·스크린샷 30초 초과가 매번 다른 곳에서 났고,
// 공유 node_modules/.vite 재최적화가 다른 서버까지 새로고침시켰다(디자인 개선 B단계).
const verifyServer = process.env.VERIFY_SERVER === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'shared-template-feedback',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      process.env.DATABASE_URL ||= env.DATABASE_URL || env.POSTGRES_URL
      server.middlewares.use('/api/feedback', (request, response) => { void handleFeedback(request, response) })
    },
  }],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { chunkSizeWarningLimit: 1500 },
  ...(verifyServer && {
    cacheDir: process.env.VERIFY_CACHE_DIR,
    server: { watch: null, hmr: false },
  }),
})
