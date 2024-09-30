import {
  Profile,
  WearableDefinition,
  EmoteDefinition,
  Entity,
  Emote,
  Wearable,
  EmoteRepresentationADR74,
  WearableRepresentation,
  EmoteRepresentationDefinition,
  WearableRepresentationDefinition,
} from '@dcl/schemas'
import { isEmote } from '../emote'
import { json } from '../json'
import { isWearable } from '../wearable'

/**
 * Converts representations into representation definitions. Representations have contents as string[] and representation definitions have contents as { key: string, url: string}[].
 * @param entity
 * @param representations
 * @param peerUrl
 * @returns representation definitions
 */
function mapEntityRepresentationToDefinition<
  T extends WearableRepresentationDefinition | EmoteRepresentationDefinition
>(entity: Entity, representations: (EmoteRepresentationADR74 | WearableRepresentation)[], peerUrl: string): T[] {
  return representations.map((representation) => ({
    ...representation,
    contents: representation.contents.map((key) => ({
      key,
      url: `${peerUrl}/content/contents/${entity.content.find((c) => c.file === key)!.hash}`,
    })),
  })) as T[]
}

/**
 * Converts an entity into a wearable or an emote definition.
 * @param entity
 * @param peerUrl
 * @returns a wearable or emote definition
 */
function entityToDefinition<T extends WearableDefinition | EmoteDefinition>(entity: Entity, peerUrl: string): T {
  const metadata = entity.metadata as Wearable | Emote

  // this is used for the image and the thumbnail urls
  const lambdaBaseUrl = `${peerUrl}/lambdas/collections/contents/${entity.metadata.id}`

  if ('emoteDataADR74' in metadata) {
    const definition: EmoteDefinition = {
      ...metadata,
      thumbnail: `${lambdaBaseUrl}/thumbnail`,
      image: `${lambdaBaseUrl}/image`,
      emoteDataADR74: {
        ...metadata.emoteDataADR74,
        representations: mapEntityRepresentationToDefinition<EmoteRepresentationDefinition>(
          entity,
          metadata.emoteDataADR74.representations,
          peerUrl
        ),
      },
    }
    return definition as T
  }

  const definition: WearableDefinition = {
    ...metadata,
    thumbnail: `${lambdaBaseUrl}/thumbnail`,
    image: `${lambdaBaseUrl}/image`,
    data: {
      ...metadata.data,
      representations: mapEntityRepresentationToDefinition<WearableRepresentationDefinition>(
        entity,
        metadata.data.representations,
        peerUrl
      ),
    },
  }

  return definition as T
}

class PeerApi {
  /**
   * Fetches the entities that represent the given pointers.
   * @param pointers List of pointers
   * @param peerUrl The url of a catalyst
   * @returns List of active entities for given pointers
   */
  async fetchEntities(pointers: string[], peerUrl: string) {
    if (pointers.length === 0) {
      return []
    }
    const entities = await json<Entity[]>(`${peerUrl}/content/entities/active`, {
      method: 'post',
      body: JSON.stringify({ pointers }),
      headers: { 'Content-Type': 'application/json' },
    })
    return entities
  }

  /**
   * Fetches the entities represented by the given urns and processes them into Wearable and Emote definitions.
   * @param urns List of urns for wearables or emotes
   * @param peerUrl The url of a Catalyst
   * @returns List of wearables and list of emotes for given urns
   */
  async fetchItems(urns: string[], peerUrl: string): Promise<[WearableDefinition[], EmoteDefinition[]]> {
    if (urns.length === 0) {
      return [[], []]
    }
    const pointers = urns.map((urn) => urn.toLowerCase()) // this hack is necessary for body shape urns to work, since they have upper case letter and the catalyst can't find them
    const entities = await this.fetchEntities(pointers, peerUrl)
    const definitions = entities.map((entity) => entityToDefinition(entity, peerUrl))
    const wearables = definitions.filter(isWearable)
    const emotes = definitions.filter(isEmote)
    return [wearables, emotes]
  }

  async fetchProfile(profile: string, peerUrl: string) {
    try {
      return await json<Profile>(`${peerUrl}/lambdas/profiles/${profile}`)
    } catch (error) {
      console.error('There was an error loading the profile', error)
      return null
    }
  }

  async fetchProfileEntity(content: string, peerUrl: string) {
    try {
      const entity = await json<Entity>(`${peerUrl}/content/contents/${content}`)
      if (entity.type !== 'profile') {
        throw new Error('The content is not a profile')
      }

      return entity.metadata as Profile
    } catch (error) {
      console.error('There was an error loading the profile', error)
      return null
    }
  }
}

export const peerApi = new PeerApi()
