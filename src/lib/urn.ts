export function isBodyShape(urn: string) {
  return (
    urn.startsWith('urn:decentraland:off-chain:base-avatars:') &&
    (urn.endsWith('BaseMale') || urn.endsWith('BaseFemale'))
  )
}
