import { IPreviewController, PreviewEmoteEventType, PreviewMessageType, sendMessage } from '@dcl/schemas'
import { EmoteEventPayload } from '@dcl/schemas/dist/dapps/preview/preview-emote-event-payload'
import { getParent } from './parent'

export function handleEmoteEvents(controller: IPreviewController): () => void {
  // handle an emote event by forwarding it as a message

  const handleAnimationPlay = () => {
    sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, {
      type: PreviewEmoteEventType.ANIMATION_PLAY,
      payload: undefined,
    })
  }

  const handleAnimationPause = () => {
    sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, {
      type: PreviewEmoteEventType.ANIMATION_PAUSE,
      payload: undefined,
    })
  }

  const handleAnimationLoop = () => {
    sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, {
      type: PreviewEmoteEventType.ANIMATION_LOOP,
      payload: undefined,
    })
  }

  const handleAnimationEnd = () => {
    sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, {
      type: PreviewEmoteEventType.ANIMATION_END,
      payload: undefined,
    })
  }

  const handleAnimationPlaying = (payload: EmoteEventPayload<PreviewEmoteEventType>) => {
    sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, { type: PreviewEmoteEventType.ANIMATION_PLAYING, payload })
  }

  controller.emote.events.on(PreviewEmoteEventType.ANIMATION_PLAY, handleAnimationPlay)
  controller.emote.events.on(PreviewEmoteEventType.ANIMATION_PAUSE, handleAnimationPause)
  controller.emote.events.on(PreviewEmoteEventType.ANIMATION_LOOP, handleAnimationLoop)
  controller.emote.events.on(PreviewEmoteEventType.ANIMATION_END, handleAnimationEnd)
  controller.emote.events.on(PreviewEmoteEventType.ANIMATION_PLAYING, handleAnimationPlaying)

  return () => {
    controller.emote.events.off(PreviewEmoteEventType.ANIMATION_PLAY, handleAnimationPlay)
    controller.emote.events.off(PreviewEmoteEventType.ANIMATION_PAUSE, handleAnimationPause)
    controller.emote.events.off(PreviewEmoteEventType.ANIMATION_LOOP, handleAnimationLoop)
    controller.emote.events.off(PreviewEmoteEventType.ANIMATION_END, handleAnimationEnd)
    controller.emote.events.off(PreviewEmoteEventType.ANIMATION_PLAYING, handleAnimationPlaying)
  }
}
