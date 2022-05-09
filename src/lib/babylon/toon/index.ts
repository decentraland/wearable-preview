import { Effect } from '@babylonjs/core'

// Monkey-patch the shaders with the corrected version for Decentraland

// eslint-disable-next-line
Effect.ShadersStore['pbrPixelShader'] = require('!!raw-loader!./new-pbr.hlsl').default