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
let _cachedSearch = ''
let _cachedParams: URLSearchParams | null = null
function getSearchParams(): URLSearchParams {
  const search = window.location.search
  if (!_cachedParams || search !== _cachedSearch) {
    _cachedSearch = search
    _cachedParams = new URLSearchParams(search)
  }
  return _cachedParams
}

export function isUnityBackFaceCullingEnabled(): boolean {
  return getSearchParams().get('culling') !== 'none'
}

export function applyUnityBackFaceCulling(material: Material): void {
  if (!isUnityBackFaceCullingEnabled()) {
    return
  }

  material.backFaceCulling = true
}
