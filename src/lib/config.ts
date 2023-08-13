import {
  Avatar,
  BodyShape,
  EmoteDefinition,
  EmoteRepresentationWithBlobs,
  EmoteWithBlobs,
  isStandard,
  Network,
  PreviewCamera,
  PreviewConfig,
  PreviewEmote,
  PreviewOptions,
  PreviewProjection,
  PreviewType,
  Rarity,
  WearableDefinition,
  WearableRepresentationWithBlobs,
  WearableWithBlobs,
} from '@dcl/schemas'
import { config } from '../config'
import { nftApi } from './api/nft'
import { peerApi } from './api/peer'
import { createMemo } from './cache'
import { colorToHex, formatHex } from './color'
import { isEmote } from './emote'
import { getWearableRepresentationOrDefault, hasWearableRepresentation, isTexture } from './representation'
import {
  getDefaultCategories,
  getDefaultWearableUrn,
  getBodyShape,
  getWearableByCategory,
  isWearable,
  getFacialFeatureCategories,
  getNonFacialFeatureCategories,
} from './wearable'
import { computeZoom, getZoom } from './zoom'

const DEFAULT_PROFILE = 'default'

async function fetchItem(urn: string, peerUrl: string) {
  const [wearables, emotes] = await fetchURNs([urn], peerUrl)

  if (wearables.length === 1) {
    return wearables[0]
  }

  if (emotes.length === 1) {
    return emotes[0]
  }

  throw new Error(`Could not find wearable or emote for urn="${urn}"`)
}

function parseBase64s(base64s: string[]): [WearableDefinition[], EmoteDefinition[]] {
  const parsed = base64s.map((base64) => JSON.parse(atob(base64)))
  const wearables = parsed.filter(isWearable)
  const emotes = parsed.filter(isEmote)
  return [wearables, emotes]
}

function isValidNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && !isNaN(value)
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/g.test(address)
}

function sanitizeProfile(profile: string | null | undefined) {
  if (profile === 'default' || (profile && isValidAddress(profile))) {
    return profile
  }

  return null
}

async function fetchProfileWearables(profile: Avatar | null, peerUrl: string) {
  if (!profile) {
    return []
  }
  const [wearables] = await fetchURNs(profile.avatar.wearables, peerUrl)
  return wearables
}

async function fetchURNs(urns: string[], peerUrl: string): Promise<[WearableDefinition[], EmoteDefinition[]]> {
  if (urns.length === 0) {
    return [[], []]
  }
  return peerApi.fetchItems(urns, peerUrl)
}

async function fetchURLs(urls: string[]): Promise<[WearableDefinition[], EmoteDefinition[]]> {
  if (urls.length === 0) {
    return [[], []]
  }
  const promises = urls.map((url) =>
    fetch(url)
      .then((resp) => resp.json())
      .catch()
  )
  const results = await Promise.all(promises)

  const wearables = results.filter(isWearable)
  const emotes = results.filter(isEmote)
  return [wearables, emotes]
}

export const profileMemo = createMemo<Avatar | null>()
async function fetchProfile(profile: string, peerUrl: string) {
  return profileMemo.memo(profile, async () => {
    if (profile === DEFAULT_PROFILE) {
      return null
    }
    const resp = await peerApi
      .fetchProfile(profile, peerUrl)
      .then((profile) => (profile && profile.avatars.length > 0 ? profile.avatars[0] : null))
      .catch((error: Error) => console.log(`Failed to load profile="${profile}"`, error))
    return resp || null
  })
}

async function fetchItemFromContract(options: {
  contractAddress: string
  itemId?: string | null
  tokenId?: string | null
  peerUrl: string
  nftServerUrl: string
}) {
  const { contractAddress, itemId, tokenId, peerUrl, nftServerUrl } = options
  if (!itemId && !tokenId) {
    throw new Error(`You need to provide an itemId or a tokenId`)
  }

  const network = config.get('NETWORK')
  let urn = `urn:decentraland:${network}:collections-v2:${contractAddress}:${itemId}`
  if (!itemId && !tokenId) {
    throw new Error(`You must provide either tokenId or itemId`)
  } else if (!itemId && tokenId) {
    const nft = await nftApi.fetchNFT(contractAddress, tokenId, nftServerUrl)
    urn =
      nft.network !== Network.ETHEREUM
        ? `urn:decentraland:${network}:collections-v2:${contractAddress}:${nft.itemId}`
        : nft.image.split('contents/')[1].split('/thumbnail')[0] // since the Ethereum collections have a different URN, we extract it from the image path
  }
  return fetchItem(urn, peerUrl)
}

