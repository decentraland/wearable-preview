import { Material } from '@babylonjs/core'

/**
 * Unity (aang-renderer) ignores the glTF `doubleSided` flag and culls back faces on every
 * material — `ToonMaterialGenerator` sets `CullMode.Back` unconditionally. Babylon honours
 * the flag, so a double-sided wearable draws each face twice: flat cards like feathers,
 * hair strands and capes stay visible from behind instead of disappearing, which reads as
 * "too many feathers" next to the Unity reference.
 *
 * Matching Unity means overriding the file's own declaration. That is deliberate — the
 * reference look wins — but it changes silhouettes anywhere authors relied on double-sided
 * geometry, so it gets its own escape hatch rather than riding along with the tonemapping.
 */
export function isUnityBackFaceCullingEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('culling') !== 'none'
}

export function applyUnityBackFaceCulling(material: Material): void {
  if (!isUnityBackFaceCullingEnabled()) {
    return
  }

  material.backFaceCulling = true
}
