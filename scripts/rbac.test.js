'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const rbac = require('../src/engine/rbac');

test('normalizeRole maps viewer to reporter', () => {
  assert.equal(rbac.normalizeRole('viewer'), 'reporter');
  assert.equal(rbac.normalizeRole('sender'), 'sender');
});

test('manager cannot read activity_log or users', () => {
  assert.equal(rbac.canRead('manager', 'activity_log'), false);
  assert.equal(rbac.canRead('manager', 'users'), false);
  assert.equal(rbac.canWrite('manager', 'push'), true);
});

test('sender can write push but not employees', () => {
  assert.equal(rbac.canWrite('sender', 'push'), true);
  assert.equal(rbac.canRead('sender', 'templates'), true);
  assert.equal(rbac.canWrite('sender', 'templates'), false);
  const putEmployees = rbac.enforceApiPermission(
    { role: 'sender', brand_id: 'b1' },
    'PUT',
    '/brands/b1/employees/x'
  );
  assert.equal(putEmployees.ok, false);
  assert.equal(putEmployees.status, 403);
});

test('reporter blocked from push send', () => {
  const res = rbac.enforceApiPermission({ role: 'reporter' }, 'POST', '/push/send');
  assert.equal(res.ok, false);
  assert.equal(res.status, 403);
});

test('reporter can read analytics and activity log', () => {
  assert.equal(rbac.canRead('reporter', 'analytics'), true);
  assert.equal(rbac.canRead('reporter', 'activity_log'), true);
  assert.equal(rbac.canWrite('reporter', 'analytics'), false);
});

test('default landing sections per role', () => {
  assert.equal(rbac.defaultLandingSection('sender'), 'push');
  assert.equal(rbac.defaultLandingSection('reporter'), 'analytics');
  assert.equal(rbac.defaultLandingSection('admin'), 'welcome');
});