async function fetchWearablesAndEmotes(
  profile: Avatar | null,
  urns: string[],
  urls: string[],
  base64s: string[],
  bodyShape: BodyShape,
  includeDefaultWearables: boolean,
  includeFacialFeatures: boolean,
  peerUrl: string
): Promise<[WearableDefinition[], EmoteDefinition[]]> {
  // gather wearables from profile, urns, urls and base64s
  const [wearablesFromProfile, [wearablesFromURNs, emotesFromURNs], [wearablesFromURLs, emotesFromURLs]] =
    await Promise.all([
      fetchProfileWearables(profile, peerUrl),
      fetchURNs([bodyShape, ...urns], peerUrl),
      fetchURLs(urls),
    ])
  const [wearablesFromBase64, emotesFromBase64] = parseBase64s(base64s)

  // merge wearables and emotes from all sources
  let wearables = [...wearablesFromProfile, ...wearablesFromURNs, ...wearablesFromURLs, ...wearablesFromBase64]
  const emotes = [...emotesFromURNs, ...emotesFromURLs, ...emotesFromBase64]

  // filter out wearables that don't have a representation for the body shape
  wearables = wearables.filter((wearable) => hasWearableRepresentation(wearable, bodyShape))
  // fill default categories
  const defaultWearableUrns: string[] = []
  const categories =
    includeDefaultWearables && includeFacialFeatures
      ? getDefaultCategories()
      : includeDefaultWearables
      ? getNonFacialFeatureCategories()
      : includeFacialFeatures
      ? getFacialFeatureCategories()
      : []
  for (const category of categories) {
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
    const [defaultWearables] = await fetchURNs(defaultWearableUrns, peerUrl)
    wearables = [...wearables, ...defaultWearables]
  }

  return [wearables, emotes]
}

