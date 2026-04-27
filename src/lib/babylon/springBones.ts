import { AssetContainer, Matrix, Quaternion, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { SpringBoneParams } from '@dcl/schemas'

const SPRING_BONE_PREFIX = 'springbone'
const MAX_CHAINS_PER_WEARABLE = 32
const MAX_JOINTS_PER_CHAIN = 64
const MAX_DELTA_TIME = 0.05 // 50ms cap to prevent physics explosion after tab backgrounding

const SPRING_BONE_STIFFNESS_MIN = 0
const SPRING_BONE_STIFFNESS_MAX = 4
const SPRING_BONE_GRAVITY_POWER_MIN = 0
const SPRING_BONE_GRAVITY_POWER_MAX = 2
const SPRING_BONE_DRAG_MIN = 0
const SPRING_BONE_DRAG_MAX = 1

const DEFAULT_PARAMS: SpringBoneParams = {
  stiffness: 2,
  gravityPower: 0,
  gravityDir: [0, -1, 0],
  drag: 0.5,
}

type SpringJointState = {
  node: TransformNode
  initialLocalRotation: Quaternion
  initialLocalMatrix: Matrix
  boneAxis: Vector3
  boneLength: number
  currentTail: Vector3
  previousTail: Vector3
}

type SpringChain = {
  rootName: string
  joints: SpringJointState[]
  params: SpringBoneParams
  centerNode: TransformNode | null
}

function isSpringBoneName(name: string): boolean {
  return name.toLowerCase().includes(SPRING_BONE_PREFIX)
}

// Pre-allocated scratch objects to avoid per-frame heap allocations
const _scratchVec3A = new Vector3()
const _scratchVec3B = new Vector3()
const _scratchVec3C = new Vector3()
const _scratchVec3D = new Vector3()
const _scratchVec3E = new Vector3()
const _scratchMatrix = new Matrix()
const _scratchMatrixB = new Matrix()
const _scratchMatrixC = new Matrix()
const _scratchQuat = new Quaternion()
const _identityMatrix = Matrix.Identity()

function quaternionFromUnitVectorsToRef(from: Vector3, to: Vector3, result: Quaternion): void {
  const dot = Vector3.Dot(from, to)
  if (dot >= 1.0) {
    result.set(0, 0, 0, 1)
    return
  }
  if (dot < -0.999999) {
    Vector3.CrossToRef(Vector3.Right(), from, _scratchVec3E)
    if (_scratchVec3E.lengthSquared() < 0.000001) {
      Vector3.CrossToRef(Vector3.Up(), from, _scratchVec3E)
    }
    _scratchVec3E.normalize()
    Quaternion.RotationAxisToRef(_scratchVec3E, Math.PI, result)
    return
  }
  Vector3.CrossToRef(from, to, _scratchVec3E)
  result.set(_scratchVec3E.x, _scratchVec3E.y, _scratchVec3E.z, 1 + dot)
  result.normalize()
}

function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function sanitizeGravityDir(dir: unknown): [number, number, number] {
  if (!Array.isArray(dir) || dir.length < 3) return DEFAULT_PARAMS.gravityDir as [number, number, number]
  const x = Number(dir[0])
  const y = Number(dir[1])
  const z = Number(dir[2])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return DEFAULT_PARAMS.gravityDir as [number, number, number]
  }
  return [x, y, z]
}

function validateParams(raw: Partial<SpringBoneParams>, fallback: SpringBoneParams = DEFAULT_PARAMS): SpringBoneParams {
  return {
    stiffness: clampFinite(raw.stiffness, SPRING_BONE_STIFFNESS_MIN, SPRING_BONE_STIFFNESS_MAX, fallback.stiffness),
    gravityPower: clampFinite(
      raw.gravityPower,
      SPRING_BONE_GRAVITY_POWER_MIN,
      SPRING_BONE_GRAVITY_POWER_MAX,
      fallback.gravityPower,
    ),
    gravityDir: sanitizeGravityDir(raw.gravityDir),
    drag: clampFinite(raw.drag, SPRING_BONE_DRAG_MIN, SPRING_BONE_DRAG_MAX, fallback.drag),
    center: typeof raw.center === 'string' ? raw.center : fallback.center,
  }
}

function resolveCenter(centerName: string | undefined, scene: Scene): TransformNode | null {
  if (!centerName) return null
  for (const node of scene.transformNodes) {
    if (node.name === centerName && !isSpringBoneName(node.name)) {
      return node
    }
  }
  console.warn('[SpringBones] Center node not found or is a spring bone, falling back to world space:', centerName)
  return null
}

