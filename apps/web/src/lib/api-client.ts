/**
 * Tiny fetch wrapper for calling the NestJS API.
 *
 * Phase 2 placeholder. In Phase 4+ this will be expanded with auth, retries,
 * typed responses, and per-resource method groups.
 */

import { apiBaseUrl } from './env';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore — body was not JSON
    }
    throw new ApiError(res.status, body, `API request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>('/health');
    return true;
  } catch {
    return false;
  }
}
