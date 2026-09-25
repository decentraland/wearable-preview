import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmoteDefinition, PreviewEmote, PreviewEmoteEventType } from '@dcl/schemas'
import { createEmoteController } from './emote'
import { UnityInstance } from './render'

const audioReady = vi.hoisted(() => ({ listeners: [] as (() => void)[] }))
vi.mock('./audio', () => ({
  onAudioReady: (listener: () => void) => audioReady.listeners.push(listener),
}))
const audioBecomesReady = () => audioReady.listeners.forEach((listener) => listener())

type Call = { method: string; value: string }

// Unity answers a JSBridge query by posting a `unity-renderer` message back to the window.
function fakeUnity(emoteLength: number) {
  const calls: Call[] = []
  const answer = (type: string, payload: unknown) =>
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'unity-renderer', payload: { type, payload } } }))
  const instance: UnityInstance = {
    SendMessage: (_object, method, value) => {
      calls.push({ method, value })
      if (method === 'GetEmoteLength') answer('emoteLength', emoteLength)
      if (method === 'IsEmotePlaying') answer('isEmotePlaying', false)
    },
  }
  const sent = (method: string) => calls.filter((call) => call.method === method)
  return { instance, calls, sent }
}

function setup(emoteLength = 2, emote: EmoteDefinition | null = null, previewEmote?: PreviewEmote) {
  const unity = fakeUnity(emoteLength)
  const controller = createEmoteController(unity.instance, emote, undefined, previewEmote)
  const events: Record<string, unknown[]> = {}
  for (const type of Object.values(PreviewEmoteEventType)) {
    events[type] = []
    controller.events.on(type, (payload) => events[type].push(payload))
  }
  const positions = () =>
    events[PreviewEmoteEventType.ANIMATION_PLAYING].map((payload) => (payload as { length: number }).length)
  return { ...unity, controller, events, positions }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('unity emote controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    audioReady.listeners.length = 0
  })

  it('ends a play-once emote item even while the default emote is a looping one', async () => {
    const playOnce = { emoteDataADR74: { loop: false } } as unknown as EmoteDefinition
    const { controller, sent, events } = setup(2, playOnce, PreviewEmote.IDLE)
    await controller.play()
    await vi.advanceTimersByTimeAsync(2100)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_LOOP]).toHaveLength(0)
    expect(sent('StopEmote')).toHaveLength(1)
  })

  it('restarts a playing clip when its audio becomes ready late, so both start in step', async () => {
    const { controller, sent, positions } = setup(2)
    await controller.play()
    await vi.advanceTimersByTimeAsync(1000)
    audioBecomesReady()
    await vi.advanceTimersByTimeAsync(30)
    expect(sent('StopEmote')).toHaveLength(1)
    expect(sent('PlayEmote')).toHaveLength(2)
    expect(positions().at(-1)).toBeLessThan(0.1)
  })

  it('silences the stale audio of a clip that ended before its audio became ready', async () => {
    const { controller, sent } = setup(2)
    await controller.play()
    await vi.advanceTimersByTimeAsync(2100)
    audioBecomesReady()
    expect(sent('StopEmote')).toHaveLength(2)
    expect(sent('PlayEmote')).toHaveLength(1)
  })

  it('plays once when play is requested twice', async () => {
    const { controller, sent, events } = setup()
    await controller.play()
    await controller.play()
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(1)
  })

  it('does not start counting when no emote is loaded', async () => {
    const { controller, sent, positions } = setup(0)
    await controller.play()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sent('PlayEmote')).toHaveLength(0)
    expect(positions()).toHaveLength(0)
  })

  it('counts from zero again when replayed after the end', async () => {
    const { controller, positions, events } = setup(2)
    await controller.play()
    await vi.advanceTimersByTimeAsync(2_500)
    expect(events[PreviewEmoteEventType.ANIMATION_END]).toHaveLength(1)
    const before = positions().length
    await controller.play()
    await vi.advanceTimersByTimeAsync(100)
    const replayed = positions().slice(before)
    expect(replayed.length).toBeGreaterThan(0)
    expect(Math.max(...replayed)).toBeLessThan(0.5)
  })

  it('resumes from the paused position', async () => {
    const { controller, positions, events } = setup(5)
    await controller.play()
    await vi.advanceTimersByTimeAsync(1_000)
    await controller.pause()
    expect(events[PreviewEmoteEventType.ANIMATION_PAUSE]).toHaveLength(1)
    const before = positions().length
    await vi.advanceTimersByTimeAsync(3_000)
    expect(positions()).toHaveLength(before)
    await controller.play()
    await vi.advanceTimersByTimeAsync(100)
    const resumed = positions().slice(before)
    expect(Math.min(...resumed)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...resumed)).toBeLessThan(1.5)
  })

  it('ignores a pause while nothing is playing', async () => {
    const { controller, sent, events } = setup()
    await controller.pause()
    expect(sent('PauseEmote')).toHaveLength(0)
    expect(events[PreviewEmoteEventType.ANIMATION_PAUSE]).toHaveLength(0)
  })

  it('seeking a stopped emote leaves it paused there, and play resumes from that position', async () => {
    const { controller, sent, positions } = setup(5)
    await controller.goTo(1.5)
    await flush()
    expect(sent('GoToEmote').map((call) => call.value)).toEqual(['1.5'])
    expect(sent('PauseEmote')).toHaveLength(1)
    const before = positions().length
    await controller.play()
    await vi.advanceTimersByTimeAsync(100)
    const resumed = positions().slice(before)
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(Math.min(...resumed)).toBeGreaterThanOrEqual(1.5)
    expect(Math.max(...resumed)).toBeLessThan(2)
  })

  it('tracks a clip Unity started on its own without replaying it', async () => {
    const { controller, sent, events, positions } = setup(4)
    await controller.play()
    await vi.advanceTimersByTimeAsync(2_000)
    // Unity reloaded and restarted the clip.
    await controller.syncAutoplay()
    const before = positions().length
    await vi.advanceTimersByTimeAsync(100)
    expect(sent('PlayEmote')).toHaveLength(1)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(2)
    expect(Math.max(...positions().slice(before))).toBeLessThan(0.5)
  })

  it('does not track an autoplay when no emote is loaded', async () => {
    const { controller, events, positions } = setup(0)
    await controller.syncAutoplay()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(events[PreviewEmoteEventType.ANIMATION_PLAY]).toHaveLength(0)
    expect(positions()).toHaveLength(0)
  })

  it('seeking while playing keeps playing from the new position', async () => {
    const { controller, sent, positions } = setup(5)
    await controller.play()
    await vi.advanceTimersByTimeAsync(500)
    await controller.goTo(3)
    expect(sent('PauseEmote')).toHaveLength(0)
    const before = positions().length
    await vi.advanceTimersByTimeAsync(100)
    expect(Math.min(...positions().slice(before))).toBeGreaterThanOrEqual(3)
  })
})
