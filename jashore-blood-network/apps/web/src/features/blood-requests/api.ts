/**
 * Blood request API client + types.
 */

import { apiFetch } from '@/lib/api-client';
import type { BloodGroup } from '@jbn/shared-types';

export type UrgencyLevel = 'URGENT' | 'NORMAL' | 'FLEXIBLE';
export type BloodComponent = 'WHOLE_BLOOD' | 'PLASMA' | 'PLATELETS' | 'RED_BLOOD_CELLS';
export type ContactMethod = 'PHONE' | 'EMAIL' | 'IN_APP';
export type RequestStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'SEARCHING'
  | 'DONOR_RESPONDED'
  | 'ARRANGED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export interface BloodRequestPublic {
  id: string;
  patientDisplayName: string | null;
  bloodGroup: BloodGroup;
  bloodComponent: BloodComponent | null;
  unitsRequested: number;
  upazila: { id: string; name: string };
  hospitalName: string | null;
  requiredBy: string;
  urgency: UrgencyLevel;
  status: RequestStatus;
  createdAt: string;
}

export interface BloodRequestDetail extends BloodRequestPublic {
  contactMethod: ContactMethod;
  contactNote: string | null;
  notes: string | null;
  expiresAt: string;
  updatedAt: string;
  isOwner: boolean;
}

export interface BloodRequestListResponse {
  items: BloodRequestPublic[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CreateBloodRequestInput {
  patientDisplayName?: string;
  bloodGroup: BloodGroup;
  bloodComponent?: BloodComponent;
  unitsRequested: number;
  upazilaId: string;
  hospitalId?: string | null;
  hospitalName?: string | null;
  requiredBy: string;
  urgency: UrgencyLevel;
  contactMethod: ContactMethod;
  contactNote?: string;
  notes?: string;
}

export type UpdateBloodRequestInput = Partial<CreateBloodRequestInput>;

export interface SearchBloodRequestsParams {
  bloodGroup?: BloodGroup;
  upazilaId?: string;
  urgency?: UrgencyLevel;
  status?: RequestStatus;
  page?: number;
  pageSize?: number;
}

export async function searchBloodRequests(
  params: SearchBloodRequestsParams,
): Promise<BloodRequestListResponse> {
  const query = new URLSearchParams();
  if (params.bloodGroup) query.set('bloodGroup', params.bloodGroup);
  if (params.upazilaId) query.set('upazilaId', params.upazilaId);
  if (params.urgency) query.set('urgency', params.urgency);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  return apiFetch<BloodRequestListResponse>(`/api/v1/blood-requests?${query.toString()}`);
}

export async function fetchMyBloodRequests(page = 1): Promise<BloodRequestListResponse> {
  return apiFetch<BloodRequestListResponse>(
    `/api/v1/blood-requests/mine?page=${page}`,
  );
}

export async function fetchBloodRequest(id: string): Promise<BloodRequestDetail> {
  return apiFetch<BloodRequestDetail>(`/api/v1/blood-requests/${id}`);
}

export async function createBloodRequest(
  input: CreateBloodRequestInput,
): Promise<BloodRequestDetail> {
  return apiFetch<BloodRequestDetail>('/api/v1/blood-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBloodRequest(
  id: string,
  input: UpdateBloodRequestInput,
): Promise<BloodRequestDetail> {
  return apiFetch<BloodRequestDetail>(`/api/v1/blood-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function cancelBloodRequest(
  id: string,
  reason?: string,
): Promise<BloodRequestDetail> {
  return apiFetch<BloodRequestDetail>(`/api/v1/blood-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'CANCELLED', reason }),
  });
}
