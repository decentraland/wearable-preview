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

  it('ignores properties without an override source', () => {
    const { instance, sent } = fakeInstance()

    sendIndividualOverrideMessages(instance, { zoom: 50, emote: 'dance' }, sources(['zoom']))

    expect(sent).toEqual([
      ['SetZoomLevel', '50'],
      ['SetHideControls', 'true'],
    ])
  })
})
