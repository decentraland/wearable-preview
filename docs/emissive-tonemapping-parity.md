# Babylon ↔ Unity emissive / tonemapping parity

Branch: `fix/emissive-tonemapping-unity-parity`

## Problem

Wearables with a non-zero `emissiveFactor` render very differently in the Babylon
preview than in the Unity preview (`?unity=true`), which is the reference look.

Reproduced with `Hell's Angels`
(`0x65ed61c4fc2d1102ed574a48e664b90b7a300ea8` item `0`,
content hash `QmSqtxt7bfbhm8W5bNVisrd2rpbSsG7X3bsWrRCUEQXh2G`). Its two materials
isolate the cause:

| material           | baseColorTexture         | alphaMode | emissiveFactor              | Unity vs Babylon |
| ------------------ | ------------------------ | --------- | --------------------------- | ---------------- |
| `Material.001`     | `Fire2.jpg` (orange)     | `BLEND`   | `[0.4812, 0, 0.0036]`       | **diverges**     |
| `Material.002`     | black→red gradient       | `OPAQUE`  | `[0, 0, 0]`                 | matches          |

Only the emissive material diverges. Sampled pixels: Unity feathers `#FDFBD2`
(flat pale cream, fire texture invisible), Babylon `#E04020` (saturated fire red).

## Cause

**Unity (`aang-renderer`) multiplies `emissiveFactor` by 12.5 and tonemaps the result.**

- `Assets/Scripts/Loading/ToonMaterialGenerator.cs:12,55` —
  `_Emissive_Color = gltfMaterial.Emissive * EMISSIVE_MAGIC_NUMBER`, `EMISSIVE_MAGIC_NUMBER = 5f`.
- `DCL_ToonBodyDoubleShadeWithFeather.hlsl:382` —
  `emissive = _Emissive_Tex_var.rgb * _Emissive_Color.rgb * 2.5f`. There is no emissive
  texture on this material and `_Emissive_Tex` defaults to `"white"` (`DCL_Toon.shader:158`),
  so it passes through at 1.0.
- Net **×12.5**: `0.4812 → 6.02` linear red, well into HDR
  (`URP_Asset.asset`: `m_SupportsHDR: 1`, `m_ColorGradingMode: 1`).
- `URP_GlobalVolumeProfile.asset` then applies **ACES** tonemapping (`Tonemapping.mode: 2`)
  plus Bloom (threshold 1, intensity 1, scatter 0.6).

ACES walks a very bright saturated red up the red→orange→yellow→white path and
desaturates it. At 6.0 linear the base texture's own contribution (≤0.3 linear) is
swamped, which is why the Unity feathers are flat cream with zero fire detail while
the non-emissive inner gradient renders normally.

**Babylon (`wearable-preview`) applies `emissiveFactor` 1:1 with no tonemapping.**

- `src/lib/babylon/wearable.ts:39-48` only zeroes metallic/specular; emissive is untouched,
  so `emissiveColor` stays at the raw glTF value (verified at runtime: `[0.4812, 0, 0.0036]`).
- Nothing in `src/` ever sets `toneMappingEnabled`, so Babylon's default (off) applies and
  the LDR result simply clamps.
- `src/lib/babylon/scene.ts:235-238` adds a `GlowLayer` at `intensity = 2.0`, which latches
  onto that red emissive and pushes the saturated red further still.

Verified by loading the same GLB into a bare Babylon scene twice: with the current
`wearable-preview` setup, and with only two changes (emissive ×12.5, ACES enabled). The
second reproduces the Unity look.

## Constraints discovered while scoping

These shape the design and are the reason the plan is staged rather than one commit.

1. **Screenshots bypass camera post-processes.** `src/lib/scene.ts:23-26` uses
   `Tools.CreateScreenshotUsingRenderTargetAsync`, which renders into a fresh
   `RenderTargetTexture` (`node_modules/@babylonjs/core/Misc/screenshotTools.js:132-143`).
   The camera's post-process chain is *not* applied — only an explicitly added FXAA pass is.
   So tonemapping added via `DefaultRenderingPipeline` would show on the live canvas but
   **not** in the screenshots the shop/marketplace consume. Tonemapping via
   `scene.imageProcessingConfiguration` is applied *inside* the material shaders
   (`pbr.fragment`, `default.fragment` both include `imageProcessingFunctions`) and therefore
   does survive the RTT path.

2. **`getMetrics()` counts scene textures against a hardcoded ignore list**
   (`src/lib/scene.ts:5-12`). Any new rendering pipeline adds RTTs and would inflate the
   reported texture count that the Builder validates against.

