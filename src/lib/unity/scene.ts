import { ISceneController, Metrics } from '@dcl/schemas'
import { UnityInstance } from './render'

enum UnityMessage {
  SET_MODE = 'SetMode',
  SET_BACKGROUND = 'SetBackground',
  TAKE_SCREENSHOT = 'TakeScreenshot',
  SET_ZOOM = 'SetZoom',
  SET_OFFSET = 'SetOffset',
  SET_CAMERA_POSITION = 'SetCameraPosition',
  GET_METRICS = 'GetMetrics',
}

enum UnityMessagePayload {
  METRICS = 'metrics',
  SCREENSHOT = 'screenshot',
  REQUEST_FAILED = 'request-failed',
}

const BASE64_IMAGE_HEADER = 'data:image/png;base64,'

// Unity answers a query by posting `{ type: 'unity-renderer', payload: { type, payload } }` to the
// window. A query it cannot serve (nothing loaded yet, a reload in flight, a bad argument) comes back
// as `request-failed` naming the query by its reply type and giving the reason.
function query<T>(instance: UnityInstance, method: UnityMessage, value: string, reply: UnityMessagePayload) {
  return new Promise<T>((resolve, reject) => {
    function onReply(event: MessageEvent) {
      if (event.data?.type !== 'unity-renderer') return
      const { type, payload } = event.data.payload
      if (type === reply) {
        window.removeEventListener('message', onReply)
        resolve(payload as T)
      } else if (type === UnityMessagePayload.REQUEST_FAILED && payload?.request === reply) {
        window.removeEventListener('message', onReply)
        reject(new Error(payload.reason))
      }
    }
    window.addEventListener('message', onReply)
    instance.SendMessage('JSBridge', method, value)
  })
}

const isPixelSize = (value: number) => Number.isInteger(value) && value > 0

export function createSceneController(instance: UnityInstance): ISceneController {
  return {
    getScreenshot: async (width: number, height: number) => {
      if (!instance) return ''
      // A pixel size asks for a capture of the live framing at that size, chrome excluded; without one
      // the renderer sends the whole canvas as it is on screen.
      const size = isPixelSize(width) && isPixelSize(height) ? `${width},${height}` : ''
      const png = await query<string>(instance, UnityMessage.TAKE_SCREENSHOT, size, UnityMessagePayload.SCREENSHOT)
      return BASE64_IMAGE_HEADER + png
    },
    getMetrics: () => {
      if (!instance) {
        return Promise.resolve({
          triangles: 0,
          materials: 0,
          textures: 0,
          meshes: 0,
          bodies: 0,
          entities: 0,
        })
      }
      return query<Metrics>(instance, UnityMessage.GET_METRICS, '', UnityMessagePayload.METRICS)
    },
    changeZoom: async (zoom: number) => {
      if (!instance) return
      instance.SendMessage('JSBridge', UnityMessage.SET_ZOOM, zoom.toString())
    },
    panCamera: async (offset: { x?: number; y?: number; z?: number }) => {
      if (!instance) return
      const x = offset.x ?? 0
      const y = offset.y ?? 0
      const z = offset.z ?? 0
      instance.SendMessage('JSBridge', UnityMessage.SET_OFFSET, `${x},${y},${z}`)
    },
    changeCameraPosition: async (position: { alpha?: number; beta?: number; radius?: number }) => {
      if (!instance) return
      const alpha = position.alpha ?? 0
      const beta = position.beta ?? 0
      const radius = position.radius ?? 0
      instance.SendMessage('JSBridge', UnityMessage.SET_CAMERA_POSITION, `${alpha},${beta},${radius}`)
    },
    setUsername: async (username: string) => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'SetUsername', username)
    },
    cleanup: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'Cleanup', '')
    },
  }
}
