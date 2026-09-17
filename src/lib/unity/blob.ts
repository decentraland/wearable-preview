import { EmoteDefinition, EmoteWithBlobs, WearableDefinition, WearableWithBlobs } from '@dcl/schemas'
import { fromBlob } from '../config'
import { isEmote } from '../emote'

// Singleton by design: the page hosts exactly one preview instance. A second concurrent instance
// would revoke this one's object URLs.
let previousObjectUrls: string[] = []

/**
 * Converts an item with blobs into the base64-encoded definition JSON that the renderer accepts
 * via AddBase64. The blobs become object URLs, local to this document, that Unity downloads like
 * any other content URL. Also returns the parsed definition so callers can inspect it.
 */
export function blobToBase64Definition(itemWithBlobs: WearableWithBlobs | EmoteWithBlobs): {
  base64: string
  definition: WearableDefinition | EmoteDefinition
} {
  // Revoke the URLs from the previous call: callers hot-swap models repeatedly (e.g. the builder's
  // live preview) and every stale URL would pin its GLB in memory.
  for (const url of previousObjectUrls) {
    URL.revokeObjectURL(url)
  }

  const definition = fromBlob(itemWithBlobs)
  const representations =
    'emoteDataADR74' in definition ? definition.emoteDataADR74.representations : definition.data.representations
  previousObjectUrls = representations.flatMap((representation) =>
    representation.contents.map((content) => content.url),
  )

  // btoa alone throws on code points above 0xFF, so encode as UTF-8 bytes first (the renderer
  // decodes with Encoding.UTF8.GetString).
  const bytes = new TextEncoder().encode(JSON.stringify(definition))
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return { base64: btoa(binary), definition }
}

/** Inverse of `blobToBase64Definition`'s encoding; also decodes plain-ASCII base64 from other callers. */
export function base64ToDefinition(base64: string): WearableDefinition | EmoteDefinition {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** The emote among the base64 definitions, if any; the last one wins as in the Babylon config. */
export function findBase64Emote(base64s: string[]): EmoteDefinition | null {
  for (let index = base64s.length - 1; index >= 0; index--) {
    try {
      const definition = base64ToDefinition(base64s[index])
      if (isEmote(definition)) return definition
    } catch {
      // Malformed entries are the renderer's problem to report; they carry no emote for us.
    }
  }
  return null
}
