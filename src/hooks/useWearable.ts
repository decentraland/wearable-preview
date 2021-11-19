import { Network } from '@dcl/schemas'
import { nftApi } from '../lib/api/nft'
import { peerApi } from '../lib/api/peer'
import { useFetch } from './useFetch'

export function useWearable(options: { contractAddress: string; itemId?: string | null; tokenId?: string | null }) {
  let { contractAddress, itemId, tokenId } = options
  const [wearable, isWearableLoading, wearableError] = useFetch(async () => {
    if (!contractAddress) {
      throw new Error('You must provide a valid contract address')
    }
    let urn = `urn:decentraland:matic:collections-v2:${contractAddress}:${itemId}`
    if (!itemId && !tokenId) {
      throw new Error(`You must provide either tokenId or itemId`)
    } else if (!itemId && tokenId) {
      const nft = await nftApi.fetchNFT(contractAddress, tokenId)
      urn =
        nft.network !== Network.ETHEREUM
          ? `urn:decentraland:matic:collections-v2:${contractAddress}:${nft.itemId}`
          : nft.image.split('contents/')[1].split('/thumbnail')[0] // since the Ethereum collections have a different URN, we extract it from the image path
    }
    return peerApi.fetchWearable(urn)
  })

  return [wearable, isWearableLoading, wearableError] as const
}
