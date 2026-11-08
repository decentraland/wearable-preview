import { describe, expect, it, vi } from 'vitest'
import { sendIndividualOverrideMessages } from './messages'

vi.mock('../sentry', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

type Sent = [string] | [string, string]

function fakeInstance() {
  const sent: Sent[] = []
  const instance = {
    SendMessage: (_target: string, method: string, value?: string) => {
      sent.push(value === undefined ? [method] : [method, value])
    },
  }
  return { instance, sent }
}

const sources = (keys: string[]) => Object.fromEntries(keys.map((key) => [key, true]))

describe('sendIndividualOverrideMessages', () => {
  it('reloads after a property the renderer has to load', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { profile: 'default1' }, sources(['profile']))

    expect(sent).toEqual([['SetProfile', 'default1'], ['Reload']])
  })

  it('applies the camera options to the live view without a reload', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(
      instance,
      { zoom: 100, wheelZoom: 2, lockAlpha: true, camera: 'static' },
      sources(['zoom', 'wheelZoom', 'lockAlpha', 'camera']),
    )

    expect(sent).toEqual([
      ['SetZoomLevel', '100'],
      ['SetWheelZoom', '2'],
      ['SetLockAlpha', 'true'],
      ['SetCamera', 'static'],
      ['SetHideControls', 'true'],
    ])
  })

  it('shows the scene boundaries and tunes the wheel on the live view', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(
      instance,
      { showSceneBoundaries: true, wheelPrecision: 50, zoomScale: 2 },
      sources(['showSceneBoundaries', 'wheelPrecision', 'zoomScale']),
    )

    expect(sent).toEqual([
      ['SetShowSceneBoundaries', 'true'],
      ['SetWheelPrecision', '50'],
      ['SetZoomScale', '2'],
    ])
  })

  it('sends the social emote animation as JSON and reloads', () => {
    const { instance, sent } = fakeInstance()
    const socialEmote = { title: 'Hug', loop: false, Armature: { animation: 'Hug_Avatar' } }

    sendIndividualOverrideMessages(instance, { socialEmote }, sources(['socialEmote']))

    expect(sent).toEqual([['SetSocialEmote', JSON.stringify(socialEmote)], ['Reload']])
  })

  it('reloads for the starting camera', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(
      instance,
      { cameraX: 2, disableAutoCenter: true },
      sources(['cameraX', 'disableAutoCenter']),
    )

    expect(sent).toEqual([['SetCameraX', '2'], ['SetDisableAutoCenter', 'true'], ['Reload']])
  })

  it('sends the three offsets as one message', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { offsetY: -0.5 }, sources(['offsetY']))

    expect(sent).toEqual([['SetOffset', '0,-0.5,0']])
  })

  it('reloads once when live and loaded properties mix', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { emote: 'dance', wheelStart: 100 }, sources(['emote', 'wheelStart']))

    expect(sent).toEqual([['SetEmote', 'dance'], ['SetWheelStart', '100'], ['Reload']])
  })

  it('sends hosted definitions like encoded ones and reloads', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { urls: ['https://example.com/a.json'] }, sources(['urls']))

    expect(sent).toEqual([['ClearUrls'], ['AddUrl', 'https://example.com/a.json'], ['Reload']])
  })

  it('maps a transparent background to the live background setter, with no shadow or glow', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(
      instance,
      { background: '#ff0000', disableBackground: true },
      sources(['background', 'disableBackground']),
    )

    expect(sent).toEqual([
      ['SetBackground', '00000000'],
      ['SetShadow', 'off'],
      ['SetGlow', 'off'],
    ])
  })

  it('sends a background colour without a reload', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { background: '#ff0000' }, sources(['background']))

    expect(sent).toEqual([['SetBackground', 'ff0000']])
  })

  it('maps no default emote to the emote none', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { disableDefaultEmotes: true }, sources(['disableDefaultEmotes']))

    expect(sent).toEqual([['SetEmote', 'none'], ['Reload']])
  })

  it('lets a named emote win over no default emote', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(
      instance,
      { disableDefaultEmotes: true, emote: 'dance' },
      sources(['disableDefaultEmotes', 'emote']),
    )

    expect(sent).toEqual([['SetEmote', 'dance'], ['Reload']])
  })

  it('ignores properties without an override source', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { zoom: 50, emote: 'dance' }, sources(['zoom']))

    expect(sent).toEqual([
      ['SetZoomLevel', '50'],
      ['SetHideControls', 'true'],
    ])
  })
})
