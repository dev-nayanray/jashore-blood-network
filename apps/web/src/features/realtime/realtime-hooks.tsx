/**
 * Supabase Realtime hooks for live updates.
 *
 * ARCHITECTURE:
 *   - Uses Supabase Realtime (PostgreSQL logical replication)
 *   - Browser subscribes using the ANON key (never service-role)
 *   - RLS policies enforce that users only see events for rows they can read
 *   - Polling fallback remains as a safety net for connection loss
 *   - Real-time messages are UPDATE SIGNALS, not authorization decisions
 *   - The API remains the source of truth for mutations
 *
 * SECURITY:
 *   - No service-role keys in browser code
 *   - Subscriptions are RLS-enforced — users can't subscribe to private rows
 *   - Real-time payloads contain only public columns (no PII)
 *   - Subscriptions are cleaned up on unmount/sign-out
 *   - Events trigger a refetch from the API (which re-validates authorization)
 *
 * RELIABILITY:
 *   - Connection status tracked and displayed to users
 *   - Automatic reconnection handled by Supabase client
 *   - Polling fallback continues at reduced frequency when connected
 *   - Duplicate events handled by comparing timestamps
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/env';

// ---------------------------------------------------------------------------
// Singleton Supabase client (browser-side, anon key only)
// ---------------------------------------------------------------------------

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'placeholder-anon-key') {
    return null; // Not configured — callers fall back to polling
  }
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 2 }, // Rate limit to prevent flooding
      },
    });
  }
  return supabaseClient;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'unavailable';

export interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// useRealtimeRequest — subscribe to a single blood request's changes
// ---------------------------------------------------------------------------

/**
 * Subscribes to real-time updates for a specific blood request.
 * When the request changes (status, urgency, etc.), calls `onUpdate`
 * which triggers a refetch from the API.
 *
 * SECURITY: RLS ensures the user only receives events for requests they
 * are authorized to view. The hook does NOT trust the real-time payload —
 * it only uses it as a signal to refetch from the API.
 *
 * @param requestId The blood request ID to track
 * @param onUpdate Callback when an update is detected
 * @returns Connection status
 */
export function useRealtimeRequest(
  requestId: string | null,
  onUpdate: () => void,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('unavailable');
  const onUpdateRef = useRef(onUpdate);
  const lastUpdateTimestamp = useRef<string>('');

  // Keep the callback ref current without resubscribing
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!requestId) {
      setStatus('unavailable');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setStatus('unavailable');
      return;
    }

    setStatus('connecting' as ConnectionStatus);
    const channelName = `request:${requestId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload: RealtimeEvent) => {
          // Only trigger update if the timestamp changed (dedup)
          const newTimestamp =
            (payload.new as { updated_at?: string })?.updated_at ?? '';
          if (newTimestamp && newTimestamp !== lastUpdateTimestamp.current) {
            lastUpdateTimestamp.current = newTimestamp;
            onUpdateRef.current();
          }
        },
      )
      .subscribe(
        (channelStatus: string) => {
          if (channelStatus === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
            setStatus('reconnecting');
          } else if (channelStatus === 'CLOSED') {
            setStatus('disconnected');
          }
        },
      );

    return () => {
      client.removeChannel(channel);
      setStatus('unavailable');
    };
  }, [requestId]);

  return status;
}

// ---------------------------------------------------------------------------
// useRealtimeNotifications — subscribe to user's notifications
// ---------------------------------------------------------------------------

/**
 * Subscribes to real-time updates for the authenticated user's notifications.
 * When a new notification is inserted, calls `onNewNotification`.
 *
 * SECURITY: RLS ensures the user only receives events for their own
 * notifications (recipient_id = auth.uid()).
 *
 * @param userId The authenticated user's profile ID
 * @param onNewNotification Callback when a new notification arrives
 * @returns Connection status
 */
export function useRealtimeNotifications(
  userId: string | null,
  onNewNotification: () => void,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('unavailable');
  const onNewRef = useRef(onNewNotification);

  useEffect(() => {
    onNewRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    if (!userId) {
      setStatus('unavailable');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setStatus('unavailable');
      return;
    }

    const channelName = `notifications:${userId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          // New notification — trigger refetch
          onNewRef.current();
        },
      )
      .subscribe(
        (channelStatus: string) => {
          if (channelStatus === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
            setStatus('reconnecting');
          } else if (channelStatus === 'CLOSED') {
            setStatus('disconnected');
          }
        },
      );

    return () => {
      client.removeChannel(channel);
      setStatus('unavailable');
    };
  }, [userId]);

  return status;
}

// ---------------------------------------------------------------------------
// useRealtimeRequestList — subscribe to blood request list changes
// ---------------------------------------------------------------------------

/**
 * Subscribes to real-time changes on the blood_requests table.
 * Triggers `onChange` for any INSERT, UPDATE, or DELETE event.
 * The caller refetches the list from the API to get the current state.
 *
 * SECURITY: RLS ensures only public/authorized requests are visible.
 * Private requests (PENDING, REJECTED, etc.) are filtered by RLS.
 *
 * @param onChange Callback when any request change is detected
 * @returns Connection status
 */
export function useRealtimeRequestList(
  onChange: () => void,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('unavailable');
  const onChangeRef = useRef(onChange);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setStatus('unavailable');
      return;
    }

    // Debounce changes — batch multiple events into a single refetch
    const debouncedChange = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChangeRef.current();
      }, 500); // 500ms debounce
    };

    const channel = client
      .channel('request-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_requests',
        },
        () => {
          debouncedChange();
        },
      )
      .subscribe(
        (channelStatus: string) => {
          if (channelStatus === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
            setStatus('reconnecting');
          } else if (channelStatus === 'CLOSED') {
            setStatus('disconnected');
          }
        },
      );

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      client.removeChannel(channel);
      setStatus('unavailable');
    };
  }, []);

  return status;
}

// ---------------------------------------------------------------------------
// ConnectionStatusIndicator — visual feedback for real-time connection
// ---------------------------------------------------------------------------

export function ConnectionStatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'unavailable') return null; // Don't show if real-time not configured

  const config = {
    connected: { color: 'bg-green-500', label: 'Live', text: 'text-green-700' },
    reconnecting: { color: 'bg-amber-500 animate-pulse', label: 'Reconnecting', text: 'text-amber-700' },
    disconnected: { color: 'bg-red-500', label: 'Offline', text: 'text-red-700' },
    'connecting': { color: 'bg-amber-500 animate-pulse', label: 'Connecting', text: 'text-amber-700' },
  } as const;

  const c = config[status] ?? config.disconnected;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      role="status"
      aria-label={`Real-time connection: ${c.label}`}
    >
      <span className={`h-2 w-2 rounded-full ${c.color}`} aria-hidden="true" />
      <span className={c.text}>{c.label}</span>
    </span>
  );
}
