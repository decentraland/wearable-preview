import { AbstractMesh, Quaternion, Scene, Vector3 } from '@babylonjs/core'
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

function mat4FromTRS(t?: number[], r?: number[], s?: number[]): Float64Array {
  const tx = t?.[0] ?? 0, ty = t?.[1] ?? 0, tz = t?.[2] ?? 0
  const qx = r?.[0] ?? 0, qy = r?.[1] ?? 0, qz = r?.[2] ?? 0, qw = r?.[3] ?? 1
  const sx = s?.[0] ?? 1, sy = s?.[1] ?? 1, sz = s?.[2] ?? 1
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz
  const xx = qx * x2, xy = qx * y2, xz = qx * z2
  const yy = qy * y2, yz = qy * z2, zz = qz * z2
  const wx = qw * x2, wy = qw * y2, wz = qw * z2
  const m = new Float64Array(16)
  m[0] = (1 - yy - zz) * sx; m[1] = (xy + wz) * sx; m[2] = (xz - wy) * sx; m[3] = 0
  m[4] = (xy - wz) * sy; m[5] = (1 - xx - zz) * sy; m[6] = (yz + wx) * sy; m[7] = 0
  m[8] = (xz + wy) * sz; m[9] = (yz - wx) * sz; m[10] = (1 - xx - yy) * sz; m[11] = 0
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1
  return m
}

function mat4Multiply(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3]
    }
  }
  return out
}

function mat4Invert(m: Float64Array): Float64Array {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3]
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7]
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11]
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15]
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (Math.abs(det) < 1e-10) {
    const id = new Float64Array(16)
    id[0] = id[5] = id[10] = id[15] = 1
    return id
  }
  det = 1.0 / det
  const out = new Float64Array(16)
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det
  return out
}

function negateAccessorComponent(json: any, binChunk: ArrayBuffer, accessorIdx: number, componentIdx: number): void {
  const accessor = json.accessors[accessorIdx]
  if (accessor.componentType !== 5126) return
  const bufferView = json.bufferViews[accessor.bufferView]
  const baseOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0)
  const numComponents = accessor.type === 'VEC2' ? 2 : accessor.type === 'VEC3' ? 3 : accessor.type === 'VEC4' ? 4 : 0
  if (componentIdx >= numComponents) return
  const componentSize = 4
  const stride = bufferView.byteStride || (numComponents * componentSize)
  const view = new DataView(binChunk)
  for (let i = 0; i < accessor.count; i++) {
    const offset = baseOffset + i * stride + componentIdx * componentSize
    view.setFloat32(offset, -view.getFloat32(offset, true), true)
  }
}

function undoVertexConversion(json: any, binChunk: ArrayBuffer): void {
  if (!json.nodes || !json.meshes || !json.accessors || !json.bufferViews) return
  const skinnedMeshIndices = new Set<number>()
  for (const node of json.nodes) {
    if (node.mesh !== undefined && node.skin !== undefined) {
      skinnedMeshIndices.add(node.mesh)
    }
  }
  for (const meshIdx of Array.from(skinnedMeshIndices)) {
    const mesh = json.meshes[meshIdx]
    for (const prim of mesh.primitives || []) {
      for (const attr of ['POSITION', 'NORMAL', 'TANGENT']) {
        if (prim.attributes?.[attr] !== undefined) {
          negateAccessorComponent(json, binChunk, prim.attributes[attr], 2)
        }
      }
    }
  }
}

function resetSkinnedMeshTransforms(json: any): void {
  if (!json.nodes) return
  for (const node of json.nodes) {
    if (node.mesh !== undefined && node.skin !== undefined) {
      delete node.translation
      delete node.rotation
      delete node.scale
      delete node.matrix
    }
  }
}

