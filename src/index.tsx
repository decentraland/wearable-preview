import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './Routes'
import './index.css'

const basename = /^decentraland.(zone|org|today)$/.test(window.location.host) ? '/wearable-preview' : '/'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>
)
