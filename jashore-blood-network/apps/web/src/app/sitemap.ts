/**
 * Sitemap — lists all public pages for search engine indexing.
 * Private pages (admin, profile, notifications) are excluded.
 */

import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'https://jashore-blood-network.org';

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPages = [
    '',
    '/donors/search',
    '/blood-requests',
    '/hospitals',
    '/become-donor',
    '/about',
    '/faq',
    '/login',
    '/register',
  ];

  return publicPages.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1.0 : path === '/donors/search' ? 0.9 : 0.7,
  }));
}
