import { fragmentTemplate } from "./templates";
import { GeneratedShader, ShaderParams } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampVec3 = (value: [number, number, number]): [number, number, number] => [
  clamp(value[0], 0, 1),
  clamp(value[1], 0, 1),
  clamp(value[2], 0, 1),
];

const clampVec4 = (value: [number, number, number, number]): [number, number, number, number] => [
  clamp(value[0], 0, 1),
  clamp(value[1], 0, 1),
  clamp(value[2], 0, 1),
  clamp(value[3], 0, 1),
];

const clampVec3List = (values: [number, number, number][]) =>
  values.map((value) => clampVec3(value));

export const generateShader = (params: ShaderParams): GeneratedShader => {
  return {
    fragment: fragmentTemplate,
    uniforms: {
      u_seed: params.seed,
      u_noiseScale: params.noiseScale,
      u_warp: params.warp,
      u_speed: params.speed,
      u_contrast: params.contrast,
      u_hueShift: params.hueShift,
      u_grain: params.grain,
      u_paletteA: clampVec3(params.paletteA),
      u_paletteB: clampVec3(params.paletteB),
      u_paletteC: clampVec3(params.paletteC),
      u_extraColors: clampVec3List(params.extraColors),
      u_extraCount: params.extraCount,
      u_textureWeights: clampVec4(params.textureWeights),
      u_textureScale: params.textureScale,
      u_motionWeights: clampVec4(params.motionWeights),
    },
  };
};
