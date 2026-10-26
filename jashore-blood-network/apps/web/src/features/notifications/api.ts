/**
 * Notification API client + types.
 */

import { apiFetch } from '@/lib/api-client';

export interface NotificationDto {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationPreferencesDto {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  bloodRequestAlertsEnabled: boolean;
  preferredBloodGroups: string[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  maxAlertsPerDay: number;
}

export async function fetchNotifications(page = 1): Promise<NotificationListResponse> {
  return apiFetch<NotificationListResponse>(`/api/v1/notifications?page=${page}`);
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/api/v1/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/api/v1/notifications/mark-all-read', {
    method: 'POST',
  });
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesDto> {
  return apiFetch<NotificationPreferencesDto>('/api/v1/notifications/preferences');
}

export async function updateNotificationPreferences(
  input: Partial<NotificationPreferencesDto>,
): Promise<NotificationPreferencesDto> {
  return apiFetch<NotificationPreferencesDto>('/api/v1/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
