import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmoteDefinition, PreviewEmoteEventType } from '@dcl/schemas'
import { createEmoteController } from './emote'
import { UnityInstance } from './render'

const audioReady = vi.hoisted(() => ({ listeners: [] as (() => void)[] }))
vi.mock('./audio', () => ({
  onAudioReady: (listener: () => void) => audioReady.listeners.push(listener),
}))
const audioBecomesReady = () => audioReady.listeners.forEach((listener) => listener())

type Call = { method: string; value: string }

// Unity answers a JSBridge query by posting a `unity-renderer` message back to the window, and reports
// every playback change as an `emote-event`, so the fake echoes what the renderer would.
function fakeUnity(emoteLength: number) {
  const calls: Call[] = []
  let position = 0
  let paused = false
  const answer = (type: string, payload: unknown) =>
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'unity-renderer', payload: { type, payload } } }))
  const emoteEvent = (event: string, time: number) => answer('emote-event', { event, time })
  const instance: UnityInstance = {
    SendMessage: (_object, method, value) => {
      calls.push({ method, value })
      if (method === 'GetEmoteLength') answer('emoteLength', emoteLength)
      if (method === 'IsEmotePlaying') answer('isEmotePlaying', false)
      if (emoteLength <= 0) return
      if (method === 'PlayEmote') {
        if (!paused) position = 0
        paused = false
        emoteEvent('play', position)
      }
      if (method === 'PauseEmote') {
        paused = true
        emoteEvent('pause', position)
      }
      if (method === 'StopEmote') {
        position = 0
        paused = true
        emoteEvent('end', 0)
      }
      if (method === 'GoToEmote') {
        position = Number(value)
        emoteEvent('playing', position)
      }
    },
  }
  const sent = (method: string) => calls.filter((call) => call.method === method)
  // What the renderer reports on its own as the clip runs.
  const renderer = {
    tick: (time: number) => {
      position = time
      emoteEvent('playing', time)
    },
    loop: () => {
      position = 0
      emoteEvent('loop', 0)
    },
    end: () => {
      // Played out: the next play starts over, unlike a stop, which holds the first frame.
      position = emoteLength
      paused = false
      emoteEvent('end', emoteLength)
    },
    autoplay: () => {
      position = 0
      paused = false
      emoteEvent('play', 0)
    },
  }
  return { instance, calls, sent, renderer }
}

function setup(emoteLength = 2, emote: EmoteDefinition | null = null) {
  const unity = fakeUnity(emoteLength)
  const controller = createEmoteController(unity.instance, emote)
  const events: Record<string, unknown[]> = {}
  for (const type of Object.values(PreviewEmoteEventType)) {
    events[type] = []
    controller.events.on(type, (payload) => events[type].push(payload))
  }
  const positions = () =>
    events[PreviewEmoteEventType.ANIMATION_PLAYING].map((payload) => (payload as { length: number }).length)
  return { ...unity, controller, events, positions }
}

