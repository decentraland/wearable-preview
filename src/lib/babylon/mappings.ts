import { SceneLoader } from '@babylonjs/core'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { WearableBodyShape } from '@dcl/schemas'
import { AvatarPreview } from '../avatar'
import { getRepresentation } from '../representation'
import { Wearable } from '../wearable'

export function createMappings(wearables: Wearable[], bodyShape = WearableBodyShape.MALE) {
  const mappings: Record<string, string> = {}
  for (const wearable of wearables) {
    try {
      const representation = getRepresentation(wearable, bodyShape)
      for (const file of representation.contents) {
        mappings[file.key] = file.url
      }
    } catch (error) {
      console.warn(
        `Skipping generation of mappings for wearable="${wearable.id}" since it lacks a representation for bodyShape="${bodyShape}"`
      )
      continue
    }
  }
  return mappings
}

/**
 * Configures the mappings for all the relative paths within a model to the right IPFS in the catalyst
 * @param wearables
 */
export function setupMappings(preview: AvatarPreview) {
  const wearables = preview.wearable ? [preview.wearable, ...preview.wearables] : preview.wearables
  const mappings = createMappings(wearables, preview.bodyShape)
  SceneLoader.OnPluginActivatedObservable.add((plugin) => {
    if (plugin.name === 'gltf') {
      const gltf = plugin as GLTFFileLoader
      gltf.preprocessUrlAsync = async (url: string) => {
        const baseUrl = `/content/contents/`
        const parts = url.split(baseUrl)
        return parts.length > 0 && !!parts[1] ? mappings[parts[1]] : url
      }
    }
  })
}
