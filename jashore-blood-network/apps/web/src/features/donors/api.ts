/**
 * Donor API client + types.
 *
 * Used by the donor registration, profile, and search pages.
 */

import { apiFetch, ApiError } from '@/lib/api-client';
import type { BloodGroup } from '@jbn/shared-types';

export interface DonorSearchResult {
  id: string;
  displayName: string;
  bloodGroup: BloodGroup;
  upazila: { id: string; name: string };
  locality: { id: string; name: string } | null;
  availabilityConfirmedAt: string;
  lastDonationAt: string | null;
  isVerified: boolean;
}

export interface DonorSearchResponse {
  items: DonorSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface OwnDonorProfile {
  id: string;
  profileId: string;
  bloodGroup: BloodGroup;
  upazila: { id: string; name: string; district: { id: string; name: string } };
  locality: { id: string; name: string } | null;
  lastDonationAt: string | null;
  isAvailable: boolean;
  availabilityConfirmedAt: string;
  visibility: 'LISTED' | 'UNLISTED' | 'HIDDEN';
  contactPreference: 'IN_APP_ONLY' | 'IN_APP_AND_PHONE' | 'IN_APP_AND_EMAIL';
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonorProfileInput {
  bloodGroup: BloodGroup;
  upazilaId: string;
  localityId?: string | null;
  lastDonationAt?: string | null;
  contactPreference: 'IN_APP_ONLY' | 'IN_APP_AND_PHONE' | 'IN_APP_AND_EMAIL';
  visibility: 'LISTED' | 'UNLISTED' | 'HIDDEN';
}

export interface UpdateDonorProfileInput {
  bloodGroup?: BloodGroup;
  upazilaId?: string;
  localityId?: string | null;
  lastDonationAt?: string | null;
  contactPreference?: 'IN_APP_ONLY' | 'IN_APP_AND_PHONE' | 'IN_APP_AND_EMAIL';
  visibility?: 'LISTED' | 'UNLISTED' | 'HIDDEN';
  isAvailable?: boolean;
}

export interface SearchDonorsParams {
  bloodGroup?: BloodGroup;
  districtId?: string;
  upazilaId?: string;
  localityId?: string;
  recentlyAvailable?: boolean;
  verifiedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function searchDonors(params: SearchDonorsParams): Promise<DonorSearchResponse> {
  const query = new URLSearchParams();
  if (params.bloodGroup) query.set('bloodGroup', params.bloodGroup);
  if (params.districtId) query.set('districtId', params.districtId);
  if (params.upazilaId) query.set('upazilaId', params.upazilaId);
  if (params.localityId) query.set('localityId', params.localityId);
  if (params.recentlyAvailable) query.set('recentlyAvailable', 'true');
  if (params.verifiedOnly) query.set('verifiedOnly', 'true');
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  return apiFetch<DonorSearchResponse>(`/api/v1/donors?${query.toString()}`);
}

export async function fetchMyDonorProfile(): Promise<OwnDonorProfile | null> {
  try {
    return await apiFetch<OwnDonorProfile>('/api/v1/donors/me');
  } catch (err) {
    // 404 means no profile yet — return null
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function createMyDonorProfile(
  input: CreateDonorProfileInput,
): Promise<OwnDonorProfile> {
  return apiFetch<OwnDonorProfile>('/api/v1/donors/me', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMyDonorProfile(
  input: UpdateDonorProfileInput,
): Promise<OwnDonorProfile> {
  return apiFetch<OwnDonorProfile>('/api/v1/donors/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
