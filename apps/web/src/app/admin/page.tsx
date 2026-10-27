import { redirect } from 'next/navigation';

/**
 * /admin has no index of its own — send visitors straight to the dashboard.
 * (Without this page the URL 404s.)
 */
export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
