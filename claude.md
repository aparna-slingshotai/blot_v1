# Changelog

All notable changes to this project will be documented in this file.

Format loosely based on [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
- Exported Flutter-compatible fragment shader as `src/shader/flower.frag`
  - Includes `#include <flutter/runtime_effect.glsl>` for Flutter `FragmentProgram` API
  - Replaces `gl_FragCoord` with `FlutterFragCoord()` and `gl_FragColor` with explicit `out vec4 fragColor`
  - Contains uniform float-index mapping documentation for Dart `shader.setFloat()` calls
- Added `claude.md` changelog file for tracking project changes

### Changed
- Added cross-reference comments between `src/shader/templates.ts` (WebGL) and `src/shader/flower.frag` (Flutter)

---

## [V1.2] - PR #1

### Changed
- More dramatic shader changes upon selection
- Removed UI for better visualization
- Updated shader (shader 2)
- General updates

## [V1.0] - Initial release

### Added
- Initial dynamic shader generator with onboarding input mapping
- Fragment shader: ray-marching SDF renderer producing animated 3D flower
- Onboarding-to-shader parameter mapping (`inputMapping.ts`)
- Web demo (GitHub Pages) in `docs/`
- Font added
