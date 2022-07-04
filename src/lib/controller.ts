import { IEmoteController } from './emote'
import { ISceneController } from './scene'

export interface IPreviewController {
  scene: ISceneController
  emote: IEmoteController
}