function buildChain(root: TransformNode, scene: Scene, params: SpringBoneParams): SpringChain | null {
  const centerNode = resolveCenter(params.center, scene)
  const worldToCenter = centerNode ? Matrix.Invert(centerNode.getWorldMatrix()) : Matrix.Identity()

  // Collect chain nodes depth-first (linear chain), capped to prevent DoS
  const chainNodes: TransformNode[] = [root]
  let current: TransformNode = root
  while (chainNodes.length < MAX_JOINTS_PER_CHAIN + 1) {
    const children = current.getChildren((child) => child instanceof TransformNode, false) as TransformNode[]
    if (children.length === 0) break
    chainNodes.push(children[0])
    current = children[0]
  }

  // Need at least root + tip
  if (chainNodes.length < 2) return null

  // Build joints for all nodes except the tip
  const joints: SpringJointState[] = []
  for (let i = 0; i < chainNodes.length - 1; i++) {
    const node = chainNodes[i]
    const childNode = chainNodes[i + 1]

    node.computeWorldMatrix(true)
    childNode.computeWorldMatrix(true)

    // Ensure quaternion rotation mode
    if (!node.rotationQuaternion) {
      node.rotationQuaternion = Quaternion.FromEulerVector(node.rotation)
    }

    const initialLocalRotation = node.rotationQuaternion.clone()

    // Compute local matrix from current local transform
    const initialLocalMatrix = Matrix.Compose(node.scaling, initialLocalRotation, node.position)

    // Bone axis: direction from node to child in local space
    const nodeWorldMatrix = node.getWorldMatrix()
    const nodeWorldPos = node.getAbsolutePosition()
    const childWorldPos = childNode.getAbsolutePosition()

    const boneLength = Vector3.Distance(nodeWorldPos, childWorldPos)

    // Compute local direction to child
    const nodeWorldMatrixInv = Matrix.Invert(nodeWorldMatrix)
    const childLocalPos = Vector3.TransformCoordinates(childWorldPos, nodeWorldMatrixInv)
    const boneAxis = childLocalPos.length() > 0 ? childLocalPos.normalize() : new Vector3(0, 1, 0)

    // Initialize tail positions in center space
    const currentTail = Vector3.TransformCoordinates(childWorldPos, worldToCenter)

    joints.push({
      node,
      initialLocalRotation,
      initialLocalMatrix,
      boneAxis,
      boneLength,
      currentTail: currentTail.clone(),
      previousTail: currentTail.clone(),
    })
  }

  return { rootName: root.name, joints, params, centerNode }
}

