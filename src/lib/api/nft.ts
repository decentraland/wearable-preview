import { Item, NFT } from '@dcl/schemas'

const NFT_API_URL = 'https://nft-api.decentraland.org'

class NFTApi {
  async fetchItem(contractAddress: string, itemId: string) {
    const resp = await fetch(`${NFT_API_URL}/v1/items?contractAddress=${contractAddress}&itemId=${itemId}`)
    const { data }: { data: Item[] } = await resp.json()
    if (data.length === 0) {
      throw new Error(`Item not found for contractAddress="${contractAddress}" itemId="${itemId}"`)
    }
    return data[0]
  }
  async fetchNFT(contractAddress: string, tokenId: string) {
    const resp = await fetch(`${NFT_API_URL}/v1/nfts?contractAddress=${contractAddress}&tokenId=${tokenId}`)
    const { data }: { data: { nft: NFT }[] } = await resp.json()
    if (data.length === 0) {
      throw new Error(`NFT not found for contractAddress="${contractAddress}" tokenId="${tokenId}"`)
    }
    return data[0].nft
  }
}

export const nftApi = new NFTApi()
