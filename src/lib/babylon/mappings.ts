import { SceneLoader } from '@babylonjs/core'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { PreviewConfig, BodyShape, WearableDefinition, EmoteDefinition } from '@dcl/schemas'
import { isEmote } from '../emote'
import { getEmoteRepresentation, getWearableRepresentation } from '../representation'
import { isWearable } from '../wearable'

export function createMappings(wearables: WearableDefinition[], emote?: EmoteDefinition, bodyShape = BodyShape.MALE) {
  const mappings: Record<string, string> = {}
  for (const wearable of wearables) {
    try {
      const representation = getWearableRepresentation(wearable, bodyShape)
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
  if (emote) {
    const representation = getEmoteRepresentation(emote, bodyShape)
    for (const file of representation.contents) {
      mappings[file.key] = file.url
    }
  }
  return mappings
}

/**
 * Configures the mappings for all the relative paths within a model to the right IPFS in the catalyst
 * @param wearables
 */
export function setupMappings(config: PreviewConfig) {
  const wearables = isWearable(config.item) ? [config.item, ...config.wearables] : config.wearables
  const emote = isEmote(config.item) ? config.item : undefined
  const mappings = createMappings(wearables, emote, config.bodyShape)

  const processedUrls: any = []
  SceneLoader.OnPluginActivatedObservable.add((plugin) => {
    if (plugin.name === 'gltf') {
      const gltf = plugin as GLTFFileLoader
      gltf.preprocessUrlAsync = async (url) => {
        const baseUrl = `/`
        const filename = url.split(baseUrl).pop()
        if (filename) {
          const keys = Object.keys(mappings)
          const key = keys.find((_key) => _key.endsWith(filename))
          const processedUrl = mappings[key!] || url
          processedUrls.push(processedUrl) // Track processed URLs
          return processedUrl
        }
        return url
      }
    }
  })

  return mappings
}
