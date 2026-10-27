/**
 * Robots — allows public pages, blocks private pages from indexing.
 */

import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'https://jashore-blood-network.org';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/donors/profile',
        '/donors/register',
        '/donors/verification',
        '/notifications',
        '/blood-requests/new',
        '/blood-requests/*/edit',
        '/report-abuse',
        '/logout',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
