import { Network, Rarity, WearableBodyShape, WearableCategory } from '@dcl/schemas'
import { Env } from '../types/env'
import { nftApi } from './api/nft'
import { peerApi } from './api/peer'
import { colorToHex, formatHex } from './color'
import { getRepresentationOrDefault, hasRepresentation, isTexture } from './representation'
import { getDefaultCategories, getDefaultWearableUrn, getWearableByCategory, isWearable, Wearable } from './wearable'

export type AvatarPreview = {
  wearables: Wearable[]
  bodyShape: WearableBodyShape
  skin: string
  hair: string
  eyes: string
  zoom: number
  type: AvatarPreviewType
  background: AvatarBackground
}

export type AvatarPreviewOptions = {
  contractAddress?: string | null
  tokenId?: string | null
  itemId?: string | null
  profile?: string | null
  bodyShape?: WearableBodyShape | null
  skin?: string | null
  hair?: string | null
  eyes?: string | null
  urns?: string[] | null
  env?: Env | null
}

export type AvatarBackground = {
  image?: string
  gradient: string
}

export enum AvatarPreviewType {
  TEXTURE = 'texture',
  WEARABLE = 'wearable',
  AVATAR = 'avatar',
}

async function fetchWearable(urn: string, env: Env) {
  return peerApi.fetchWearable(urn, env).catch((error: Error) => console.log(`Failed to load wearable="${urn}"`, error))
}

async function fetchProfile(profile: string, env: Env) {
  return peerApi
    .fetchProfile(profile, env)
    .then((profile) => (profile && profile.avatars.length > 0 ? profile.avatars[0] : null))
    .catch((error: Error) => console.log(`Failed to load profile="${profile}"`, error))
}

async function fetchWearableFromContract(options: { contractAddress: string; itemId?: string | null; tokenId?: string | null; env: Env }) {
  const { contractAddress, itemId, tokenId, env } = options
  if (!itemId && !tokenId) {
    throw new Error(`You need to provide an itemId or a tokenId`)
  }

  const network = env === Env.PROD ? 'matic' : 'mumbai'
  let urn = `urn:decentraland:${network}:collections-v2:${contractAddress}:${itemId}`
  if (!itemId && !tokenId) {
    throw new Error(`You must provide either tokenId or itemId`)
  } else if (!itemId && tokenId) {
    const nft = await nftApi.fetchNFT(contractAddress, tokenId, env)
    urn =
      nft.network !== Network.ETHEREUM
        ? `urn:decentraland:${network}:collections-v2:${contractAddress}:${nft.itemId}`
        : nft.image.split('contents/')[1].split('/thumbnail')[0] // since the Ethereum collections have a different URN, we extract it from the image path
  }
  return fetchWearable(urn, env)
}

async function fetchWearables(urns: string[], bodyShape: WearableBodyShape, env: Env) {
  let wearables = (await Promise.all([bodyShape, ...urns].map((urn) => fetchWearable(urn, env))))
    .filter(isWearable) // filter out wearables that failed to load
    .filter((wearable) => hasRepresentation(wearable, bodyShape)) // filter out wearables that don't have a representation for the body shape
  // fill default categories
  let success = false
  let attempts = 0
  do {
    const promises: Promise<Wearable | void>[] = []
    for (const category of getDefaultCategories(bodyShape)) {
      const wearable = getWearableByCategory(wearables, category)
      if (!wearable) {
        const urn = getDefaultWearableUrn(category, bodyShape)
        if (urn) {
          const defaultWearable = fetchWearable(urn, env)
          promises.push(defaultWearable)
        } else {
          throw new Error(`Could not get default URN for category="${category}"`)
        }
      }
    }
    const defaultWearables = await Promise.all(promises)
    wearables = [...wearables, ...defaultWearables.filter(isWearable)]
    // make sure all the default wearables were loaded successfully, otherwise retry up to 3 times
    success = defaultWearables.every(isWearable)
    attempts++
  } while (!success && attempts < 3)
  return wearables
}

/**
 * Returns the right zoom for a given category
 * @param category
 * @returns
 */
export function getZoom(wearable?: Wearable | void) {
  const category = wearable?.data.category
  switch (category) {
    case WearableCategory.UPPER_BODY:
      return 2
    case WearableCategory.SKIN:
      return 1.75
    default:
      return 1.25
  }
}

export async function createAvatarPreview(options: AvatarPreviewOptions = {}): Promise<AvatarPreview> {
  const { contractAddress, tokenId, itemId } = options
  const env = options.env || Env.PROD

  let wearablePromise: Promise<Wearable | void> = Promise.resolve()
  if (contractAddress) {
    wearablePromise = fetchWearableFromContract({ contractAddress, tokenId, itemId, env })
  }

  const profilePromise = options.profile ? fetchProfile(options.profile, env) : Promise.resolve()

  const [wearable, profile] = await Promise.all([wearablePromise, profilePromise] as const)

  const bodyShape = options.bodyShape || (profile && (profile.avatar.bodyShape as WearableBodyShape)) || WearableBodyShape.MALE
  const skin = formatHex(options.skin || (profile && colorToHex(profile.avatar.skin.color)) || 'cc9b76')
  const hair = formatHex(options.hair || (profile && colorToHex(profile.avatar.hair.color)) || '000000')
  const eyes = formatHex(options.eyes || (profile && colorToHex(profile.avatar.eyes.color)) || '000000')
  const urns = [...(profile ? profile.avatar.wearables : []), ...(options.urns || [])]
  let wearables: Wearable[] = []
  let zoom = 1.75
  let type = AvatarPreviewType.WEARABLE
  let background: AvatarBackground = {
    gradient: `radial-gradient(#676370, #18141b)`,
  }

  if (urns.length > 0) {
    wearables = await fetchWearables(urns, bodyShape, env)
    type = AvatarPreviewType.AVATAR
  }

  if (wearable) {
    zoom = wearables.length > 0 ? zoom : getZoom(wearable)
    const representation = getRepresentationOrDefault(wearable)
    if (isTexture(representation) && type !== AvatarPreviewType.AVATAR) {
      type = AvatarPreviewType.TEXTURE
    }
    const [light, dark] = Rarity.getGradient(wearable.rarity)
    const gradient = `radial-gradient(${light}, ${dark})`
    background = {
      image: wearable.thumbnail,
      gradient,
    }
    wearables = [...wearables, wearable]
  }

  return {
    wearables,
    bodyShape,
    skin,
    hair,
    eyes,
    zoom,
    type,
    background,
  }
}
