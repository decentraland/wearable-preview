import mitt from 'mitt'
import { IEmoteController, WearableDefinition, EmoteDefinition } from '@dcl/schemas'

export function isEmote(definition: WearableDefinition | EmoteDefinition | void): definition is EmoteDefinition {
  return !!definition && 'emoteDataADR74' in definition
}

export class InvalidEmoteError extends Error {
  constructor() {
    super(`Invalid emote`)
  }
}

export function createInvalidEmoteController(): IEmoteController {
  return {
    getLength() {
      throw new InvalidEmoteError()
    },
    isPlaying() {
      throw new InvalidEmoteError()
    },
    goTo() {
      throw new InvalidEmoteError()
    },
    play() {
      throw new InvalidEmoteError()
    },
    pause() {
      throw new InvalidEmoteError()
    },
    stop() {
      throw new InvalidEmoteError()
    },
    enableSound() {
      throw new InvalidEmoteError()
    },
    disableSound() {
      throw new InvalidEmoteError()
    },
    hasSound() {
      throw new InvalidEmoteError()
    },
    events: mitt(),
  }
}
