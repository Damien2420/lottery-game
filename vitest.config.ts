import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // 要完整跑完一場模擬的慢速測試（*.slow.test.ts）平常不跑，用 npm run test:slow 另外執行
    exclude: [...configDefaults.exclude, '**/*.slow.test.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    // 路徑別名：@ 對應 src
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
