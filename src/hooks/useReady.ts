import { PreviewMessageType, sendMessage } from '@dcl/schemas'
import { useEffect, useState } from 'react'

export const useReady = () => {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (!isReady) {
      sendMessage(window.parent, PreviewMessageType.READY, null)
      setIsReady(true)
    }
  }, [isReady])
}
