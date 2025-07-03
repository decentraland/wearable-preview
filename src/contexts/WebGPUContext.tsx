import React, { createContext, useContext, ReactNode } from 'react'
import { WebGPUSupport } from '../lib/webgpu'

export interface WebGPUContextType {
  webGPUSupport: WebGPUSupport
  isSupported: boolean
  isAvailable: boolean
}

const WebGPUContext = createContext<WebGPUContextType | null>(null)

interface WebGPUProviderProps {
  children: ReactNode
  value: WebGPUSupport
}

export const WebGPUProvider: React.FC<WebGPUProviderProps> = ({ children, value: initialValue }) => {
  const value: WebGPUContextType = {
    webGPUSupport: initialValue,
    isSupported: initialValue.isSupported,
    isAvailable: initialValue.isAvailable,
  }

  return <WebGPUContext.Provider value={value}>{children}</WebGPUContext.Provider>
}

export const useWebGPUContext = (): WebGPUContextType => {
  const context = useContext(WebGPUContext)
  if (!context) {
    throw new Error('useWebGPUContext must be used within a WebGPUProvider')
  }
  return context
}