describe('unity emote controller', () => {
  afterEach(() => {
    audioReady.listeners.length = 0
  })

  it('relays the positions and the end of a play-once emote', async () => {
    const { controller, renderer, events, positions } = setup(2)
    await controller.play()
    renderer.tick(1)
    renderer.end()
    expect(positions()).toEqual([1, 2])
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_LOOP]).toHaveLength(0)
  })

  it('relays a loop of a looping emote', async () => {
    const { controller, renderer, events } = setup(2)
    await controller.play()
    renderer.tick(1.9)
    renderer.loop()
    renderer.tick(0.1)
    expect(events[PreviewEmoteEventType.ANIMATION_LOOP]).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(0)
  })

  it('restarts a playing clip when its audio becomes ready late, so both start in step', async () => {
    const { controller, renderer, sent, events } = setup(2)
    await controller.play()
    renderer.tick(1)
    audioBecomesReady()
    expect(sent('PlayEmote')).toHaveLength(2)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(2)
  })

  it('reports no end for a playing clip restarted because its audio became ready', async () => {
    const { controller, renderer, sent, events } = setup(2)
    await controller.play()
    renderer.tick(1)
    audioBecomesReady()
    expect(sent('StopEmote')).toHaveLength(0)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(0)
  })

  it('silences the stale audio of a clip that ended before its audio became ready', async () => {
    const { controller, renderer, sent } = setup(2)
    await controller.play()
    renderer.end()
    audioBecomesReady()
    expect(sent('StopEmote')).toHaveLength(1)
    expect(sent('PlayEmote')).toHaveLength(1)
  })

  it('plays once when play is requested twice', async () => {
    const { controller, sent, events } = setup()
    await controller.play()
    await controller.play()
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(1)
  })

  it('does not play when no emote is loaded', async () => {
    const { controller, sent, events } = setup(0)
    await controller.play()
    expect(sent('PlayEmote')).toHaveLength(0)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(0)
  })

  it('starts over when replayed after the end', async () => {
    const { controller, renderer, sent, events } = setup(2)
    await controller.play()
    renderer.tick(1.5)
    renderer.end()
    await controller.play()
    expect(sent('PlayEmote')).toHaveLength(2)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(2)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(1)
  })

  it('resumes from the paused position', async () => {
    const { controller, renderer, sent, events, positions } = setup(5)
    await controller.play()
    renderer.tick(1)
    await controller.pause()
    expect(sent('PauseEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_PAUSE]).toHaveLength(1)
    const before = positions().length
    await controller.play()
    renderer.tick(1.1)
    expect(sent('PlayEmote')).toHaveLength(2)
    expect(Math.min(...positions().slice(before))).toBeGreaterThanOrEqual(1)
  })

  it('ignores a pause while nothing is playing', async () => {
    const { controller, sent, events } = setup()
    await controller.pause()
    expect(sent('PauseEmote')).toHaveLength(0)
    expect(events[PreviewEmoteEventType.ANIMATION_PAUSE]).toHaveLength(0)
  })

  it('seeking a stopped emote leaves it paused there, and play resumes from that position', async () => {
    const { controller, renderer, sent, positions } = setup(5)
    await controller.goTo(1.5)
    expect(sent('GoToEmote').map((call) => call.value)).toEqual(['1.5'])
    expect(sent('PauseEmote')).toHaveLength(1)
    expect(positions()).toEqual([1.5])
    await controller.play()
    renderer.tick(1.6)
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(Math.min(...positions().slice(1))).toBeGreaterThanOrEqual(1.5)
  })

  it('seeking while playing keeps playing from the new position', async () => {
    const { controller, renderer, sent, positions } = setup(5)
    await controller.play()
    renderer.tick(0.5)
    await controller.goTo(3)
    expect(sent('PauseEmote')).toHaveLength(0)
    renderer.tick(3.1)
    expect(positions().slice(-2)).toEqual([3, 3.1])
  })

  it('stops on the first frame and the next play starts over', async () => {
    const { controller, renderer, sent, events } = setup(5)
    await controller.play()
    renderer.tick(2)
    await controller.stop()
    expect(sent('StopEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(1)
    await controller.play()
    expect(sent('PlayEmote')).toHaveLength(2)
  })

  it('tracks a clip Unity started on its own without replaying it', async () => {
    const { controller, renderer, sent, events } = setup(4)
    await controller.play()
    renderer.tick(2)
    // Unity reloaded and restarted the clip before this controller heard of it.
    await controller.syncAutoplay()
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(2)
  })

  it('does not sync twice when the renderer already reported the restart', async () => {
    const { controller, renderer, sent, events } = setup(4)
    renderer.autoplay()
    await controller.syncAutoplay()
    expect(sent('GetEmoteLength')).toHaveLength(0)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(1)
  })

  it('does not track an autoplay when no emote is loaded', async () => {
    const { controller, events } = setup(0)
    await controller.syncAutoplay()
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(0)
  })
})
