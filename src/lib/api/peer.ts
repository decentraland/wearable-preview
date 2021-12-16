import { Wearable as WearableBroken, WearableRepresentation as WearableRepresentationBroken } from '@dcl/schemas'
import { Env } from '../../types/env'
import { json } from '../json'

export const peerByEnv: Record<Env, string> = {
  [Env.DEV]: 'https://peer.decentraland.zone',
  [Env.PROD]: 'https://peer-lb.decentraland.org',
}

export type Wearable = Omit<WearableBroken, 'data'> & {
  data: Omit<WearableBroken['data'], 'representations'> & {
    representations: WearableRepresentation[]
  }
}

export type WearableRepresentation = Omit<WearableRepresentationBroken, 'contents'> & { contents: { key: string; url: string }[] }

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
