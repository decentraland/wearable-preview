import {
  Avatar,
  Network,
  PreviewCamera,
  PreviewConfig,
  PreviewEmote,
  PreviewEnv,
  PreviewOptions,
  PreviewType,
  Rarity,
  WearableBodyShape,
  WearableDefinition,
} from '@dcl/schemas'
import { nftApi } from './api/nft'
import { peerApi } from './api/peer'
import { createMemo } from './cache'
import { colorToHex, formatHex } from './color'
import { getRepresentationOrDefault, hasRepresentation, isTexture } from './representation'
import { getDefaultCategories, getDefaultWearableUrn, getWearableBodyShape, getWearableByCategory, isEmote, isWearable } from './wearable'
import { getZoom } from './zoom'

const DEFAULT_PROFILE = 'default'

async function fetchWearable(urn: string, env: PreviewEnv) {
  const results = await fetchURNs([urn], env)
  if (results.length !== 1) {
    throw new Error(`Could not find wearable for urn="${urn}"`)
  }
  return results[0]
}

function toWearable(base64: string): WearableDefinition {
  return JSON.parse(atob(base64))
}

async function fetchURNs(urns: string[], env: PreviewEnv) {
  if (urns.length === 0) {
    return []
  }
  return peerApi.fetchWearables(urns, env)
}

async function fetchURLs(urls: string[]) {
  if (urls.length === 0) {
    return []
  }
  const promises = urls.map((url) =>
    fetch(url)
      .then((resp) => resp.json())
      .catch()
  )
  const results = await Promise.all(promises)
  return results.filter(isWearable)
}

export const profileMemo = createMemo<Avatar | null>()
async function fetchProfile(profile: string, env: PreviewEnv) {
  return profileMemo.memo(profile, async () => {
    if (profile === DEFAULT_PROFILE) {
      return null
    }
    const resp = await peerApi
      .fetchProfile(profile, env)
      .then((profile) => (profile && profile.avatars.length > 0 ? profile.avatars[0] : null))
      .catch((error: Error) => console.log(`Failed to load profile="${profile}"`, error))
    return resp || null
  })
}

async function fetchWearableFromContract(options: {
  contractAddress: string
  itemId?: string | null
  tokenId?: string | null
  env: PreviewEnv
}) {
  const { contractAddress, itemId, tokenId, env } = options
  if (!itemId && !tokenId) {
    throw new Error(`You need to provide an itemId or a tokenId`)
  }

  const network = env === PreviewEnv.PROD ? 'matic' : 'mumbai'
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

async function fetchAvatar(urns: string[], urls: string[], base64s: string[], bodyShape: WearableBodyShape, env: PreviewEnv) {
  // fetch wearables from urns, urls and base64s
  let wearables = [...(await fetchURNs([bodyShape, ...urns], env)), ...(await fetchURLs(urls)), ...base64s.map(toWearable)]
  // filter out wearables that don't have a representation for the body shape
  wearables = wearables.filter((wearable) => hasRepresentation(wearable, bodyShape))
  // fill default categories
  const defaultWearableUrns: string[] = []
  for (const category of getDefaultCategories(bodyShape)) {
    const wearable = getWearableByCategory(wearables, category)
    if (!wearable) {
      const urn = getDefaultWearableUrn(category, bodyShape)
      if (urn) {
        defaultWearableUrns.push(urn)
      } else {
        throw new Error(`Could not get default URN for category="${category}"`)
      }
    }
  }
  if (defaultWearableUrns.length > 0) {
    const defaultWearables = await fetchURNs(defaultWearableUrns, env)
    wearables = [...wearables, ...defaultWearables]
  }
  return wearables
}

export async function createConfig(options: PreviewOptions = {}): Promise<PreviewConfig> {
  const { contractAddress, tokenId, itemId } = options
  const env = options.env || PreviewEnv.PROD

  // load wearable to preview
  let wearablePromise: Promise<WearableDefinition | void> = Promise.resolve()
  if (contractAddress) {
    wearablePromise = fetchWearableFromContract({ contractAddress, tokenId, itemId, env })
  }

  // load profile
  const profilePromise = options.profile ? fetchProfile(options.profile, env) : Promise.resolve(null)

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

  // urls to load wearables from
  const urls = options.urls || []

  // wearables passed as base64
  const base64s = options.base64s || []

  let wearables: WearableDefinition[] = []
  let zoom = 1.75
  let type = PreviewType.WEARABLE
  let background: PreviewConfig['background'] = {
    gradient: options.transparentBackground ? undefined : `radial-gradient(#676370, #18141b)`,
  }

  // if loading multiple wearables (either from URNs or URLs), or if wearable is emote, render full avatar
  if (urls.length > 0 || urns.length > 0 || (wearable && isEmote(wearable)) || options.profile === DEFAULT_PROFILE) {
    type = PreviewType.AVATAR
    wearables = await fetchAvatar(urns, urls, base64s, bodyShape, env)
  }

  if (wearable) {
    zoom = wearables.length > 0 ? zoom : getZoom(wearable)
    const representation = getRepresentationOrDefault(wearable)
    if (isTexture(representation) && type !== PreviewType.AVATAR) {
      type = PreviewType.TEXTURE
    }
    const [light, dark] = Rarity.getGradient(wearable.rarity!)
    const gradient = `radial-gradient(${light}, ${dark})`
    background = {
      image: wearable.thumbnail,
      gradient,
    }
  }

  let emote = PreviewEmote.IDLE
  if (options.emote && Object.values(PreviewEmote).includes(options.emote)) {
    emote = options.emote
  }

  let camera = PreviewCamera.INTERACTIVE
  if (options.camera && Object.values(PreviewCamera).includes(options.camera)) {
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
