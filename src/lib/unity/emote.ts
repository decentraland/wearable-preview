import { IEmoteController, PreviewEmoteEventType } from '@dcl/schemas'
import mitt from 'mitt'
import { UnityInstance } from './render'

type EmoteEvents = {
  [PreviewEmoteEventType.ANIMATION_PLAY]: void
  [PreviewEmoteEventType.ANIMATION_PAUSE]: void
  [PreviewEmoteEventType.ANIMATION_LOOP]: void
  [PreviewEmoteEventType.ANIMATION_END]: void
  [PreviewEmoteEventType.ANIMATION_PLAYING]: { length: number }
}

enum UnityMessagePayload {
  LENGTH = 'emoteLength',
  PLAYING = 'isEmotePlaying',
  HAS_SOUND = 'hasSound',
}

export function createEmoteController(instance: UnityInstance): IEmoteController {
  const events = mitt<EmoteEvents>()
  return {
    getLength: async () => {
      return new Promise<number>((resolve) => {
        if (!instance) {
          resolve(0)
          return
        }
        instance.SendMessage('JSBridge', 'GetEmoteLength', '')
        window.addEventListener('message', function onLength(event) {
          if (event.data.type === 'unity-renderer') {
            const { type, payload } = event.data.payload
            if (type === UnityMessagePayload.LENGTH) {
              window.removeEventListener('message', onLength)
              resolve(payload)
            }
          }
        })
      })
    },
    isPlaying: async () => {
      return new Promise<boolean>((resolve) => {
        if (!instance) {
          resolve(false)
          return
        }
        instance.SendMessage('JSBridge', 'IsEmotePlaying', '')
        window.addEventListener('message', function onPlaying(event) {
          if (event.data.type === 'unity-renderer') {
            const { type, payload } = event.data.payload
            if (type === UnityMessagePayload.PLAYING) {
              window.removeEventListener('message', onPlaying)
              resolve(payload)
            }
          }
        })
      })
    },
    goTo: async (seconds: number) => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'GoToEmote', seconds.toString())
      events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: seconds })
    },
    play: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'PlayEmote', '')
      events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
    },
    pause: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'PauseEmote', '')
      events.emit(PreviewEmoteEventType.ANIMATION_PAUSE)
    },
    stop: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'StopEmote', '')
      events.emit(PreviewEmoteEventType.ANIMATION_END)
    },
    enableSound: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'EnableSound', '')
    },
    disableSound: async () => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'DisableSound', '')
    },
    hasSound: async () => {
      return new Promise<boolean>((resolve) => {
        if (!instance) {
          resolve(false)
          return
        }
        instance.SendMessage('JSBridge', 'HasSound', '')
        window.addEventListener('message', function onSound(event) {
          if (event.data.type === 'unity-renderer') {
            const { type, payload } = event.data.payload
            if (type === UnityMessagePayload.HAS_SOUND) {
              window.removeEventListener('message', onSound)
              resolve(payload)
            }
          }
        })
      })
    },
    events,
  }
}
