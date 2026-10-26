import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/auth-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jashore Blood Network',
    template: '%s | Jashore Blood Network',
  },
  description:
    'A district-wide blood donor discovery and blood request coordination platform for Jashore District, Bangladesh.',
  applicationName: 'Jashore Blood Network',
  authors: [{ name: 'Jashore Blood Network' }],
  keywords: [
    'blood donor',
    'Jashore',
    'Bangladesh',
    'blood request',
    'donor coordination',
  ],
  formatDetection: {
    telephone: true,
    address: false,
    email: false,
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
      <body className="min-h-dvh flex flex-col bg-white text-neutral-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
