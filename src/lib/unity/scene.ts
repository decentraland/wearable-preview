import { ISceneController, Metrics } from '@dcl/schemas'
import { UnityInstance } from './render'

enum UnityMessage {
  SET_MODE = 'SetMode',
  SET_BACKGROUND = 'SetBackground',
  TAKE_SCREENSHOT = 'TakeScreenshot',
  SET_ZOOM = 'SetZoom',
  SET_OFFSET = 'SetOffset',
  GET_METRICS = 'GetMetrics',
}

enum UnityMessagePayload {
  METRICS = 'metrics',
  SCREENSHOT = 'screenshot',
}

export function createSceneController(instance: UnityInstance): ISceneController {
  return {
    getScreenshot: () => {
      return new Promise<string>((resolve) => {
        if (!instance) {
          resolve('')
          return
        }
        instance.SendMessage('JSBridge', UnityMessage.TAKE_SCREENSHOT, '')
        window.addEventListener('message', function onScreenshot(event) {
          if (event.data.type === 'unity-renderer') {
            const { type, payload } = event.data.payload
            if (type === UnityMessagePayload.SCREENSHOT) {
              window.removeEventListener('message', onScreenshot)
              resolve(payload)
            }
          }
        })
      })
    },
    getMetrics: () => {
      return new Promise<Metrics>((resolve) => {
        if (!instance) {
          resolve({
            triangles: 0,
            materials: 0,
            textures: 0,
            meshes: 0,
            bodies: 0,
            entities: 0,
          })
          return
        }
        instance.SendMessage('JSBridge', UnityMessage.GET_METRICS, '')
        window.addEventListener('message', function onMetrics(event) {
          if (event.data.type === 'unity-renderer') {
            const { type, payload } = event.data.payload
            if (type === UnityMessagePayload.METRICS) {
              window.removeEventListener('message', onMetrics)
              resolve(payload)
            }
          }
        })
      })
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
      instance.SendMessage('JSBridge', 'SetCameraPosition', `${alpha},${beta},${radius}`)
    },
    cleanup: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'Cleanup', '')
    },
  }
}
