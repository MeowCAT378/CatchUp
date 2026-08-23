const localWebOrigin = 'http://localhost:3000';

export function webOrigin() {
  const value = process.env.WEB_ORIGIN?.trim();
  if (!value) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('WEB_ORIGIN is required in production');
    return localWebOrigin;
  }

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value)
    throw new Error('WEB_ORIGIN must be an HTTP(S) origin without a path');
  return url.origin;
}
