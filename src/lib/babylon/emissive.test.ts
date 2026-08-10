import { Color3 } from '@babylonjs/core/Maths/math.color'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyUnityEmissiveGain,
  getOriginalEmissiveColor,
  getToneMappingExposure,
  isUnityToneMappingEnabled,
  TONE_MAPPING_EXPOSURE,
  UNITY_EMISSIVE_GAIN,
  UNITY_EMISSIVE_GENERATOR_GAIN,
  UNITY_EMISSIVE_SHADER_GAIN,
} from './emissive'

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}

afterEach(() => setSearch(''))

// The gain only touches emissiveColor and metadata, so a plain stand-in keeps these tests
// off a WebGL context. Cast at the call site to satisfy the PBRMaterial signature.
function fakeMaterial(emissiveColor = new Color3(0, 0, 0)) {
  return { emissiveColor, metadata: undefined } as any
}

// Hell's Angels (0x65ed61c4fc2d1102ed574a48e664b90b7a300ea8 item 0), the wearable that
// surfaced the Babylon/Unity divergence.
const REFERENCE_EMISSIVE = new Color3(0.48118668795180497, 0, 0.0036217522927073365)

describe('UNITY_EMISSIVE_GAIN', () => {
  it('is the product of the two Unity multipliers', () => {
    expect(UNITY_EMISSIVE_GENERATOR_GAIN).toBe(5)
    expect(UNITY_EMISSIVE_SHADER_GAIN).toBe(2.5)
    expect(UNITY_EMISSIVE_GAIN).toBe(UNITY_EMISSIVE_GENERATOR_GAIN * UNITY_EMISSIVE_SHADER_GAIN)
    expect(UNITY_EMISSIVE_GAIN).toBe(12.5)
  })
})

describe('applyUnityEmissiveGain', () => {
  it('scales the emissive to match Unity', () => {
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())

    applyUnityEmissiveGain(material)

    expect(material.emissiveColor.r).toBeCloseTo(6.0148, 4)
    expect(material.emissiveColor.g).toBeCloseTo(0, 4)
    expect(material.emissiveColor.b).toBeCloseTo(0.04527, 4)
  })

  it('leaves non-emissive materials black', () => {
    const material = fakeMaterial(new Color3(0, 0, 0))

    applyUnityEmissiveGain(material)

    expect(material.emissiveColor.asArray()).toEqual([0, 0, 0])
  })

  it('does not compound when a re-render applies it again', () => {
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())

    applyUnityEmissiveGain(material)
    const afterFirst = material.emissiveColor.clone()
    applyUnityEmissiveGain(material)

    expect(material.emissiveColor.asArray()).toEqual(afterFirst.asArray())
  })

  it('preserves the original color for the glow layer and the export', () => {
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())

    applyUnityEmissiveGain(material)

    expect(getOriginalEmissiveColor(material).asArray()).toEqual(REFERENCE_EMISSIVE.asArray())
  })

  it('keeps unrelated metadata set by other passes', () => {
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())
    material.metadata = { gltf: { pointer: '/materials/0' } }

    applyUnityEmissiveGain(material)

    expect(material.metadata.gltf).toEqual({ pointer: '/materials/0' })
  })
})

describe('the toneMapping=none escape hatch', () => {
  it('is off by default, so the fix ships enabled', () => {
    expect(isUnityToneMappingEnabled()).toBe(true)
  })

  it('rolls the gain back too — the gain without a tonemapper is worse than neither', () => {
    setSearch('?toneMapping=none')
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())

    applyUnityEmissiveGain(material)

    expect(isUnityToneMappingEnabled()).toBe(false)
    expect(material.emissiveColor.asArray()).toEqual(REFERENCE_EMISSIVE.asArray())
    expect(material.metadata?.originalEmissiveColor).toBeUndefined()
  })

  it('is not triggered by other values', () => {
    setSearch('?toneMapping=aces')
    expect(isUnityToneMappingEnabled()).toBe(true)
  })
})

describe('getToneMappingExposure', () => {
  it('lifts the scene by default — ACES over un-lifted LDR crushes the dark end', () => {
    expect(getToneMappingExposure()).toBe(TONE_MAPPING_EXPOSURE)
    expect(TONE_MAPPING_EXPOSURE).toBeGreaterThan(1)
  })

  it('honours ?exposure= so QA can sweep it', () => {
    setSearch('?exposure=3')
    expect(getToneMappingExposure()).toBe(3)
  })

  it('falls back to the default for junk and non-positive values', () => {
    for (const value of ['abc', '0', '-1', '']) {
      setSearch(`?exposure=${value}`)
      expect(getToneMappingExposure()).toBe(TONE_MAPPING_EXPOSURE)
    }
  })
})

describe('getOriginalEmissiveColor', () => {
  it('falls back to the current color when the gain was never applied', () => {
    const material = fakeMaterial(REFERENCE_EMISSIVE.clone())

    expect(getOriginalEmissiveColor(material).asArray()).toEqual(REFERENCE_EMISSIVE.asArray())
  })
})
