import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = 'https://legalight.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/services/', '/about/', '/privacy/', '/offer/', '/consent/'].map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
