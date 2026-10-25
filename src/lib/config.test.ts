import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyShape, PreviewType, WearableCategory, WearableDefinition } from '@dcl/schemas'

const { fetchItems } = vi.hoisted(() => ({ fetchItems: vi.fn() }))
vi.mock('./api/peer', () => ({ peerApi: { fetchItems } }))
vi.mock('./sentry', () => ({ captureException: vi.fn() }))

const { createConfig } = await import('./config')

const EYEBROWS_URN = 'urn:decentraland:matic:collections-v2:0x0000000000000000000000000000000000000001:0'
const HAT_URN = 'urn:decentraland:matic:collections-v2:0x0000000000000000000000000000000000000002:0'

function definition(id: string, category: WearableCategory, mainFile: string): WearableDefinition {
  return {
    id,
    name: id,
    description: '',
    image: '',
    thumbnail: `https://peer.example/${id}/thumbnail.png`,
    i18n: [],
    data: {
      category,
      tags: [],
      replaces: [],
      hides: [],
      representations: [BodyShape.MALE, BodyShape.FEMALE].map((bodyShape) => ({
        bodyShapes: [bodyShape],
        mainFile,
        contents: [{ key: mainFile, url: `https://peer.example/${id}/${mainFile}` }],
        overrideHides: [],
        overrideReplaces: [],
      })),
    },
  } as unknown as WearableDefinition
}

function definitionFor(urn: string): WearableDefinition {
  if (urn === EYEBROWS_URN) return definition(urn, WearableCategory.EYEBROWS, 'eyebrows.png')
  if (urn === HAT_URN) return definition(urn, WearableCategory.HAT, 'hat.glb')
  if (urn === BodyShape.MALE) return definition(urn, WearableCategory.BODY_SHAPE, 'body.glb')
  return definition(urn, WearableCategory.HAT, 'default.glb')
}

describe('createConfig', () => {
  beforeEach(() => {
    fetchItems.mockReset().mockImplementation((urns: string[]) => Promise.resolve([urns.map(definitionFor), []]))
  })

  describe('when a single wearable is requested with the wearable type', () => {
    describe('and the wearable is texture-only, like eyebrows', () => {
      it('should preview it as a texture with its thumbnail instead of a 3D model', async () => {
        const config = await createConfig({ type: PreviewType.WEARABLE, urns: [EYEBROWS_URN] })

        expect(config.type).toBe(PreviewType.TEXTURE)
        expect(config.item?.id).toBe(EYEBROWS_URN)
        expect(config.background.image).toBe(`https://peer.example/${EYEBROWS_URN}/thumbnail.png`)
      })
    })

    describe('and the wearable has a model', () => {
      it('should preview it as a 3D wearable', async () => {
        const config = await createConfig({ type: PreviewType.WEARABLE, urns: [HAT_URN] })

        expect(config.type).toBe(PreviewType.WEARABLE)
        expect(config.item?.id).toBe(HAT_URN)
      })
    })
  })
})
