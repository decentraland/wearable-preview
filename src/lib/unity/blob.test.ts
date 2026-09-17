import { describe, expect, it } from 'vitest'
import { BodyShape, EmoteCategory, EmoteDefinition, WearableCategory, WearableDefinition } from '@dcl/schemas'
import { base64ToDefinition, findBase64Emote } from './blob'

const encode = (definition: object) => {
  const bytes = new TextEncoder().encode(JSON.stringify(definition))
  return btoa(String.fromCharCode(...bytes))
}

const emote = (loop: boolean, name = 'Wave'): EmoteDefinition =>
  ({
    id: `emote-${name}`,
    name,
    description: '',
    image: '',
    thumbnail: '',
    i18n: [],
    emoteDataADR74: {
      category: EmoteCategory.DANCE,
      tags: [],
      loop,
      representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'emote.glb', contents: [] }],
    },
  }) as unknown as EmoteDefinition

const wearable: WearableDefinition = {
  id: 'wearable-1',
  name: 'Hat',
  description: '',
  image: '',
  thumbnail: '',
  i18n: [],
  data: {
    category: WearableCategory.HAT,
    tags: [],
    hides: [],
    replaces: [],
    representations: [
      { bodyShapes: [BodyShape.MALE], mainFile: 'hat.glb', contents: [], overrideHides: [], overrideReplaces: [] },
    ],
  },
} as unknown as WearableDefinition

describe('base64ToDefinition', () => {
  it('round-trips a UTF-8 encoded definition', () => {
    const definition = emote(true, 'Saludo 👋')
    expect(base64ToDefinition(encode(definition))).toEqual(definition)
  })

  it('decodes plain-ASCII base64 produced with btoa alone', () => {
    expect(base64ToDefinition(btoa(JSON.stringify(wearable)))).toEqual(wearable)
  })
})

describe('findBase64Emote', () => {
  it('returns the emote so the controller can honor its loop flag', () => {
    const found = findBase64Emote([encode(wearable), encode(emote(true))])
    expect(found?.emoteDataADR74.loop).toBe(true)
  })

  it('prefers the last emote when several are present', () => {
    const found = findBase64Emote([encode(emote(true, 'First')), encode(emote(false, 'Last'))])
    expect(found?.name).toBe('Last')
  })

  it('returns null when only wearables are present', () => {
    expect(findBase64Emote([encode(wearable)])).toBeNull()
  })

  it('skips malformed entries', () => {
    expect(findBase64Emote(['not-base64!!', encode(emote(false))])?.emoteDataADR74.loop).toBe(false)
  })
})
