/**
 * Blood request card — public list result.
 */

'use client';

import Link from 'next/link';
import { BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import type { BloodRequestPublic, RequestStatus, UrgencyLevel } from './api';

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  SEARCHING: 'Searching',
  DONOR_RESPONDED: 'Donor Responded',
  ARRANGED: 'Arranged',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  SEARCHING: 'bg-green-100 text-green-800',
  DONOR_RESPONDED: 'bg-indigo-100 text-indigo-800',
  ARRANGED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-neutral-100 text-neutral-600',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  REJECTED: 'bg-red-100 text-red-800',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
  FLEXIBLE: 'Flexible',
};

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  URGENT: 'bg-red-50 text-red-700 border-red-200',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-200',
  FLEXIBLE: 'bg-neutral-50 text-neutral-700 border-neutral-200',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

export function BloodRequestCard({ request }: { request: BloodRequestPublic }) {
  return (
    <Link
      href={`/blood-requests/${request.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700"
            >
              {BLOOD_GROUP_LABELS[request.bloodGroup]}
            </span>
            <span className="text-xs text-neutral-500">
              {request.unitsRequested} unit{request.unitsRequested === 1 ? '' : 's'}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold text-neutral-900">
            {request.patientDisplayName || 'Patient (anonymous)'}
          </h3>
          <p className="mt-0.5 truncate text-sm text-neutral-600">
            {request.hospitalName || 'Hospital not specified'}
            {' — '}
            {request.upazila.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[request.status]}`}
          >
            {STATUS_LABELS[request.status]}
          </span>
          <span
            className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[request.urgency]}`}
          >
            {URGENCY_LABELS[request.urgency]}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>Needed by: {formatDateTime(request.requiredBy)}</span>
        <span>Posted {formatDateTime(request.createdAt)}</span>
      </div>
    </Link>
  );
}
