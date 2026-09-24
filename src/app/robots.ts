import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://raaga.me';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/download', '/get-app', '/apps', '/releases/', '/docs'],
        disallow: ['/api/auth/', '/settings/'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/download', '/docs'],
        disallow: ['/api/auth/', '/settings/'],
      },
      {
        userAgent: 'Bingbot',
        allow: ['/', '/download', '/docs'],
        disallow: ['/api/auth/', '/settings/'],
      },
      {
        userAgent: 'Applebot',
        allow: ['/', '/download', '/docs'],
        disallow: ['/api/auth/', '/settings/'],
      },
      {
        userAgent: 'DuckDuckBot',
        allow: ['/', '/download', '/docs'],
        disallow: ['/api/auth/', '/settings/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/download', '/docs'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/download', '/docs'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/download', '/docs'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
