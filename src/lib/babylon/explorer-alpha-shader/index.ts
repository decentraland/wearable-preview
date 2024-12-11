import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customFragmentShader } from './fragment'
import { customVertexShader } from './vertex'
import { customBasicFragmentShader } from './basic_fragment'
import { customBasicVertexShader } from './basic_vertex'
// import { customFragmentShader } from './fragmentTest'

export function createShader(scene: Scene, shaderId: string) {
  Effect.ShadersStore['customVertexShader'] = customBasicVertexShader
  Effect.ShadersStore['customFragmentShader'] = customBasicFragmentShader
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
        'textureSampler',
        'materialType',
        'alpha',
      ],
      samplers: ['sampler_MainTex', 'sampler_NormalMap', 'sampler_Emissive_Tex', 'textureSampler'],
      defines: [],
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
