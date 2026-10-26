/**
 * Admin API client.
 */

import { apiFetch } from '@/lib/api-client';

export interface DashboardMetrics {
  totalUsers: number;
  totalDonors: number;
  verifiedDonors: number;
  donorsPendingVerification: number;
  activeBloodRequests: number;
  requestsPendingVerification: number;
  urgentBloodRequests: number;
  fulfilledRequests: number;
  openAbuseReports: number;
  suspendedAccounts: number;
}

export interface AdminUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface Analytics {
  requestsByBloodGroup: Array<{ bloodGroup: string; count: number }>;
  requestsByUpazila: Array<{ upazila: string; count: number }>;
  requestsByStatus: Array<{ status: string; count: number }>;
  donorsByBloodGroup: Array<{ bloodGroup: string; count: number }>;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>('/api/v1/admin/dashboard');
}

export async function fetchAnalytics(): Promise<Analytics> {
  return apiFetch<Analytics>('/api/v1/admin/analytics');
}

export async function fetchAdminUsers(params?: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminUser[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.role) query.set('role', params.role);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  return apiFetch(`/api/v1/admin/users?${query.toString()}`);
}

export async function fetchAdminDonors(params?: {
  search?: string;
  bloodGroup?: string;
  upazilaId?: string;
  verificationStatus?: string;
  page?: number;
}): Promise<{ items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.bloodGroup) query.set('bloodGroup', params.bloodGroup);
  if (params?.upazilaId) query.set('upazilaId', params.upazilaId);
  if (params?.verificationStatus) query.set('verificationStatus', params.verificationStatus);
  if (params?.page) query.set('page', String(params.page));
  return apiFetch(`/api/v1/admin/donors?${query.toString()}`);
}

export async function fetchAdminBloodRequests(params?: {
  status?: string;
  bloodGroup?: string;
  upazilaId?: string;
  urgency?: string;
  page?: number;
}): Promise<{ items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.bloodGroup) query.set('bloodGroup', params.bloodGroup);
  if (params?.upazilaId) query.set('upazilaId', params.upazilaId);
  if (params?.urgency) query.set('urgency', params.urgency);
  if (params?.page) query.set('page', String(params.page));
  return apiFetch(`/api/v1/admin/blood-requests?${query.toString()}`);
}

export async function fetchAuditLogs(params?: {
  action?: string;
  actorId?: string;
  targetType?: string;
  page?: number;
}): Promise<{ items: AuditLogItem[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.action) query.set('action', params.action);
  if (params?.actorId) query.set('actorId', params.actorId);
  if (params?.targetType) query.set('targetType', params.targetType);
  if (params?.page) query.set('page', String(params.page));
  return apiFetch(`/api/v1/admin/audit-logs?${query.toString()}`);
}

export async function suspendUser(userId: string, reason: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/admin/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function reinstateUser(userId: string, reason?: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/admin/users/${userId}/reinstate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
