import { describe, expect, it } from 'vitest';
import { metadata as homeMetadata } from '@/app/page';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { FAQ, SITE_URL } from '@/lib/site';

describe('SEO', () => {
  it('sitemap 只列出首頁', () => {
    expect(sitemap().map((e) => e.url)).toEqual([`${SITE_URL}/`]);
  });
  it('robots 指向 sitemap', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
  it('FAQ 至少包含 4 題', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(4);
  });
  it('首頁 metadata 的 canonical 為 /', () => {
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });
  it('SITE_URL 不以斜線結尾', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});
