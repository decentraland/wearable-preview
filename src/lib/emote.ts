import { WearableDefinition } from '@dcl/schemas'

export interface IEmoteController {
  getLength(): number
  isPlaying(): boolean
  goTo(seconds: number): void
  play(): void
  pause(): void
  stop(): void
}

export function isEmote(wearable: WearableDefinition) {
  return `emoteDataV0` in wearable
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
