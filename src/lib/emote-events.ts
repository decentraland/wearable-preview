import { IPreviewController, PreviewEmoteEventType, PreviewMessageType, sendMessage } from '@dcl/schemas'

export function handleEmoteEvents(controller: IPreviewController) {
  // handle an emote event by forwarding it as a message
  function handleEvent(type: PreviewEmoteEventType) {
    controller.emote.events.on(type, () => sendMessage(window.parent, PreviewMessageType.EMOTE_EVENT, { type }))
  }

  // handle all emote event types
  handleEvent(PreviewEmoteEventType.ANIMATION_PLAY)
  handleEvent(PreviewEmoteEventType.ANIMATION_PAUSE)
  handleEvent(PreviewEmoteEventType.ANIMATION_LOOP)
  handleEvent(PreviewEmoteEventType.ANIMATION_END)
}
