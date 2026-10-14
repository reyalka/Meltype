// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import { expect, test } from 'vite-plus/test';
import { runBot } from './test-utils.ts';

test('notices retains all existing license and copyright cases', () => {
  const r = runBot('notices.ts', { args: ['--self-test'] });
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout.match(/PASS/g)).toHaveLength(8);
  expect(r.calls).toEqual([]);
});

test('notices posts a warning for a new TypeScript source without headers', () => {
  const r = runBot('notices.ts', {
    event: { pull_request: { number: 7, user: { login: 'alice' } } },
    mocks: [
      {
        path: '/pulls/7/files?per_page=100&page=1',
        data: [{ filename: 'bot.ts', status: 'added', patch: '+export const value = 1;' }],
      },
      { path: '/issues/7/comments?per_page=100', data: [] },
      { path: '/issues/7/comments', method: 'POST', data: {} },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls.at(-1)?.body?.body).toContain('bot.ts');
  expect(r.calls.at(-1)?.body?.body).toContain('SPDX-License-Identifier');
});

test('notices resolves its previous warning after headers are fixed', () => {
  const r = runBot('notices.ts', {
    event: { pull_request: { number: 7, user: { login: 'alice' } } },
    mocks: [
      {
        path: '/pulls/7/files?per_page=100&page=1',
        data: [
          {
            filename: 'bot.ts',
            status: 'added',
            patch: '+// SPDX-License-Identifier: GPL-3.0-or-later\n+// Copyright (C) 2026 alice',
          },
        ],
      },
      {
        path: '/issues/7/comments?per_page=100',
        data: [
          {
            id: 10,
            user: { type: 'Bot' },
            body: '<!-- meltype-bot --><!-- notices -->\nold warning',
          },
        ],
      },
      { path: '/issues/comments/10', method: 'PATCH', data: {} },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls.at(-1)?.body?.body).toContain('✅');
});
