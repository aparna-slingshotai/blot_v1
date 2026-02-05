export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface ShaderParams {
  seed: number;
  noiseScale: number;
  warp: number;
  speed: number;
  contrast: number;
  hueShift: number;
  grain: number;
  paletteA: Vec3;
  paletteB: Vec3;
  paletteC: Vec3;
  extraColors: Vec3[];
  extraCount: number;
  textureWeights: Vec4;
  textureScale: number;
  motionWeights: Vec4;
}

export interface GeneratedShader {
  fragment: string;
  uniforms: {
    u_seed: number;
    u_noiseScale: number;
    u_warp: number;
    u_speed: number;
    u_contrast: number;
    u_hueShift: number;
    u_grain: number;
    u_paletteA: Vec3;
    u_paletteB: Vec3;
    u_paletteC: Vec3;
    u_extraColors: Vec3[];
    u_extraCount: number;
    u_textureWeights: Vec4;
    u_textureScale: number;
    u_motionWeights: Vec4;
  };
}
