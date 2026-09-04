import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://raaga.me';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs'],
        disallow: ['/api/', '/settings/'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/docs'],
        disallow: ['/api/', '/settings/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
