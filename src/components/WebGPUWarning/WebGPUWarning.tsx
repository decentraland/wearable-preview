import React, { useState, useEffect, useCallback } from 'react'
import { Button, Icon } from 'decentraland-ui'
import { detectWebGPU, getWebGPUInstructions, WebGPUSupport } from '../../lib/webgpu'
import './WebGPUWarning.css'

const WebGPUWarning: React.FC = () => {
  const [webGPUSupport, setWebGPUSupport] = useState<WebGPUSupport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
  }, [])

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        const support = await detectWebGPU()
        setWebGPUSupport(support)
      } catch (error) {
        setWebGPUSupport({
          isSupported: false,
          isAvailable: false,
          error: 'Failed to detect WebGPU support',
        })
      } finally {
        setIsLoading(false)
      }
    }
    checkWebGPU()
  }, [])

  if (isLoading || webGPUSupport?.isAvailable || isDismissed) {
    return null
  }

  const instructions = getWebGPUInstructions()

  return (
    <div className="webgpu-toast-notification">
      <div className="webgpu-toast-header">
        <Icon name="warning circle" className="webgpu-toast-icon" />
        <span className="webgpu-toast-title">WebGPU Not Available</span>
        <Button
          basic
          icon
          size="mini"
          className="webgpu-toast-close"
          aria-label="Dismiss notification"
          onClick={handleDismiss}
        >
          <Icon name="close" />
        </Button>
      </div>
      <div className="webgpu-toast-message">{webGPUSupport?.error || 'WebGPU is not available in your browser.'}</div>
      <div className="webgpu-toast-instructions">
        <strong>How to enable WebGPU:</strong>
        <p>{instructions}</p>
      </div>
    </div>
  )
}

export default WebGPUWarning
