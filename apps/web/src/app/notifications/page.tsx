'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDto,
} from '@/features/notifications/api';
import { useAuth } from '@/features/auth/auth-provider';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotifications(page);
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setUnread(res.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login';
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* silent */ }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* silent */ }
  };

  if (authLoading) return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (!user) return null;

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Mark all read
            </button>
          )}
          <Link
            href="/notifications/preferences"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Preferences
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-live="polite">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No notifications</p>
          <p className="mt-1 text-sm text-neutral-600">
            You will be notified here when there are blood requests matching your profile.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-4 ${
                  n.isRead ? 'border-neutral-200 bg-white' : 'border-brand-200 bg-brand-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                      )}
                      <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-neutral-600">{n.body}</p>
                    <p className="mt-2 text-xs text-neutral-400">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 text-xs text-brand-600 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                {n.relatedType === 'blood_request' && n.relatedId && (
                  <Link
                    href={`/blood-requests/${n.relatedId}`}
                    className="mt-2 inline-block text-xs text-brand-600 hover:underline"
                  >
                    View request →
                  </Link>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
              >
                ← Previous
              </button>
              <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
