import { EmoteDefinition, EmoteWithBlobs, WearableDefinition, WearableWithBlobs } from '@dcl/schemas'
import { fromBlob } from '../config'

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
