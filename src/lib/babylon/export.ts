import { AbstractMesh, Bone, Matrix, Quaternion, Scene, Skeleton, TransformNode, Vector3 } from '@babylonjs/core'
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

/**
 * Bakes the current visible pose (whatever the live preview shows) as the new
 * bind pose of the exported glTF. Without this, the .vrm encodes the rig's
 * authored bind pose (fingers spread, Mixamo-style feet) — which is what most
 * VRM viewers render when no animation is applied.
 *
 * For each bone in the skin, overwrites:
 *   - the node's TRS with the bone's current local matrix
 *   - the inverseBindMatrices accessor entry with inverse(current absolute)
 *
 * Math sanity-check: at viewer rest, jointWorld_i × IBM_i must equal identity
 * so the mesh renders at its mesh-local vertex positions. Since we set
 *   node_i.TRS = bone_i.localMatrix → jointWorld_i = bone_i.absoluteMatrix
 *   IBM_i = inverse(bone_i.absoluteMatrix)
 * the product is identity by construction.
 */
function rebakeBindPose(
  json: any,
  binChunk: ArrayBuffer | null,
  snapshotByName: Map<string, { local: Matrix; absolute: Matrix }>,
): void {
  if (!binChunk || !json.skins || !json.nodes || !json.accessors || !json.bufferViews) return

  // 1) Overwrite each bone-node's TRS with the snapshot's local matrix.
  const boneNodeIndices = new Set<number>()
  for (const skin of json.skins) {
    for (const idx of skin.joints) boneNodeIndices.add(idx)
  }

  const tmpScale = new Vector3()
  const tmpRotation = new Quaternion()
  const tmpTranslation = new Vector3()
  for (const idx of boneNodeIndices) {
    const node = json.nodes[idx]
    if (!node?.name) continue
    const snap = snapshotByName.get(node.name)
    if (!snap) continue

    snap.local.decompose(tmpScale, tmpRotation, tmpTranslation)
    node.translation = tmpTranslation.asArray()
    node.rotation = tmpRotation.asArray()
    node.scale = tmpScale.asArray()
    delete node.matrix
  }

  // 2) Overwrite each skin's inverseBindMatrices in-place. The accessor's data
  //    is Float32 column-major 4x4 matrices packed back-to-back in the binary
  //    chunk; we mutate via a Float32Array view over the underlying buffer.
  for (const skin of json.skins) {
    if (skin.inverseBindMatrices === undefined) continue
    const accessor = json.accessors[skin.inverseBindMatrices]
    if (!accessor || accessor.bufferView === undefined) continue
    const bufferView = json.bufferViews[accessor.bufferView]
    if (!bufferView) continue
    const totalOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0)
    if (totalOffset % 4 !== 0) continue

    const ibmView = new Float32Array(binChunk, totalOffset, skin.joints.length * 16)
    for (let i = 0; i < skin.joints.length; i++) {
      const jointNode = json.nodes[skin.joints[i]]
      const snap = jointNode?.name ? snapshotByName.get(jointNode.name) : undefined
      if (!snap) continue
      Matrix.Invert(snap.absolute).copyToArray(ibmView, i * 16)
    }
  }
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

/**
 * Wraps all top-level scene nodes in a new "VRMRoot" node with a corrective
 * rotation. This is applied AFTER Babylon's serializer has done its handedness
 * conversion, so it's purely additive — we're not fighting the serializer,
 * just rotating the final result.
 *
 * VRM 0.x convention: avatar standing upright (Y-up), facing +Z.
 * If the exported avatar comes out upside-down or mirrored, adjust the
 * quaternion below empirically.
 */
