import { WearableBodyShape } from '@dcl/schemas'
import { peerApi } from '../lib/api/peer'
import { hasRepresentation } from '../lib/representation'
import { getDefaultCategories, getDefaultWearableUrn, getWearableByCategory, isWearable, Wearable } from '../lib/wearable'
import { Env } from '../types/env'
import { useFetch } from './useFetch'

function fetchWearable(urn: string, env: Env) {
  return peerApi.fetchWearable(urn, env).catch((error: Error) => console.log(`Failed to load wearable="${urn}"`, error))
}

export function useAvatar(options: { shape: WearableBodyShape; urns: string[]; env: Env }) {
  const { shape, urns, env } = options
  const [avatar, isLoading, error] = useFetch(async () => {
    if (urns.length === 0) {
      return []
    }

    const promises = [fetchWearable(shape, env), ...urns.map((urn) => fetchWearable(urn, env))]
    const [bodyShape, ...other] = await Promise.all(promises)

    if (!bodyShape) {
      throw new Error(`Could not load bodyShape="${shape}"`)
    }

    // filter out wearables that failed to load
    let wearables = other.filter(isWearable)

    // filter out wearables that don't have a representation for the body shape
    wearables = wearables.filter((wearable) => hasRepresentation(wearable, shape))

    // fill default categories
    let success = false
    do {
      const promises: Promise<Wearable | void>[] = []
      for (const category of getDefaultCategories(shape)) {
        const wearable = getWearableByCategory(wearables, category)
        if (!wearable) {
          const urn = getDefaultWearableUrn(category, shape)
          if (urn) {
            const defaultWearable = fetchWearable(urn, env)
            promises.push(defaultWearable)
          } else {
            throw new Error(`Could not get default URN for category="${category}"`)
          }
        }
      }
      const defaultWearables = await Promise.all(promises)
      wearables = [...wearables, ...defaultWearables.filter(isWearable)]
      success = defaultWearables.every(isWearable) // make sure all the default wearables were loaded successfully, otherwise retry
    } while (!success)

    return [bodyShape, ...wearables]
  })
  return [avatar, isLoading, error] as const
}
