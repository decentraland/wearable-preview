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
  RepresentationDefinition,
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
function mapEntityRepresentationToDefinition<T extends RepresentationDefinition | EmoteRepresentationDefinition>(
  entity: Entity,
  representations: (EmoteRepresentationADR74 | WearableRepresentation)[],
  peerUrl: string
): T[] {
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

  if ('emoteDataADR74' in metadata) {
    const definition: EmoteDefinition = {
      ...metadata,
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
    data: {
      ...metadata.data,
      representations: mapEntityRepresentationToDefinition<RepresentationDefinition>(
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
    const profiles = await json<Profile[]>(`${peerUrl}/lambdas/profiles?id=${profile}`)
    return profiles.length > 0 ? profiles[0] : null
  }
}

export const peerApi = new PeerApi()
