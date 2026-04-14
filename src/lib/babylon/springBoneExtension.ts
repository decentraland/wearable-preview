import { Nullable } from '@babylonjs/core/types'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { GLTFLoader } from '@babylonjs/loaders/glTF/2.0/glTFLoader'
import { IGLTFLoaderExtension } from '@babylonjs/loaders/glTF/2.0/glTFLoaderExtension'
import { INode } from '@babylonjs/loaders/glTF/2.0/glTFLoaderInterfaces'

export const DCL_SPRING_BONE_EXTENSION = 'DCL_spring_bone_joint'

export interface IDCLSpringBoneJoint {
  version: number
  stiffness?: number
  gravityPower?: number
  gravityDir?: [number, number, number]
  drag?: number
  center?: string
}

class DCLSpringBoneJointExtension implements IGLTFLoaderExtension {
  public readonly name = DCL_SPRING_BONE_EXTENSION
  public enabled: boolean

  private _loader: GLTFLoader | null

  constructor(loader: GLTFLoader) {
    this._loader = loader
    this.enabled = this._loader.isExtensionUsed(DCL_SPRING_BONE_EXTENSION)
  }

  public loadNodeAsync(
    context: string,
    node: INode,
    assign: (babylonTransformNode: TransformNode) => void,
  ): Nullable<Promise<TransformNode>> {
    if (!this._loader) return null
    return GLTFLoader.LoadExtensionAsync<IDCLSpringBoneJoint, TransformNode>(
      context,
      node,
      this.name,
      (_extensionContext, extension) => {
        return this._loader!.loadNodeAsync(context, node, (babylonTransformNode) => {
          babylonTransformNode.metadata = babylonTransformNode.metadata || {}
          babylonTransformNode.metadata.gltf = babylonTransformNode.metadata.gltf || {}
          babylonTransformNode.metadata.gltf[DCL_SPRING_BONE_EXTENSION] = extension
          assign(babylonTransformNode)
        })
      },
    )
  }

  public dispose(): void {
    this._loader = null
  }
}

GLTFLoader.RegisterExtension(DCL_SPRING_BONE_EXTENSION, (loader) => new DCLSpringBoneJointExtension(loader))
