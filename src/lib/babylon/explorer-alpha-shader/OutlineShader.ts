import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customOutlineFragmentShader } from './OutlineFragment'
import { customOutlineVertexShader } from './OutlineVertex'

export function createOutlineShader(scene: Scene, shaderId: string) {
  Effect.ShadersStore['customOutlineVertexShader'] = customOutlineVertexShader;
  Effect.ShadersStore['customOutlineFragmentShader'] = customOutlineFragmentShader;
  return new ShaderMaterial(
    shaderId,
    scene,
    {
      vertex: 'customOutlineVertexShader',
      fragment: 'customOutlineFragmentShader',
    },
    {
      attributes: ['position', 'normal'],
      uniforms: ['worldViewProjection', '_BaseColor'],
      uniformBuffers: undefined,
      samplers: ['sampler_MainTex'],
      defines: [],
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
