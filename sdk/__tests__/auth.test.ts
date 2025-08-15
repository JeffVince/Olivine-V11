import test from 'node:test';
import assert from 'node:assert';
import { OlivineAuth, JwtPayload } from '../auth';

const SECRET = 'test-secret';

// Create an API key token with read scope
const apiKey = OlivineAuth.sign({ userId: '1', orgId: 'org1', role: 'admin', scopes: ['read'] }, SECRET);

const auth = new OlivineAuth(apiKey, 'org1');

test('attaches Authorization header', () => {
  assert.strictEqual(auth.authHeader().Authorization, `Bearer ${apiKey}`);
});

test('validates scopes from API key', () => {
  assert.ok(auth.validateScopes(['read']));
  assert.ok(!auth.validateScopes(['write']));
});

test('verify enforces required scopes', () => {
  const token = OlivineAuth.sign({ userId: '1', orgId: 'org1', role: 'admin', scopes: ['read'] }, SECRET);
  assert.doesNotThrow(() => OlivineAuth.verify(token, SECRET, ['read']));
  assert.throws(() => OlivineAuth.verify(token, SECRET, ['write']));
});

