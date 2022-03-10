import { ArcRotateCamera } from '@babylonjs/core'
import { AvatarPreview } from '../avatar'

export function startAutoRotateBehavior(camera: ArcRotateCamera, preview: AvatarPreview) {
  if (camera) {
    camera.useAutoRotationBehavior = true
    if (camera.autoRotationBehavior) {
      camera.autoRotationBehavior.idleRotationSpeed = preview.autoRotateSpeed
    }
  }
}
