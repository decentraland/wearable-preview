import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import { Preview } from './components/Preview'

ReactDOM.render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
  document.getElementById('root')
)

/// DELETE MEEE!!!!!11
function update(prop: string, value: string) {
  window.postMessage({ type: 'update', options: { [prop]: value } })
}

;(window as any).update = update
