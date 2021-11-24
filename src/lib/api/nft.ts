import { Item, NFT } from '@dcl/schemas'
import { Env } from '../../types/env'
import { json } from '../json'

export const nftApiByEnv: Record<Env, string> = {
  [Env.DEV]: 'https://nft-api.decentraland.io',
  [Env.PROD]: 'https://nft-api.decentraland.org',
}

class NFTApi {
  async fetchItem(contractAddress: string, itemId: string, env: Env) {
    const { data } = await json<{ data: Item[] }>(`${nftApiByEnv[env]}/v1/items?contractAddress=${contractAddress}&itemId=${itemId}`)
    if (data.length === 0) {
      throw new Error(`Item not found for contractAddress="${contractAddress}" itemId="${itemId}"`)
    }
    return data[0]
  }
  async fetchNFT(contractAddress: string, tokenId: string, env: Env) {
    const { data } = await json<{ data: { nft: NFT }[] }>(
      `${nftApiByEnv[env]}/v1/nfts?contractAddress=${contractAddress}&tokenId=${tokenId}`
    )
    if (data.length === 0) {
      throw new Error(`NFT not found for contractAddress="${contractAddress}" tokenId="${tokenId}"`)
    }
    return data[0].nft
  }
}

export const nftApi = new NFTApi()
