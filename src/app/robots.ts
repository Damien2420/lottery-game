import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * 產生 robots.txt；允許抓取全站並指向 sitemap。
 * @returns robots 設定
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
