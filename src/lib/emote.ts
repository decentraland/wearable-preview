import mitt from 'mitt'
import { WearableDefinition, EmoteDefinition, IEmoteController } from '@dcl/schemas'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'

export function isEmote(definition: WearableDefinition | EmoteDefinition | void): definition is EmoteDefinition {
  return !!definition && 'emoteDataADR74' in definition
}

/**
 * Checks if an emote is a social emote based on its emoteDataADR74 properties.
 * A social emote has a startAnimation and at least one outcome defined.
 * This works for both deployed (blockchain) and non-deployed emotes.
 */
export function isSocialEmote(emote: EmoteDefinition | null | undefined): boolean {
  return (
    !!emote &&
    !!emote.emoteDataADR74 &&
    !!emote.emoteDataADR74.startAnimation &&
    !!emote.emoteDataADR74.outcomes &&
    emote.emoteDataADR74.outcomes.length > 0
  )
}

/**
 * Gets a random SocialEmoteAnimation from a social emote's outcomes.
 * Returns the startAnimation if randomizeOutcomes is false, otherwise picks a random outcome.
 * Returns null if the emote is not a social emote.
 */
export function getRandomSocialEmoteAnimation(emote: EmoteDefinition | null | undefined): SocialEmoteAnimation | null {
  if (!isSocialEmote(emote)) {
    return null
  }

  const { startAnimation, outcomes } = emote!.emoteDataADR74

  // If randomizeOutcomes is false or undefined, use the startAnimation
  if (!outcomes || outcomes.length === 0) {
    return {
      title: 'Start Animation',
      loop: startAnimation!.loop,
      audio: startAnimation!.audio,
      Armature: startAnimation!.Armature,
      Armature_Prop: startAnimation!.Armature_Prop,
    }
  }

  // Pick a random outcome
  const randomIndex = Math.floor(Math.random() * outcomes.length)
  const outcome = outcomes[randomIndex]

  return {
    title: outcome.title,
    loop: outcome.loop,
    audio: outcome.audio,
    ...outcome.clips,
  }
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
    emote: null,
    isSocialEmote() {
      throw new InvalidEmoteError()
    },
    getSocialEmoteAnimations() {
      throw new InvalidEmoteError()
    },
    getPlayingSocialEmoteAnimation() {
      throw new InvalidEmoteError()
    },
    events: mitt(),
  }
}
