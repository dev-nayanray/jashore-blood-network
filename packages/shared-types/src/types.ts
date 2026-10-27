/**
 * Shared TypeScript types.
 *
 * Phase 2 contains only placeholder types. Domain types (DonorProfile,
 * BloodRequest, RequestResponse, etc.) will be added in Phase 3.
 */

/**
 * Brand type for UUIDs. Prevents accidental mixing of IDs of different
 * entity types (e.g. passing a DonorId where a RequestId is expected).
 *
 * Usage:
 *   type DonorId = Branded<string, 'DonorId'>;
 *   type RequestId = Branded<string, 'RequestId'>;
 */
export type Branded<T, B extends string> = T & { readonly __brand: B };

/**
 * ISO 3166-1 alpha-2 country code.
 */
export type CountryCode = string & { readonly __countryCode: true };

/**
 * E.164 phone number format (e.g. +8801712345678).
 */
export type E164Phone = string & { readonly __e164: true };

/**
 * ISO 8601 timestamp string.
 */
export type IsoTimestamp = string & { readonly __isoTimestamp: true };
