import { afterEach, describe, expect, it } from 'vitest'
import { applyUnityBackFaceCulling, isUnityBackFaceCullingEnabled } from './culling'

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}

afterEach(() => setSearch(''))

// Only backFaceCulling is touched, so a stand-in keeps these off a WebGL context.
const fakeMaterial = (backFaceCulling: boolean) => ({ backFaceCulling }) as any

describe('applyUnityBackFaceCulling', () => {
  it('overrides the glTF doubleSided flag, which Babylon maps to backFaceCulling=false', () => {
    const material = fakeMaterial(false)

    applyUnityBackFaceCulling(material)

    expect(material.backFaceCulling).toBe(true)
  })

  it('leaves already-culled materials alone', () => {
    const material = fakeMaterial(true)

    applyUnityBackFaceCulling(material)

    expect(material.backFaceCulling).toBe(true)
  })
})

describe('the culling=none escape hatch', () => {
  it('is off by default, so wearables match Unity', () => {
    expect(isUnityBackFaceCullingEnabled()).toBe(true)
  })

  it('restores the glTF doubleSided behaviour', () => {
    setSearch('?culling=none')
    const material = fakeMaterial(false)

    applyUnityBackFaceCulling(material)

    expect(isUnityBackFaceCullingEnabled()).toBe(false)
    expect(material.backFaceCulling).toBe(false)
  })

  it('is independent of the tonemapping switch', () => {
    setSearch('?toneMapping=none')
    expect(isUnityBackFaceCullingEnabled()).toBe(true)
  })
})
