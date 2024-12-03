import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customFragmentShader } from './fragment'
import { customVertexShader } from './vertex'

export function createShader(scene: Scene, shaderId: string) {
  Effect.ShadersStore['customVertexShader'] = customVertexShader
//   Effect.ShadersStore['customFragmentShader'] = `precision highp float;

// uniform sampler2D sampler_MainTex;         // Albedo texture (Main texture)
// uniform sampler2D sampler_NormalMap;       // Normal map texture
// uniform sampler2D sampler_Emissive_Tex;   // Emissive texture
// uniform float alpha;                       // Alpha (transparency) value

// varying vec2 vUV;

// void main() {
//     // Sample the textures
//     vec4 albedoColor = texture2D(sampler_MainTex, vUV);   // Sample the albedo (main) texture
//     vec4 normalColor = texture2D(sampler_NormalMap, vUV); // Normal map texture (not used for color directly)
//     vec4 emissiveColor = texture2D(sampler_Emissive_Tex, vUV); // Emissive texture

//     // Combine the colors: base color from albedo with emissive highlights
//     vec4 finalColor = albedoColor + emissiveColor * 0.3;  // Add emissive highlights to albedo

//     // Set the alpha channel for transparency
//     finalColor.a = 0.99; // Apply alpha transparency

//     // Output the final color (with transparency)
//     gl_FragColor = finalColor;
// }
// `
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
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
