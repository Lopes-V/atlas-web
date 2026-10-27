import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, verifySession, passwordMatches, accessConfigured } from '../src/lib/session';

const secret = 'test-only-session-secret-with-more-than-32-characters';
test('session accepts valid signature and rejects tampering, expired and malformed tokens', () => {
  const token = createSession(secret, 1000);
  assert.equal(verifySession(token, secret, 1001), true);
  assert.equal(verifySession(token + 'x', secret, 1001), false);
  assert.equal(verifySession(token, 'another-secret', 1001), false);
  assert.equal(verifySession(token, secret, 1000 + 8 * 60 * 60 * 1000), false);
  assert.equal(verifySession(undefined, secret, 1001), false);
  assert.equal(verifySession('broken', secret, 1001), false);
});
test('password check accepts exact match only', () => {
  assert.equal(passwordMatches('correct-password', 'correct-password'), true);
  assert.equal(passwordMatches('wrong', 'correct-password'), false);
  assert.equal(passwordMatches('', 'correct-password'), false);
});

test('four-character access password enables authentication only with a strong session secret', () => {
  assert.equal(accessConfigured('1234', secret), true);
  assert.equal(accessConfigured('123', secret), false);
  assert.equal(accessConfigured('', secret), false);
  assert.equal(accessConfigured(undefined, secret), false);
  assert.equal(accessConfigured('1234', 'short'), false);
  assert.equal(accessConfigured('1234', undefined), false);
});
