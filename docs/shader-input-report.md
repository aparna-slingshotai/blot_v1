# Shader Input Report

This document describes how the onboarding inputs map to shader uniforms in `docs/shader.frag` (and the current `docs/app.js` runtime mapping).

## Inputs (UI → data)

- Screen 1 intent: `screen1Intent`
- Screen 2 selections: `screen2Selections[]`
- Screen 3 selections: `screen3Selections[]`
- Screen 4 selections: `screen4Selections[]`
- Accent color: `accentColor` (hex)
- Seed: `seed` (string or number)

## Normalization helpers

- `normalizeMultiSelect(list, maxCount)` returns:
  - `density = clamp(list.length / maxCount, 0, 1)`
  - `variety = 0 if empty, else hash(sorted list)`
- `normalizeWeights(weights, fallback)` normalizes 4 weights to sum to 1 (or uses fallback if total is 0).

## Base axes (Screen 1 intent)

Each intent sets a starting “axis” vector used throughout:

- Exploration: `energy 0.6, calm 0.5, novelty 0.9, focus 0.4, warmth 0.55, structure 0.35`
- Challenge me: `energy 0.95, calm 0.2, novelty 0.7, focus 0.7, warmth 0.4, structure 0.6`
- Ideas & Solutions: `energy 0.55, calm 0.55, novelty 0.6, focus 0.8, warmth 0.5, structure 0.85`
- Validate & Listen: `energy 0.35, calm 0.9, novelty 0.35, focus 0.6, warmth 0.85, structure 0.5`
- Teach me: `energy 0.5, calm 0.65, novelty 0.4, focus 0.75, warmth 0.6, structure 0.8`
- Fallback: all axes `0.55` if intent is missing.

## Screen 2 selections (perspectives)

Defines `screen2.density` + `screen2.variety` and provides **extra palette colors**:

- Each selected label is hashed to a color (`colorFromLabel`), stored in `u_extraColors`.
- `u_extraCount = min(extraColors.length, 21)`.

Axis effects:
- `energy += 0.25 * screen2.density`
- `calm += 0.2 * (1 - screen2.density)`
- `novelty += 0.3 * screen2.variety`
- `focus -= 0.15 * screen2.variety`
- `texture += 0.3 * screen2.variety`

## Screen 3 selections (tone)

Defines `screen3.density` + `screen3.variety` and drives texture weights:

Texture weights for `u_textureWeights` (before normalization):
- Warm: w0 += 1
- Quirky: w3 += 1
- Wise: w2 += 1
- Direct: w1 += 1
- Laid-back: w0 += 1, w3 += 1
- Humorous: w0 += 1
- Sarcastic: w1 += 1
- Nerdy: w1 += 1, w2 += 1

Axis effects:
- `focus += 0.35 * screen3.density`
- `calm += 0.1 * screen3.variety`
- `structure += 0.35 * screen3.density`

## Screen 4 selections (topics)

Defines `screen4.density` + `screen4.variety` and drives motion weights:

Motion weights for `u_motionWeights` (before normalization):
- Sports, Fitness, Video games, Music: w1 += 1
- Pop culture, Memes, Board games: w2 += 1
- Nature, Yoga, Gardening, Cooking, Animals, Photography: w0 += 1
- Tarot, Mythology, Dreams: w3 += 1
- Books, Philosophy, History, Movies: w0 += 1, w3 += 1

Axis effects:
- `energy += 0.15 * screen4.density`
- `novelty += 0.2 * screen4.variety`
- `warmth += 0.2 * screen4.density`
- `texture += 0.3 * screen4.variety`

## Accent color

If `accentColor` is provided, it is blended into the palette:

- `palette.a = mix(baseA, accentColor, 0.6)`
- `palette.b = mix(baseB, accentColor, 0.3)`
- `palette.c = baseC`

## Seed

- If numeric: used directly.
- If string: `hashString(seed) * 1000`.
- If empty: `hashString(JSON.stringify(inputs)) * 1000`.

## Uniform mapping (final shader parameters)

Computed from the axes and selections:

- `u_seed`: derived from `seed` or hashed inputs
- `u_noiseScale = lerp(0.6, 4.2, 0.35 * structure + 0.65 * novelty)`
- `u_warp = lerp(0.0, 1.4, 0.6 * novelty + 0.4 * energy)`
- `u_speed = lerp(0.05, 0.75, energy)`
- `u_contrast = lerp(0.8, 1.6, 0.5 * focus + 0.5 * structure)`
- `u_hueShift = lerp(-0.25, 0.25, warmth)`
- `u_grain = lerp(0.0, 0.25, 0.5 * novelty + 0.5 * texture)`
- `u_paletteA/B/C`: themed palette (intent palette blended with base palette)
- `u_extraColors`: colors generated from Screen 2 selections (max 21)
- `u_extraCount`: number of extra colors
- `u_textureWeights`: normalized weights from Screen 3 selections
- `u_textureScale = clamp(0.2 + 0.8 * screen3.density, 0, 1)`
- `u_motionWeights`: normalized weights from Screen 4 selections

## Notes for Flutter implementation

- All uniforms above are floats/vectors; pass them as per your GL/Skia shader API.
- For `u_extraColors`, always pass a fixed-size array of 21 vec3 values (pad with 0s).
- `u_extraCount` should be the count of real entries, used to gate blending in the shader.
- Normalization and hashing should match the JS implementations in `docs/app.js`.
