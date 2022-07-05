import equal from 'deep-equal'
import { PreviewMessagePayload, PreviewMessageType, PreviewOptions } from '@dcl/schemas'
import { useMessage } from './useMessage'
import { useState } from 'react'

export const useOverrides = () => {
  const [overrides, setOverrides] = useState<PreviewOptions>({})

  // receive message from parent window to update options
  useMessage((event) => {
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
  })

  return overrides
}
