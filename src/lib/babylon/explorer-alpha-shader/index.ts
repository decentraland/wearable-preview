import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customFragmentShader } from './fragment'
import { customVertexShader } from './vertex'
// import { customFragmentShader } from './fragmentTest'

export function createShader(scene: Scene, shaderId: string) {
  Effect.ShadersStore['customVertexShader'] = customVertexShader
  Effect.ShadersStore['customFragmentShader'] = customFragmentShader
  return new ShaderMaterial(
    shaderId,
    scene,
    {
      vertex: 'custom',
      fragment: 'custom',
    },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: [
        'world',
        'worldView',
        'worldViewProjection',
        'view',
        'projection',
        'time',
        'direction',
        'sampler_MainTex',
        'sampler_NormalMap',
        'sampler_Emissive_Tex',
      ],
      samplers: ['sampler_MainTex', 'sampler_NormalMap', 'sampler_Emissive_Tex'],
      defines: [],
      // needAlphaBlending: true,
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
