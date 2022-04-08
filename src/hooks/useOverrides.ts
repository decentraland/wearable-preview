import { PreviewOptions } from '@dcl/schemas'
import { useState, useEffect } from 'react'
import { MessageType } from '../lib/message'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<PreviewOptions>({})

  // receive message from parent window to update options
  useEffect(() => {
    const previous = window.onmessage
    window.onmessage = function (event: MessageEvent) {
      if (event.data && event.data.type === MessageType.UPDATE) {
        const message = event.data as { type: MessageType.UPDATE; options: PreviewOptions }
        if (message.options && typeof message.options === 'object') {
          setOverrides(message.options)
        }
      }
    }
    return () => {
      window.onmessage = previous
    }
  }, [])

  return overrides
}
