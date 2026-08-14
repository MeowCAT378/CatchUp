import { normalizeEmail } from './auth.service';

describe('normalizeEmail', () => {
  it('trims and lowercases emails without changing passwords', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
  });
});
