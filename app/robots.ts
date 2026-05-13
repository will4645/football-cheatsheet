import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/preview', '/privacy', '/terms'],
        disallow: ['/dashboard', '/match/', '/competition/', '/api/', '/account'],
      },
    ],
    sitemap: 'https://football-cheatsheet.vercel.app/sitemap.xml',
  };
}
