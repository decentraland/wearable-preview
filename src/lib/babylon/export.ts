import { Scene, Vector3 } from '@babylonjs/core'
import { GLTF2Export } from '@babylonjs/serializers/glTF'

// Maps DCL avatar bone names to VRM 0.x humanoid bone names
const DCL_TO_VRM_HUMANOID: Record<string, string> = {
  Avatar_Hips: 'hips',
  Avatar_Spine: 'spine',
  Avatar_Spine1: 'chest',
  Avatar_Spine2: 'upperChest',
  Avatar_Neck: 'neck',
  Avatar_Head: 'head',
  Avatar_LeftShoulder: 'leftShoulder',
  Avatar_LeftArm: 'leftUpperArm',
  Avatar_LeftForeArm: 'leftLowerArm',
  Avatar_LeftHand: 'leftHand',
  Avatar_RightShoulder: 'rightShoulder',
  Avatar_RightArm: 'rightUpperArm',
  Avatar_RightForeArm: 'rightLowerArm',
  Avatar_RightHand: 'rightHand',
  Avatar_LeftUpLeg: 'leftUpperLeg',
  Avatar_LeftLeg: 'leftLowerLeg',
  Avatar_LeftFoot: 'leftFoot',
  Avatar_LeftToeBase: 'leftToes',
  Avatar_RightUpLeg: 'rightUpperLeg',
  Avatar_RightLeg: 'rightLowerLeg',
  Avatar_RightFoot: 'rightFoot',
  Avatar_RightToeBase: 'rightToes',
  Avatar_LeftHandThumb1: 'leftThumbProximal',
  Avatar_LeftHandThumb2: 'leftThumbIntermediate',
  Avatar_LeftHandThumb3: 'leftThumbDistal',
  Avatar_LeftHandIndex1: 'leftIndexProximal',
  Avatar_LeftHandIndex2: 'leftIndexIntermediate',
  Avatar_LeftHandIndex3: 'leftIndexDistal',
  Avatar_LeftHandMiddle1: 'leftMiddleProximal',
  Avatar_LeftHandMiddle2: 'leftMiddleIntermediate',
  Avatar_LeftHandMiddle3: 'leftMiddleDistal',
  Avatar_LeftHandRing1: 'leftRingProximal',
  Avatar_LeftHandRing2: 'leftRingIntermediate',
  Avatar_LeftHandRing3: 'leftRingDistal',
  Avatar_LeftHandPinky1: 'leftLittleProximal',
  Avatar_LeftHandPinky2: 'leftLittleIntermediate',
  Avatar_LeftHandPinky3: 'leftLittleDistal',
  Avatar_RightHandThumb1: 'rightThumbProximal',
  Avatar_RightHandThumb2: 'rightThumbIntermediate',
  Avatar_RightHandThumb3: 'rightThumbDistal',
  Avatar_RightHandIndex1: 'rightIndexProximal',
  Avatar_RightHandIndex2: 'rightIndexIntermediate',
  Avatar_RightHandIndex3: 'rightIndexDistal',
  Avatar_RightHandMiddle1: 'rightMiddleProximal',
  Avatar_RightHandMiddle2: 'rightMiddleIntermediate',
  Avatar_RightHandMiddle3: 'rightMiddleDistal',
  Avatar_RightHandRing1: 'rightRingProximal',
  Avatar_RightHandRing2: 'rightRingIntermediate',
  Avatar_RightHandRing3: 'rightRingDistal',
  Avatar_RightHandPinky1: 'rightLittleProximal',
  Avatar_RightHandPinky2: 'rightLittleIntermediate',
  Avatar_RightHandPinky3: 'rightLittleDistal',
}

function readGLBChunks(buffer: ArrayBuffer): { json: any; binChunk: ArrayBuffer | null } {
  const view = new DataView(buffer)
  const jsonChunkLength = view.getUint32(12, true)
  const jsonBytes = new Uint8Array(buffer, 20, jsonChunkLength)
  const json = JSON.parse(new TextDecoder().decode(jsonBytes))

  let binChunk: ArrayBuffer | null = null
  const binOffset = 20 + jsonChunkLength
  if (binOffset + 8 <= buffer.byteLength) {
    const binLength = view.getUint32(binOffset, true)
    binChunk = buffer.slice(binOffset + 8, binOffset + 8 + binLength)
  }

  return { json, binChunk }
}

