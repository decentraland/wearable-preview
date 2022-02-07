import { WearableBodyShape } from '@dcl/schemas'
import { peerApi } from '../lib/api/peer'
import { Env } from '../types/env'
import { useFetch } from './useFetch'

export function useWearables(options: { shape: WearableBodyShape; urns: string[]; env: Env }) {
  const { shape, urns, env } = options
  const [wearables, isLoading, error] = useFetch(async () => {
    const promises = urns.map((urn) => peerApi.fetchWearable(urn, env))
    if (promises.length > 0) {
      promises.unshift(peerApi.fetchWearable(shape, env))
    }
    return Promise.all(promises)
  })
  return [wearables, isLoading, error] as const
}
