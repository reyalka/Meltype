// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import { expect, test } from 'vite-plus/test';
import { runBot } from './test-utils.ts';

test('cases combines PR examples with linked misdetection issues', () => {
  const r = runBot('pr-checks.ts', {
    args: ['cases', 'cases.txt'],
    event: {
      pull_request: {
        body: 'Fixes #686\nCloses #12\n## 確かめること\n- `hello` → `hello`\n## 確認\nignored → ignored',
      },
    },
    mocks: [
      {
        path: '/issues/686',
        data: {
          labels: [{ name: '誤判定' }],
          body: '### 打ったもの\n\n`enshittification`\n\n### 期待した結果\n\n`enshittification`',
        },
      },
      { path: '/issues/12', data: { labels: [{ name: 'bug' }] } },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.files['cases.txt']).toBe('hello\thello\nenshittification\tenshittification\n');
  expect(JSON.parse(r.files['cases.txt.sources.json'])).toEqual(['確かめること', '#686']);
  expect(r.files['output.txt']).toBe('count=2\n');
});

test.each([true, false])('expect sets exit status for ok=%s and escapes table cells', (ok) => {
  const r = runBot('pr-checks.ts', {
    args: ['expect', 'result.json'],
    files: {
      'result.json': JSON.stringify([
        { ok, typed: 'a|b', expected: 'a|b', actual: 'a|b', kind: 'exact' },
      ]),
    },
  });
  expect(r.status).toBe(ok ? 0 : 1);
  expect(r.files['summary.md']).toContain('a\\|b');
  expect(r.calls).toEqual([]);
});

test.each([
  { name: 'existing failure', baseOk: false, newCase: false, status: 0 },
  { name: 'regression', baseOk: true, newCase: false, status: 1 },
  { name: 'new failing case', baseOk: true, newCase: true, status: 1 },
])('compare identifies $name', ({ baseOk, newCase, status }) => {
  const r = runBot('pr-checks.ts', {
    args: ['compare', 'base.json', 'pr.json'],
    files: {
      'base.json': JSON.stringify({
        pass: Number(baseOk),
        total: 1,
        cases: [{ key: 'old', ok: baseOk, detail: 'old' }],
      }),
      'pr.json': JSON.stringify({
        pass: 0,
        total: 1,
        cases: [{ key: newCase ? 'new' : 'old', ok: false, detail: 'broken' }],
      }),
    },
  });
  expect(r.status, r.stderr).toBe(status);
  expect(r.files['summary.md']).toContain('精度の比較');
  expect(r.calls).toEqual([]);
});
