/**
 * Notification bell — shows unread count and dropdown panel.
 *
 * Polls /api/v1/notifications/unread-count every 60 seconds.
 * Clicking the bell opens a dropdown with the latest 5 notifications.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchUnreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDto,
} from '@/features/notifications/api';
import { useAuth } from '@/features/auth/auth-provider';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await fetchUnreadCount();
      setUnread(count);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    void refreshUnread();
    const interval = setInterval(refreshUnread, 60_000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchNotifications(1);
        setRecent(res.items.slice(0, 5));
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) return null;

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setRecent((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setRecent((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {
      // silent
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-white shadow-lg"
          role="menu"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
            <span className="text-sm font-semibold text-neutral-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                No notifications yet.
              </div>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-neutral-100 px-4 py-3 last:border-0 ${
                    n.isRead ? 'bg-white' : 'bg-brand-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{n.body}</p>
                      <p className="mt-1 text-[10px] text-neutral-400">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 text-[10px] text-brand-600 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  {n.relatedType === 'blood_request' && n.relatedId && (
                    <Link
                      href={`/blood-requests/${n.relatedId}`}
                      onClick={() => setOpen(false)}
                      className="mt-1 block text-xs text-brand-600 hover:underline"
                    >
                      View request →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-neutral-200 px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-brand-600 hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
