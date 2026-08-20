const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSeedEnvironment } = require('./seed.cjs');

test('seed environment allowlist accepts only explicit development and test', () => {
  for (const environment of ['development', 'test', ' Development ']) {
    assert.doesNotThrow(() => assertSeedEnvironment(environment));
  }

  for (const environment of [undefined, '', 'production', 'staging']) {
    assert.throws(
      () => assertSeedEnvironment(environment),
      /NODE_ENV to be explicitly set to development or test/,
    );
  }
});
