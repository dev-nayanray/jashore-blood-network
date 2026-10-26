'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import {
  createBloodRequest,
  type CreateBloodRequestInput,
  type BloodComponent,
  type UrgencyLevel,
  type ContactMethod,
} from '@/features/blood-requests/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';
import { useAuth } from '@/features/auth/auth-provider';

export default function NewBloodRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [unitsRequested, setUnitsRequested] = useState('1');
  const [requiredBy, setRequiredBy] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('NORMAL');
  const [patientName, setPatientName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [bloodComponent, setBloodComponent] = useState<BloodComponent | ''>('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('IN_APP');
  const [contactNote, setContactNote] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    void (async () => {
      try {
        const d = await fetchDistricts();
        setDistricts(d);
      } catch { /* ok */ }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDistrict) { setUpazilas([]); return; }
    void (async () => {
      try { setUpazilas(await fetchUpazilas(selectedDistrict)); } catch { setUpazilas([]); }
    })();
  }, [selectedDistrict]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bloodGroup || !upazilaId || !requiredBy) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateBloodRequestInput = {
        bloodGroup: bloodGroup as CreateBloodRequestInput['bloodGroup'],
        upazilaId,
        unitsRequested: parseInt(unitsRequested, 10) || 1,
        requiredBy: new Date(requiredBy).toISOString(),
        urgency,
        contactMethod,
        patientDisplayName: patientName || undefined,
        hospitalName: hospitalName || undefined,
        bloodComponent: bloodComponent || undefined,
        contactNote: contactNote || undefined,
        notes: notes || undefined,
      };
      const result = await createBloodRequest(input);
      router.push(`/blood-requests/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Request Blood</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Submit a blood request. A moderator will verify it before it becomes publicly visible.
        </p>
      </header>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This platform does not determine medical eligibility. Hospitals and qualified medical
        professionals must confirm blood compatibility, donor eligibility, and transfusion arrangements.
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Required information</legend>
          <div>
            <label htmlFor="bloodGroup" className="block text-sm font-medium text-neutral-700">Blood group needed <span className="text-red-600">*</span></label>
            <select id="bloodGroup" required value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{BLOOD_GROUP_LABELS[bg]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="units" className="block text-sm font-medium text-neutral-700">Units needed <span className="text-red-600">*</span></label>
            <input id="units" type="number" min={1} max={10} value={unitsRequested} onChange={(e) => setUnitsRequested(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="district" className="block text-sm font-medium text-neutral-700">District <span className="text-red-600">*</span></label>
            <select id="district" required value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setUpazilaId(''); }} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
              <option value="">Select district</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="upazila" className="block text-sm font-medium text-neutral-700">Upazila <span className="text-red-600">*</span></label>
            <select id="upazila" required value={upazilaId} onChange={(e) => setUpazilaId(e.target.value)} disabled={!selectedDistrict || submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base disabled:bg-neutral-100">
              <option value="">Select upazila</option>
              {upazilas.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="requiredBy" className="block text-sm font-medium text-neutral-700">Needed by (date &amp; time) <span className="text-red-600">*</span></label>
            <input id="requiredBy" type="datetime-local" required value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="urgency" className="block text-sm font-medium text-neutral-700">Urgency</label>
            <select id="urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as UrgencyLevel)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
              <option value="URGENT">Urgent — needed within 24 hours</option>
              <option value="NORMAL">Normal — needed within a few days</option>
              <option value="FLEXIBLE">Flexible — scheduled in advance</option>
            </select>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Additional information (optional)</legend>
          <div>
            <label htmlFor="patientName" className="block text-sm font-medium text-neutral-700">Patient display name</label>
            <input id="patientName" type="text" maxLength={120} value={patientName} onChange={(e) => setPatientName(e.target.value)} disabled={submitting}
              placeholder="e.g. Patient initials or relation" className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="hospitalName" className="block text-sm font-medium text-neutral-700">Hospital name</label>
            <input id="hospitalName" type="text" maxLength={180} value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="bloodComponent" className="block text-sm font-medium text-neutral-700">Blood component (if specific)</label>
            <select id="bloodComponent" value={bloodComponent} onChange={(e) => setBloodComponent(e.target.value as BloodComponent | '')} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
              <option value="">Whole blood (default)</option>
              <option value="WHOLE_BLOOD">Whole blood</option>
              <option value="PLASMA">Plasma</option>
              <option value="PLATELETS">Platelets</option>
              <option value="RED_BLOOD_CELLS">Red blood cells</option>
            </select>
          </div>
          <div>
            <label htmlFor="contactMethod" className="block text-sm font-medium text-neutral-700">Preferred contact method</label>
            <select id="contactMethod" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
              <option value="IN_APP">In-app messages (recommended)</option>
              <option value="PHONE">Phone</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
          <div>
            <label htmlFor="contactNote" className="block text-sm font-medium text-neutral-700">Contact note (for donors)</label>
            <textarea id="contactNote" maxLength={2000} value={contactNote} onChange={(e) => setContactNote(e.target.value)} disabled={submitting} rows={2}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">Additional notes</label>
            <textarea id="notes" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} rows={3}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
        </fieldset>

        <button type="submit" disabled={submitting || !bloodGroup || !upazilaId || !requiredBy}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
        <Link href="/blood-requests" className="block text-center text-sm text-neutral-600 hover:text-neutral-900">Cancel</Link>
      </form>
    </main>
  );
}
