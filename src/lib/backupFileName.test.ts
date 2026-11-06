import { describe, expect, it } from 'vitest';
import { backupFileName } from './backupFileName';

describe('backupFileName', () => {
  it('以本地日期組成檔名並補零', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('pinball-lottery-backup-20260105.json');
  });

  it('十二月底也正確', () => {
    expect(backupFileName(new Date(2026, 11, 31, 0, 0))).toBe('pinball-lottery-backup-20261231.json');
  });
});
