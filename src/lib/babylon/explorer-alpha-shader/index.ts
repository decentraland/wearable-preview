import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customBasicFragmentShader } from './basic_fragment'
import { customBasicVertexShader } from './basic_vertex'

export function createShaderMaterial(scene: Scene, shaderId: string) {
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
        'textureSampler',
        'materialType',
        'alpha',
      ],
      samplers: ['sampler_MainTex', 'sampler_NormalMap', 'sampler_Emissive_Tex'],
      defines: [],
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
