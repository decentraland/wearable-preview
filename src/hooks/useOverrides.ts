import { useState, useEffect } from 'react'
import { PreviewMessagePayload, PreviewMessageType, PreviewOptions } from '@dcl/schemas'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<PreviewOptions>({})

  // receive message from parent window to update options
  useEffect(() => {
    const previous = window.onmessage
    window.onmessage = function (event: MessageEvent) {
      if (
        event.data &&
        event.data.type === PreviewMessageType.UPDATE &&
        typeof event.data.payload === 'object' &&
        typeof event.data.payload.options === 'object'
      ) {
        const { options } = event.data.payload as PreviewMessagePayload<PreviewMessageType.UPDATE>
        setOverrides(options)
      }
    }
    return () => {
      window.onmessage = previous
    }
  }, [])

  return overrides
}
