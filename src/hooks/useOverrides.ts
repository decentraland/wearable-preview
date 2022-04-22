import { useState, useEffect } from 'react'
import equal from 'deep-equal'
import { PreviewMessagePayload, PreviewMessageType, PreviewOptions } from '@dcl/schemas'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<PreviewOptions>({})

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
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [overrides])

  return overrides
}
