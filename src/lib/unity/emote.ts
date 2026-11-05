import { EmoteDefinition, EmoteEvents, IEmoteController, PreviewEmote, PreviewEmoteEventType } from '@dcl/schemas'
import mitt from 'mitt'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { isSocialEmote as isSocialEmoteHelper } from '../emote'
import { UnityInstance } from './render'
import { onAudioReady } from './audio'

enum UnityMessagePayload {
  LENGTH = 'emoteLength',
  PLAYING = 'isEmotePlaying',
  HAS_SOUND = 'hasSound',
  EMOTE_EVENT = 'emote-event',
}

// The renderer's emote events, as it names them. They map one to one onto the Babylon preview's.
enum RendererEmoteEvent {
  PLAY = 'play',
  PLAYING = 'playing',
  PAUSE = 'pause',
  LOOP = 'loop',
  END = 'end',
}

// STOPPED → PLAYING (play) | STOPPED → PAUSED (goTo while stopped) | PAUSED → PLAYING (play)
// PLAYING → PAUSED (pause) | PLAYING → STOPPED (end/stop)
enum PlaybackState {
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

/** The Unity controller also tracks the default (embedded) emote the page last asked for. */
export type UnityEmoteController = IEmoteController & {
  previewEmote: PreviewEmote | null
  /**
   * Aligns the tracker with a clip Unity started on its own (it autoplays the emote on every load and
   * reload). The renderer reports that start itself once this controller exists; this covers the
   * first load, whose report arrives before the controller does. Sending PlayEmote here would replay
   * the clip Unity has just begun and layer its audio.
   */
  syncAutoplay(): Promise<void>
}

export function createEmoteController(
  instance: UnityInstance,
  emote: EmoteDefinition | null,
  playingAnimation?: SocialEmoteAnimation,
  previewEmote?: PreviewEmote | null,
): UnityEmoteController {
  const events = mitt<EmoteEvents>()
  // Mutable: the parent swaps the default emote through UPDATE messages after this controller exists.
  let currentPreviewEmote: PreviewEmote | null = previewEmote ?? null

  // Playback tracking state. The position and the transitions come from the renderer's own events,
  // so a progress bar follows the real playhead; the state is also set here on each request, so a
  // duplicate request is dropped before the renderer confirms.
  let emoteLength = 0
  let currentTime = 0
  let state: PlaybackState = PlaybackState.STOPPED
  // Plays this controller asked for and the renderer has not confirmed yet; a start reported beyond
  // them is one Unity made on its own, which syncAutoplay must not count twice.
  let requestedPlays = 0
  let rendererPlayed = false

  // Mutable: emotes fed through the blob/base64 overrides arrive
  // after this controller is created, via the `emote` setter below. The epoch invalidates async
  // work (play's length fetch) that started against a previous definition.
  let currentEmote = emote
  let definitionEpoch = 0

  // A new clip is always followed by a Reload that restarts it from zero, so the tracker starts over:
  // a stale length would refuse a play of a clip that is in fact loaded.
  const resetTracker = () => {
    definitionEpoch++
    state = PlaybackState.STOPPED
    currentTime = 0
    emoteLength = 0
    requestedPlays = 0
    rendererPlayed = false
  }

  const requestPlay = () => {
    requestedPlays++
    instance.SendMessage('JSBridge', 'PlayEmote', '')
  }

  const onRendererEvent = (event: RendererEmoteEvent, time: number) => {
    switch (event) {
      case RendererEmoteEvent.PLAY:
        state = PlaybackState.PLAYING
        currentTime = time
        if (requestedPlays > 0) requestedPlays--
        else rendererPlayed = true
        events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
        break
      case RendererEmoteEvent.PLAYING:
        currentTime = time
        events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: time })
        break
      case RendererEmoteEvent.PAUSE:
        state = PlaybackState.PAUSED
        currentTime = time
        events.emit(PreviewEmoteEventType.ANIMATION_PAUSE)
        break
      case RendererEmoteEvent.LOOP:
        currentTime = 0
        events.emit(PreviewEmoteEventType.ANIMATION_LOOP)
        break
      case RendererEmoteEvent.END:
        // A clip that played out keeps its length as the position, a stopped one goes back to zero.
        state = PlaybackState.STOPPED
        currentTime = time
        if (time > 0) events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, { length: time })
        events.emit(PreviewEmoteEventType.ANIMATION_END)
        break
    }
  }

  // The page hosts one renderer for its whole life, so this listener lives as long as the page.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== 'unity-renderer') return
    const { type, payload } = event.data.payload
    if (type !== UnityMessagePayload.EMOTE_EVENT || !payload) return
    onRendererEvent(payload.event as RendererEmoteEvent, Number(payload.time) || 0)
  })

  // Unity starts the clip before its audio can sound: the first pass is silent while Chrome still decodes
  // it, and audio queued behind the autoplay policy sounds from its start once lifted, out of step. When
  // the audio turns ready, restart a playing clip so both begin together; an ended one must stay silent.
  // The restart is a play alone, without a stop: the clip never stops, so no end is reported for it.
  onAudioReady(() => {
    if (state === PlaybackState.PLAYING) {
      requestPlay()
    } else if (state === PlaybackState.STOPPED && currentTime > 0) {
      instance.SendMessage('JSBridge', 'StopEmote', '')
    }
  })

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

  const fetchLength = () =>
    requestFromUnity<number>(
      () => instance.SendMessage('JSBridge', 'GetEmoteLength', ''),
      UnityMessagePayload.LENGTH,
      0,
    )

  return {
    syncAutoplay: async () => {
      if (!instance) return
      // The renderer reported this start itself, so the tracker already follows it.
      if (rendererPlayed) return
      resetTracker()
      const epoch = definitionEpoch
      const length = await fetchLength()
      // A definition swap or an explicit play/pause got in first; that call owns the tracker now.
      if (epoch !== definitionEpoch || state !== PlaybackState.STOPPED) return
      if (length <= 0) return
      emoteLength = length
      state = PlaybackState.PLAYING
      events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
    },
    getLength: fetchLength,
    isPlaying: async () => {
      return requestFromUnity<boolean>(
        () => instance.SendMessage('JSBridge', 'IsEmotePlaying', ''),
        UnityMessagePayload.PLAYING,
        false,
      )
    },
    goTo: async (seconds: number) => {
      if (!instance) return
      instance.SendMessage('JSBridge', 'GoToEmote', seconds.toString())
      // Unity can only seek a running clip, so seeking a stopped emote restarts it (audio included).
      // Freeze it right away: the seek lands as "paused at this position", and the next play resumes
      // from there instead of replaying from zero over the audio that GoTo just started.
      if (state === PlaybackState.STOPPED) {
        instance.SendMessage('JSBridge', 'PauseEmote', '')
        state = PlaybackState.PAUSED
      }
    },
    play: async () => {
      if (!instance) return
      // Unity replays the clip from zero on every PlayEmote, layering its audio over the take that is
      // still sounding, so a play while already playing is a duplicate to drop, not a restart.
      if (state === PlaybackState.PLAYING) return

      // Fetch length if we don't have it yet
      const epoch = definitionEpoch
      if (emoteLength <= 0) {
        const length = await fetchLength()
        // The definition was swapped while we awaited: discard this play, the reload that follows
        // every swap triggers a fresh one.
        if (epoch !== definitionEpoch) return
        if (state === PlaybackState.PLAYING) return
        // No emote is loaded (e.g. the base avatar booted before the item arrived): nothing to play.
        if (length <= 0) return
        emoteLength = length
      }

      // Anything but a resume starts the clip over in Unity.
      if (state !== PlaybackState.PAUSED) {
        currentTime = 0
      }

      state = PlaybackState.PLAYING
      requestPlay()
    },
    pause: async () => {
      if (!instance) return
      // Unity ignores a pause while nothing plays; mirroring it as PAUSED would make the next play a
      // resume of a position Unity no longer holds.
      if (state !== PlaybackState.PLAYING) return
      state = PlaybackState.PAUSED
      instance.SendMessage('JSBridge', 'PauseEmote', '')
    },
    stop: async () => {
      if (!instance) return
      state = PlaybackState.STOPPED
      currentTime = 0
      instance.SendMessage('JSBridge', 'StopEmote', '')
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
      return isSocialEmoteHelper(currentEmote)
    },
    getSocialEmoteAnimations: async () => {
      if (!currentEmote || !isSocialEmoteHelper(currentEmote)) return null

      return [
        {
          title: 'Start Animation',
          ...currentEmote.emoteDataADR74.startAnimation!,
        },
        ...currentEmote.emoteDataADR74.outcomes!.map((outcome) => ({
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
    get emote() {
      return currentEmote
    },
    set emote(value: EmoteDefinition | null) {
      currentEmote = value
      resetTracker()
      // The social animation belonged to the previous definition.
      playingAnimation = undefined
    },
    get previewEmote() {
      return currentPreviewEmote
    },
    set previewEmote(value: PreviewEmote | null) {
      if (value === currentPreviewEmote) return
      currentPreviewEmote = value
      resetTracker()
    },
    events,
  }
}
