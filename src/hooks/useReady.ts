import { PreviewMessageType, sendMessage } from '@dcl/schemas'
import { useEffect, useState } from 'react'

export const useReady = () => {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (!isReady) {
      // Check if window has parent. Usually windows that don't have a parent (ie. not an iframe) have a reference to itself under window.parent, but on certain hosts and with certain security policies it can be undefined, in which case we default to window.
      const target = window.parent || window
      sendMessage(target, PreviewMessageType.READY, null)
      setIsReady(true)
    }
  }, [isReady])
}