function updateSimulation(chains: SpringChain[], scene: Scene): void {
  const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, MAX_DELTA_TIME)
  if (dt <= 0) return

  for (const chain of chains) {
    const { params, centerNode } = chain

    // Compute center space transforms, reusing scratch matrices
    let worldToCenter: Matrix
    let centerToWorld: Matrix
    if (centerNode) {
      const centerWorld = centerNode.getWorldMatrix()
      centerWorld.invertToRef(_scratchMatrix)
      worldToCenter = _scratchMatrix
      centerToWorld = centerWorld
    } else {
      worldToCenter = _identityMatrix
      centerToWorld = _identityMatrix
    }

    // Normalize gravityDir (guard against zero vector)
    _scratchVec3A.set(params.gravityDir[0], params.gravityDir[1], params.gravityDir[2])
    const gravityDir = _scratchVec3A
    if (gravityDir.lengthSquared() > 0) {
      gravityDir.normalize()
    } else {
      gravityDir.set(0, -1, 0)
    }
    const drag = params.drag
    const stiffness = params.stiffness
    const gravityPower = params.gravityPower

    for (let ji = 0; ji < chain.joints.length; ji++) {
      const joint = chain.joints[ji]

      // Only force recompute for first joint; subsequent joints are already fresh
      // from the previous iteration's computeWorldMatrix at the end of the loop
      if (ji === 0) {
        joint.node.computeWorldMatrix(true)
      }
      const worldPos = joint.node.getAbsolutePosition()

      // Convert tail positions from center space to world space
      // _scratchVec3B = currentTailWorld, _scratchVec3C = prevTailWorld
      Vector3.TransformCoordinatesToRef(joint.currentTail, centerToWorld, _scratchVec3B)
      Vector3.TransformCoordinatesToRef(joint.previousTail, centerToWorld, _scratchVec3C)

      // 1. Inertia (Verlet): computed in center space to exclude center node motion
      // inertia = (currentTail - previousTail) * (1 - drag), in center space
      joint.currentTail.subtractToRef(joint.previousTail, _scratchVec3D)
      _scratchVec3D.scaleInPlace(1 - drag)
      // Transform inertia direction from center space to world space
      Vector3.TransformNormalToRef(_scratchVec3D, centerToWorld, _scratchVec3D)
      // nextTail = currentTailWorld + inertiaWorld
      _scratchVec3B.addToRef(_scratchVec3D, _scratchVec3D) // _scratchVec3D = nextTail

      // 2. Stiffness force: constant directional force along rest bone axis (VRM spec)
      const parentWorldMatrix =
        joint.node.parent instanceof TransformNode ? joint.node.parent.getWorldMatrix() : _identityMatrix
      // restMatrix = initialLocalMatrix * parentWorldMatrix
      joint.initialLocalMatrix.multiplyToRef(parentWorldMatrix, _scratchMatrixB)
      // Rest bone direction in world space
      Vector3.TransformNormalToRef(joint.boneAxis, _scratchMatrixB, _scratchVec3B) // reuse B as restTailDir
      const restTailDirLen = _scratchVec3B.length()
      if (restTailDirLen > 0) _scratchVec3B.scaleInPlace(1 / restTailDirLen)
      // Stiffness pushes tail along the rest direction
      _scratchVec3B.scaleToRef(stiffness * dt * joint.boneLength, _scratchVec3E)
      _scratchVec3D.addInPlace(_scratchVec3E)

      // 3. Gravity
      gravityDir.scaleToRef(gravityPower * dt, _scratchVec3E)
      _scratchVec3D.addInPlace(_scratchVec3E)

      // 4. Length constraint: clamp tail to boneLength from bone origin
      _scratchVec3D.subtractToRef(worldPos, _scratchVec3C) // _scratchVec3C = direction
      const len = _scratchVec3C.length()
      // _scratchVec3D = constrainedTail
      if (len > 0) {
        _scratchVec3C.scaleInPlace(joint.boneLength / len)
        worldPos.addToRef(_scratchVec3C, _scratchVec3D)
      } else {
        _scratchVec3B.scaleToRef(joint.boneLength, _scratchVec3E)
        worldPos.addToRef(_scratchVec3E, _scratchVec3D)
      }

      // 5. Store state (in center space)
      // previousTail = old currentTail (already in center space, not yet overwritten)
      joint.previousTail.copyFrom(joint.currentTail)
      // currentTail = constrainedTail converted to center space
      Vector3.TransformCoordinatesToRef(_scratchVec3D, worldToCenter, joint.currentTail)

      // 6. Apply rotation
      // Get the direction from bone origin to constrained tail in world space
      _scratchVec3D.subtractToRef(worldPos, _scratchVec3C) // _scratchVec3C = currentDir
      const currentDirLen = _scratchVec3C.length()
      if (currentDirLen > 0) _scratchVec3C.scaleInPlace(1 / currentDirLen)

      // Transform this world direction into the bone's rest-pose local space
      _scratchMatrixB.invertToRef(_scratchMatrixC) // _scratchMatrixC = restMatrixInv
      Vector3.TransformNormalToRef(_scratchVec3C, _scratchMatrixC, _scratchVec3C) // localTailDir
      const localTailDirLen = _scratchVec3C.length()
      if (localTailDirLen > 0) _scratchVec3C.scaleInPlace(1 / localTailDirLen)

      // Rotation from rest axis to current tail direction
      quaternionFromUnitVectorsToRef(joint.boneAxis, _scratchVec3C, _scratchQuat)
      // Final rotation = initial * delta
      joint.initialLocalRotation.multiplyToRef(_scratchQuat, _scratchQuat)
      // rotationQuaternion is guaranteed non-null: buildChain sets it during init
      joint.node.rotationQuaternion!.copyFrom(_scratchQuat)

      // 7. NaN/Infinity recovery: if tail state is corrupted, reset to rest pose
      if (!isFiniteVec3(joint.currentTail) || !isFiniteVec3(joint.previousTail)) {
        // Recompute rest tail position in center space as recovery
        Vector3.TransformNormalToRef(joint.boneAxis, _scratchMatrixB, _scratchVec3C)
        const rLen = _scratchVec3C.length()
        if (rLen > 0) _scratchVec3C.scaleInPlace(1 / rLen)
        _scratchVec3C.scaleInPlace(joint.boneLength)
        worldPos.addToRef(_scratchVec3C, _scratchVec3D)
        Vector3.TransformCoordinatesToRef(_scratchVec3D, worldToCenter, joint.currentTail)
        joint.previousTail.copyFrom(joint.currentTail)
        joint.node.rotationQuaternion!.copyFrom(joint.initialLocalRotation)
      }

      // Force world matrix update for children
      joint.node.computeWorldMatrix(true)
    }
  }
}