3. **Facial features render entirely through the emissive channel.**
   `src/lib/babylon/face.ts:74-86` builds a `StandardMaterial` with `diffuseColor = Black()`
   and `emissiveTexture = mask`. `StandardMaterial` also applies scene image processing, so
   enabling ACES scene-wide *will* shift eyes / eyebrows / mouth (ACES maps linear 1.0 to
   ≈0.8 sRGB). This is the largest blast-radius risk in the change.

4. **VRM export serializes the live scene.** `src/lib/babylon/export.ts:437` runs
   `GLTF2Export` over the same `Scene` object. An in-place `emissiveColor *= 12.5` would be
   written into the exported file as `emissiveFactor: 6.01`, which is out of the glTF-spec
   `[0,1]` range.

5. **Ordering is not fully reproducible.** Unity composites the whole frame in HDR, then
   blooms, then tonemaps once. Babylon's material-level image processing tonemaps *per
   material, before alpha blending*. For stacked transparent emissive surfaces (exactly this
   wearable) the results will be close but not identical. Accepted for now; see step 5.

6. `docs/ai-agent-context.md:32` claims Babylon.js 8.x — the installed version is
   **4.2.2**. `TONEMAPPING_ACES` and the Hill `ACESFitted` implementation are present and
   identical to later versions, so the plan holds either way, but the doc should be corrected.

## Plan

### Step 1 — Emissive gain (new module)

New `src/lib/babylon/emissive.ts`:

- `UNITY_EMISSIVE_GENERATOR_GAIN = 5` — `ToonMaterialGenerator.EMISSIVE_MAGIC_NUMBER`
- `UNITY_EMISSIVE_SHADER_GAIN = 2.5` — `DCL_ToonBodyDoubleShadeWithFeather.hlsl:382`
- `UNITY_EMISSIVE_GAIN = UNITY_EMISSIVE_GENERATOR_GAIN * UNITY_EMISSIVE_SHADER_GAIN`
- `applyUnityEmissiveGain(material: PBRMaterial): void` — scales `emissiveColor`, records the
  original on `material.metadata.originalEmissiveColor`, and no-ops if already applied.

Keeping the two factors separate and named after their source keeps the link to
`aang-renderer` traceable when either side changes.

Call it from the existing cleanup loop in `src/lib/babylon/wearable.ts:39-48`. That loop is
the single funnel for every glTF material in the scene — body shape included, since the body
shape is itself loaded through `loadWearable`.

Idempotency matters: options updates re-render, and the guard prevents compounding.

### Step 2 — ACES tonemapping, with an exposure lift

In `createScene` (`src/lib/babylon/scene.ts`), after the scene is constructed:

```ts
root.imageProcessingConfiguration.toneMappingEnabled = true
root.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
root.imageProcessingConfiguration.exposure = getToneMappingExposure()
```

Scene-level (not `DefaultRenderingPipeline`) — see constraints 1 and 2.

**The exposure lift was not in the original plan and turned out to be required.** ACES
expects HDR input with headroom above 1.0. Unity's scene has it (many lights, GI, and the
emissive gain); this scene does not — its four lights sum to roughly 1.0 — so tonemapping
the raw values crushes the dark end. Measured on the reference wearable's *non-emissive*
material, which should not have moved at all:

| | outer feathers (emissive) | inner shape (non-emissive) |
| - | - | - |
| Unity (target) | `#FBE9BA` | `#751610` |
| Babylon before | `#F6AD9E` | `#982218` |
| ACES, exposure 1 | `#EFAD86` | `#400E0A` ← worse than before |
| **ACES, exposure 2 (shipped)** | **`#F9D2AF`** | **`#6D150F`** |
| ACES, exposure 3 | `#FADFC3` | `#7D1913` |

Exposure 1 would have traded the emissive bug for a darker catalogue, so the default started
at 2.0 — the conventional compensation for ACES over LDR-authored content — chosen from this
one wearable because the avatar could not be rendered locally at the time.

**Re-measured across the catalogue, 2.0 was too bright.** Overriding `?peerUrl=` and
`?marketplaceServerUrl=` to the `.org` endpoints makes the avatar render on the local dev
server (the "blank avatar" below was the dev config pointing at `.zone`), which allowed a
sweep against the Unity renderer over 10 marketplace wearables. Mean avatar luminance,
signed, against Unity's 120.0/255:

| exposure | luminance vs Unity | mean abs. error | per-pixel Δ |
| - | - | - | - |
| `toneMapping=none` (master) | +9.6 | 19.1 | 46.4 |
| 1.0 | −11.4 | 11.6 | 40.6 |
| 1.15 | −4.8 | 8.5 | 39.4 |
| **1.2 (shipped)** | **−2.8** | **8.7** | **39.6** |
| 1.3 | +0.9 | 10.0 | 40.1 |
| 2.0 | +20.3 | 23.6 | 49.6 |

