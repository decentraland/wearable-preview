import { IPhysicsController, SpringBoneParams } from '@dcl/schemas'
import { UnityMethod } from './messages'
import { UnityInstance } from './render'

export function createPhysicsController(instance: UnityInstance): IPhysicsController {
  return {
    setSpringBonesParams: async (itemHash: string, params: Record<string, SpringBoneParams>): Promise<void> => {
      if (!instance) return
      instance.SendMessage('JSBridge', UnityMethod.SET_SPRING_BONES_PARAMS, JSON.stringify({ itemHash, params }))
    },
  }
}
