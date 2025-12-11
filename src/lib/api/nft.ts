import { Item, NFT } from '@dcl/schemas'
import { json } from '../json'

class NFTApi {
  async fetchItem(contractAddress: string, itemId: string, marketplaceServerUrl: string) {
    const { data } = await json<{ data: Item[] }>(
      `${marketplaceServerUrl}/v1/items?contractAddress=${contractAddress}&itemId=${itemId}`
    )
    if (data.length === 0) {
      throw new Error(`Item not found for contractAddress="${contractAddress}" itemId="${itemId}"`)
    }
    return data[0]
  }
  async fetchNFT(contractAddress: string, tokenId: string, marketplaceServerUrl: string) {
    const { data } = await json<{ data: { nft: NFT }[] }>(
      `${marketplaceServerUrl}/v1/nfts?contractAddress=${contractAddress}&tokenId=${tokenId}`
    )
    if (data.length === 0) {
      throw new Error(`NFT not found for contractAddress="${contractAddress}" tokenId="${tokenId}"`)
    }
    return data[0].nft
  }
}

export const nftApi = new NFTApi()
