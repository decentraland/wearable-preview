import { PreviewMessageType, sendMessage } from '@dcl/schemas'
import { useEffect, useState } from 'react'
import { getParent } from '../lib/parent'

export const useReady = () => {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (!isReady) {
      sendMessage(getParent(), PreviewMessageType.READY, null)
      setIsReady(true)
    }
  }, [isReady])
}
