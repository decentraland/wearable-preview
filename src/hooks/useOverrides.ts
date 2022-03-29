import { useState, useEffect } from 'react'
import { AvatarPreviewOptions } from '../lib/avatar'
import { MessageType } from '../lib/message'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<Partial<AvatarPreviewOptions>>({})

  // receive message from parent window to update options
  useEffect(() => {
    const previous = window.onmessage
    window.onmessage = function (event: MessageEvent) {
      if (event.data && event.data.type === MessageType.UPDATE) {
        const message = event.data as { type: MessageType.UPDATE; options: Partial<AvatarPreviewOptions> }
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