At 2.0 the tonemapping made most of the catalogue *further* from Unity than master was — it
fixed emissive wearables and washed out everything else. The optimum is a flat basin from
1.1 to 1.3 on both metrics; 1.2 sits in it with less dark bias than 1.15. `?exposure=`
overrides it for QA sweeps.

Note this trades a little fidelity on the reference wearable's feathers (which favoured a
*higher* lift) for the rest of the catalogue, since emissive-heavy items are the minority.

### Step 3 — Keep the GlowLayer from compounding

With emissive at ×12.5 the existing `GlowLayer` (`scene.ts:235-238`) reads a 12.5× brighter
source and will bleed enormously. Feed it the pre-gain value:

```ts
glowLayer.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
  const original = (material as PBRMaterial).metadata?.originalEmissiveColor
  ...
}
```

Alternative if that proves fiddly: scale `glowLayer.intensity` down by `UNITY_EMISSIVE_GAIN`.
Either way the goal for this step is *no visible change* to glow — it is not the thing being
fixed, and holding it constant keeps step 2's effect readable in review.

### Step 4 — Protect the VRM export

`export.ts` already post-processes the serialized JSON (`stripAnimations`,
`applyUnlitMaterials`). Add a `normalizeEmissiveForExport(json)` alongside them that divides
`emissiveFactor` by `UNITY_EMISSIVE_GAIN` and clamps to `[0,1]`, so exported files stay
spec-valid regardless of what the preview does for display.

### Step 5 — Deferred: bloom and HDR compositing

Not in this change. True parity (composite in HDR → bloom → tonemap once) requires a
`DefaultRenderingPipeline`, which per constraint 1 first requires migrating `getScreenshot`
off `CreateScreenshotUsingRenderTarget` — `preserveDrawingBuffer: true` is already set at
`scene.ts:105-109`, so `CreateScreenshotAsync` against the canvas is a viable target — and
per constraint 2 requires extending `ignoreTextureList`. Separate PR.

### Step 6 — Backface culling

`ToonMaterialGenerator.cs:95` hardcodes `CullMode.Back`, ignoring the glTF `doubleSided`
flag; Babylon honours it. On the reference wearable — whose materials both declare
`"doubleSided": true` — every flat feather card drew from both sides, so Babylon showed the
full fan from the front *and* the back while Unity shows a subset from the front and the
full spread from the back.

`src/lib/babylon/culling.ts` forces `backFaceCulling = true` on every material in the
container, applied outside the `instanceof PBRMaterial` branch in `wearable.ts` because
Unity applies it to every material it generates, PBR or not. Measured subject coverage:

| view | doubleSided (before) | culled (after) |
| - | - | - |
| front | 88707 px | 61983 px |
| back | 115874 px | 88125 px |

Own escape hatch, `?culling=none`, kept separate from `?toneMapping=none`: this overrides
what the asset file itself declares and changes silhouettes anywhere authors relied on
double-sided geometry, so it needs to be rollback-able on its own. Arguably Unity is the one
misbehaving against the glTF spec here — matching it is a deliberate choice to follow the
reference look, and still deserves a catalogue-wide check for wearables that now show holes
(hair cards, skirts, capes are the likely candidates).

### QA escape hatch

`?toneMapping=none` rolls back the whole change — the gain *and* the tonemapping together,
since the gain without a tonemapper to compress it is worse than neither. `?exposure=N`
sweeps the lift. Both read `window.location.search` directly rather than going through
`PreviewConfig`, which lives in `@dcl/schemas` and would need a release to extend.

## Status

Steps 1–4, step 6, and the escape hatches are implemented. Step 5 (bloom / HDR compositing)
remains deferred as planned.

**Two known residual gaps against Unity**, both from step 5 being deferred:

- Feathers land at `#F9D2AF` against Unity's `#FBE9BA` — still slightly warmer and less
  bright, because Unity's bloom (threshold 1, intensity 1) pushes its highlights further
  toward white than a tonemapper alone can.
- Unity composites the whole frame in HDR then tonemaps once; this change tonemaps per
  material, before alpha blending (constraint 5). Stacked transparent emissive surfaces —
  exactly this wearable — will stay close but never identical.

**The local "blank avatar" was a dev-config issue, now worked around.** `src/config/env/dev.json`
points `PEER_URL` at `peer.decentraland.zone`, where mainnet marketplace wearables do not
exist. Passing `?peerUrl=https://peer.decentraland.org` and
`?marketplaceServerUrl=https://marketplace-api.decentraland.org` renders the avatar fine, which
is how the exposure sweep above was run — so skin, hair and facial features have now been
checked against the tonemapping across 38 wearables.

