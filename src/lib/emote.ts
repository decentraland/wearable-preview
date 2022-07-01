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
