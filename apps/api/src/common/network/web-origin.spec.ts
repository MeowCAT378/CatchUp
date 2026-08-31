import { webOrigin } from './web-origin';

describe('webOrigin', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWebOrigin = process.env.WEB_ORIGIN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalWebOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = originalWebOrigin;
  });

  it('uses localhost only outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.WEB_ORIGIN;
    expect(webOrigin()).toBe('http://localhost:3000');
  });

  it('requires one valid origin in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEB_ORIGIN;
    expect(webOrigin).toThrow('WEB_ORIGIN is required in production');
    process.env.WEB_ORIGIN = 'https://staging.example.com';
    expect(webOrigin()).toBe('https://staging.example.com');
    process.env.WEB_ORIGIN = 'https://staging.example.com/path';
    expect(webOrigin).toThrow(
      'WEB_ORIGIN must be an HTTP(S) origin without a path',
    );
  });
});
