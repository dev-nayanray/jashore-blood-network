/**
 * @jbn/validation
 *
 * Shared Zod schemas. The Next.js frontend uses these for client-side form
 * validation; the NestJS backend uses them inside a ZodValidationPipe to
 * validate request bodies before they reach controller handlers.
 *
 * Phase 2 contains environment-variable schemas. Phase 4 adds auth schemas.
 * Domain schemas (donor profile, blood request, etc.) will be added in
 * Phase 5+.
 */

export {
  envSchema,
  webEnvSchema,
  apiEnvSchema,
  sharedEnvSchema,
  parseEnv,
  type AppEnv,
  type WebEnv,
  type ApiEnv,
} from './env';

export {
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
  type OtpRequestInput,
  type OtpVerifyInput,
  type UpdateProfileInput,
} from './auth';

export {
  createDonorProfileSchema,
  updateDonorProfileSchema,
  searchDonorsSchema,
  type CreateDonorProfileInput,
  type UpdateDonorProfileInput,
  type SearchDonorsInput,
} from './donors';

export {
  createBloodRequestSchema,
  updateBloodRequestSchema,
  updateRequestStatusSchema,
  searchBloodRequestsSchema,
  type CreateBloodRequestInput,
  type UpdateBloodRequestInput,
  type UpdateRequestStatusInput,
  type SearchBloodRequestsInput,
} from './blood-requests';
