import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { isEmbed } from '@/gallery/router'

// ?theme=dark|light 강제(index.html 인라인 스크립트가 첫 페인트 전에 이미 적용; 여기서는 보강)
const forced = new URLSearchParams(window.location.search).get('theme')
if (forced === 'dark' || forced === 'light') document.documentElement.setAttribute('data-theme', forced)

const appRoot = createRoot(document.getElementById('root')!)
// A preview can portal review tools into its parent document. Dispose before the iframe disappears.
if (new URLSearchParams(window.location.search).get('embed') === '1') {
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    appRoot.unmount()
  }
  window.addEventListener('db-template-dispose', dispose)
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose() })
}

appRoot.render(
  <StrictMode>
    {/* 로그인 상태는 모든 경로가 함께 쓴다. 임베드(미리보기 iframe)는 로그인을 부르지 않는다. */}
    <AuthProvider enabled={!isEmbed}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
