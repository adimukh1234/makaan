import { describe, expect, it } from 'vitest';
import { isId, newId } from '../src/ids';

describe('ids', () => {
  it('generates prefixed, URL safe ids', () => {
    const id = newId('ten');
    expect(id).toMatch(/^ten_[0-9a-z]{26}$/);
    expect(isId(id, 'ten')).toBe(true);
    expect(isId(id, 'usr')).toBe(false);
  });

  it('does not collide across many generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      seen.add(newId('usr'));
    }
    expect(seen.size).toBe(5000);
  });
});