function rewriteInverseBindMatrices(json: any, binChunk: ArrayBuffer | null): ArrayBuffer | null {
  if (!json.skins || !json.nodes) return binChunk

  const parentMap = new Map<number, number>()
  for (let i = 0; i < json.nodes.length; i++) {
    const children = json.nodes[i].children
    if (children) {
      for (const c of children) parentMap.set(c, i)
    }
  }

  function getWorldMatrix(nodeIdx: number): Float64Array {
    const chain: number[] = []
    let idx: number | undefined = nodeIdx
    while (idx !== undefined) {
      chain.push(idx)
      idx = parentMap.get(idx)
    }
    chain.reverse()
    let world = new Float64Array(16)
    world[0] = world[5] = world[10] = world[15] = 1
    for (const i of chain) {
      const node = json.nodes[i]
      const local = node.matrix
        ? Float64Array.from(node.matrix)
        : mat4FromTRS(node.translation, node.rotation, node.scale)
      world = mat4Multiply(world, local)
    }
    return world
  }

  const skinIBMData: Float32Array[] = []
  for (const skin of json.skins) {
    const joints: number[] = skin.joints
    const floats = new Float32Array(joints.length * 16)
    for (let j = 0; j < joints.length; j++) {
      const inv = mat4Invert(getWorldMatrix(joints[j]))
      for (let k = 0; k < 16; k++) floats[j * 16 + k] = inv[k]
    }
    skinIBMData.push(floats)
  }

  const originalSize = binChunk?.byteLength ?? 0
  const alignedOriginal = Math.ceil(originalSize / 4) * 4
  let totalExtra = 0
  for (const d of skinIBMData) totalExtra += d.byteLength
  const newBin = new ArrayBuffer(alignedOriginal + totalExtra)
  const newUint8 = new Uint8Array(newBin)
  if (binChunk) newUint8.set(new Uint8Array(binChunk))

  if (!json.bufferViews) json.bufferViews = []
  if (!json.accessors) json.accessors = []

  let offset = alignedOriginal
  for (let s = 0; s < json.skins.length; s++) {
    const ibm = skinIBMData[s]
    newUint8.set(new Uint8Array(ibm.buffer, ibm.byteOffset, ibm.byteLength), offset)

    const bvIdx = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: ibm.byteLength })

    const accIdx = json.accessors.length
    json.accessors.push({ bufferView: bvIdx, componentType: 5126, count: json.skins[s].joints.length, type: 'MAT4' })

    json.skins[s].inverseBindMatrices = accIdx
    offset += ibm.byteLength
  }

  if (json.buffers?.[0]) json.buffers[0].byteLength = newBin.byteLength
  return newBin
}

function mergeSkeletons(json: any): void {
  if (!json.skins || json.skins.length <= 1 || !json.nodes) return

  const nameToFirstIndex = new Map<string, number>()
  for (let i = 0; i < json.nodes.length; i++) {
    const name = json.nodes[i].name
    if (name && !nameToFirstIndex.has(name)) {
      nameToFirstIndex.set(name, i)
    }
  }

  for (const skin of json.skins) {
    skin.joints = skin.joints.map((jointIdx: number) => {
      const name = json.nodes[jointIdx]?.name
      if (name) {
        const firstIdx = nameToFirstIndex.get(name)
        if (firstIdx !== undefined) return firstIdx
      }
      return jointIdx
    })
    if (skin.skeleton !== undefined) {
      const skelName = json.nodes[skin.skeleton]?.name
      if (skelName) {
        const firstIdx = nameToFirstIndex.get(skelName)
        if (firstIdx !== undefined) skin.skeleton = firstIdx
      }
    }
  }
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
  const parentMesh = scene.getMeshByName('parent')

  const saved = parentMesh
    ? {
        scaling: parentMesh.scaling.clone(),
        position: parentMesh.position.clone(),
        rotationQuaternion: parentMesh.rotationQuaternion?.clone() ?? null,
        rotation: parentMesh.rotation.clone(),
      }
    : null

  if (parentMesh) {
    parentMesh.scaling.copyFromFloats(1, 1, 1)
    parentMesh.position.copyFromFloats(0, 0, 0)
    if (parentMesh.rotationQuaternion) {
      parentMesh.rotationQuaternion.copyFrom(Quaternion.Identity())
    } else {
      parentMesh.rotation.copyFromFloats(0, 0, 0)
    }
    parentMesh.computeWorldMatrix(true)
  }

  try {
    const glbData = await GLTF2Export.GLBAsync(scene, 'avatar', {
      shouldExportNode: (node) => {
        if (node.name === 'parent_other') return false
        if (node.name.endsWith('_Other')) return false
        if (node instanceof AbstractMesh && !node.isEnabled(false)) return false
        return true
      },
    })

    const glbBlob = glbData.glTFFiles['avatar.glb'] as Blob
    const buffer = await glbBlob.arrayBuffer()
    const { json, binChunk } = readGLBChunks(buffer)

    mergeSkeletons(json)
    const fixedBin = rewriteInverseBindMatrices(json, binChunk)
    if (fixedBin) {
      undoVertexConversion(json, fixedBin)
    }
    resetSkinnedMeshTransforms(json)
    injectVRMExtension(json)

    return new Blob([packGLB(json, fixedBin)], { type: 'application/octet-stream' })
  } finally {
    if (parentMesh && saved) {
      parentMesh.scaling.copyFrom(saved.scaling)
      parentMesh.position.copyFrom(saved.position)
      if (saved.rotationQuaternion && parentMesh.rotationQuaternion) {
        parentMesh.rotationQuaternion.copyFrom(saved.rotationQuaternion)
      } else {
        parentMesh.rotation.copyFrom(saved.rotation)
      }
      parentMesh.computeWorldMatrix(true)
    }
  }
}