function applyOrientationFix(json: any): void {
  if (!json.nodes || !json.scenes || json.scenes.length === 0) return

  // 180° rotation around Y so the avatar faces the camera (+Z), matching the
  // VRM 0.x facing convention. Babylon exports the avatar facing -Z by default.
  const correctionRotation = [0, 1, 0, 0]

  // Lift the avatar so feet sit on the viewer's ground plane. Tune if needed —
  // some viewers place their grid at chest/head height instead of Y=0.
  const correctionTranslation = [0, 1.8, 0]

  const scene = json.scenes[0]
  const originalRootIndices = [...scene.nodes]

  // Create the new wrapper node
  const wrapperIndex = json.nodes.length
  json.nodes.push({
    name: 'VRMRoot',
    rotation: correctionRotation,
    translation: correctionTranslation,
    children: originalRootIndices,
  })

  // Replace scene roots with just the wrapper
  scene.nodes = [wrapperIndex]
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
  console.group('[VRM EXPORT DEBUG]')
  console.log('Scene handedness:', scene.useRightHandedSystem ? 'right' : 'left')

  const fmt = (arr: ArrayLike<number> | undefined) =>
    arr ? JSON.stringify(Array.from(arr).map((v) => +v.toFixed(4))) : 'undefined'

  const allRoots = scene.transformNodes.filter((n: TransformNode) => n.name === '__root__')
  console.log(`Found ${allRoots.length} __root__ node(s):`)
  allRoots.forEach((r: TransformNode, i: number) => {
    console.log(
      `  __root__[${i}]  scaling=${fmt(r.scaling.asArray())}  pos=${fmt(r.position.asArray())}  rot=${fmt(
        r.rotationQuaternion?.asArray() ?? r.rotation.asArray(),
      )}  parent=${r.parent?.name ?? '(scene root)'}  children=${r.getChildren().length}`,
    )
  })

  const debugParent = scene.getMeshByName('parent')
  if (debugParent) {
    console.log(
      `parent mesh: scaling=${fmt(debugParent.scaling.asArray())}  pos=${fmt(
        debugParent.position.asArray(),
      )}  rot=${fmt(
        debugParent.rotationQuaternion?.asArray() ?? debugParent.rotation.asArray(),
      )}  parent=${debugParent.parent?.name ?? '(scene root)'}  absPos=${fmt(
        debugParent.getAbsolutePosition().asArray(),
      )}`,
    )
  }

  console.log(
    'Top-level transform nodes:',
    scene.transformNodes.filter((n: TransformNode) => !n.parent).map((n: TransformNode) => n.name),
  )
  console.log(
    'Top-level meshes:',
    scene.meshes.filter((m: AbstractMesh) => !m.parent).map((m: AbstractMesh) => m.name),
  )

  const probeBones = ['Avatar_Hips', 'Avatar_LeftHand', 'Avatar_RightHand', 'Avatar_LeftFoot', 'Avatar_RightFoot']
  scene.skeletons.forEach((skel: Skeleton, i: number) => {
    console.log(`Skeleton[${i}] "${skel.name}" bones=${skel.bones.length}`)
    probeBones.forEach((name) => {
      const bone = skel.bones.find((b: Bone) => b.name === name)
      console.log(`  ${name} absolute=${fmt(bone?.getAbsoluteTransform().toArray())}`)
    })
  })
  console.groupEnd()

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

  // Babylon's GLTF2Export mutates bone matrices during serialization (snaps to
  // bind pose, etc.) and does NOT restore them. Snapshot BOTH the bone's base
  // matrix (rest pose) AND its local matrix (current animated state) — they're
  // different in Babylon 4.2 and the serializer touches the local one.
  const boneSnapshots = scene.skeletons.flatMap((skel: Skeleton) =>
    skel.bones.map((bone: Bone) => ({
      bone,
      base: bone.getBaseMatrix().clone(),
      local: bone.getLocalMatrix().clone(),
      absolute: bone.getAbsoluteTransform().clone(),
    })),
  )

  // First-occurrence by name — matches mergeSkeletons's deduplication policy,
  // so rebakeBindPose uses the bone snapshot for the same node mergeSkeletons
  // ends up pointing each skin's joint to.
  const snapshotByName = new Map<string, (typeof boneSnapshots)[number]>()
  for (const snap of boneSnapshots) {
    if (!snapshotByName.has(snap.bone.name)) {
      snapshotByName.set(snap.bone.name, snap)
    }
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

    rebakeBindPose(json, binChunk, snapshotByName)
    mergeSkeletons(json)
    applyOrientationFix(json)
    injectVRMExtension(json)

    return new Blob([packGLB(json, binChunk)], { type: 'application/octet-stream' })
  } finally {
    for (const { bone, base, local } of boneSnapshots) {
      // updateMatrix writes into both _baseMatrix and _localMatrix, marks the
      // bone dirty, and recomputes the difference matrix in one call.
      bone.updateMatrix(base, true, true)
      // Then overwrite the local matrix with the actual saved animated state
      // (updateMatrix sets local = base, which would lose any animation pose).
      bone.getLocalMatrix().copyFrom(local)
      bone.markAsDirty()
    }
    scene.skeletons.forEach((skel: Skeleton) => skel.computeAbsoluteTransforms())

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
