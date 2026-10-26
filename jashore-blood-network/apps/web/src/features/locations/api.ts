/**
 * Location API client + types.
 *
 * Fetches the location reference data (districts, upazilas) from the
 * /api/v1/locations endpoints. Used by the donor registration form and
 * the search filter UI.
 */

import { apiFetch } from '@/lib/api-client';

export interface District {
  id: string;
  name: string;
  country: string;
  code: string | null;
}

export interface Upazila {
  id: string;
  name: string;
  districtId: string;
  code: string | null;
}

export async function fetchDistricts(): Promise<District[]> {
  return apiFetch<District[]>('/api/v1/locations/districts');
}

export async function fetchUpazilas(districtId?: string): Promise<Upazila[]> {
  const query = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
  return apiFetch<Upazila[]>(`/api/v1/locations/upazilas${query}`);
}
