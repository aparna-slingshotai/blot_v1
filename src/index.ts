export { generateShader } from "./shader/generator";
export { fragmentTemplate } from "./shader/templates";
export type { GeneratedShader, ShaderParams, Vec3, Vec4 } from "./shader/types";

export {
  defaultOnboardingSchema,
  mapOnboardingInputsToShaderParams,
  type InputSchema,
  type InputValue,
} from "./onboarding/inputMapping";

export {
  particleCommonGlsl,
  particleBufferAGlsl,
  particleBufferBGlsl,
  particleBufferCGlsl,
  particleImageGlsl,
} from "./shader/particles/templates";
