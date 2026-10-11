import { useRef } from 'react'
import { IPreviewController, PreviewMessagePayload, PreviewMessageType, sendMessage } from '@dcl/schemas'
import { useMessage } from './useMessage'
import { getParent } from '../lib/parent'
import { captureException } from '../lib/sentry'
import { isSceneDisposedError } from '../lib/sceneDisposed'

function sendResult(id: string, result: any) {
  sendMessage(getParent(), PreviewMessageType.CONTROLLER_RESPONSE, { id, ok: true, result })
}

function sendError(id: string, error: string) {
  sendMessage(getParent(), PreviewMessageType.CONTROLLER_RESPONSE, { id, ok: false, error })
}

export const useController = () => {
  const controllerRef = useRef<IPreviewController | undefined>()

  useMessage(async (event: MessageEvent) => {
    if (
      event.data &&
      event.data.type === PreviewMessageType.CONTROLLER_REQUEST &&
      typeof event.data.payload === 'object' &&
      typeof event.data.payload.id === 'string' &&
      typeof event.data.payload.namespace === 'string' &&
      typeof event.data.payload.method === 'string' &&
      typeof event.data.payload.params === 'object' &&
      Array.isArray(event.data.payload.params)
    ) {
      const { id, method, namespace, params } = event.data
        .payload as PreviewMessagePayload<PreviewMessageType.CONTROLLER_REQUEST>
      if (controllerRef.current) {
        if (namespace in controllerRef.current) {
          if (method in controllerRef.current[namespace as keyof IPreviewController]) {
            try {
              const controller = controllerRef.current[namespace as keyof IPreviewController] as any
              const fn = controller[method] as Function
              const result = await fn.apply(null, params)
              sendResult(id, result)
            } catch (error: any) {
              // A call that raced a re-render is expected (see SceneDisposedError): the parent still gets the
              // error below and retries, so only report the failures that are real faults.
              if (!isSceneDisposedError(error)) {
                captureException(error, { phase: 'controller', namespace, method })
              }
              sendError(id, error.message)
            }
          } else {
            sendError(id, 'Invalid method')
          }
        } else {
          sendError(id, 'Invalid namespace')
        }
      } else {
        sendError(id, 'Controller not ready')
      }
    }
  })

  return controllerRef
}
