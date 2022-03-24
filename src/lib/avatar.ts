import { Network, Rarity, WearableBodyShape } from '@dcl/schemas'
import { Env } from '../types/env'
import { nftApi } from './api/nft'
import { peerApi } from './api/peer'
import { colorToHex, formatHex } from './color'
import { getRepresentationOrDefault, hasRepresentation, isTexture } from './representation'
import {
  getDefaultCategories,
  getDefaultWearableUrn,
  getWearableBodyShape,
  getWearableByCategory,
  isEmote,
  isWearable,
  Wearable,
} from './wearable'
import { getZoom } from './zoom'

export type AvatarPreview = {
  wearable?: Wearable
  wearables: Wearable[]
  bodyShape: WearableBodyShape
  skin: string
  hair: string
  eyes: string
  zoom: number
  type: AvatarPreviewType
  background: AvatarBackground
  emote: AvatarEmote
  camera: AvatarCamera
  autoRotateSpeed: number
  offsetX: number
  offsetY: number
  offsetZ: number
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
  zoom?: number | null
  emote?: AvatarEmote | null
  camera?: AvatarCamera | null
  autoRotateSpeed?: number | null
  offsetX?: number | null
  offsetY?: number | null
  offsetZ?: number | null
  env?: Env | null
}

export type AvatarBackground = {
  image?: string
  gradient: string
}

export enum AvatarEmote {
  IDLE = 'idle',
  CLAP = 'clap',
  DAB = 'dab',
  DANCE = 'dance',
  FASHION = 'fashion',
  FASHION_2 = 'fashion-2',
  FASHION_3 = 'fashion-3',
  FASHION_4 = 'fashion-4',
  LOVE = 'love',
  MONEY = 'money',
}

export enum AvatarCamera {
  STATIC = 'static',
  INTERACTIVE = 'wearable',
}

export enum AvatarPreviewType {
  TEXTURE = 'texture',
  WEARABLE = 'wearable',
  AVATAR = 'avatar',
}

const DEFAULT_PROFILE = 'default'

async function fetchWearable(urn: string, env: Env) {
  return peerApi.fetchWearable(urn, env).catch((error: Error) => console.log(`Failed to load wearable="${urn}"`, error))
}

async function fetchProfile(profile: string, env: Env) {
  if (profile === DEFAULT_PROFILE) {
    return null
  }
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

async function fetchAvatar(urns: string[], bodyShape: WearableBodyShape, env: Env) {
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

export async function createAvatarPreview(options: AvatarPreviewOptions = {}): Promise<AvatarPreview> {
  const { contractAddress, tokenId, itemId } = options
  const env = options.env || Env.PROD

  // load wearable to preview
  let wearablePromise: Promise<Wearable | void> = Promise.resolve()
  if (contractAddress) {
    wearablePromise = fetchWearableFromContract({ contractAddress, tokenId, itemId, env })
  }

  // load profile
  const profilePromise = options.profile ? fetchProfile(options.profile, env) : Promise.resolve()

  // await promises
  const [wearable, profile] = await Promise.all([wearablePromise, profilePromise] as const)

  // use body shape from options, default to the profile one, if no profile default to the wearable bodyShape, if none, default to male
  const bodyShape =
    options.bodyShape ||
    (profile && (profile.avatar.bodyShape as WearableBodyShape)) ||
    (wearable ? getWearableBodyShape(wearable!) : WearableBodyShape.MALE)

  // use colors from options, default to profile, if none, use default values
  const skin = formatHex(options.skin || (profile && colorToHex(profile.avatar.skin.color)) || 'cc9b76')
  const hair = formatHex(options.hair || (profile && colorToHex(profile.avatar.hair.color)) || '000000')
  const eyes = formatHex(options.eyes || (profile && colorToHex(profile.avatar.eyes.color)) || '000000')

  // merge urns from profile (if any) and extra urns
  const urns = [...(profile ? profile.avatar.wearables : []), ...(options.urns || [])]

  let wearables: Wearable[] = []
  let zoom = 1.75
  let type = AvatarPreviewType.WEARABLE
  let background: AvatarBackground = {
    gradient: `radial-gradient(#676370, #18141b)`,
  }

  // if loading multiple wearables, or if wearable is emote, render full avatar
  if (urns.length > 0 || (wearable && isEmote(wearable)) || options.profile === DEFAULT_PROFILE) {
    type = AvatarPreviewType.AVATAR
    wearables = await fetchAvatar(urns, bodyShape, env)
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
  }

  let emote = AvatarEmote.IDLE
  if (options.emote && Object.values(AvatarEmote).includes(options.emote)) {
    emote = options.emote
  }

  let camera = AvatarCamera.INTERACTIVE
  if (options.camera && Object.values(AvatarCamera).includes(options.camera)) {
    camera = options.camera
  }
  const autoRotateSpeed = typeof options.autoRotateSpeed === 'number' && !isNaN(options.autoRotateSpeed) ? options.autoRotateSpeed : 0.2

  return {
    wearable: wearable ?? undefined,
    wearables,
    bodyShape,
    skin,
    hair,
    eyes,
    type,
    background,
    emote,
    camera,
    autoRotateSpeed,
    offsetX: options.offsetX || 0,
    offsetY: options.offsetY || 0,
    offsetZ: options.offsetZ || 0,
    zoom: options.zoom || zoom,
  }
}
