import { describe, expect, it } from 'vitest'
import { Matrix } from '@babylonjs/core'
import { fixInvertedWinding, normalizeEmissiveForExport, rebakeBindPose } from './export'
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

function buildTriangleGltf(indices: number[]) {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0]
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1]
  const binChunk = new ArrayBuffer(36 + 36 + 12)
  new Float32Array(binChunk, 0, 9).set(positions)
  new Float32Array(binChunk, 36, 9).set(normals)
  new Uint32Array(binChunk, 72, 3).set(indices)
  const json = {
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { byteOffset: 0, byteLength: 36 },
      { byteOffset: 36, byteLength: 36 },
      { byteOffset: 72, byteLength: 12 },
    ],
  }
  return { json, binChunk, readIndices: () => Array.from(new Uint32Array(binChunk, 72, 3)) }
}

describe('fixInvertedWinding', () => {
  it('reverses triangles that face away from their normals', () => {
    const { json, binChunk, readIndices } = buildTriangleGltf([0, 2, 1])
    fixInvertedWinding(json, binChunk)
    expect(readIndices()).toEqual([0, 1, 2])
  })

  it('leaves correctly wound triangles alone', () => {
    const { json, binChunk, readIndices } = buildTriangleGltf([0, 1, 2])
    fixInvertedWinding(json, binChunk)
    expect(readIndices()).toEqual([0, 1, 2])
  })
})

describe('rebakeBindPose', () => {
  function buildSkin() {
    const binChunk = new ArrayBuffer(2 * 64)
    const json = {
      nodes: [{ name: 'Avatar_Hand' }, { name: 'Avatar_HandThumb1' }],
      skins: [{ joints: [0, 1], inverseBindMatrices: 0 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: 'MAT4' }],
      bufferViews: [{ byteOffset: 0, byteLength: 128 }],
    }
    const snapshots = new Map([
      ['Avatar_Hand', { absolute: Matrix.Translation(0.7, 1.4, 0) }],
      ['Avatar_HandThumb1', { absolute: Matrix.Translation(0.75, 1.45, 0.05) }],
    ])
    const parents = new Map<string, string | null>([
      ['Avatar_Hand', null],
      ['Avatar_HandThumb1', 'Avatar_Hand'],
    ])
    return { json, binChunk, snapshots, parents }
  }

  it('mirrors joints along Z to match the serializer when leaving a left-handed scene', () => {
    const { json, binChunk, snapshots, parents } = buildSkin()
    rebakeBindPose(json, binChunk, snapshots, parents, true)
    const thumb = json.nodes[1] as { translation: number[] }
    expect(thumb.translation[2]).toBeCloseTo(-0.05)
    expect(new Float32Array(binChunk, 64, 16)[14]).toBeCloseTo(0.05)
  })

  it('keeps joint positions as-is for right-handed scenes', () => {
    const { json, binChunk, snapshots, parents } = buildSkin()
    rebakeBindPose(json, binChunk, snapshots, parents, false)
    const thumb = json.nodes[1] as { translation: number[] }
    expect(thumb.translation[2]).toBeCloseTo(0.05)
  })
})
