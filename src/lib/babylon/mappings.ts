import { SceneLoader } from '@babylonjs/core'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { PreviewConfig, BodyShape, WearableDefinition, EmoteDefinition } from '@dcl/schemas'
import { getRepresentation } from '../representation'

export function createMappings(wearables: (WearableDefinition | EmoteDefinition)[], bodyShape = BodyShape.MALE) {
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
        const baseUrl = `/`
        const filename = url.split(baseUrl).pop()
        if (!filename) {
          return url
        }
        const keys = Object.keys(mappings)
        const key = keys.find((_key) => _key.endsWith(filename))
        return mappings[key!] || url
      }
    }
  })
}
