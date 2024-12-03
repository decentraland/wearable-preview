export const customFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D sampler_MainTex;  // The albedo texture
uniform float alpha;               // Transparency

in vec2 vUV;                       // UV coordinates
out vec4 fragColor;                // Final color output

void main() {
    vec4 albedoColor = texture(sampler_MainTex, vUV);

    albedoColor.a *= alpha;

    fragColor = albedoColor;
}
`