import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_TITLE, validateListForm } from './listForm';

describe('validateListForm', () => {
  it('標題空白時使用預設標題並整理名單', () => {
    expect(validateListForm('   ', ' a \r\n\nb')).toEqual({ ok: true, title: DEFAULT_LIST_TITLE, names: ['a', 'b'] });
  });

  it('允許空名單', () => {
    expect(validateListForm('x', '')).toEqual({ ok: true, title: 'x', names: [] });
  });

  it('剛好 200 人可通過，201 人被拒絕', () => {
    const make = (n: number): string => Array.from({ length: n }, (_, i) => `p${i}`).join('\n');
    expect(validateListForm('x', make(200)).ok).toBe(true);
    expect(validateListForm('x', make(201))).toEqual({ ok: false, error: '最多 200 人' });
  });
});
