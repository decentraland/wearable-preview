import { IEmoteController, WearableDefinition, EmoteDefinition } from '@dcl/schemas'

export function isEmote(wearable: WearableDefinition | EmoteDefinition): wearable is EmoteDefinition {
  // leaving both until the existing emotes are migrated
  return 'emoteDataADR74' in wearable || 'emoteDataV0' in wearable
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
  }
}
