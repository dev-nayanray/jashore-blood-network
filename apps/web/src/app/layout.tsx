import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/auth-provider';
import { AppShell } from '@/components/app-shell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jashore Blood Network — Connecting Donors with Patients',
    template: '%s | Jashore Blood Network',
  },
  description:
    'A district-wide blood donor coordination platform for Jashore District, Bangladesh. Find consenting blood donors, submit verifiable blood requests, and connect with healthcare facilities.',
  applicationName: 'Jashore Blood Network',
  authors: [{ name: 'Jashore Blood Network' }],
  keywords: [
    'blood donor', 'Jashore', 'Bangladesh', 'blood request',
    'donor coordination', 'blood donation', 'রক্ত দেই',
  ],
  formatDetection: { telephone: true, address: false, email: false },
  openGraph: {
    title: 'Jashore Blood Network',
    description: 'Connecting people who need blood with donors who care. Jashore District, Bangladesh.',
    type: 'website', locale: 'en_US', siteName: 'Jashore Blood Network',
  },
  twitter: {
    card: 'summary',
    title: 'Jashore Blood Network',
    description: 'Connecting people who need blood with donors who care. Jashore District, Bangladesh.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#dc2626',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
