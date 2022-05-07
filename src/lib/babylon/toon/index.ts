import { Effect } from '@babylonjs/core'

// Monkey-patch the shaders with the corrected version for Decentraland

// eslint-disable-next-line
Effect.ShadersStore['cellPixelShader'] = require('!!raw-loader!./fragment.hlsl').default
// eslint-disable-next-line
Effect.ShadersStore['cellVertexShader'] = require('!!raw-loader!./vertex.hlsl').default
console.log(Effect.ShadersStore)
export { CellMaterial } from '@babylonjs/materials'
