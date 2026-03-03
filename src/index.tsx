import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const UnityPreview = React.lazy(() => import('./components/UnityPreview/UnityPreview'))
import { WebGPUProvider } from './contexts/WebGPUContext'
import { useWebGPU } from './hooks/useWebGPU'
import { detectWebGPU } from './lib/webgpu'
import { initSentry } from './lib/sentry'
import './index.css'

const Preview = React.lazy(() => import('./components/Preview/Preview'))

// Initialize Sentry as early as possible to capture all errors
initSentry()

const App = () => {
  const search = new URLSearchParams(window.location.search)
  const isUnityPreview = search.get('unity') === 'true'
  const { isAvailable } = useWebGPU()

  // Use UnityPreview if WebGPU is available and Unity is requested, otherwise use Preview
  const shouldUseUnity = isUnityPreview && isAvailable

  return <Suspense fallback={null}>{shouldUseUnity ? <UnityPreview /> : <Preview />}</Suspense>
}

// Initialize the app with WebGPU detection
const startApp = async () => {
  const webGPUSupport = await detectWebGPU()

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <WebGPUProvider value={webGPUSupport}>
        <App />
      </WebGPUProvider>
    </StrictMode>,
  )
}

startApp()
