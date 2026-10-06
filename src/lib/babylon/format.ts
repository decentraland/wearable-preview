/** The first four bytes of every binary glTF (GLB) file: the ASCII string "glTF". */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]

/**
 * Whether the file at `url` is a binary glTF, judged by its first four bytes. It asks for just those bytes and
 * stops reading after them. Any failure (network, CORS, an unreadable body) answers `false`, so callers keep
 * the behaviour they had before they could tell.
 */
export async function isBinaryGltf(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-3' } })
    if (!response.ok || !response.body) {
      await response.body?.cancel()
      return false
    }

    const reader = response.body.getReader()
    const header = new Uint8Array(GLB_MAGIC.length)
    let filled = 0
    while (filled < header.length) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const length = Math.min(header.length - filled, value.length)
      header.set(value.subarray(0, length), filled)
      filled += length
    }
    await reader.cancel()

    return filled === header.length && GLB_MAGIC.every((byte, index) => header[index] === byte)
  } catch {
    return false
  }
}

/**
 * Loads a model as GLB and, if that fails, as glTF. The glTF retry is skipped when the file is a GLB: Babylon's
 * glTF loader would `JSON.parse` the binary inside its request callback, which throws an uncaught
 * `SyntaxError: Unexpected token 'g', "glTF..." is not valid JSON` instead of rejecting, and hides why the GLB
 * failed. In that case the GLB error is rethrown as is.
 */
export async function loadWithGltfFallback<T>(
  url: string,
  load: (url: string, extension: '.glb' | '.gltf') => Promise<T>,
): Promise<T> {
  try {
    return await load(url, '.glb')
  } catch (glbError) {
    if (await isBinaryGltf(url)) {
      throw glbError
    }
    return load(url, '.gltf')
  }
}