function packGLB(json: any, binChunk: ArrayBuffer | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonPaddedLength = Math.ceil(jsonBytes.length / 4) * 4
  const binPaddedLength = binChunk ? Math.ceil(binChunk.byteLength / 4) * 4 : 0
  const totalLength = 12 + 8 + jsonPaddedLength + (binChunk ? 8 + binPaddedLength : 0)

  const result = new ArrayBuffer(totalLength)
  const view = new DataView(result)
  const uint8 = new Uint8Array(result)

  view.setUint32(0, 0x46546c67, true) // "glTF"
  view.setUint32(4, 2, true)
  view.setUint32(8, totalLength, true)

  const jsonPadded = new Uint8Array(jsonPaddedLength).fill(0x20) // pad with spaces
  jsonPadded.set(jsonBytes)
  view.setUint32(12, jsonPaddedLength, true)
  view.setUint32(16, 0x4e4f534a, true) // "JSON"
  uint8.set(jsonPadded, 20)

  if (binChunk) {
    const binOffset = 20 + jsonPaddedLength
    const binPadded = new Uint8Array(binPaddedLength)
    binPadded.set(new Uint8Array(binChunk))
    view.setUint32(binOffset, binPaddedLength, true)
    view.setUint32(binOffset + 4, 0x004e4942, true) // "BIN\0"
    uint8.set(binPadded, binOffset + 8)
  }

  return result
}

function injectVRMExtension(json: any): void {
  const seenVrmBones = new Set<string>()
  const humanBones: Array<{ bone: string; node: number; useDefaultValues: boolean }> = []

  if (json.nodes) {
    ;(json.nodes as Array<{ name?: string }>).forEach((node, index) => {
      if (!node.name) return
      const vrmBone = DCL_TO_VRM_HUMANOID[node.name]
      // Use first occurrence of each bone (body-shape skeleton wins over wearable duplicates)
      if (vrmBone && !seenVrmBones.has(vrmBone)) {
        seenVrmBones.add(vrmBone)
        humanBones.push({ bone: vrmBone, node: index, useDefaultValues: true })
      }
    })
  }

  if (!json.extensionsUsed) json.extensionsUsed = []
  if (!json.extensionsUsed.includes('VRM')) json.extensionsUsed.push('VRM')
  if (!json.extensions) json.extensions = {}

  json.extensions.VRM = {
    exporterVersion: 'decentraland-wearable-preview',
    specVersion: '0.0',
    meta: {
      title: 'Decentraland Avatar',
      version: '1.0',
      author: '',
      contactInformation: '',
      reference: '',
      allowedUserName: 'Everyone',
      violentUssageName: 'Disallow',
      sexualUssageName: 'Disallow',
      commercialUssageName: 'Allow',
      licenseName: 'CC_BY',
      otherLicenseUrl: '',
    },
    humanoid: {
      humanBones,
      armStretch: 0.05,
      legStretch: 0.05,
      upperArmTwist: 0.5,
      lowerArmTwist: 0.5,
      upperLegTwist: 0.5,
      lowerLegTwist: 0.5,
      feetSpacing: 0,
      hasTranslationDoF: false,
    },
    firstPerson: {
      firstPersonBone: -1,
      firstPersonBoneOffset: { x: 0, y: 0, z: 0 },
      meshAnnotations: [],
      lookAtTypeName: 'Bone',
      lookAtHorizontalInner: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 8 },
      lookAtHorizontalOuter: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 12 },
      lookAtVerticalDown: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
      lookAtVerticalUp: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 15 },
    },
    blendShapeMaster: { blendShapeGroups: [] },
    secondaryAnimation: { boneGroups: [], colliderGroups: [] },
    materialProperties: [],
  }
}

export async function exportVRM(scene: Scene): Promise<Blob> {
  // Temporarily undo the centering transform so the avatar exports at original scale
  const parentMesh = scene.getMeshByName('parent')
  let savedScale: Vector3 | null = null
  let savedPosition: Vector3 | null = null
  if (parentMesh) {
    savedScale = parentMesh.scaling.clone()
    savedPosition = parentMesh.position.clone()
    parentMesh.scaling.copyFromFloats(1, 1, 1)
    parentMesh.position.copyFromFloats(0, 0, 0)
  }

  try {
    const glbData = await GLTF2Export.GLBAsync(scene, 'avatar', {
      shouldExportNode: (node) => {
        if (node.name === 'parent_other') return false
        if (node.name.endsWith('_Other')) return false
        if ('isEnabled' in node && typeof node.isEnabled === 'function' && !node.isEnabled()) return false
        return true
      },
    })

    const glbBlob = glbData.glTFFiles['avatar.glb'] as Blob
    const buffer = await glbBlob.arrayBuffer()
    const { json, binChunk } = readGLBChunks(buffer)

    injectVRMExtension(json)

    return new Blob([packGLB(json, binChunk)], { type: 'application/octet-stream' })
  } finally {
    if (parentMesh && savedScale && savedPosition) {
      parentMesh.scaling.copyFrom(savedScale)
      parentMesh.position.copyFrom(savedPosition)
    }
  }
}
