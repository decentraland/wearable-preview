import { Profile } from '@dcl/schemas'
import { Env } from '../../types/env'
import { json } from '../json'
import { Wearable } from '../wearable'

export const peerByEnv: Record<Env, string> = {
  [Env.DEV]: 'https://peer.decentraland.zone',
  [Env.PROD]: 'https://peer.decentraland.org',
}

class PeerApi {
  async fetchWearable(urn: string, env: Env) {
    const { wearables } = await json<{ wearables: Wearable[] }>(`${peerByEnv[env]}/lambdas/collections/wearables?wearableId=${urn}`)
    if (wearables.length === 0) {
      throw new Error(`Wearable not found for urn="${urn}"`)
    }
    return wearables[0]
  }
  async fetchProfile(profile: string, env: Env) {
    const profiles = await json<Profile[]>(`${peerByEnv[env]}/lambdas/profiles?id=${profile}`)
    return profiles.length > 0 ? profiles[0] : null
  }
}

export const peerApi = new PeerApi()
