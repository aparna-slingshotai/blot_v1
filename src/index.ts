export { generateShader } from "./shader/generator";
export { fragmentTemplate, rippleTemplate } from "./shader/templates";
export type { GeneratedShader, ShaderParams, Vec3, Vec4 } from "./shader/types";

export {
  defaultOnboardingSchema,
  mapOnboardingInputsToShaderParams,
  type InputSchema,
  type InputValue,
} from "./onboarding/inputMapping";
