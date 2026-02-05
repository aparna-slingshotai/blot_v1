# Dynamic Shader Generator

This repo contains a small, framework-agnostic shader generator. It maps abstract
onboarding inputs into a stable set of shader parameters, then returns a fragment
shader string plus a uniforms object to feed your renderer.

## Quick usage

```ts
import {
  defaultOnboardingSchema,
  mapOnboardingInputsToShaderParams,
  generateShader,
} from "./src";

const inputs = {
  screen1Intent: "Exploration",
  screen2Selections: ["Option A", "Option C"],
  screen3Selections: ["Option 1", "Option 7"],
  screen4Selections: ["Option Alpha"],
  accentColor: "#ff9966",
  seed: "user-42",
};

const params = mapOnboardingInputsToShaderParams(inputs, defaultOnboardingSchema);
const { fragment, uniforms } = generateShader(params);
```

## Notes

- `mapOnboardingInputsToShaderParams()` is where you tune how onboarding axes
  translate to shader behavior.
- `generateShader()` is renderer-agnostic: it returns a GLSL fragment string and
  uniform values; you supply `u_time` and `u_resolution` at render time.
- Update `defaultOnboardingSchema` choices for your real Screen 2–4 options so
  density scales correctly with selection count.

## Web demo (GitHub Pages)

Static files live in `docs/` so you can deploy with GitHub Pages:

1. Push this repo to GitHub.
2. In GitHub → Settings → Pages, set the source to `main` and folder to `/docs`.
3. Open the published URL to see the shader demo and tweak inputs live.
