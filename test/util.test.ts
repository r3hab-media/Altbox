import { describe, expect, it } from 'vitest';

import { autoContrast, parseColor, parseDims } from '../src/util';

describe('parseDims', () => {
  it('parses valid dimensions', () => {
    const { width, height } = parseDims('600x300');
    expect(width).toBe(600);
    expect(height).toBe(300);
  });

  it('rejects invalid separators', () => {
    expect(() => parseDims('600X300')).toThrowError('Invalid dimensions');
  });
});

describe('parseColor', () => {
  it('parses named colors', () => {
    expect(parseColor('red')).toBe('#ff0000');
  });

  it('returns transparent for t', () => {
    expect(parseColor('t')).toBe('transparent');
  });

  it('normalizes shorthand hex', () => {
    expect(parseColor('#0f0')).toBe('#00ff00');
  });
});

describe('autoContrast', () => {
  it('returns light foreground on dark backgrounds', () => {
    expect(autoContrast('#ff0000')).toBe('#ffffff');
  });
});
