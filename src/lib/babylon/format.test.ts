import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBinaryGltf, loadWithGltfFallback } from './format'

const GLB_HEADER = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00])
const GLTF_HEADER = new TextEncoder().encode('{"asset":{"version":"2.0"}}')

function respondWith(body: Uint8Array, status = 206) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('when checking whether a model file is a binary glTF', () => {
  it('should ask only for the first four bytes', async () => {
    respondWith(GLB_HEADER)
    await isBinaryGltf('https://example.com/model')
    expect(fetch).toHaveBeenCalledWith('https://example.com/model', { headers: { Range: 'bytes=0-3' } })
  })

  it('should answer true for a file that starts with the GLB magic', async () => {
    respondWith(GLB_HEADER)
    await expect(isBinaryGltf('https://example.com/model')).resolves.toBe(true)
  })

  it('should answer false for a JSON glTF', async () => {
    respondWith(GLTF_HEADER)
    await expect(isBinaryGltf('https://example.com/model')).resolves.toBe(false)
  })

  it('should answer false for a file shorter than the magic', async () => {
    respondWith(new Uint8Array([0x67, 0x6c]))
    await expect(isBinaryGltf('https://example.com/model')).resolves.toBe(false)
  })

  it('should answer false when the server refuses the request', async () => {
    respondWith(new Uint8Array(), 404)
    await expect(isBinaryGltf('https://example.com/model')).resolves.toBe(false)
  })

  it('should answer false when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(isBinaryGltf('https://example.com/model')).resolves.toBe(false)
  })
})

describe('when loading a model with the glTF fallback', () => {
  describe('and it loads as GLB', () => {
    it('should not try glTF', async () => {
      const load = vi.fn().mockResolvedValue('container')
      await expect(loadWithGltfFallback('https://example.com/model', load)).resolves.toBe('container')
      expect(load).toHaveBeenCalledTimes(1)
      expect(load).toHaveBeenCalledWith('https://example.com/model', '.glb')
    })
  })

  describe('and the GLB load fails on a file that is a GLB', () => {
    it('should rethrow the GLB error instead of parsing the binary as glTF', async () => {
      respondWith(GLB_HEADER)
      const glbError = new Error('Unable to load assets from https://example.com/model')
      const load = vi.fn().mockRejectedValueOnce(glbError)

      await expect(loadWithGltfFallback('https://example.com/model', load)).rejects.toBe(glbError)
      expect(load).not.toHaveBeenCalledWith('https://example.com/model', '.gltf')
    })
  })

  describe('and the GLB load fails on a file that is not a GLB', () => {
    it('should load it as glTF', async () => {
      respondWith(GLTF_HEADER)
      const load = vi.fn().mockRejectedValueOnce(new Error('Unexpected magic')).mockResolvedValueOnce('container')

      await expect(loadWithGltfFallback('https://example.com/model', load)).resolves.toBe('container')
      expect(load).toHaveBeenLastCalledWith('https://example.com/model', '.gltf')
    })
  })
})
