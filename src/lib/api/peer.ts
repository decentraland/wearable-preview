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
}

export const peerApi = new PeerApi()
