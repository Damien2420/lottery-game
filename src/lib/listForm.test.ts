import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_TITLE, validateListForm } from './listForm';

describe('validateListForm', () => {
  it('標題空白時使用預設標題並整理名單', () => {
    expect(validateListForm('   ', ' a \r\n\nb')).toEqual({ ok: true, title: DEFAULT_LIST_TITLE, names: ['a', 'b'] });
  });

  it('允許空名單', () => {
    expect(validateListForm('x', '')).toEqual({ ok: true, title: 'x', names: [] });
  });

  it('人數沒有上限', () => {
    const names = Array.from({ length: 1000 }, (_, i) => `p${i}`).join('\n');
    expect(validateListForm('x', names).ok).toBe(true);
  });
});
