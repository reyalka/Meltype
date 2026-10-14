// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import { expect, test } from 'vite-plus/test';
import { runBot } from './test-utils.ts';

test('sponsors retains its existing README replacement cases', () => {
  const r = runBot('sponsors.ts', { args: ['--self-test'] });
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout.match(/PASS/g)).toHaveLength(4);
  expect(r.calls).toEqual([]);
});

test('sponsors paginates, deduplicates and excludes private names', () => {
  const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null) => ({
    data: { user: { sponsorshipsAsMaintainer: { nodes, pageInfo: { hasNextPage, endCursor } } } },
  });
  const sponsor = (login: string, privacyLevel = 'PUBLIC') => ({
    privacyLevel,
    sponsorEntity: { login },
  });
  const r = runBot('sponsors.ts', {
    files: { 'README.md': 'before\n<!-- sponsors:start -->\nold\n<!-- sponsors:end -->\nafter\n' },
    mocks: [
      {
        path: '/graphql',
        method: 'POST',
        data: page([sponsor('alice'), sponsor('secret', 'PRIVATE')], true, 'cursor-1'),
      },
      {
        path: '/graphql',
        method: 'POST',
        data: page([sponsor('alice'), sponsor('bob')], false, null),
      },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls[1].body?.variables?.after).toBe('cursor-1');
  expect(r.files['README.md']).toContain('alice.png');
  expect(r.files['README.md']).toContain('bob.png');
  expect(r.files['README.md']).not.toContain('secret');
  expect(r.files['README.md'].match(/alice\.png/g)).toHaveLength(1);
  expect(r.files['README.md']).toMatch(/^before\n/);
  expect(r.files['README.md']).toMatch(/\nafter\n$/);
});

test('sponsors does not modify README when GraphQL fails', () => {
  const readme = '<!-- sponsors:start -->\nold\n<!-- sponsors:end -->';
  const r = runBot('sponsors.ts', {
    files: { 'README.md': readme },
    mocks: [{ path: '/graphql', method: 'POST', data: { errors: [{ message: 'denied' }] } }],
  });
  expect(r.status).toBe(1);
  expect(r.files['README.md']).toBe(readme);
});
