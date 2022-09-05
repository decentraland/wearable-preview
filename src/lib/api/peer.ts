import { Profile, WearableDefinition } from '@dcl/schemas'
import { json } from '../json'

class PeerApi {
  async fetchWearables(urns: string[], peerUrl: string) {
    if (urns.length === 0) {
      return []
    }
    const { wearables } = await json<{ wearables: WearableDefinition[] }>(
      `${peerUrl}/lambdas/collections/wearables?${urns.map((urn) => `wearableId=${urn}`).join('&')}`
    )
    if (wearables.length === 0) {
      throw new Error(`Wearables not found for urns="${urns}"`)
    }
    return wearables
  }
  async fetchProfile(profile: string, peerUrl: string) {
    const profiles = await json<Profile[]>(`${peerUrl}/lambdas/profiles?id=${profile}`)
    return profiles.length > 0 ? profiles[0] : null
  }
}

export const peerApi = new PeerApi()
