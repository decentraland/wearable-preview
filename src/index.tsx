import { StrictMode, useState, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { detectWebGPU } from './lib/webgpu'
import { Preview } from './components/Preview'
import { UnityPreview } from './components/UnityPreview'
import './index.css'

const App = () => {
  const search = new URLSearchParams(window.location.search)
  const isUnityPreview = search.get('unity') === 'true'
  const [webGPUSupport, setWebGPUSupport] = useState<{ isSupported: boolean; isAvailable: boolean } | null>(null)

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        const support = await detectWebGPU()
        setWebGPUSupport(support)
      } catch (error) {
        console.warn('Failed to detect WebGPU support:', error)
        setWebGPUSupport({ isSupported: false, isAvailable: false })
      }
    }

    checkWebGPU()
  }, [])

  const useFallback = useMemo(() => {
    return isUnityPreview && !!webGPUSupport && !webGPUSupport.isAvailable
  }, [isUnityPreview, webGPUSupport])

  // Use UnityPreview if WebGPU is available and Unity is requested, otherwise use Preview
  const shouldUseUnity = isUnityPreview && webGPUSupport?.isAvailable && !useFallback

  return shouldUseUnity ? <UnityPreview /> : <Preview />
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
