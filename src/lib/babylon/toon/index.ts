import { Effect } from '@babylonjs/core'
import customToonShading from './new-pbr.hlsl?raw'

const needle = `#include<pbrBlockFinalColorComposition>`
const injection = `#include<customToonShading>`

if (Effect.ShadersStore['pbrPixelShader'].includes(needle)) {
  if (!Effect.ShadersStore['pbrPixelShader'].includes(injection)) {
    Effect.ShadersStore['pbrPixelShader'] = Effect.ShadersStore['pbrPixelShader'].replace(
      needle,
      needle + '\n' + injection + '\n',
    )
  }
} else {
  throw new Error('could not patch the pbrPixelShader')
}

// Monkey-patch the shaders with the corrected version for Decentraland
Effect.IncludesShadersStore['customToonShading'] = customToonShading
