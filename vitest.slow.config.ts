import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 慢速測試設定：只跑 *.slow.test.ts（要完整跑完一場的模擬測試）。
 * 不用 mergeConfig 合併 vitest.config.ts，因為陣列會被串接，預設設定排除慢速測試的規則會留下來。
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.slow.test.ts'],
    exclude: ['**/node_modules/**'],
    // 台面約 2 到 4 分鐘一場，完整跑完的模擬測試需要較長時限
    testTimeout: 120_000,
  },
  resolve: {
    // 路徑別名：@ 對應 src
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
