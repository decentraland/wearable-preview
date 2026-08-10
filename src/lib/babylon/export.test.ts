import { describe, expect, it } from 'vitest'
import { normalizeEmissiveForExport } from './export'
import { cleanupSearchAfterEach, setSearch } from './test-helpers'

cleanupSearchAfterEach()

describe('normalizeEmissiveForExport', () => {
  it('undoes the display gain so the file stays within the glTF [0,1] range', () => {
    // Hell's Angels (0x65ed61c4fc2d1102ed574a48e664b90b7a300ea8 item 0) as the scene holds
    // it once applyUnityEmissiveGain has run.
    const authored = [0.48118668795180497, 0, 0.0036217522927073365]
    const json = { materials: [{ emissiveFactor: authored.map((channel) => channel * 12.5) }] }

    normalizeEmissiveForExport(json)

    expect(json.materials[0].emissiveFactor).toEqual(authored)
    for (const channel of json.materials[0].emissiveFactor) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })

  it('clamps values that would still exceed the spec range', () => {
    const json = { materials: [{ emissiveFactor: [100, -3, 0.5] }] }

    normalizeEmissiveForExport(json)

    expect(json.materials[0].emissiveFactor).toEqual([1, 0, 0.04])
  })

  it('ignores materials without an emissiveFactor', () => {
    const json = { materials: [{ pbrMetallicRoughness: { metallicFactor: 0 } }] }

    expect(() => normalizeEmissiveForExport(json)).not.toThrow()
    expect(json.materials[0]).toEqual({ pbrMetallicRoughness: { metallicFactor: 0 } })
  })

  it('ignores documents with no materials array', () => {
    const json = { meshes: [] }

    expect(() => normalizeEmissiveForExport(json)).not.toThrow()
  })

  it('skips normalization when toneMapping=none, since the gain was never applied', () => {
    setSearch('?toneMapping=none')
    const original = [0.48118668795180497, 0, 0.0036217522927073365]
    const json = { materials: [{ emissiveFactor: [...original] }] }

    normalizeEmissiveForExport(json)

    // Values must remain untouched — dividing un-scaled emissive by 12.5 would crush them.
    expect(json.materials[0].emissiveFactor).toEqual(original)
  })
})
