import { Wearable as WearableBroken, WearableRepresentation } from '@dcl/schemas'

const PEER_URL = 'https://peer.decentraland.org'

type Wearable = Omit<WearableBroken, 'data'> & {
  data: Omit<WearableBroken['data'], 'representations'> & {
    representations: (Omit<WearableRepresentation, 'contents'> & { contents: { key: string; url: string }[] })[]
  }
}

class PeerApi {
  async fetchWearable(urn: string) {
    const resp = await fetch(`${PEER_URL}/lambdas/collections/wearables?wearableId=${urn}`)
    const { wearables }: { wearables: Wearable[] } = await resp.json()
    if (wearables.length === 0) {
      throw new Error(`Wearable not found for urn="${urn}"`)
    }
    return wearables[0]
  }
}

export const peerApi = new PeerApi()
