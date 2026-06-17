import { AbstractMesh, Bone, Matrix, Quaternion, Scene, Skeleton, TransformNode, Vector3 } from '@babylonjs/core'
import { GLTF2Export } from '@babylonjs/serializers/glTF'

// Maps DCL avatar bone names to VRM 0.x humanoid bone names.
//
// IMPORTANT: DCL's rig uses an opposite handedness convention from VRM 0.x —
// Avatar_LeftArm sits at world +X, whereas VRM 0.x expects the leftUpperArm to
// be at -X (avatar faces +Z, its own left side is -X). To make VRM animations
// apply to the correct side of the body, we map each DCL "Left" bone to the
// VRM "right" slot, and vice versa. The bone names look misleading but the
// rotation directions end up correct in any compliant VRM viewer.
const DCL_TO_VRM_HUMANOID: Record<string, string> = {
  Avatar_Hips: 'hips',
  Avatar_Spine: 'spine',
  Avatar_Spine1: 'chest',
  Avatar_Spine2: 'upperChest',
  Avatar_Neck: 'neck',
  Avatar_Head: 'head',
  Avatar_LeftShoulder: 'rightShoulder',
  Avatar_LeftArm: 'rightUpperArm',
  Avatar_LeftForeArm: 'rightLowerArm',
  Avatar_LeftHand: 'rightHand',
  Avatar_RightShoulder: 'leftShoulder',
  Avatar_RightArm: 'leftUpperArm',
  Avatar_RightForeArm: 'leftLowerArm',
  Avatar_RightHand: 'leftHand',
  Avatar_LeftUpLeg: 'rightUpperLeg',
  Avatar_LeftLeg: 'rightLowerLeg',
  Avatar_LeftFoot: 'rightFoot',
  Avatar_LeftToeBase: 'rightToes',
  Avatar_RightUpLeg: 'leftUpperLeg',
  Avatar_RightLeg: 'leftLowerLeg',
  Avatar_RightFoot: 'leftFoot',
  Avatar_RightToeBase: 'leftToes',
  Avatar_LeftHandThumb1: 'rightThumbProximal',
  Avatar_LeftHandThumb2: 'rightThumbIntermediate',
  Avatar_LeftHandThumb3: 'rightThumbDistal',
  Avatar_LeftHandIndex1: 'rightIndexProximal',
  Avatar_LeftHandIndex2: 'rightIndexIntermediate',
  Avatar_LeftHandIndex3: 'rightIndexDistal',
  Avatar_LeftHandMiddle1: 'rightMiddleProximal',
  Avatar_LeftHandMiddle2: 'rightMiddleIntermediate',
  Avatar_LeftHandMiddle3: 'rightMiddleDistal',
  Avatar_LeftHandRing1: 'rightRingProximal',
  Avatar_LeftHandRing2: 'rightRingIntermediate',
  Avatar_LeftHandRing3: 'rightRingDistal',
  Avatar_LeftHandPinky1: 'rightLittleProximal',
  Avatar_LeftHandPinky2: 'rightLittleIntermediate',
  Avatar_LeftHandPinky3: 'rightLittleDistal',
  Avatar_RightHandThumb1: 'leftThumbProximal',
  Avatar_RightHandThumb2: 'leftThumbIntermediate',
  Avatar_RightHandThumb3: 'leftThumbDistal',
  Avatar_RightHandIndex1: 'leftIndexProximal',
  Avatar_RightHandIndex2: 'leftIndexIntermediate',
  Avatar_RightHandIndex3: 'leftIndexDistal',
  Avatar_RightHandMiddle1: 'leftMiddleProximal',
  Avatar_RightHandMiddle2: 'leftMiddleIntermediate',
  Avatar_RightHandMiddle3: 'leftMiddleDistal',
  Avatar_RightHandRing1: 'leftRingProximal',
  Avatar_RightHandRing2: 'leftRingIntermediate',
  Avatar_RightHandRing3: 'leftRingDistal',
  Avatar_RightHandPinky1: 'leftLittleProximal',
  Avatar_RightHandPinky2: 'leftLittleIntermediate',
  Avatar_RightHandPinky3: 'leftLittleDistal',
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
 * Rewrites bones into canonical form to match what well-behaved VRM exporters
 * (e.g. UniVRM) produce: each bone-node has identity rotation, identity scale,
 * and a parent-relative translation in world meters; each inverseBindMatrices
 * entry is the inverse of a pure translation matrix.
 *
 * The reference VRM we inspected had this layout exactly. DCL's rig comes out
 * of Babylon with weird non-canonical TRS (0.01 scale baked in, 180° rotations
 * on the basis vectors, translations at 100× meter scale). That layout renders
 * correctly at rest because the scale×rotation in jointWorld and the inverse
 * scale×rotation in IBM cancel out — but VRM animations rotate joints in their
 * local frame, so the baked rotations push arms backward, feet sideways, etc.
 *
 * Algorithm:
 *   1. For each bone, read its world position from snap.absolute.getTranslation()
 *      — Babylon stores skeleton-local positions there at meter scale.
 *   2. Set node.TRS = (worldPos − parentWorldPos, identity rotation, unit scale).
 *      Root bones (no bone parent) just use worldPos directly.
 *   3. Set IBM = inverse(translate(worldPos)) = translate(−worldPos).
 *
 * Math sanity-check: at rest, jointWorld_i is a chain of pure translations =
 * translate(worldPos_i); IBM_i = translate(−worldPos_i); product = identity, so
 * the mesh renders at its stored mesh-local vertex positions (which Babylon
 * also outputs at meter scale).
 */
function rebakeBindPose(
  json: any,
  binChunk: ArrayBuffer | null,
  snapshotByName: Map<string, { local: Matrix; absolute: Matrix }>,
  boneParentNameByName: Map<string, string | null>,
): void {
  if (!binChunk || !json.skins || !json.nodes || !json.accessors || !json.bufferViews) return

  // World position per bone, extracted from the (skeleton-local) absolute matrix.
  // We rely on the skeleton's owner mesh being at identity (parent mesh is reset
  // earlier in exportVRM), so skeleton-local equals world.
  const worldPosByName = new Map<string, Vector3>()
  for (const [name, snap] of snapshotByName) {
    worldPosByName.set(name, snap.absolute.getTranslation())
  }

  const boneNodeIndices = new Set<number>()
  for (const skin of json.skins) {
    for (const idx of skin.joints) boneNodeIndices.add(idx)
  }

  // 1) Canonical TRS per bone-node.
  for (const idx of boneNodeIndices) {
    const node = json.nodes[idx]
    if (!node?.name) continue
    const myWorldPos = worldPosByName.get(node.name)
    if (!myWorldPos) continue

    const parentName = boneParentNameByName.get(node.name)
    const parentWorldPos = parentName ? worldPosByName.get(parentName) : undefined
    const localPos = parentWorldPos ? myWorldPos.subtract(parentWorldPos) : myWorldPos

    node.translation = [localPos.x, localPos.y, localPos.z]
    node.rotation = [0, 0, 0, 1]
    node.scale = [1, 1, 1]
    delete node.matrix
  }

  // 2) IBMs = inverse pure translation. We mutate the accessor's Float32 view
  //    over the binary chunk in place — same layout we use to read GLB chunks.
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
      const worldPos = jointNode?.name ? worldPosByName.get(jointNode.name) : undefined
      if (!worldPos) {
        Matrix.Identity().copyToArray(ibmView, i * 16)
        continue
      }
      Matrix.Translation(-worldPos.x, -worldPos.y, -worldPos.z).copyToArray(ibmView, i * 16)
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
 * Restructures the glTF JSON to match the canonical layout that UniVRM (and
 * other clean exporters) produce:
 *   scene roots = [hips, meshes, secondary]
 * Avatar_Hips becomes a top-level skeleton root, all mesh nodes get grouped
 * under a transformless "meshes" container, and a "secondary" empty container
 * is added for VRM spring-bone secondary animations.
 *
 * Why this matters: Babylon's serializer wraps everything inside the original
 * scene meshes (`parent`, `top`, `bottom`) and adds a 180° Y rotation to them
 * for left→right handedness conversion. Combined with our canonical rebake
 * those wrappers leave the avatar at a position viewers don't auto-frame.
 * Flattening to the reference layout fixes positioning AND helps viewers
 * recognize the avatar as a standard humanoid VRM.
 */
function restructureForVrm(json: any): void {
  if (!json.skins || !json.nodes || !json.scenes || json.scenes.length === 0) return

  // Find Avatar_Hips — this becomes the new scene-root skeleton.
  let hipsIdx = -1
  for (let i = 0; i < json.nodes.length; i++) {
    if (json.nodes[i].name === 'Avatar_Hips') {
      hipsIdx = i
      break
    }
  }
  if (hipsIdx < 0) return

  // All mesh-bearing nodes — they get moved into the new "meshes" container.
  const meshNodeIndices: number[] = []
  for (let i = 0; i < json.nodes.length; i++) {
    if (json.nodes[i].mesh !== undefined) meshNodeIndices.push(i)
  }

  // Detach hips and mesh nodes from any current parent.
  const detached = new Set<number>([hipsIdx, ...meshNodeIndices])
  for (let i = 0; i < json.nodes.length; i++) {
    const node = json.nodes[i]
    if (node.children && node.children.length) {
      node.children = node.children.filter((c: number) => !detached.has(c))
      if (node.children.length === 0) delete node.children
    }
  }

  // Strip transforms from mesh nodes — skinned meshes ignore their own
  // transform per glTF spec, and the reference VRM leaves them unset.
  for (const m of meshNodeIndices) {
    delete json.nodes[m].translation
    delete json.nodes[m].rotation
    delete json.nodes[m].scale
    delete json.nodes[m].matrix
  }

  // Create the two extra scene roots.
  const meshesIdx = json.nodes.length
  json.nodes.push({ name: 'meshes', children: meshNodeIndices })
  const secondaryIdx = json.nodes.length
  json.nodes.push({ name: 'secondary' })

  // New scene roots: hips, meshes, secondary (mirrors juanma reference exactly).
  json.scenes[0].nodes = [hipsIdx, meshesIdx, secondaryIdx]

  // Point every skin's skeleton at the new hips root.
  for (const skin of json.skins) {
    if (skin.skeleton !== undefined) skin.skeleton = hipsIdx
  }
}

/**
 * Removes any embedded animations from the glTF. Babylon's serializer often
 * includes the avatar's current animation track, but our mergeSkeletons remaps
 * joint indices and leaves animation channels pointing at the original nodes —
 * UniVRM and UniGLTF then crash with IndexOutOfRangeException on import.
 *
 * The VRM is meant as a static rig that animation hosts (VMagicMirror,
 * VSeeFace, Unity etc) drive with their own motion data, so dropping the
 * embedded animations is the correct choice and matches the juanma reference,
 * which ships with no animations either.
 */
function stripAnimations(json: any): void {
  if (json.animations) delete json.animations
}

/**
 * Tags every material as KHR_materials_unlit so VRM viewers render the avatar
 * with the flat / cartoon look DCL uses, instead of PBR metallic shading.
 * Matches the juanma reference, which also marks every material as unlit.
 */
function applyUnlitMaterials(json: any): void {
  if (!Array.isArray(json.materials) || json.materials.length === 0) return

  if (!json.extensionsUsed) json.extensionsUsed = []
  if (!json.extensionsUsed.includes('KHR_materials_unlit')) {
    json.extensionsUsed.push('KHR_materials_unlit')
  }

  for (const mat of json.materials) {
    if (!mat.extensions) mat.extensions = {}
    if (!mat.extensions.KHR_materials_unlit) mat.extensions.KHR_materials_unlit = {}
    // Unlit materials should not contribute metallic/roughness — zero them out.
    if (mat.pbrMetallicRoughness) {
      mat.pbrMetallicRoughness.metallicFactor = 0
      mat.pbrMetallicRoughness.roughnessFactor = 0.9
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

/**
 * Babylon 4.2's glTF serializer derives each exported image's identity from the
 * Babylon texture's `name`. When two DISTINCT textures share a name, the second
 * one's glTF texture entry is silently aliased to the FIRST one's image:
 * glTFMaterialExporter._getTextureInfoFromBase64 stores the second image's bytes
 * under a random name but then matches the image source on the un-deduplicated
 * original name, so `glTFTexture.source` points back at the first image.
 *
 * DCL avatars reuse the names "AvatarSkin_MAT (Base Color)" / "AvatarSkin_MAT"
 * across body parts that carry DIFFERENT image data — the head has its own clean
 * 1024² skin map, the body a darker 2048² one. The collision makes every skin
 * mesh inherit a single image, so the head loses its own map and renders the
 * wrong (dark, feature-placeholder) texels around the nose and eyes.
 *
 * Make every texture name unique for the duration of the export, then restore so
 * the live scene is left untouched.
 */
function uniquifyTextureNamesForExport(scene: Scene): () => void {
  const restorers: Array<() => void> = []
  const seen = new Set<string>()
  for (const tex of scene.textures) {
    if (seen.has(tex.name)) {
      const original = tex.name
      tex.name = `${original}#${tex.uid}`
      restorers.push(() => {
        tex.name = original
      })
    }
    seen.add(tex.name)
  }
  return () => {
    for (const restore of restorers) restore()
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

  // Map of bone name → parent bone name (using Babylon's bone hierarchy, which
  // is the source of truth for absolute transforms). rebakeBindPose uses this
  // to compute parent-relative translations in canonical form.
  const boneParentNameByName = new Map<string, string | null>()
  for (const snap of boneSnapshots) {
    if (boneParentNameByName.has(snap.bone.name)) continue
    const parent = snap.bone.getParent()
    boneParentNameByName.set(snap.bone.name, parent ? parent.name : null)
  }

  // Disambiguate same-named textures so the serializer doesn't alias distinct
  // skin maps to a single image (see uniquifyTextureNamesForExport).
  const restoreTextureNames = uniquifyTextureNamesForExport(scene)

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

    rebakeBindPose(json, binChunk, snapshotByName, boneParentNameByName)
    mergeSkeletons(json)
    restructureForVrm(json)
    stripAnimations(json)
    applyUnlitMaterials(json)
    injectVRMExtension(json)

    return new Blob([packGLB(json, binChunk)], { type: 'application/octet-stream' })
  } finally {
    restoreTextureNames()

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
