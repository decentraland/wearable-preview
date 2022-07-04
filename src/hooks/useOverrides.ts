import { useState, useEffect } from 'react'
import equal from 'deep-equal'
import { PreviewMessagePayload, PreviewMessageType, PreviewOptions, sendMessage } from '@dcl/schemas'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<PreviewOptions>({})
  const [isReady, setIsReady] = useState(false)

  // receive message from parent window to update options
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.data &&
        event.data.type === PreviewMessageType.UPDATE &&
        typeof event.data.payload === 'object' &&
        typeof event.data.payload.options === 'object'
      ) {
        const { options } = event.data.payload as PreviewMessagePayload<PreviewMessageType.UPDATE>
        if (!equal(overrides, options)) {
          setOverrides(options)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    if (!isReady) {
      sendMessage(window.parent, PreviewMessageType.READY, null)
      setIsReady(true)
    }
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [overrides, isReady])

  return overrides
}
