import { PreviewEnv, Profile, WearableDefinition } from '@dcl/schemas'
import { json } from '../json'

export const peerByEnv: Record<PreviewEnv, string> = {
  [PreviewEnv.DEV]: 'https://peer.decentraland.zone',
  [PreviewEnv.PROD]: 'https://peer.decentraland.org',
}

class PeerApi {
  async fetchWearables(urns: string[], env: PreviewEnv) {
    if (urns.length === 0) {
      return []
    }
    const { wearables } = await json<{ wearables: WearableDefinition[] }>(
      `${peerByEnv[env]}/lambdas/collections/wearables?${urns.map((urn) => `wearableId=${urn}`).join('&')}`
    )
    if (wearables.length === 0) {
      throw new Error(`Wearables not found for urns="${urns}"`)
    }
    return wearables
  }
  async fetchProfile(profile: string, env: PreviewEnv) {
    const profiles = await json<Profile[]>(`${peerByEnv[env]}/lambdas/profiles?id=${profile}`)
    return profiles.length > 0 ? profiles[0] : null
  }
}

export const peerApi = new PeerApi()
