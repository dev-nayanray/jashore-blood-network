/**
 * App Shell — shared layout with header + bottom navigation.
 * Appears on ALL pages for consistent app-style navigation.
 * Mobile-first, responsive design with red theme matching reference design.
 */

'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-provider';
import { NotificationBell } from '@/features/notifications/notification-bell';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/donors/search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { href: '/blood-requests', label: 'Requests', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/donors/register', label: 'Donate', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { href: '/settings', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Don't show app shell on admin pages (they have their own layout)
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      {/* Top Header — red gradient matching reference */}
      <header className="sticky top-0 z-40 border-b border-red-400/30 bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md" role="banner">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Jashore Blood Network — Home">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.653 16.915V19h2.694v-2.085c1.604-.214 3.07-.937 4.092-2.085 1.022-1.148 1.529-2.582 1.529-4.283 0-1.7-.507-3.135-1.529-4.283-1.022-1.148-2.488-1.871-4.092-2.085V2.085H9.653v2.085C8.049 4.384 6.583 5.107 5.561 6.255 4.539 7.403 4.032 8.838 4.032 10.538c0 1.701.507 3.135 1.529 4.283 1.022 1.148 2.488 1.871 4.092 2.085z"/>
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight">রক্ত দেই</span>
            <span className="hidden text-xs font-medium text-white/70 sm:inline">Jashore Blood Network</span>
          </Link>

          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-white/60 text-sm">…</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <NotificationBell />
                <Link href="/settings" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium hover:bg-white/20 transition">
                  <span className="hidden sm:inline">{user.fullName.split(' ')[0]}</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              </div>
            ) : (
              <Link href="/login" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main" className="flex-1 pb-20" role="main">
        {children}
      </main>

      {/* Bottom Navigation — app-style, always visible */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white shadow-lg" aria-label="Bottom navigation">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 transition ${
                  isActive ? 'text-red-600' : 'text-neutral-500 hover:text-neutral-800'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
