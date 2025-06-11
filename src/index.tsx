import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preview } from './components/Preview'
import { UnityPreview } from './components/UnityPreview'
import './index.css'

const App = () => {
  const search = new URLSearchParams(window.location.search)
  const isUnityPreview = search.get('unity') !== null

  return isUnityPreview ? <UnityPreview /> : <Preview />
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
