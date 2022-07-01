import { SceneLoader } from '@babylonjs/core'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { PreviewConfig, BodyShape, WearableDefinition } from '@dcl/schemas'
import { getRepresentation } from '../representation'

export function createMappings(wearables: WearableDefinition[], bodyShape = BodyShape.MALE) {
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
export function setupMappings(config: PreviewConfig) {
  const wearables = config.wearable ? [config.wearable, ...config.wearables] : config.wearables
  const mappings = createMappings(wearables, config.bodyShape)
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
