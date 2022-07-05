import { useCallback, useEffect } from 'react'

export const useMessage = (handler: (event: MessageEvent) => void) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useCallback(handler, [])
  // receive message from parent window to update options
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      callback(event)
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [callback])
}
