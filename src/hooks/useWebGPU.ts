import { useWebGPUContext, WebGPUContextType } from '../contexts/WebGPUContext'

export const useWebGPU = (): WebGPUContextType => {
  return useWebGPUContext()
}
