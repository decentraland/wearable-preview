import { peerApi } from '../lib/api/peer'
import { Env } from '../types/env'
import { useFetch } from './useFetch'

export function useWearables(options: { urns: string[]; env: Env }) {
  const { urns, env } = options
  const [wearables, isLoading, error] = useFetch(async () => {
    return Promise.all(urns.map((urn) => peerApi.fetchWearable(urn, env)))
  })
  return [wearables, isLoading, error] as const
}
