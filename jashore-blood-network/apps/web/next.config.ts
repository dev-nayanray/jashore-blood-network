import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Force locale to ensure consistent date/number formatting
  i18n: undefined,
  // Production: these headers will be set by Vercel, but we set them in dev too
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // Transpile workspace packages so they work with Next's bundler
  transpilePackages: ['@jbn/shared-types', '@jbn/validation'],
};

export default nextConfig;
