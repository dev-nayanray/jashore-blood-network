/**
 * Real-time hooks tests (Phase 14).
 *
 * Tests the hook logic with a mocked Supabase client.
 * Verifies subscription lifecycle, dedup, cleanup, and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockImplementation((callback: (status: string) => void) => {
    // Simulate successful subscription
    setTimeout(() => callback('SUBSCRIBED'), 0);
    return mockChannel;
  }),
  unsubscribe: vi.fn(),
};

const mockRemoveChannel = vi.fn();
const mockCreateClient = vi.fn().mockReturnValue({
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: mockRemoveChannel,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/env', () => ({
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
  apiBaseUrl: 'http://localhost:3001',
}));

// Import after mocks are set up
const { useRealtimeRequest, useRealtimeNotifications, useRealtimeRequestList } =
  await import('@/features/realtime/realtime-hooks');

describe('useRealtimeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      setTimeout(() => callback('SUBSCRIBED'), 0);
      return mockChannel;
    });
  });

  it('returns unavailable when requestId is null', () => {
    const { result } = renderHook(() =>
      useRealtimeRequest(null, vi.fn()),
    );

    expect(result.current).toBe('unavailable');
  });

  it('subscribes to blood_requests table for the given request ID', async () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeRequest('req-123', onUpdate));

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'blood_requests',
        filter: 'id=eq.req-123',
      }),
      expect.any(Function),
    );
  });

  it('calls onUpdate when a real-time event is received with a new timestamp', async () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeRequest('req-123', onUpdate));

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Get the callback that was registered
    const onCall = mockChannel.on.mock.calls[0];
    const callback = onCall?.[2] as (payload: unknown) => void;

    // Simulate a real-time event
    callback({
      eventType: 'UPDATE',
      table: 'blood_requests',
      old: null,
      new: { id: 'req-123', updated_at: '2026-10-26T10:00:00Z' },
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it('does NOT call onUpdate for duplicate events (same timestamp)', async () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeRequest('req-123', onUpdate));

    await new Promise((resolve) => setTimeout(resolve, 10));

    const onCall = mockChannel.on.mock.calls[0];
    const callback = onCall?.[2] as (payload: unknown) => void;

    // First event
    callback({
      eventType: 'UPDATE',
      table: 'blood_requests',
      old: null,
      new: { id: 'req-123', updated_at: '2026-10-26T10:00:00Z' },
    });

    // Duplicate event (same timestamp)
    callback({
      eventType: 'UPDATE',
      table: 'blood_requests',
      old: null,
      new: { id: 'req-123', updated_at: '2026-10-26T10:00:00Z' },
    });

    // onUpdate should be called only once (dedup)
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscription on unmount', async () => {
    const { unmount } = renderHook(() =>
      useRealtimeRequest('req-123', vi.fn()),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});

describe('useRealtimeNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      setTimeout(() => callback('SUBSCRIBED'), 0);
      return mockChannel;
    });
  });

  it('returns unavailable when userId is null', () => {
    const { result } = renderHook(() =>
      useRealtimeNotifications(null, vi.fn()),
    );

    expect(result.current).toBe('unavailable');
  });

  it('subscribes to notifications table filtered by recipient_id', async () => {
    const onNew = vi.fn();
    renderHook(() => useRealtimeNotifications('user-123', onNew));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'recipient_id=eq.user-123',
      }),
      expect.any(Function),
    );
  });

  it('calls onNewNotification when an INSERT event is received', async () => {
    const onNew = vi.fn();
    renderHook(() => useRealtimeNotifications('user-123', onNew));

    await new Promise((resolve) => setTimeout(resolve, 10));

    const onCall = mockChannel.on.mock.calls[0];
    const callback = onCall?.[2] as (payload: unknown) => void;

    callback({
      eventType: 'INSERT',
      table: 'notifications',
      old: null,
      new: { id: 'n1', recipient_id: 'user-123' },
    });

    expect(onNew).toHaveBeenCalled();
  });

  it('cleans up subscription on unmount', async () => {
    const { unmount } = renderHook(() =>
      useRealtimeNotifications('user-123', vi.fn()),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});

describe('useRealtimeRequestList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      setTimeout(() => callback('SUBSCRIBED'), 0);
      return mockChannel;
    });
  });

  it('subscribes to all blood_requests changes', async () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeRequestList(onChange));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'blood_requests',
      }),
      expect.any(Function),
    );
  });

  it('debounces multiple events (500ms)', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderHook(() => useRealtimeRequestList(onChange));

    await vi.advanceTimersByTimeAsync(10);

    const onCall = mockChannel.on.mock.calls[0];
    const callback = onCall?.[2] as (payload: unknown) => void;

    // Send 3 events rapidly
    callback({ eventType: 'INSERT', table: 'blood_requests', old: null, new: {} });
    callback({ eventType: 'UPDATE', table: 'blood_requests', old: null, new: {} });
    callback({ eventType: 'UPDATE', table: 'blood_requests', old: null, new: {} });

    // onChange should not be called yet (debounced)
    expect(onChange).not.toHaveBeenCalled();

    // Advance past debounce window
    vi.advanceTimersByTime(500);

    // onChange should be called once (debounced)
    expect(onChange).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
