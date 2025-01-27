export const customFragmentShader = `#version 300 es
precision highp float;

#define float2 vec2
#define float3 vec3
#define float4 vec4
#define half float
#define half2 vec2
#define half3 vec3
#define half4 vec4
#define half3x3 mat3
#define float2x2 mat2
#define float3x3 mat3
#define float4x4 mat4
#define lerp mix
#define saturate(a) clamp(a, 0.0, 1.0)
#define SATURATE_IF_SDR(x) (x)
#define mul(a,b) (a*b)
#define real float
#define real3 vec3
#define real4 vec4

#define FLT_EPS  5.960464478e-8  // 2^-24, machine epsilon: 1 + EPS = 1 (half of the ULP for 1.0f)
#define FLT_MIN  1.175494351e-38 // Minimum normalized positive floating-point number
#define FLT_MAX  3.402823466e+38 // Maximum representable floating-point number
#define HALF_EPS 4.8828125e-4    // 2^-11, machine epsilon: 1 + EPS = 1 (half of the ULP for 1.0f)
#define HALF_MIN 6.103515625e-5  // 2^-14, the same value for 10, 11 and 16-bit: https://www.khronos.org/opengl/wiki/Small_Float_Formats
#define HALF_MIN_SQRT 0.0078125  // 2^-7 == sqrt(HALF_MIN), useful for ensuring HALF_MIN after x^2
#define HALF_MAX 65504.0
#define UINT_MAX 0xFFFFFFFFu
#define INT_MAX  0x7FFFFFFF
#define rsqrt 1.0/sqrt

// Lights
in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vUV;
//in vec3 normalDir;
//in vec3 tangentDir;
//in vec3 bitangentDir;
//in float mirrorFlag;
//in vec4 positionCS;

// Babylon Defaults
uniform vec4 _WorldSpaceCameraPos;
uniform mat4 world;
uniform mat4 worldView;
#define unity_ObjectToWorld world
#define UNITY_MATRIX_V worldView

// Decentraland Material Specific
uniform vec4 _Emissive_Color; // 0.00, 0.00, 0.00, 1.00

// Decentraland Scene Specific
uniform vec4 _LightDirection; // Distance Attenuation in the final w slot
uniform vec4 _LightColor;

// Texture sampler inputs
uniform sampler2D textureSampler;
uniform sampler2D sampler_BaseMap;
uniform sampler2D sampler_BumpMap;
uniform sampler2D sampler_EmissionMap;
uniform sampler2D sampler_MainTex;
uniform sampler2D sampler_1st_ShadeMap;
uniform sampler2D sampler_2nd_ShadeMap;
uniform sampler2D sampler_NormalMap;
uniform sampler2D sampler_ClippingMask;
uniform sampler2D sampler_OcclusionMap;
uniform sampler2D sampler_MetallicGlossMap;
uniform sampler2D sampler_Set_1st_ShadePosition;
uniform sampler2D sampler_Set_2nd_ShadePosition;
uniform sampler2D sampler_ShadingGradeMap;
uniform sampler2D sampler_HighColor_Tex;
uniform sampler2D sampler_Set_HighColorMask;
uniform sampler2D sampler_Set_RimLightMask;
uniform sampler2D sampler_MatCap_Sampler;
uniform sampler2D sampler_NormalMapForMatCap;
uniform sampler2D sampler_Set_MatcapMask;
uniform sampler2D sampler_Emissive_Tex;
uniform sampler2D sampler_AngelRing_Sampler;
uniform sampler2D sampler_Outline_Sampler;
uniform sampler2D sampler_OutlineTex;
uniform sampler2D sampler_BakedNormal;

// Output
out vec4 fragColor;

// Unity Material and Scene Inputs - Hardcoded for ease
float _AlphaToMaskAvailable = 1.0;
float _Clipping_Level = 0.0;
float _Unlit_Intensity = 4.0;
float _Is_BLD = 0.0;
float _Offset_X_Axis_BLD = -0.05;
float _Offset_Y_Axis_BLD = 0.09;
float _Inverse_Z_Axis_BLD = 1.0;
float _Is_Filter_LightColor = 1.0;
float _Is_LightColor_Base = 1.0;
vec3 _Color = vec3(-4.48876, 0.0, 0.0);
vec3 _1st_ShadeColor = vec3(0.88792, 0.88792, 0.88792);
vec3 _2nd_ShadeColor = vec3(0.60383, 0.60383, 0.60383);
float _Use_BaseAs1st = 1.0;
float _Is_LightColor_1st_Shade = 1.0;
float _Use_1stAs2nd = 1.0;
float _Is_LightColor_2nd_Shade = 1.0;
float _Is_NormalMapToBase = 0.0;
float _Tweak_SystemShadowsLevel = 0.0;
float _Set_SystemShadowsToBase = 1.0;
float _BaseColor_Step = 0.2;
float _BaseShade_Feather = 0.02;
vec3 _ShadeColor_Step = vec3(0.2, 0.2, 0.2);
vec3 _1st2nd_Shades_Feather = vec3(0.05, 0.05, 0.05);
float _Is_NormalMapToHighColor = 1.0;
float _Tweak_HighColorMaskLevel = -1.0;
float _HighColor_Power = 0.7;
float _Is_SpecularToHighColor = 0.0;
vec3 _HighColor = vec3(1.0, 1.0, 1.0);
float _Is_LightColor_HighColor = 1.0;
float _Is_BlendAddToHiColor = 1.0;
float _TweakHighColorOnShadow = 0.0;
float _Is_UseTweakHighColorOnShadow = 0.0;
vec3 _RimLightColor = vec3(1.0, 1.0, 1.0);
float _Is_LightColor_RimLight = 1.0;
float _Is_NormalMapToRimLight = 1.0;
float _RimLight_Power = 0.3;
float _RimLight_InsideMask = 0.15;
float _RimLight_FeatherOff = 0.0;
float _Tweak_LightDirection_MaskLevel = 0.0;
float _LightDirection_MaskOn = 0.0;
float _Ap_RimLight_Power = 0.1;
float _Tweak_RimLightMaskLevel = -0.9;
vec3 _Ap_RimLightColor = vec3(1.0, 1.0, 1.0);
float _Is_LightColor_Ap_RimLight = 1.0;
float _Ap_RimLight_FeatherOff = 0.0;
float _Add_Antipodean_RimLight = 0.0;
float _RimLight = 1.0;
float _Rotate_MatCapUV = 4.59037e-41;
float _CameraRolling_Stabilizer = 3.23322e-41;
float _Rotate_NormalMapForMatCapUV = 5.60519e-45;
float _BumpScaleMatcap = 2.32616e-43;
float _Is_NormalMapForMatCap = 1.79366e-43;
float _Is_Ortho = 9.3887e-43;
float _Tweak_MatCapUV = -2.41782e+15;
float _Inverse_MatcapMask = 0.0;
float _Tweak_MatcapMaskLevel = 0.0;
vec4 _MatCapColor = vec4(1.0, 1.0, 1.0, 1.0);
float _Is_LightColor_MatCap = 1.0;
float _TweakMatCapOnShadow = 0.0;
float _Is_BlendAddToMatCap = 1.0;
float _Is_UseTweakMatCapOnShadow = 0.0;
float _MatCap = 0.0;
float _GI_Intensity = 0.0;
vec4 emissive = vec4(1.07760e-42, 0.0, 0.0, 0.0);
float _BlurLevelMatcap = 0.0;
vec4 _BaseColor = vec4(0.88792, 0.53948, 0.37626, 1.0);
float _Cutoff = 0.0;
float _Smoothness = 0.5;
float _BumpScale = 1.0;
vec4 _EmissionColor = vec4(0.0, 0.0, -3.77099e+15, 4.59037e-41);
vec4 _GlossyEnvironmentColor = vec4(0.0, 0.0, 0.0, 0.0);

// SH block feature
real4 unity_SHAr = vec4( 0.00f, -0.00973f, 0.00f, 0.41196f );
real4 unity_SHAg = vec4( 0.00f, 0.10704f, 0.00f, 0.30608f );
real4 unity_SHAb = vec4( 0.00f, 0.12774f, 0.00f, 0.44097f );
real4 unity_SHBr = vec4( 0.00f, 0.00f, 0.0337f, 0.00f );
real4 unity_SHBg = vec4( 0.00f, 0.00f, 0.02523f, 0.00f );
real4 unity_SHBb = vec4( 0.00f, 0.00f, 0.05021f, 0.00f );
real4 unity_SHC = vec4( 0.0337f, 0.02523f, 0.05021f, 1.00f );

#define SAMPLE_BASEMAP(uv,texArrayID)                   texture(sampler_BaseMap, uv)
#define SAMPLE_BUMPMAP(uv,texArrayID)                   texture(sampler_BumpMap, uv)
#define SAMPLE_EMISSIONMAP(uv,texArrayID)               texture(sampler_EmissionMap, uv)
#define SAMPLE_MAINTEX(uv,texArrayID)                   texture(sampler_MainTex, uv)
#define SAMPLE_1ST_SHADEMAP(uv,texArrayID)              texture(sampler_1st_ShadeMap, uv)
#define SAMPLE_2ND_SHADEMAP(uv,texArrayID)              texture(sampler_2nd_ShadeMap, uv)
#define SAMPLE_NORMALMAP(uv,texArrayID)                 texture(sampler_NormalMap, uv)
#define SAMPLE_CLIPPINGMASK(uv,texArrayID)              texture(sampler_ClippingMask, uv)
#define SAMPLE_OCCLUSIONMAP(uv,texArrayID)              texture(sampler_OcclusionMap, uv)
#define SAMPLE_METALLICGLOSS(uv,texArrayID)             texture(sampler_MetallicGlossMap, uv)
#define SAMPLE_SET_1ST_SHADEPOSITION(uv,texArrayID)     texture(sampler_Set_1st_ShadePosition, uv) 
#define SAMPLE_SET_2ND_SHADEPOSITION(uv,texArrayID)     texture(sampler_Set_2nd_ShadePosition, uv)
#define SAMPLE_SHADINGGRADEMAP(uv,texArrayID,lod)       textureLod(sampler_ShadingGradeMap, uv, lod)
#define SAMPLE_HIGHCOLOR(uv,texArrayID)                 texture(sampler_HighColor_Tex, uv)
#define SAMPLE_HIGHCOLORMASK(uv,texArrayID)             texture(sampler_Set_HighColorMask, uv)
#define SAMPLE_SET_RIMLIGHTMASK(uv, texArrayID)         texture(sampler_Set_RimLightMask, uv)
#define SAMPLE_MATCAP(uv,texArrayID,lod)                textureLod(sampler_MatCap_Sampler, uv, lod)
#define SAMPLE_NORMALMAPFORMATCAP(uv,texArrayID)        texture(sampler_NormalMapForMatCap, uv)
#define SAMPLE_SET_MATCAPMASK(uv,texArrayID)            texture(sampler_Set_MatcapMask, uv)
#define SAMPLE_EMISSIVE(uv,texArrayID)                  texture(sampler_Emissive_Tex, uv)
#define SAMPLE_ANGELRING(uv,texArrayID)                 texture(sampler_AngelRing_Sampler, uv)
#define SAMPLE_OUTLINE(uv,texArrayID,lod)               textureLod(sampler_Outline_Sampler, uv, lod)
#define SAMPLE_OUTLINETEX(uv,texArrayID)                texture(sampler_OutlineTex, uv)
#define SAMPLE_BAKEDNORMAL(uv,texArrayID,lod)           textureLod(sampler_BakedNormal, uv, lod)

//#define TRANSFORM_TEX(tex, name) ((tex.xy) * name##_ST.xy + name##_ST.zw)
#define TRANSFORM_TEX(tex, name) tex.xy

int _MainTexArr_ID = 0;
int _1st_ShadeMapArr_ID = 0;
int _2nd_ShadeMapArr_ID = 0;
int _NormalMapArr_ID = 0;
int _Set_1st_ShadePositionArr_ID = 0;
int _Set_2nd_ShadePositionArr_ID = 0;
int _ShadingGradeMapArr_ID = 0;
int _HighColor_TexArr_ID = 0;
int _Set_HighColorMaskArr_ID = 0;
int _Set_RimLightMaskArr_ID = 0;
int _MatCap_SamplerArr_ID = 0;
int _NormalMapForMatCapArr_ID = 0;
int _Set_MatcapMaskArr_ID = 0;
int _Emissive_TexArr_ID = 0;
int _ClippingMaskArr_ID = 0;
int _AngelRing_SamplerArr_ID = 0;
int _Outline_SamplerArr_ID = 0;
int _OutlineTexArr_ID = 0;
int _BakedNormalArr_ID = 0;
int _OcclusionMapArr_ID = 0;
int _MetallicGlossMapArr_ID = 0;
int _BaseMapArr_ID = 0;
int _BumpMapArr_ID = 0;
int _EmissionMapArr_ID = 0;

struct VertexOutput
{
    float4 pos;
    float2 uv0;
    float4 posWorld;
    float3 normalDir;
    float3 tangentDir;
    float3 bitangentDir;
    float mirrorFlag;
    float4 positionCS;
    int mainLightID;
};

// Abstraction over Light shading data.
struct UtsLight
{
    float3   direction;
    float3   color;
    float    distanceAttenuation;
    float    shadowAttenuation;
    int      type;
};

struct BRDFData
{
    half3 albedo;
    half3 diffuse;
    half3 specular;
    half reflectivity;
    half perceptualRoughness;
    half roughness;
    half roughness2;
    half grazingTerm;

    // We save some light invariant BRDF terms so we don't have to recompute
    // them in the light loop. Take a look at DirectBRDF function for detailed explaination.
    half normalizationTerm;     // roughness * 4.0 + 2.0
    half roughness2MinusOne;    // roughness^2 - 1.0
};

struct SurfaceData
{
    half3 albedo;
    half3 specular;
    half  metallic;
    half  smoothness;
    half3 normalTS;
    half3 emission;
    half  occlusion;
    half  alpha;
    half  clearCoatMask;
    half  clearCoatSmoothness;
};

struct Varyings
{
    float2 uv;
    float3 positionWS;
    float3 normalWS;
    half4 tangentWS;    // xyz: tangent, w: sign
    float4 shadowCoord;
    half3 viewDirTS;
    float4 positionCS;
};

struct InputData
{
    float3  positionWS;
    float4  positionCS;
    float3  normalWS;
    half3   viewDirectionWS;
    float4  shadowCoord;
    half    fogCoord;
    half3   vertexLighting;
    half3   bakedGI;
    float2  normalizedScreenSpaceUV;
    half4   shadowMask;
    half3x3 tangentToWorld;
};

bool anyPos(vec3 _v)
{
    return length(_v) > 0.0;
}

// Returns true if AlphaToMask functionality is currently available
// NOTE: This does NOT guarantee that AlphaToMask is enabled for the current draw. It only indicates that AlphaToMask functionality COULD be enabled for it.
//       In cases where AlphaToMask COULD be enabled, we export a specialized alpha value from the shader.
//       When AlphaToMask is enabled:     The specialized alpha value is combined with the sample mask
//       When AlphaToMask is not enabled: The specialized alpha value is either written into the framebuffer or dropped entirely depending on the color write mask
bool IsAlphaToMaskAvailable()
{
    return (_AlphaToMaskAvailable != 0.0);
}

//function to rotate the UV: RotateUV()
//float2 rotatedUV = RotateUV(i.uv0, (_angular_Verocity*3.141592654), float2(0.5, 0.5), _Time.g);
float2 RotateUV(float2 _uv, float _radian, float2 _piv, float _time)
{
    float RotateUV_ang = _radian;
    float RotateUV_cos = cos(_time*RotateUV_ang);
    float RotateUV_sin = sin(_time*RotateUV_ang);
    return (mul(_uv - _piv, float2x2( RotateUV_cos, -RotateUV_sin, RotateUV_sin, RotateUV_cos)) + _piv);
}

float SharpenAlpha(float alpha, float alphaClipTreshold)
{
    return saturate((alpha - alphaClipTreshold) / max(fwidth(alpha), 0.0001) + 0.5);
}

void clip(float _clip)
{
    if(_clip < 0.0)
        discard;
}

// When AlphaToMask is available:     Returns a modified alpha value that should be exported from the shader so it can be combined with the sample mask
// When AlphaToMask is not available: Terminates the current invocation if the alpha value is below the cutoff and returns the input alpha value otherwise

half AlphaClip(half alpha, half cutoff)
{
    // Produce 0.0 if the input value would be clipped by traditional alpha clipping and produce the original input value otherwise.
    // WORKAROUND: The alpha parameter in this ternary expression MUST be converted to a float in order to work around a known HLSL compiler bug.
    //             See Fogbugz 934464 for more information
    half clippedAlpha = (alpha >= cutoff) ? float(alpha) : 0.0;

    // Calculate a specialized alpha value that should be used when alpha-to-coverage is enabled

    // If the user has specified zero as the cutoff threshold, the expectation is that the shader will function as if alpha-clipping was disabled.
    // Ideally, the user should just turn off the alpha-clipping feature in this case, but in order to make this case work as expected, we force alpha
    // to 1.0 here to ensure that alpha-to-coverage never throws away samples when its active. (This would cause opaque objects to appear transparent)
    half alphaToCoverageAlpha = (cutoff <= 0.0) ? 1.0 : SharpenAlpha(alpha, cutoff);

    // When alpha-to-coverage is available:     Use the specialized value which will be exported from the shader and combined with the MSAA coverage mask.
    // When alpha-to-coverage is not available: Use the "clipped" value. A clipped value will always result in thread termination via the clip() logic below.
    alpha = IsAlphaToMaskAvailable() ? alphaToCoverageAlpha : clippedAlpha;

    // Terminate any threads that have an alpha value of 0.0 since we know they won't contribute anything to the final image
    clip(alpha - 0.0001);

    return alpha;
}

bool IsAlphaDiscardEnabled()
{
    //#if defined(DEBUG_DISPLAY)
    //return (_DebugSceneOverrideMode == DEBUGSCENEOVERRIDEMODE_NONE);
    //#else
    return true;
    //#endif
}

real AlphaDiscard(real alpha, real cutoff, real offset)
{
    #if defined(_ALPHATEST_ON)
        if (IsAlphaDiscardEnabled())
            alpha = AlphaClip(alpha, cutoff + offset);
    #endif

    return alpha;
}

half Alpha(half albedoAlpha, half4 color, half cutoff)
{
    #if !defined(_SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A) && !defined(_GLOSSINESS_FROM_BASE_ALPHA)
        half alpha = albedoAlpha * color.a;
    #else
        half alpha = color.a;
    #endif

    alpha = AlphaDiscard(alpha, cutoff, 0.0);

    return alpha;
}

half4 SampleMetallicSpecGloss(float2 uv, half albedoAlpha)
{
    half4 specGloss;

    #ifdef _METALLICSPECGLOSSMAP
        int nMetallicGlossMapArrID = _MetallicGlossMapArr_ID;
        specGloss = SAMPLE_METALLICGLOSS(uv, nMetallicGlossMapArrID);
        #ifdef _SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A
            specGloss.a = albedoAlpha * _Smoothness;
        #else
            specGloss.a *= _Smoothness;
        #endif
    // #else // _METALLICSPECGLOSSMAP
    //     #if _SPECULAR_SETUP
    //         specGloss.rgb = _SpecColor.rgb;
    //     #else
    //         specGloss.rgb = _Metallic.rrr;
    //     #endif

    //     #ifdef _SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A
    //         specGloss.a = albedoAlpha * _Smoothness;
    //     #else
    //         specGloss.a = _Smoothness;
    //     #endif
    #endif

    return specGloss;
}

half3 SampleNormal(float2 uv, half scale)
{
    #ifdef _NORMALMAP
        int nBumpMapArrID = _BumpMapArr_ID;
        half4 n = SAMPLE_BUMPMAP(uv, nBumpMapArrID);
        #if BUMP_SCALE_NOT_SUPPORTED
            return UnpackNormal(n);
        #else
            return UnpackNormalScale(n, scale);
        #endif
    #else
        return half3(0.0, 0.0, 1.0);
    #endif
}

half3 SampleEmission(float2 uv, half3 emissionColor)
{
    #ifndef _EMISSION
        return half3(0);
    #else
        int nEmissionMapArrID = _EmissionMapArr_ID;
        return SAMPLE_EMISSIONMAP(uv,nEmissionMapArrID).rgb * emissionColor;
    #endif
}

void InitializeStandardLitSurfaceDataUTS(float2 uv, out SurfaceData outSurfaceData)
{
    //outSurfaceData = (SurfaceData)0;
    // half4 albedoAlpha = SampleAlbedoAlpha(uv, TEXTURE2D_ARGS(_BaseMap, sampler_BaseMap));
    half4 albedoAlpha = half4(1.0,1.0,1.0,1.0);

    outSurfaceData.alpha = Alpha(albedoAlpha.a, _BaseColor, _Cutoff);

    half4 specGloss = SampleMetallicSpecGloss(uv, albedoAlpha.a);
    outSurfaceData.albedo = albedoAlpha.rgb * _BaseColor.rgb;

    //#if _SPECULAR_SETUP
        //outSurfaceData.metallic = 1.0;
        //outSurfaceData.specular = specGloss.rgb;
    //#else
        outSurfaceData.metallic = specGloss.r;
        outSurfaceData.specular = half3(0.0, 0.0, 0.0);
    //#endif

    outSurfaceData.smoothness = specGloss.a;
    outSurfaceData.normalTS = SampleNormal(uv, _BumpScale);
    //outSurfaceData.occlusion = SampleOcclusion(uv);
    outSurfaceData.emission = SampleEmission(uv, _EmissionColor.rgb);
}

float3 GetCameraPositionWS()
{
    return vec3(worldView[3][0], worldView[3][1], worldView[3][2]);
}

half3 GetWorldSpaceNormalizeViewDir(float3 positionWS)
{
    // Perspective
    float3 V = GetCameraPositionWS() - positionWS;
    return half3(normalize(V));
}

// Normalize that account for vectors with zero length
real3 SafeNormalize(float3 inVec)
{
    float dp3 = max(FLT_MIN, dot(inVec, inVec));
    return inVec * rsqrt(dp3);
}

half3 NormalizeNormalPerPixel(half3 normalWS)
{
// With XYZ normal map encoding we sporadically sample normals with near-zero-length causing Inf/NaN
#if defined(UNITY_NO_DXT5nm) && defined(_NORMALMAP)
    return SafeNormalize(normalWS);
#else
    return normalize(normalWS);
#endif
}

uniform float4 _ScaledScreenParams;

float4 GetScaledScreenParams()
{
    return _ScaledScreenParams;
}

uniform vec2 _ScaleBiasRt;

void TransformScreenUV(inout float2 uv, float screenHeight)
{
    #if defined(UNITY_UV_STARTS_AT_TOP)
    uv.y = screenHeight - (uv.y * _ScaleBiasRt.x + _ScaleBiasRt.y * screenHeight);
    #endif
}

void TransformScreenUV(inout float2 uv)
{
    #if defined(UNITY_UV_STARTS_AT_TOP)
    TransformScreenUV(uv, GetScaledScreenParams().y);
    #endif
}

void TransformNormalizedScreenUV(inout float2 uv)
{
    #if defined(UNITY_UV_STARTS_AT_TOP)
    TransformScreenUV(uv, 1.0);
    #endif
}

#define rcp(x) (1.0/x)

float2 GetNormalizedScreenSpaceUV(float2 positionCS)
{
    float2 normalizedScreenSpaceUV = positionCS.xy * rcp(GetScaledScreenParams().xy);
    TransformNormalizedScreenUV(normalizedScreenSpaceUV);
    return normalizedScreenSpaceUV;
}

float2 GetNormalizedScreenSpaceUV(float4 positionCS)
{
    return GetNormalizedScreenSpaceUV(positionCS.xy);
}

void InitializeInputData(Varyings varyings_input, half3 normalTS, out InputData inputData)
{
    //inputData = (InputData)0;

    #if defined(REQUIRES_WORLD_SPACE_POS_INTERPOLATOR)
        inputData.positionWS = varyings_input.positionWS;
    #endif

    half3 viewDirWS = GetWorldSpaceNormalizeViewDir(varyings_input.positionWS);
    #if defined(_NORMALMAP) || defined(_DETAIL)
        float sgn = varyings_input.tangentWS.w;      // should be either +1 or -1
        float3 bitangent = sgn * cross(varyings_input.normalWS.xyz, varyings_input.tangentWS.xyz);
        half3x3 tangentToWorld = half3x3(varyings_input.tangentWS.xyz, bitangent.xyz, varyings_input.normalWS.xyz);
    
        #if defined(_NORMALMAP)
            inputData.tangentToWorld = tangentToWorld;
        #endif
        inputData.normalWS = TransformTangentToWorld(normalTS, tangentToWorld);
    #else
        inputData.normalWS = varyings_input.normalWS;
    #endif

    inputData.normalWS = NormalizeNormalPerPixel(inputData.normalWS);
    inputData.viewDirectionWS = viewDirWS;

    // #if defined(REQUIRES_VERTEX_SHADOW_COORD_INTERPOLATOR)
    //     inputData.shadowCoord = varyings_input.shadowCoord;
    // #elif defined(MAIN_LIGHT_CALCULATE_SHADOWS)
    //     inputData.shadowCoord = TransformWorldToShadowCoord(inputData.positionWS);
    // #else
    //     inputData.shadowCoord = float4(0, 0, 0, 0);
    // #endif
    
    inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(varyings_input.positionCS);
    //inputData.shadowMask = SAMPLE_SHADOWMASK(varyings_input.staticLightmapUV);
}

real PerceptualSmoothnessToPerceptualRoughness(real perceptualSmoothness)
{
    return (1.0 - perceptualSmoothness);
}

real PerceptualRoughnessToRoughness(real perceptualRoughness)
{
    return perceptualRoughness * perceptualRoughness;
}

void InitializeBRDFDataDirect(half3 albedo, half3 diffuse, half3 specular, half reflectivity, half oneMinusReflectivity, half smoothness, inout half alpha, out BRDFData outBRDFData)
{
    //outBRDFData = (BRDFData)0;
    outBRDFData.albedo = albedo;
    outBRDFData.diffuse = diffuse;
    outBRDFData.specular = specular;
    outBRDFData.reflectivity = reflectivity;

    outBRDFData.perceptualRoughness = PerceptualSmoothnessToPerceptualRoughness(smoothness);
    outBRDFData.roughness           = max(PerceptualRoughnessToRoughness(outBRDFData.perceptualRoughness), HALF_MIN_SQRT);
    outBRDFData.roughness2          = max(outBRDFData.roughness * outBRDFData.roughness, HALF_MIN);
    outBRDFData.grazingTerm         = saturate(smoothness + reflectivity);
    outBRDFData.normalizationTerm   = outBRDFData.roughness * half(4.0) + half(2.0);
    outBRDFData.roughness2MinusOne  = outBRDFData.roughness2 - half(1.0);

    // Input is expected to be non-alpha-premultiplied while ROP is set to pre-multiplied blend.
    // We use input color for specular, but (pre-)multiply the diffuse with alpha to complete the standard alpha blend equation.
    // In shader: Cs' = Cs * As, in ROP: Cs' + Cd(1-As);
    // i.e. we only alpha blend the diffuse part to background (transmittance).
    #if defined(_ALPHAPREMULTIPLY_ON)
        // TODO: would be clearer to multiply this once to accumulated diffuse lighting at end instead of the surface property.
        outBRDFData.diffuse *= alpha;
    #endif
}

// standard dielectric reflectivity coef at incident angle (= 4%)
#define kDielectricSpec vec4(0.04, 0.04, 0.04, 1.0 - 0.04)

half OneMinusReflectivityMetallic(half metallic)
{
    // We'll need oneMinusReflectivity, so
    //   1-reflectivity = 1-lerp(dielectricSpec, 1, metallic) = lerp(1-dielectricSpec, 0, metallic)
    // store (1-dielectricSpec) in kDielectricSpec.a, then
    //   1-reflectivity = lerp(alpha, 0, metallic) = alpha + metallic*(0 - alpha) =
    //                  = alpha - metallic * alpha
    half oneMinusDielectricSpec = kDielectricSpec.a;
    return oneMinusDielectricSpec - metallic * oneMinusDielectricSpec;
}

// Initialize BRDFData for material, managing both specular and metallic setup using shader keyword _SPECULAR_SETUP.
void InitializeBRDFData(half3 albedo, half metallic, half3 specular, half smoothness, inout half alpha, out BRDFData outBRDFData)
{
// #ifdef _SPECULAR_SETUP
//     half reflectivity = ReflectivitySpecular(specular);
//     half oneMinusReflectivity = half(1.0) - reflectivity;
//     half3 brdfDiffuse = albedo * oneMinusReflectivity;
//     half3 brdfSpecular = specular;
// #else
    half oneMinusReflectivity = OneMinusReflectivityMetallic(metallic);
    half reflectivity = half(1.0) - oneMinusReflectivity;
    half3 brdfDiffuse = albedo * oneMinusReflectivity;
    vec4 dielectricSpec = kDielectricSpec;
    half3 brdfSpecular = lerp(dielectricSpec.rgb, albedo, metallic);
//#endif

    InitializeBRDFDataDirect(albedo, brdfDiffuse, brdfSpecular, reflectivity, oneMinusReflectivity, smoothness, alpha, outBRDFData);
}

real3 UnpackNormalAG(real4 packedNormal, real scale)
{
    real3 normal;
    normal.xy = packedNormal.ag * 2.0 - 1.0;
    normal.z = max(1.0e-16, sqrt(1.0 - saturate(dot(normal.xy, normal.xy))));

    // must scale after reconstruction of normal.z which also
    // mirrors UnpackNormalRGB(). This does imply normal is not returned
    // as a unit length vector but doesn't need it since it will get normalized after TBN transformation.
    // If we ever need to blend contributions with built-in shaders for URP
    // then we should consider using UnpackDerivativeNormalAG() instead like
    // HDRP does since derivatives do not use renormalization and unlike tangent space
    // normals allow you to blend, accumulate and scale contributions correctly.
    normal.xy *= scale;
    return normal;
}

// Unpack normal as DXT5nm (1, y, 0, x) or BC5 (x, y, 0, 1)
real3 UnpackNormalmapRGorAG(real4 packedNormal, real scale)
{
    // Convert to (?, y, 0, x)
    packedNormal.a *= packedNormal.r;
    return UnpackNormalAG(packedNormal, scale);
}

real3 UnpackNormalScale(real4 packedNormal, real bumpScale)
{
    return UnpackNormalmapRGorAG(packedNormal, bumpScale);
}

float Pow4(float x)
{
    return (x * x) * (x * x);
}

//#ifndef UNITY_SPECCUBE_LOD_STEPS
    // This is actuall the last mip index, we generate 7 mips of convolution
    #define UNITY_SPECCUBE_LOD_STEPS 6
//#endif

// //-----------------------------------------------------------------------------
// // Util image based lighting
// //-----------------------------------------------------------------------------

// // The *approximated* version of the non-linear remapping. It works by
// // approximating the cone of the specular lobe, and then computing the MIP map level
// // which (approximately) covers the footprint of the lobe with a single texel.
// // Improves the perceptual roughness distribution.
// float PerceptualRoughnessToMipmapLevel(float perceptualRoughness, uint maxMipLevel)
// {
//     perceptualRoughness = perceptualRoughness * (1.7 - 0.7 * perceptualRoughness);

//     return perceptualRoughness * maxMipLevel;
// }

// real PerceptualRoughnessToMipmapLevel(real perceptualRoughness)
// {
//     return PerceptualRoughnessToMipmapLevel(perceptualRoughness, UNITY_SPECCUBE_LOD_STEPS);
// }

// float PositivePow(float base, float power) { return pow(abs(base), power); }
// // float2 PositivePow(float2 base, float2 power) { return pow(abs(base), power); }
// // float3 PositivePow(float3 base, float3 power) { return pow(abs(base), power); }
// // float4 PositivePow(float4 base, float4 power) { return pow(abs(base), power); }

// real3 DecodeHDREnvironment(real4 encodedIrradiance, real4 decodeInstructions)
// {
//     // Take into account texture alpha if decodeInstructions.w is true(the alpha value affects the RGB channels)
//     real alpha = max(decodeInstructions.w * (encodedIrradiance.a - 1.0) + 1.0, 0.0);

//     // If Linear mode is not supported we can skip exponent part
//     return (decodeInstructions.x * PositivePow(alpha, decodeInstructions.y)) * encodedIrradiance.rgb;
// }

half3 GlossyEnvironmentReflection(half3 reflectVector, half perceptualRoughness, half occlusion)
{
// #if !defined(_ENVIRONMENTREFLECTIONS_OFF)
//     half3 irradiance;
//     half mip = PerceptualRoughnessToMipmapLevel(perceptualRoughness);
//     half4 encodedIrradiance = half4(SAMPLE_TEXTURECUBE_LOD(unity_SpecCube0, samplerunity_SpecCube0, reflectVector, mip));

//     irradiance = DecodeHDREnvironment(encodedIrradiance, unity_SpecCube0_HDR);

//     return irradiance * occlusion;
// #else

    return half3(_GlossyEnvironmentColor.rgb * occlusion);
//#endif // _ENVIRONMENTREFLECTIONS_OFF
}

// Computes the specular term for EnvironmentBRDF
half3 EnvironmentBRDFSpecular(BRDFData brdfData, half fresnelTerm)
{
    float surfaceReduction = 1.0 / (brdfData.roughness2 + 1.0);
    return half3(surfaceReduction * lerp(brdfData.specular, vec3(brdfData.grazingTerm), fresnelTerm));
}

half3 EnvironmentBRDF(BRDFData brdfData, half3 indirectDiffuse, half3 indirectSpecular, half fresnelTerm)
{
    half3 c = indirectDiffuse * brdfData.diffuse;
    c += indirectSpecular * EnvironmentBRDFSpecular(brdfData, fresnelTerm);
    return c;
}

half3 GlobalIlluminationUTS(BRDFData brdfData, half3 bakedGI, half occlusion, half3 normalWS, half3 viewDirectionWS, float3 positionWS, float2 normalizedScreenSpaceUV)
{
    half3 reflectVector = reflect(-viewDirectionWS, normalWS);
    half fresnelTerm = Pow4(1.0 - saturate(dot(normalWS, viewDirectionWS)));

    half3 indirectDiffuse = bakedGI * occlusion;
    // #if USE_FORWARD_PLUS
    //     half3 irradiance = CalculateIrradianceFromReflectionProbes(reflectVector, positionWS, brdfData.perceptualRoughness, normalizedScreenSpaceUV);
    //     half3 indirectSpecular = irradiance * occlusion;
    // #else
        half3 indirectSpecular = GlossyEnvironmentReflection(reflectVector, brdfData.perceptualRoughness, occlusion);
    //#endif
    return EnvironmentBRDF(brdfData, indirectDiffuse, indirectSpecular, fresnelTerm);
    //return half3(0.0);
}

half3 LinearToGammaSpace (half3 linRGB)
{
    linRGB = max(linRGB, half3(0.0, 0.0, 0.0));
    linRGB.r = pow(linRGB.r, 0.416666667);
    linRGB.g = pow(linRGB.g, 0.416666667);
    linRGB.b = pow(linRGB.b, 0.416666667);
    // An almost-perfect approximation from http://chilliant.blogspot.com.au/2012/08/srgb-approximations-for-hlsl.html?m=1
    return max(1.055 * linRGB - 0.055, half3(0.0));

    // Exact version, useful for debugging.
    //return half3(LinearToGammaSpaceExact(linRGB.r), LinearToGammaSpaceExact(linRGB.g), LinearToGammaSpaceExact(linRGB.b));
}

// normal should be normalized, w=1.0
half3 SHEvalLinearL0L1(half4 normal)
{
    half3 x;

    // Linear (L1) + constant (L0) polynomial terms
    x.r = dot(unity_SHAr, normal);
    x.g = dot(unity_SHAg, normal);
    x.b = dot(unity_SHAb, normal);

    return x;
}

// normal should be normalized, w=1.0
half3 SHEvalLinearL2(half4 normal)
{
    half3 x1, x2;
    // 4 of the quadratic (L2) polynomials
    half4 vB = normal.xyzz * normal.yzzx;
    x1.r = dot(unity_SHBr, vB);
    x1.g = dot(unity_SHBg, vB);
    x1.b = dot(unity_SHBb, vB);

    // Final (5th) quadratic (L2) polynomial
    half vC = normal.x*normal.x - normal.y*normal.y;
    x2 = unity_SHC.rgb * vC;
    
    return x1 + x2;
}

// normal should be normalized, w=1.0
// output in active color space
half3 ShadeSH9(half4 normal)
{
    // Linear + constant polynomial terms
    half3 res = SHEvalLinearL0L1(normal);

    // Quadratic polynomials
    res += SHEvalLinearL2(normal);

    #ifdef UNITY_COLORSPACE_GAMMA
        res = LinearToGammaSpace(res);
    #endif

    return res;
}

half3 GetLightColor(UtsLight light)
{
    return light.color * light.distanceAttenuation;
}

float4 fragDoubleShadeFeather(VertexOutput i)
{
    float2 Set_UV0 = i.uv0;
    
    i.normalDir = normalize(i.normalDir);
    float3 viewDirection = normalize(_WorldSpaceCameraPos.xyz - i.posWorld.xyz);

    float3x3 tangentTransform = float3x3( i.tangentDir, i.bitangentDir, i.normalDir);

    int nNormalMapArrID = _NormalMapArr_ID;
    float4 normalMapOutput = SAMPLE_NORMALMAP(Set_UV0, nNormalMapArrID);
    float3 _NormalMap_var = UnpackNormalScale(normalMapOutput, _BumpScale);

    float3 normalLocal = _NormalMap_var.rgb;
    float3 normalDirection = normalize(mul( normalLocal, tangentTransform )); // Perturbed normals

    // todo. not necessary to calc gi factor in  shadowcaster pass.
    SurfaceData surfaceData;
    InitializeStandardLitSurfaceDataUTS(i.uv0, surfaceData);

    InputData inputData;
    Varyings  varying_input;

    // #ifdef LIGHTMAP_ON

    // #else
    //     varying_input.vertexSH = i.vertexSH;
    // #endif
    varying_input.uv = i.uv0;
    varying_input.positionCS = i.pos;


    #ifdef REQUIRES_VERTEX_SHADOW_COORD_INTERPOLATOR
        varying_input.shadowCoord = i.shadowCoord;
    #endif

    #ifdef REQUIRES_WORLD_SPACE_POS_INTERPOLATOR
        varying_input.positionWS = i.posWorld.xyz;
    #endif

    #ifdef _NORMALMAP
        varying_input.normalWS = half4(i.normalDir, viewDirection.x);      // xyz: normal, w: viewDir.x
        varying_input.tangentWS = half4(i.tangentDir, viewDirection.y);        // xyz: tangent, w: viewDir.y
        //#if (VERSION_LOWER(7, 5))
            varying_input.bitangentWS = half4(i.bitangentDir, viewDirection.z);    // xyz: bitangent, w: viewDir.z
        //#endif
    #else //ifdef _NORMALMAP
        varying_input.normalWS = half3(i.normalDir);
        //#if (VERSION_LOWER(12, 0))  
            //varying_input.viewDirWS = half3(viewDirection);
        //#endif  //    #if (VERSION_LOWER(12, 0))  
    #endif
    
    InitializeInputData(varying_input, surfaceData.normalTS, inputData);

    BRDFData brdfData;
    InitializeBRDFData( surfaceData.albedo,
                        surfaceData.metallic,
                        surfaceData.specular,
                        surfaceData.smoothness,
                        surfaceData.alpha,
                        brdfData);

    half3 envColor = GlobalIlluminationUTS(brdfData, inputData.bakedGI, surfaceData.occlusion, inputData.normalWS, inputData.viewDirectionWS, i.posWorld.xyz, inputData.normalizedScreenSpaceUV);
    envColor *= 1.8f;

    UtsLight mainLight;// = GetMainUtsLightByID(i.mainLightID, i.posWorld.xyz, inputData.shadowCoord, i.positionCS);
    mainLight.direction = _LightDirection.xyz;
    mainLight.color = _LightColor.xyz;
    mainLight.distanceAttenuation = _LightDirection.w;
    mainLight.shadowAttenuation = 1.0f;
    mainLight.type = int(0);

    half3 mainLightColor = GetLightColor(mainLight);
    int nMainTexArrID = _MainTexArr_ID;
    float2 uv_maintex = TRANSFORM_TEX(Set_UV0, _MainTex);
    float4 _MainTex_var = SAMPLE_MAINTEX(uv_maintex,nMainTexArrID);
    
    // Clipping modes - early outs
    float fAlphaClip = 0.0;
    #if defined(_IS_CLIPPING_MODE)
    {
        fAlphaClip = _MainTex_var.a * _BaseColor.a;
        AlphaClip(fAlphaClip, _Clipping_Level);
    }
    #endif
    
    #if defined(_IS_CLIPPING_TRANSMODE)
    {
        fAlphaClip = _MainTex_var.a * _BaseColor.a;
        AlphaClip(fAlphaClip, _Clipping_Level);
    }
    #endif


    float shadowAttenuation = 1.0;
    #if defined(_MAIN_LIGHT_SHADOWS) || defined(_MAIN_LIGHT_SHADOWS_CASCADE) || defined(_MAIN_LIGHT_SHADOWS_SCREEN)
        shadowAttenuation = mainLight.shadowAttenuation;
    #endif



    // Mainlight colour and default lighting colour (Unlit)
    float3 defaultLightDirection = normalize(UNITY_MATRIX_V[2].xyz + UNITY_MATRIX_V[1].xyz);
    float3 defaultLightColor = saturate(max(half3(0.05,0.05,0.05)*_Unlit_Intensity,max(ShadeSH9(half4(0.0, 0.0, 0.0, 1.0)),ShadeSH9(half4(0.0, -1.0, 0.0, 1.0)).rgb)*_Unlit_Intensity));
    float3 customLightDirection = normalize(mul( unity_ObjectToWorld, float4(((float3(1.0,0.0,0.0)*_Offset_X_Axis_BLD*10.0)+(float3(0.0,1.0,0.0)*_Offset_Y_Axis_BLD*10.0)+(float3(0.0,0.0,-1.0)*lerp(-1.0,1.0,_Inverse_Z_Axis_BLD))),0.0)).xyz);
    float3 lightDirection = normalize(lerp(defaultLightDirection, mainLight.direction.xyz,any(bvec3(mainLight.direction.xyz)) ? 1.0 : 0.0));
    lightDirection = lerp(lightDirection, customLightDirection, _Is_BLD);

    half3 originalLightColor = mainLightColor.rgb;

    float3 lightColor = lerp(max(defaultLightColor, originalLightColor), max(defaultLightColor, saturate(originalLightColor)), _Is_Filter_LightColor);


    ////// Lighting:
    float3 halfDirection = normalize(viewDirection+lightDirection);
    //_Color = _BaseColor;


    // SHARED START
    float3 Set_LightColor = lightColor.rgb;
    float3 Set_BaseColor = lerp( (_BaseColor.rgb*_MainTex_var.rgb), ((_BaseColor.rgb*_MainTex_var.rgb)*Set_LightColor), _Is_LightColor_Base );
    
    // 1st ShadeMap
    int n1st_ShadeMapArrID = _1st_ShadeMapArr_ID;
    float4 _1st_ShadeMap_var = lerp(SAMPLE_1ST_SHADEMAP(TRANSFORM_TEX(Set_UV0, _1st_ShadeMap),n1st_ShadeMapArrID),float4(Set_BaseColor.rgb, _MainTex_var.a),_Use_BaseAs1st);
    float3 Set_1st_ShadeColor = lerp( (_1st_ShadeColor.rgb*_1st_ShadeMap_var.rgb), ((_1st_ShadeColor.rgb*_1st_ShadeMap_var.rgb)*Set_LightColor), _Is_LightColor_1st_Shade );
    // 2nd ShadeMap
    int n2nd_ShadeMapArrID = _2nd_ShadeMapArr_ID;
    float4 _2nd_ShadeMap_var = lerp(SAMPLE_2ND_SHADEMAP(TRANSFORM_TEX(Set_UV0, _2nd_ShadeMap),n2nd_ShadeMapArrID),_1st_ShadeMap_var,_Use_1stAs2nd);
    float3 Set_2nd_ShadeColor = lerp( (_2nd_ShadeColor.rgb*_2nd_ShadeMap_var.rgb), ((_2nd_ShadeColor.rgb*_2nd_ShadeMap_var.rgb)*Set_LightColor), _Is_LightColor_2nd_Shade );
    float _HalfLambert_var = 0.5*dot(lerp( i.normalDir, normalDirection, _Is_NormalMapToBase ),lightDirection)+0.5;

    int nSet_1st_ShadePositionArrID = _Set_1st_ShadePositionArr_ID;
    float4 _Set_1st_ShadePosition_var = SAMPLE_SET_1ST_SHADEPOSITION(TRANSFORM_TEX(Set_UV0,_Set_1st_ShadePosition),nSet_1st_ShadePositionArrID);

    int nSet_2nd_ShadePositionArrID = _Set_2nd_ShadePositionArr_ID;
    float4 _Set_2nd_ShadePosition_var = SAMPLE_SET_2ND_SHADEPOSITION(TRANSFORM_TEX(Set_UV0,_Set_2nd_ShadePosition),nSet_2nd_ShadePositionArrID);

    //Minmimum value is same as the Minimum Feather's value with the Minimum Step's value as threshold.
    float _SystemShadowsLevel_var = (shadowAttenuation*0.5)+0.5+_Tweak_SystemShadowsLevel > 0.001 ? (shadowAttenuation*0.5)+0.5+_Tweak_SystemShadowsLevel : 0.0001;
    float Set_FinalShadowMask = saturate((1.0 + ( (lerp( _HalfLambert_var, _HalfLambert_var*saturate(_SystemShadowsLevel_var), _Set_SystemShadowsToBase ) - (_BaseColor_Step-_BaseShade_Feather)) * ((1.0 - _Set_1st_ShadePosition_var.rgb).r - 1.0) ) / (_BaseColor_Step - (_BaseColor_Step-_BaseShade_Feather))));

    //Composition: 3 Basic Colors as Set_FinalBaseColor
    float3 Set_FinalBaseColor = lerp(Set_BaseColor,lerp(Set_1st_ShadeColor,Set_2nd_ShadeColor,saturate((1.0 + ( (_HalfLambert_var - (_ShadeColor_Step-_1st2nd_Shades_Feather)) * ((1.0 - _Set_2nd_ShadePosition_var.rgb).r - 1.0) ) / (_ShadeColor_Step - (_ShadeColor_Step-_1st2nd_Shades_Feather))))),Set_FinalShadowMask); // Final Color

    // SHARED START
    int nSet_HighColorMaskArrID = _Set_HighColorMaskArr_ID;
    float4 _Set_HighColorMask_var = SAMPLE_HIGHCOLORMASK(TRANSFORM_TEX(Set_UV0, _Set_HighColorMask), nSet_HighColorMaskArrID);

    float _Specular_var = 0.5*dot(halfDirection,lerp( i.normalDir, normalDirection, _Is_NormalMapToHighColor ))+0.5; //  Specular                
    float _TweakHighColorMask_var = (saturate((_Set_HighColorMask_var.g+_Tweak_HighColorMaskLevel))*lerp( (1.0 - step(_Specular_var,(1.0 - pow(abs(_HighColor_Power),5.0)))), pow(abs(_Specular_var),exp2(lerp(11.0,1.0,_HighColor_Power))), _Is_SpecularToHighColor ));

    int nHighColor_TexArrID = _HighColor_TexArr_ID;
    float4 _HighColor_Tex_var = SAMPLE_HIGHCOLOR(TRANSFORM_TEX(Set_UV0, _HighColor_Tex), nHighColor_TexArrID);
    float3 vHighColour1st = _HighColor_Tex_var.rgb * _HighColor.rgb;
    float3 vHighColour2nd = (_HighColor_Tex_var.rgb * _HighColor.rgb) * Set_LightColor.rgb;
    float3 _HighColor_var = lerp( vHighColour1st, vHighColour2nd, _Is_LightColor_HighColor ) * _TweakHighColorMask_var;
    // SHARED END
    //Composition: 3 Basic Colors and HighColor as Set_HighColor
    float3 Set_HighColor = (lerp(SATURATE_IF_SDR((Set_FinalBaseColor-_TweakHighColorMask_var)), Set_FinalBaseColor, lerp(_Is_BlendAddToHiColor,1.0,_Is_SpecularToHighColor) )+lerp( _HighColor_var, (_HighColor_var*((1.0 - Set_FinalShadowMask)+(Set_FinalShadowMask*_TweakHighColorOnShadow))), _Is_UseTweakHighColorOnShadow ));

    // Rimlight - Mainlight only
    int nSet_RimLightMaskArrID = _Set_RimLightMaskArr_ID;
    float4 _Set_RimLightMask_var = SAMPLE_SET_RIMLIGHTMASK(TRANSFORM_TEX(Set_UV0, _Set_RimLightMask), nSet_RimLightMaskArrID);
    float3 _Is_LightColor_RimLight_var = lerp( _RimLightColor.rgb, (_RimLightColor.rgb*Set_LightColor.rgb), _Is_LightColor_RimLight );
    float _RimArea_var = abs(1.0 - dot(lerp( i.normalDir, normalDirection, _Is_NormalMapToRimLight ),viewDirection));
    float _RimLightPower_var = pow(_RimArea_var,exp2(lerp(3.0,0.0,_RimLight_Power)));
    float _Rimlight_InsideMask_var = saturate(lerp( (0.0 + ( (_RimLightPower_var - _RimLight_InsideMask) * (1.0 - 0.0) ) / (1.0 - _RimLight_InsideMask)), step(_RimLight_InsideMask,_RimLightPower_var), _RimLight_FeatherOff ));
    float _VertHalfLambert_var = 0.5*dot(i.normalDir,lightDirection)+0.5;
    float3 _LightDirection_MaskOn_var = lerp( (_Is_LightColor_RimLight_var*_Rimlight_InsideMask_var), (_Is_LightColor_RimLight_var*saturate((_Rimlight_InsideMask_var-((1.0 - _VertHalfLambert_var)+_Tweak_LightDirection_MaskLevel)))), _LightDirection_MaskOn );
    float _ApRimLightPower_var = pow(_RimArea_var,exp2(lerp(3.0,0.0,_Ap_RimLight_Power)));
    float3 Set_RimLight = (saturate((_Set_RimLightMask_var.g+_Tweak_RimLightMaskLevel))*lerp( _LightDirection_MaskOn_var, (_LightDirection_MaskOn_var+(lerp( _Ap_RimLightColor.rgb, (_Ap_RimLightColor.rgb*Set_LightColor), _Is_LightColor_Ap_RimLight )*saturate((lerp( (0.0 + ( (_ApRimLightPower_var - _RimLight_InsideMask) * (1.0 - 0.0) ) / (1.0 - _RimLight_InsideMask)), step(_RimLight_InsideMask,_ApRimLightPower_var), _Ap_RimLight_FeatherOff )-(saturate(_VertHalfLambert_var)+_Tweak_LightDirection_MaskLevel))))), _Add_Antipodean_RimLight ));
    //Composition: HighColor and RimLight as _RimLight_var
    float3 _RimLight_var = lerp( Set_HighColor, (Set_HighColor+Set_RimLight), _RimLight );
    // Rimlight - End

    // Matcap - Mainlight only
    // CameraRolling Stabilizer
    float3 _Camera_Right = UNITY_MATRIX_V[0].xyz;
    float3 _Camera_Front = UNITY_MATRIX_V[2].xyz;
    float3 _Up_Unit = float3(0.0, 1.0, 0.0);
    float3 _Right_Axis = cross(_Camera_Front, _Up_Unit);
    float _Rotate_MatCapUV_copy = _Rotate_MatCapUV;
    // Invert if it's "inside the mirror".
    half _sign_Mirror = i.mirrorFlag; // Mirror Script Determination: if sign_Mirror = -1, determine "Inside the mirror".
    if(_sign_Mirror < 0.0)
    {
        _Right_Axis = -1.0 * _Right_Axis;
        _Rotate_MatCapUV_copy = -1.0 * _Rotate_MatCapUV_copy;
    }
    else
    {
        _Right_Axis = _Right_Axis;
    }
    float _Camera_Right_Magnitude = sqrt(_Camera_Right.x*_Camera_Right.x + _Camera_Right.y*_Camera_Right.y + _Camera_Right.z*_Camera_Right.z);
    float _Right_Axis_Magnitude = sqrt(_Right_Axis.x*_Right_Axis.x + _Right_Axis.y*_Right_Axis.y + _Right_Axis.z*_Right_Axis.z);
    float _Camera_Roll_Cos = dot(_Right_Axis, _Camera_Right) / (_Right_Axis_Magnitude * _Camera_Right_Magnitude);
    float _Camera_Roll = acos(clamp(_Camera_Roll_Cos, -1.0, 1.0));
    half _Camera_Dir = _Camera_Right.y < 0.0 ? -1.0 : 1.0;
    float _Rot_MatCapUV_var_ang = (_Rotate_MatCapUV*3.141592654) - _Camera_Dir*_Camera_Roll*_CameraRolling_Stabilizer;
    //v.2.0.7
    float2 _Rot_MatCapNmUV_var = RotateUV(Set_UV0, (_Rotate_NormalMapForMatCapUV*3.141592654), float2(0.5, 0.5), 1.0);
    //V.2.0.6
    int nNormalMapForMatCapArrID = _NormalMapForMatCapArr_ID;
    float3 _NormalMapForMatCap_var = UnpackNormalScale(SAMPLE_NORMALMAPFORMATCAP(TRANSFORM_TEX(_Rot_MatCapNmUV_var, _NormalMapForMatCap), nNormalMapForMatCapArrID), _BumpScaleMatcap);
    // MatCap with camera skew correction
    float3 viewNormal = (mul(UNITY_MATRIX_V, float4(lerp( i.normalDir, mul( _NormalMapForMatCap_var.rgb, tangentTransform ).rgb, _Is_NormalMapForMatCap ),0.0))).rgb;
    float3 NormalBlend_MatcapUV_Detail = viewNormal.rgb * float3(-1.0,-1.0,1.0);
    float3 NormalBlend_MatcapUV_Base = (mul( UNITY_MATRIX_V, float4(viewDirection,0) ).rgb*float3(-1.0,-1.0,1.0)) + float3(0.0,0.0,1.0);
    float3 noSknewViewNormal = NormalBlend_MatcapUV_Base*dot(NormalBlend_MatcapUV_Base, NormalBlend_MatcapUV_Detail)/NormalBlend_MatcapUV_Base.b - NormalBlend_MatcapUV_Detail;                
    float2 _ViewNormalAsMatCapUV = (lerp(noSknewViewNormal,viewNormal,_Is_Ortho).rg*0.5)+0.5;
    // //v.2.0.7
    float2 _Rot_MatCapUV_var = RotateUV((0.0 + ((_ViewNormalAsMatCapUV - (0.0+_Tweak_MatCapUV)) * (1.0 - 0.0) ) / ((1.0-_Tweak_MatCapUV) - (0.0+_Tweak_MatCapUV))), _Rot_MatCapUV_var_ang, float2(0.5, 0.5), 1.0);

    // If it is "inside the mirror", flip the UV left and right.
    if(_sign_Mirror < 0.0)
    {
        _Rot_MatCapUV_var.x = 1.0-_Rot_MatCapUV_var.x;
    }
    else
    {
        _Rot_MatCapUV_var = _Rot_MatCapUV_var;
    }

    int nMatCap_SamplerArrID = _MatCap_SamplerArr_ID;
    float4 _MatCap_Sampler_var = SAMPLE_MATCAP(TRANSFORM_TEX(_Rot_MatCapUV_var, _MatCap_Sampler), nMatCap_SamplerArrID, _BlurLevelMatcap);

    int nSet_MatcapMaskArrID = _Set_MatcapMaskArr_ID;
    float4 _Set_MatcapMask_var = SAMPLE_SET_MATCAPMASK(TRANSFORM_TEX(Set_UV0, _Set_MatcapMask), nSet_MatcapMaskArrID);

    // MatcapMask
    float _Tweak_MatcapMaskLevel_var = saturate(lerp(_Set_MatcapMask_var.g, (1.0 - _Set_MatcapMask_var.g), _Inverse_MatcapMask) + _Tweak_MatcapMaskLevel);
    float3 _Is_LightColor_MatCap_var = lerp( (_MatCap_Sampler_var.rgb*_MatCapColor.rgb), ((_MatCap_Sampler_var.rgb*_MatCapColor.rgb)*Set_LightColor), _Is_LightColor_MatCap );
    // ShadowMask on Matcap in Blend mode : multiply
    float3 Set_MatCap = lerp( _Is_LightColor_MatCap_var, (_Is_LightColor_MatCap_var*((1.0 - Set_FinalShadowMask)+(Set_FinalShadowMask*_TweakMatCapOnShadow)) + lerp(Set_HighColor*Set_FinalShadowMask*(1.0-_TweakMatCapOnShadow), float3(0.0, 0.0, 0.0), _Is_BlendAddToMatCap)), _Is_UseTweakMatCapOnShadow );

    // Composition: RimLight and MatCap as finalColor
    // Broke down finalColor composition
    float3 matCapColorOnAddMode = _RimLight_var+Set_MatCap*_Tweak_MatcapMaskLevel_var;
    float _Tweak_MatcapMaskLevel_var_MultiplyMode = _Tweak_MatcapMaskLevel_var * lerp (1.0, (1.0 - (Set_FinalShadowMask)*(1.0 - _TweakMatCapOnShadow)), _Is_UseTweakMatCapOnShadow);
    float3 matCapColorOnMultiplyMode = Set_HighColor*(1.0-_Tweak_MatcapMaskLevel_var_MultiplyMode) + Set_HighColor*Set_MatCap*_Tweak_MatcapMaskLevel_var_MultiplyMode + lerp(float3(0.0,0.0,0.0),Set_RimLight,_RimLight);
    float3 matCapColorFinal = lerp(matCapColorOnMultiplyMode, matCapColorOnAddMode, _Is_BlendAddToMatCap);
    float3 finalColor = lerp(_RimLight_var, matCapColorFinal, _MatCap);// Final Composition before Emissive
    // Matcap - End

    // GI_Intensity with Intensity Multiplier Filter
    float3 envLightColor = envColor.rgb;
    float envLightIntensity = 0.299*envLightColor.r + 0.587*envLightColor.g + 0.114*envLightColor.b <1.0 ? (0.299*envLightColor.r + 0.587*envLightColor.g + 0.114*envLightColor.b) : 1.0;
    float3 pointLightColor = float3(0.0);


    // _EMISSIVE_SIMPLE
    int nEmissive_TexArrID = _Emissive_TexArr_ID;
    float4 _Emissive_Tex_var = SAMPLE_EMISSIVE(TRANSFORM_TEX(Set_UV0, _Emissive_Tex), nEmissive_TexArrID);
    float emissiveMask = _Emissive_Tex_var.a;
    vec3 newEmissive = _Emissive_Tex_var.rgb * _Emissive_Color.rgb * emissiveMask;


    //Final Composition#if 
    finalColor = SATURATE_IF_SDR(finalColor) + (envLightColor*envLightIntensity*_GI_Intensity*smoothstep(1.0,0.0,envLightIntensity/2.0)) + newEmissive;
    finalColor += pointLightColor;


    half4 finalRGBA = half4(finalColor,1.0);
    float Set_Opacity = 1.0;
    #if defined(_IS_CLIPPING_MODE)
    {
        Set_Opacity = SATURATE_IF_SDR((_MainTex_var.a+_Tweak_transparency));
        finalRGBA = half4(finalColor,Set_Opacity);
    }
    #endif
    #if defined(_IS_CLIPPING_TRANSMODE)
    {
        Set_Opacity = SATURATE_IF_SDR((_MainTex_var.a+_Tweak_transparency));
        finalRGBA = half4(finalColor,Set_Opacity);
    }
    #endif
    return finalRGBA;
}

void main(void)
{
    VertexOutput vertOutput;
    vertOutput.pos; // float4
    vertOutput.uv0; // float2
    vertOutput.posWorld; // float4
    vertOutput.normalDir; // float3
    vertOutput.tangentDir; // float3
    vertOutput.bitangentDir; // float3
    vertOutput.mirrorFlag; // float
    vertOutput.positionCS; // float4
    vertOutput.mainLightID; // int
    fragColor = fragDoubleShadeFeather(vertOutput);
}`
