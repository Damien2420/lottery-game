import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * 產生 sitemap.xml；只列出可被索引的首頁。
 * @returns sitemap 項目陣列
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }];
}