function isFiniteVec3(v: Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

export class SpringBoneSimulation {
  private wearables = new Map<string, SpringChain[]>()
  private containers = new Map<string, AssetContainer>()
  private beforeRenderCallback: (() => void) | null = null
  private scene: Scene | null = null

  registerWearable(
    scene: Scene,
    container: AssetContainer,
    itemHash: string,
    springBonesParams?: Record<string, SpringBoneParams>,
  ): void {
    this.scene = scene
    this.containers.set(itemHash, container)
    const chains: SpringChain[] = []

    if (springBonesParams) {
      for (const node of container.transformNodes) {
        if (!isSpringBoneName(node.name)) continue

        const params = springBonesParams[node.name]
        if (!params) continue

        const chain = buildChain(node, scene, validateParams(params))
        if (chain) {
          chains.push(chain)
          if (chains.length >= MAX_CHAINS_PER_WEARABLE) break
        }
      }
    }

    if (chains.length > 0) {
      this.wearables.set(itemHash, chains)
    }
  }

  updateParams(itemHash: string, params: Record<string, SpringBoneParams>): void {
    let chains = this.wearables.get(itemHash)

    // Update existing chains, removing and restoring pose for any not in params
    if (chains) {
      chains = chains.filter((chain) => {
        const raw = params[chain.rootName]
        if (raw) {
          chain.params = validateParams(raw, chain.params)
        } else {
          // Restore all joints to their initial rest pose before discarding the chain
          for (const joint of chain.joints) {
            if (joint.node.rotationQuaternion) {
              joint.node.rotationQuaternion.copyFrom(joint.initialLocalRotation)
            }
          }
        }
        return !!raw
      })
      this.wearables.set(itemHash, chains)
    }

    // Build new chains for bone names in params that have no existing chain.
    // Node lookup is scoped to the wearable's AssetContainer to avoid matching
    // nodes from other wearables that may share the same name.
    //
    // NOTE: Unlike registerWearable(), we intentionally skip isSpringBoneName()
    // checks here. This method is the editor's mechanism for
    // dynamically adding spring bones to arbitrary nodes via external params.
    // KNOWN LIMITATION: buildChain() captures the current pose as the rest pose.
    // If an animation is playing, the "rest" will be the current animated position,
    // not the bind/T-pose. This can cause visual artifacts where the spring bone
    // springs from the wrong base orientation. A full preview reload (save) does not
    // have this issue because chains are built before animation starts.
    const container = this.containers.get(itemHash)
    if (this.scene && container) {
      const existingNames = new Set(chains?.map((c) => c.rootName) ?? [])

      for (const [boneName, boneParams] of Object.entries(params)) {
        if (existingNames.has(boneName)) continue
        if (chains && chains.length >= MAX_CHAINS_PER_WEARABLE) break

        const node = container.transformNodes.find((n) => n.name === boneName)
        if (!node) continue

        const chain = buildChain(node, this.scene, validateParams(boneParams))
        if (chain) {
          if (!chains) {
            chains = []
            this.wearables.set(itemHash, chains)
          }
          chains.push(chain)
        }
      }
    }
  }

  start(scene: Scene): void {
    if (this.beforeRenderCallback) return
    this.scene = scene

    this.beforeRenderCallback = () => {
      for (const chains of this.wearables.values()) {
        updateSimulation(chains, scene)
      }
    }

    scene.registerBeforeRender(this.beforeRenderCallback)
  }

  dispose(scene: Scene): void {
    if (this.beforeRenderCallback) {
      scene.unregisterBeforeRender(this.beforeRenderCallback)
      this.beforeRenderCallback = null
    }
    this.wearables.clear()
    this.containers.clear()
    this.scene = null
  }
}