Two unrelated gotchas found while building that harness, both worth fixing separately:

- Unity ignores `?urn=` and silently falls back to a bare default avatar. Use `?contract=` +
  `?item=`, and note Unity only equips the item when a `?mode=` is set (`marketplace` works;
  `builder`, `profile` and `authentication` do not).
- `?profile=default` picks a random one of 159 default outfits per load, so any before/after
  screenshot comparison needs a pinned `default<N>`.

## Test cases

The repo currently has **no tests** — `npm test` runs jest with no config and no test files.
Step 1 of testing is therefore standing up a jest + ts config that can import from `src/`.

### Unit

| # | Target | Case | Expected |
| - | ------ | ---- | -------- |
| U1 | `UNITY_EMISSIVE_GAIN` | composition | `=== 12.5`, and `=== GENERATOR_GAIN * SHADER_GAIN` |
| U2 | `applyUnityEmissiveGain` | `emissiveColor = (0.4812, 0, 0.0036)` | becomes `(6.015, 0, 0.0453)` |
| U3 | `applyUnityEmissiveGain` | `emissiveColor = (0,0,0)` | stays `(0,0,0)` |
| U4 | `applyUnityEmissiveGain` | called twice on the same material | gain applied once (idempotent) |
| U5 | `applyUnityEmissiveGain` | original preserved | `metadata.originalEmissiveColor` equals the pre-gain value |
| U6 | `loadWearable` cleanup | non-`PBRMaterial` in container | left untouched |
| U7 | `normalizeEmissiveForExport` | `emissiveFactor: [6.015, 0, 0.0453]` | back to `[0.4812, 0, 0.0036]`, all channels within `[0,1]` |
| U8 | `normalizeEmissiveForExport` | material with no `emissiveFactor` | no-op, no crash |

### Rendering / integration

These need a Babylon scene in a headless GL context (or the manual matrix below). Worth doing
headless for at least R1–R3, since those are the assertions that would catch a silent
regression later.

| # | Case | Expected |
| - | ---- | -------- |
| R1 | Load the reference GLB, assert material state after `loadWearable` | `Material.001.emissiveColor ≈ (6.015, 0, 0.0453)`; `Material.002` stays `(0,0,0)` |
| R2 | `scene.imageProcessingConfiguration` after `createScene` | `toneMappingEnabled === true`, `toneMappingType === TONEMAPPING_ACES` |
| R3 | `getMetrics()` texture count, before vs after the change | unchanged (guards constraint 2 — fails loudly if someone later adds a pipeline) |
| R4 | `exportVRM` on a scene containing the reference wearable | serialized `emissiveFactor` all within `[0,1]` |

### Visual matrix (manual, both renderers side by side)

Run each as `?...&unity=true` and `?...&unity=false` and compare. This is the real coverage
for a shading change.

| # | Case | What to check |
| - | ---- | ------------- |
| V1 | `Hell's Angels`, wearable mode — the reported item | Babylon now shows pale cream feathers with the fire texture washed out, matching Unity |
| V2 | Same item, avatar mode | same result on a full avatar |
| V3 | A wearable with `emissiveFactor = 0` | only the global ACES shift, no gain effect; still recognisably the same item |
| V4 | Default avatar, facial features | eyes / eyebrows / mouth still legible and correctly hued (constraint 3 — highest risk) |
| V5 | `skinColor` / `hairColor` at extremes (near-black, near-white) | no clipping, no muddiness |
| V6 | Emote preview (`&emote=`) | non-`WEARABLE` types get no directional/spot light (`scene.ts:222-227`); confirm ACES doesn't make these noticeably darker |
| V7 | Glow bleed on any emissive item, before vs after | unchanged (step 3 succeeded) |
| V8 | `disableBackground=true` vs a solid background colour | transparent background unaffected; no halo at the alpha edge |
| V9 | `getScreenshot` RPC output vs the live canvas | pixel-identical treatment (constraint 1) |
| V10 | iOS / Safari | `GlowLayer` is skipped there (`scene.ts:235`); confirm the tonemapped result still looks right without it |
| V11 | Shop embed, a page of item cards | thumbnails regenerate consistently; spot-check a range of rarities |
| V12 | A wearable with an emissive **texture** (not just a factor) | gain applies to the factor only; texture-driven emissives don't blow out |

### Regression sweep

Because this changes every wearable with a non-zero `emissiveFactor` *and* shifts overall
tone for everything else, before merging: capture before/after screenshots across a sample
of the catalogue (a few dozen items spanning categories and rarities, plus the base avatars)
and diff them. Items that change *unexpectedly* — i.e. anything with `emissiveFactor = 0`
moving more than the flat ACES shift — indicate a bug in step 1's scoping.
