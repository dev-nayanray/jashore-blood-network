/**
 * Public API client — for unauthenticated endpoints.
 */

import { apiFetch } from '@/lib/api-client';

export interface PublicStats {
  registeredDonors: number;
  verifiedDonors: number;
  activeBloodRequests: number;
  supportedUpazilas: number;
}

export interface PublicHospital {
  id: string;
  name: string;
  upazila: { id: string; name: string };
  address: string;
  phone: string | null;
  operatingHours: string | null;
  servicesOffered: string | null;
  verificationStatus: string;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return apiFetch<PublicStats>('/api/v1/public/stats');
}

export async function fetchPublicHospitals(params?: {
  upazilaId?: string;
  page?: number;
}): Promise<{ items: PublicHospital[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.upazilaId) query.set('upazilaId', params.upazilaId);
  if (params?.page) query.set('page', String(params.page));
  return apiFetch(`/api/v1/public/hospitals?${query.toString()}`);
}
