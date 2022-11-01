import { IPreviewController, PreviewEmoteEventType, PreviewMessageType, sendMessage } from '@dcl/schemas'
import { EmoteEventPayload } from '@dcl/schemas/dist/dapps/preview/preview-emote-event-payload'
import { getParent } from './parent'

export function handleEmoteEvents(controller: IPreviewController) {
  // handle an emote event by forwarding it as a message
  function handleEvent(type: PreviewEmoteEventType) {
    controller.emote.events.on(type, (payload: EmoteEventPayload<PreviewEmoteEventType>) =>
      sendMessage(getParent(), PreviewMessageType.EMOTE_EVENT, { type, payload })
    )
  }

  // handle all emote event types
  handleEvent(PreviewEmoteEventType.ANIMATION_PLAY)
  handleEvent(PreviewEmoteEventType.ANIMATION_PAUSE)
  handleEvent(PreviewEmoteEventType.ANIMATION_LOOP)
  handleEvent(PreviewEmoteEventType.ANIMATION_END)
  handleEvent(PreviewEmoteEventType.ANIMATION_PLAYING)
}
