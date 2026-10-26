/**
 * Organization API client.
 */

import { apiFetch } from '@/lib/api-client';

export interface OrganizationDto {
  id: string;
  name: string;
  upazilaId: string;
  upazilaName: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  operatingHours: string | null;
  servicesOffered: string | null;
  verificationStatus: string;
  verificationFeedback: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

export interface OrganizationMemberDto {
  id: string;
  profileId: string;
  fullName: string;
  phone: string;
  role: string;
  joinedAt: string;
  removedAt: string | null;
}

export async function registerOrganization(input: {
  name: string;
  upazilaId: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  operatingHours?: string;
  servicesOffered?: string;
}): Promise<OrganizationDto> {
  return apiFetch<OrganizationDto>('/api/v1/organizations/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyOrganization(): Promise<OrganizationDto | null> {
  try {
    return await apiFetch<OrganizationDto>('/api/v1/organizations/me');
  } catch (err) {
    if (err instanceof Error && err.message.includes('403')) return null;
    throw err;
  }
}

export async function updateOrganizationProfile(input: Partial<{
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  operatingHours: string;
  servicesOffered: string;
}>): Promise<OrganizationDto> {
  return apiFetch<OrganizationDto>('/api/v1/organizations/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function submitForVerification(): Promise<OrganizationDto> {
  return apiFetch<OrganizationDto>('/api/v1/organizations/me/submit', { method: 'POST' });
}

export async function fetchStaff(): Promise<OrganizationMemberDto[]> {
  return apiFetch<OrganizationMemberDto[]>('/api/v1/organizations/me/staff');
}

export async function addStaff(profileId: string): Promise<OrganizationMemberDto> {
  return apiFetch<OrganizationMemberDto>('/api/v1/organizations/me/staff', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export async function removeStaff(memberId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/organizations/me/staff/${memberId}`, {
    method: 'DELETE',
  });
}
