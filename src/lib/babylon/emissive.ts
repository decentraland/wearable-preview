import { Color3, PBRMaterial } from '@babylonjs/core'

/**
 * Unity (aang-renderer) is the reference look, and it amplifies the glTF
 * `emissiveFactor` twice before tonemapping it. Babylon applies the factor 1:1,
 * so emissive wearables render as saturated raw colors instead of the blown-out
 * highlights Unity produces. These constants mirror the two Unity multipliers so
 * the link stays traceable if either side changes.
 */

/** `ToonMaterialGenerator.EMISSIVE_MAGIC_NUMBER` in aang-renderer. */
export const UNITY_EMISSIVE_GENERATOR_GAIN = 5

/** The `* 2.5f` applied to `_Emissive_Color` in DCL_ToonBodyDoubleShadeWithFeather.hlsl. */
export const UNITY_EMISSIVE_SHADER_GAIN = 2.5

export const UNITY_EMISSIVE_GAIN = UNITY_EMISSIVE_GENERATOR_GAIN * UNITY_EMISSIVE_SHADER_GAIN

/**
 * ACES expects HDR input with headroom above 1.0. Unity's scene has it (many lights, GI, and
 * the emissive gain above); this scene does not — its four lights sum to roughly 1.0 — so
 * tonemapping the raw values crushes everything dark. Without this lift the fix would trade
 * the emissive bug for a darker catalogue: on the reference wearable the non-emissive
 * material fell from #982218 to #400E0A against Unity's #751610.
 *
 * 2.0 is the conventional compensation for ACES over LDR-authored content and lands the
 * non-emissive material on #6D150F. Overridable via ?exposure= for QA sweeps — 3.0 fits the
 * reference wearable's emissive feathers more closely, but is a larger lift than has been
 * validated against skin and facial features.
 */
export const TONE_MAPPING_EXPOSURE = 2.0

type EmissiveMetadata = {
  originalEmissiveColor?: Color3
}

/**
 * QA escape hatch to A/B the same URL during review, and to unblock support if this
 * regresses something in production. Gates the gain and the tonemapping together: the gain
 * only makes sense with a tonemapper to compress it, so half of the pair is worse than
 * neither. Not part of PreviewConfig because that type lives in @dcl/schemas and would need
 * a release to extend.
 */
export function isUnityToneMappingEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('toneMapping') !== 'none'
}

/** {@link TONE_MAPPING_EXPOSURE}, unless ?exposure= overrides it for a QA sweep. */
export function getToneMappingExposure(): number {
  const override = Number(new URLSearchParams(window.location.search).get('exposure'))
  return Number.isFinite(override) && override > 0 ? override : TONE_MAPPING_EXPOSURE
}

/**
 * Reads back the emissive color a material had before {@link applyUnityEmissiveGain}
 * scaled it. Returns the current color for materials that were never scaled.
 */
export function getOriginalEmissiveColor(material: PBRMaterial): Color3 {
  const metadata = material.metadata as EmissiveMetadata | undefined
  return metadata?.originalEmissiveColor ?? material.emissiveColor
}

/**
 * Scales a material's emissive to match Unity's, keeping the original around for
 * the glow layer and the VRM export. Safe to call twice: re-renders (triggered by
 * option updates) would otherwise compound the gain.
 */
export function applyUnityEmissiveGain(material: PBRMaterial): void {
  if (!isUnityToneMappingEnabled()) {
    return
  }

  const metadata = (material.metadata ?? {}) as EmissiveMetadata
  if (metadata.originalEmissiveColor) {
    return
  }

  metadata.originalEmissiveColor = material.emissiveColor.clone()
  material.metadata = metadata
  material.emissiveColor = material.emissiveColor.scale(UNITY_EMISSIVE_GAIN)
}
