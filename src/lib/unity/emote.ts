import { EmoteDefinition, EmoteEvents, IEmoteController, PreviewEmote, PreviewEmoteEventType } from '@dcl/schemas'
import mitt from 'mitt'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { isSocialEmote as isSocialEmoteHelper, LOOPED_EMOTES_LIST } from '../emote'
import { UnityInstance } from './render'

enum UnityMessagePayload {
  LENGTH = 'emoteLength',
  PLAYING = 'isEmotePlaying',
  HAS_SOUND = 'hasSound',
}

enum PlaybackState {
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

export function createEmoteController(
  instance: UnityInstance,
  emote: EmoteDefinition | null,
  playingAnimation?: SocialEmoteAnimation,
  previewEmote?: PreviewEmote | null,
): IEmoteController {
  const events = mitt<EmoteEvents>()

  // Playback tracking state
  let emoteLength = 0
  let currentTime = 0
  let state: PlaybackState = PlaybackState.STOPPED
  let playingIntervalId: ReturnType<typeof setInterval> | null = null
  let lastTickTime = 0

  const isLooped = (): boolean => {
    if (playingAnimation) return playingAnimation.loop
    if (emote?.emoteDataADR74?.loop) return true
    if (previewEmote && LOOPED_EMOTES_LIST.includes(previewEmote)) return true
    return false
  }

  const startPlayingInterval = () => {
    stopPlayingInterval()
    lastTickTime = Date.now()
    playingIntervalId = setInterval(() => {
      if (state !== PlaybackState.PLAYING) return
      const now = Date.now()
      const delta = (now - lastTickTime) / 1000
      lastTickTime = now
      currentTime += delta

      if (emoteLength > 0 && currentTime >= emoteLength) {
        if (isLooped()) {
          currentTime = currentTime % emoteLength
          events.emit(PreviewEmoteEventType.ANIMATION_LOOP)
        } else {
          currentTime = emoteLength
          stopPlayingInterval()
          state = PlaybackState.STOPPED
          instance.SendMessage('JSBridge', 'StopEmote', '')
          events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: currentTime })
          events.emit(PreviewEmoteEventType.ANIMATION_END)
          return
        }
      }

      events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: currentTime })
    }, 15)
  }

  const stopPlayingInterval = () => {
    if (playingIntervalId !== null) {
      clearInterval(playingIntervalId)
      playingIntervalId = null
    }
  }

  /** Send a message to Unity and wait for a typed response */
  const requestFromUnity = <T>(
    sendMsg: () => void,
    responseType: UnityMessagePayload,
    fallbackResponse: T,
  ): Promise<T> => {
    return new Promise<T>((resolve) => {
      if (!instance) {
        resolve(fallbackResponse)
        return
      }
      const onMessage = (event: MessageEvent) => {
        if (event.data.type === 'unity-renderer') {
          const { type, payload } = event.data.payload
          if (type === responseType) {
            window.removeEventListener('message', onMessage)
            resolve(payload as T)
          }
        }
      }
      window.addEventListener('message', onMessage)
      sendMsg()
    })
  }

  return {
    getLength: async () => {
      const emoteLength = await requestFromUnity<number | undefined>(
        () => instance.SendMessage('JSBridge', 'GetEmoteLength', ''),
        UnityMessagePayload.LENGTH,
        0,
      )
      return emoteLength ?? 0
    },
    isPlaying: async () => {
      return requestFromUnity<boolean>(
        () => instance.SendMessage('JSBridge', 'IsEmotePlaying', ''),
        UnityMessagePayload.PLAYING,
        false,
      )
    },
    goTo: async (seconds: number) => {
      if (!instance) return
      currentTime = seconds
      instance.SendMessage('JSBridge', 'GoToEmote', seconds.toString())
      events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: seconds })
    },
    play: async () => {
      if (!instance) return

      // Fetch length if we don't have it yet
      if (emoteLength <= 0) {
        emoteLength = await requestFromUnity<number>(
          () => instance.SendMessage('JSBridge', 'GetEmoteLength', ''),
          UnityMessagePayload.LENGTH,
          0,
        )
      }

      if (state === PlaybackState.STOPPED) {
        currentTime = 0
      }

      state = PlaybackState.PLAYING
      instance.SendMessage('JSBridge', 'PlayEmote', '')
      startPlayingInterval()
      events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
    },
    pause: async () => {
      if (!instance) return
      state = PlaybackState.PAUSED
      stopPlayingInterval()
      instance.SendMessage('JSBridge', 'PauseEmote', '')
      events.emit(PreviewEmoteEventType.ANIMATION_PAUSE)
    },
    stop: async () => {
      if (!instance) return
      state = PlaybackState.STOPPED
      currentTime = 0
      stopPlayingInterval()
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
      return requestFromUnity<boolean>(
        () => instance.SendMessage('JSBridge', 'HasSound', ''),
        UnityMessagePayload.HAS_SOUND,
        false,
      )
    },
    isSocialEmote: async () => {
      return isSocialEmoteHelper(emote)
    },
    getSocialEmoteAnimations: async () => {
      if (!emote || !isSocialEmoteHelper(emote)) return null

      return [
        {
          title: 'Start Animation',
          ...emote.emoteDataADR74.startAnimation!,
        },
        ...emote.emoteDataADR74.outcomes!.map((outcome) => ({
          title: outcome.title,
          loop: outcome.loop,
          audio: outcome.audio,
          ...outcome.clips,
        })),
      ]
    },
    getPlayingSocialEmoteAnimation: async () => {
      return playingAnimation ?? null
    },
    emote,
    events,
  }
}