export async function createConfig(options: PreviewOptions = {}): Promise<PreviewConfig> {
  const { contractAddress, tokenId, itemId } = options

  const peerUrl = options.peerUrl || config.get('PEER_URL')
  const nftServerUrl = options.nftServerUrl || config.get('NFT_SERVER_URL')

  // load item to preview
  let itemPromise: Promise<WearableDefinition | EmoteDefinition | void> = Promise.resolve()
  if (contractAddress) {
    itemPromise = fetchItemFromContract({ contractAddress, tokenId, itemId, peerUrl, nftServerUrl })
  }

  // load profile
  const sanitizedProfile = sanitizeProfile(options.profile)
  const profilePromise = sanitizedProfile ? fetchProfile(sanitizedProfile, peerUrl) : Promise.resolve(null)

  // await promises
  const [item, profile] = await Promise.all([itemPromise, profilePromise] as const)

  // use body shape from options, default to the profile one, if no profile default to the wearable bodyShape, if none, default to male
  const bodyShape =
    options.bodyShape ||
    (profile && (profile.avatar.bodyShape as BodyShape)) ||
    (item && isWearable(item) ? getBodyShape(item) : BodyShape.MALE)

  // use colors from options, default to profile, if none, use default values
  const skin = formatHex(options.skin || (profile && colorToHex(profile.avatar.skin.color)) || 'cc9b76')
  const hair = formatHex(options.hair || (profile && colorToHex(profile.avatar.hair.color)) || '000000')
  const eyes = formatHex(options.eyes || (profile && colorToHex(profile.avatar.eyes.color)) || '000000')

  // merge urns from profile (if any) and extra urns
  const urns = [...(options.urns || [])]

  // urls to load wearables from
  const urls = options.urls || []

  // wearables passed as base64
  const base64s = options.base64s || []

  const blob = options.blob ? fromBlob(options.blob) : null

  let wearables: WearableDefinition[] = []
  let emotes: EmoteDefinition[] = []
  let zoom = 1.75
  let type = PreviewType.WEARABLE
  let background: PreviewConfig['background'] = {
    color: '#4b4852', // grey
    transparent: options.disableBackground === true,
  }

  // if loading multiple wearables (either from URNs or URLs), or if wearable is emote, render full avatar
  if (urns.length > 0 || urls.length > 0 || base64s.length > 0 || (item && isEmote(item)) || options.profile) {
    type = PreviewType.AVATAR
    const [allWearables, allEmotes] = await fetchWearablesAndEmotes(
      profile,
      urns,
      urls,
      base64s,
      bodyShape,
      !options.disableDefaultWearables,
      !options.disableFace,
      peerUrl
    )
    wearables = allWearables
    emotes = allEmotes
  }

  if (item) {
    zoom = wearables.length > 0 ? zoom : getZoom(item)
    if (isWearable(item)) {
      const representation = getWearableRepresentationOrDefault(item)
      if (isTexture(representation) && type !== PreviewType.AVATAR) {
        type = PreviewType.TEXTURE
      }
    }
    background = {
      ...background,
      image: item.thumbnail,
    }
    if (isStandard(item)) {
      const color = Rarity.getColor(item.rarity)
      background = {
        ...background,
        image: item.thumbnail,
        color,
      }
    }
  }

  let emote = options.disableDefaultEmotes ? null : options.emote ? options.emote : PreviewEmote.IDLE
  if (options.emote && Object.values(PreviewEmote).includes(options.emote)) {
    emote = options.emote
  }

  let camera = PreviewCamera.INTERACTIVE
  if (options.camera && Object.values(PreviewCamera).includes(options.camera)) {
    camera = options.camera
  }
  let projection = PreviewProjection.PERSPECTIVE
  if (options.projection && Object.values(PreviewProjection).includes(options.projection)) {
    projection = options.projection
  }
  const autoRotateSpeed =
    typeof options.autoRotateSpeed === 'number' && !isNaN(options.autoRotateSpeed) ? options.autoRotateSpeed : 0.2
  const centerBoundingBox = !options.disableAutoCenter

  // wheel options
  let wheelZoom = 1
  let wheelPrecision = 100
  let wheelStart = 50
  if (isNumber(options.wheelZoom)) {
    wheelZoom = Math.max(options.wheelZoom!, 1) // min value 1
  }
  if (isNumber(options.wheelPrecision)) {
    wheelPrecision = Math.max(options.wheelPrecision!, 1) // min value 1
  }
  if (isNumber(options.wheelStart)) {
    wheelStart = 100 - Math.min(Math.max(options.wheelStart!, 0), 100) // value between 0 and 100
  }

  // custom background color
  if (options.background) {
    background.color = options.background
  }

  let cameraX = 0
  let cameraY = 0
  let cameraZ = 0
  switch (type) {
    case PreviewType.WEARABLE: {
      cameraX = -2
      cameraY = 2
      cameraZ = 2
      break
    }
    case PreviewType.AVATAR: {
      cameraX = 0
      cameraY = 1
      cameraZ = 3.5
      break
    }
  }

  if (isValidNumber(options.cameraX)) {
    cameraX = options.cameraX
  }
  if (isValidNumber(options.cameraY)) {
    cameraY = options.cameraY
  }
  if (isValidNumber(options.cameraZ)) {
    cameraZ = options.cameraZ
  }

  let customWearable: WearableDefinition | null = null

  /* When sending a fixed type wearable,
   * have to verify if the user is not sending more than one custom wearable
   * by default is fetched a baseBodyShape wearable
   * wearables[0] = { id: "urn:...:BaseMale" }
   */
  if (options?.type === PreviewType.WEARABLE && wearables.length >= 2) {
    type = options.type
    customWearable = wearables[1]
  }

  console.log('Returning panning', !!options.panning)

  return {
    // item is the most important prop, if not preset we use the blob prop, and if none, we use the last emote from the list (if any)
    item: item ?? blob ?? customWearable ?? emotes.pop(),
    wearables,
    bodyShape,
    skin,
    hair,
    eyes,
    type,
    background,
    face: options.disableFace !== false,
    emote,
    camera,
    projection,
    autoRotateSpeed: options.disableAutoRotate ? 0 : autoRotateSpeed,
    centerBoundingBox,
    offsetX: options.offsetX || 0,
    offsetY: options.offsetY || 0,
    offsetZ: options.offsetZ || 0,
    cameraX,
    cameraY,
    cameraZ,
    zoom: typeof options.zoom === 'number' ? computeZoom(options.zoom) : zoom,
    wheelZoom,
    wheelPrecision,
    wheelStart,
    fadeEffect: !options.disableFadeEffect,
    showSceneBoundaries: !!options.showSceneBoundaries,
    showThumbnailBoundaries: !!options.showThumbnailBoundaries,
    panning: !!options.panning,
    lockAlpha: !!options.lockAlpha,
    lockBeta: !!options.lockBeta,
    lockRadius: !!options.lockRadius,
  }
}

function isNumber(value: number | null | undefined): boolean {
  return typeof value === 'number' && !isNaN(value)
}

function fromBlobRepresentation<T extends WearableRepresentationWithBlobs | EmoteRepresentationWithBlobs>(
  representation: T
) {
  return {
    ...representation,
    contents: representation.contents.map((content) => ({
      key: content.key,
      url: URL.createObjectURL(content.blob),
    })),
  }
}

function fromBlob(itemWithBlobs: WearableWithBlobs | EmoteWithBlobs): WearableDefinition | EmoteDefinition {
  if ('emoteDataADR74' in itemWithBlobs) {
    return {
      ...itemWithBlobs,
      emoteDataADR74: {
        ...itemWithBlobs.emoteDataADR74,
        representations: itemWithBlobs.emoteDataADR74.representations.map(fromBlobRepresentation),
      },
    }
  }
  return {
    ...itemWithBlobs,
    data: {
      ...itemWithBlobs.data,
      representations: itemWithBlobs.data.representations.map(fromBlobRepresentation),
    },
  }
}
