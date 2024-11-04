export const customVertexShader = `#version 300 es
precision highp float;

// Attributes
in vec3 position;
in vec3 normal;
in vec2 uv;

// Uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Varying
out vec3 vPositionW;
out vec3 vNormalW;
out vec2 vUV;
// out vec4 posWorld;
// out vec3 normalDir;
// out vec3 tangentDir;
// out vec3 bitangentDir;
// out float mirrorFlag;
// out vec4 positionCS;

void main(void) {
    vec4 outPosition = worldViewProjection * vec4(position, 1.0);
    gl_Position = outPosition;

    vPositionW = vec3(world * vec4(position, 1.0));
    vNormalW = normalize(vec3(world * vec4(normal, 0.0)));
    vUV = uv;
    //normalDir = normalize(mul(normal, (float3x3)unity_WorldToObject));
    //tangentDir = normalize( mul( unity_ObjectToWorld, float4( tangent.xyz, 0.0 ) ).xyz );
    //bitangentDir = normalize(cross(normalDir, tangentDir) * tangent.w);

    //float3 crossFwd = cross(UNITY_MATRIX_V[0].xyz, UNITY_MATRIX_V[1].xyz);
    //mirrorFlag = dot(crossFwd, UNITY_MATRIX_V[2].xyz) < 0 ? 1 : -1;

    //posWorld = world * vec4(position, 1.0);
    //o.pos = UnityObjectToClipPos( v.vertex );

    //positionCS = TransformWorldToHClip(positionWS);

}`
