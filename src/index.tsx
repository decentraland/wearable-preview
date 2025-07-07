import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preview } from './components/Preview'
import { UnityPreview } from './components/UnityPreview'
import { WebGPUProvider } from './contexts/WebGPUContext'
import { useWebGPU } from './hooks/useWebGPU'
import { detectWebGPU } from './lib/webgpu'
import './index.css'

const App = () => {
  const search = new URLSearchParams(window.location.search)
  const isUnityPreview = search.get('unity') === 'true'
  const { isAvailable } = useWebGPU()

  // Use UnityPreview if WebGPU is available and Unity is requested, otherwise use Preview
  const shouldUseUnity = isUnityPreview && isAvailable

  return shouldUseUnity ? <UnityPreview /> : <Preview />
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
