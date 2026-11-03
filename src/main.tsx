import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

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
    <App />
  </StrictMode>,
)
