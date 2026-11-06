import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    // 路徑別名：@ 對應 src
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
