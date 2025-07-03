import React, { useCallback, useState } from 'react'
import { Button, Icon } from 'decentraland-ui'
import { getWebGPUInstructions } from '../../lib/webgpu'
import { useWebGPU } from '../../hooks/useWebGPU'
import './WebGPUWarning.css'

const WebGPUWarning: React.FC = () => {
  const { webGPUSupport, isLoading } = useWebGPU()
  const [isDismissed, setIsDismissed] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
  }, [])

  const toggleDebug = useCallback(() => {
    setShowDebug((prev) => !prev)
  }, [])

  if (isLoading || webGPUSupport?.isAvailable || isDismissed) {
    return null
  }

  // Get instructions using the detected platform and browser information
  const instructions = webGPUSupport
    ? getWebGPUInstructions(
        webGPUSupport.platform,
        webGPUSupport.browser,
        webGPUSupport.platformVersion,
        webGPUSupport.browserVersion,
      )
    : 'Unable to detect browser information. Please update to a WebGPU-compatible browser.'

  // Parse instructions to format numbered lists properly
  const formatInstructions = (text: string) => {
    // Split by lines to handle the numbered list
    const lines = text.split('\n')
    const formattedLines: React.ReactNode[] = []
    let inList = false
    let listItems: string[] = []
    let noteText = ''

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      // Check if this is a numbered instruction (starts with a number and period)
      if (/^\d+\./.test(trimmedLine)) {
        if (!inList) {
          inList = true
        }
        listItems.push(trimmedLine)
      } else if (trimmedLine.startsWith('Note:')) {
        // Handle note section
        if (inList) {
          // End the list and add it
          formattedLines.push(
            <ol key={`list-${index}`}>
              {listItems.map((item, i) => (
                <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>,
          )
          inList = false
          listItems = []
        }
        noteText = trimmedLine
      } else if (trimmedLine && !inList) {
        // Regular text line
        formattedLines.push(<p key={index}>{trimmedLine}</p>)
      }
    })

    // Handle any remaining list items
    if (inList && listItems.length > 0) {
      formattedLines.push(
        <ol key="final-list">
          {listItems.map((item, i) => (
            <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>,
      )
    }

    // Add note if present
    if (noteText) {
      formattedLines.push(
        <div key="note" className="note">
          {noteText}
        </div>,
      )
    }

    return formattedLines.length > 0 ? formattedLines : <p>{text}</p>
  }

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
        {formatInstructions(instructions)}
      </div>
      {webGPUSupport && (
        <div className="webgpu-toast-details">
          <div className="webgpu-debug-toggle" onClick={toggleDebug}>
            <small>
              <strong>Debug Info</strong> {showDebug ? '▼' : '▶'}
            </small>
          </div>
          {showDebug && (
            <div className="webgpu-debug-content">
              <small>
                • Platform: {webGPUSupport.platform} {webGPUSupport.platformVersion}
                <br />• Browser: {webGPUSupport.browser} {webGPUSupport.browserVersion}
                <br />• WebGPU Supported: {webGPUSupport.isSupported ? '✅ Yes' : '❌ No'}
                <br />• WebGPU Available: {webGPUSupport.isAvailable ? '✅ Yes' : '❌ No'}
                <br />
                {webGPUSupport.error && (
                  <>
                    • Error: {webGPUSupport.error}
                    <br />
                  </>
                )}
                • navigator.gpu: {navigator.gpu ? '✅ Present' : '❌ Missing'}
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WebGPUWarning
