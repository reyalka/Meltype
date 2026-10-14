// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import { expect, test } from 'vite-plus/test';
import { runBot } from './test-utils.ts';

const pr = {
  number: 7,
  user: { id: 1, login: 'alice', type: 'User' },
  author_association: 'NONE',
  head: { sha: 'head-sha' },
};
const signatureFile = (signed: unknown[]) => ({
  sha: 'file-sha',
  content: Buffer.from(JSON.stringify({ signed })).toString('base64'),
});

test.each(['OWNER', 'MEMBER', 'COLLABORATOR'])(
  'CLA exempts %s without reading or writing signatures',
  (association) => {
    const r = runBot('cla.ts', {
      event: { pull_request: { ...pr, author_association: association } },
      mocks: [{ path: '/statuses/head-sha', method: 'POST', data: {} }],
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].body?.state).toBe('success');
  },
);

test('CLA requests agreement from an unsigned PR author', () => {
  const r = runBot('cla.ts', {
    event: { pull_request: pr },
    mocks: [
      { path: '/contents/signatures.json?ref=cla-signatures', status: 404 },
      { path: '/statuses/head-sha', method: 'POST', data: {} },
      { path: '/issues/7/comments?per_page=100', data: [] },
      { path: '/issues/7/comments', method: 'POST', data: {} },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls[1].body?.state).toBe('failure');
  expect(r.calls.at(-1)?.body?.body).toContain('CLA に同意します');
});

test('CLA accepts an existing signature by immutable user id', () => {
  const r = runBot('cla.ts', {
    event: { pull_request: pr },
    mocks: [
      {
        path: '/contents/signatures.json?ref=cla-signatures',
        data: signatureFile([{ id: 1, login: 'old-login', version: 1 }]),
      },
      { path: '/statuses/head-sha', method: 'POST', data: {} },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls.at(-1)?.body?.state).toBe('success');
});

test('CLA ignores agreement from anyone other than the PR author', () => {
  const r = runBot('cla.ts', {
    event: {
      issue: { number: 7, pull_request: {} },
      comment: { body: 'CLA に同意します', user: { id: 2 } },
    },
    mocks: [{ path: '/pulls/7', data: pr }],
  });
  expect(r.status, r.stderr).toBe(0);
  expect(r.calls).toHaveLength(1);
});

test('CLA records the author agreement and updates the existing comment', () => {
  const r = runBot('cla.ts', {
    event: {
      issue: { number: 7, pull_request: {} },
      comment: {
        id: 9,
        body: 'I agree to the CLA',
        user: pr.user,
        html_url: 'https://github.invalid/comment/9',
        created_at: '2026-10-14T00:00:00Z',
      },
    },
    mocks: [
      { path: '/pulls/7', data: pr },
      { path: '/branches/cla-signatures', data: {} },
      { path: '/contents/signatures.json?ref=cla-signatures', data: signatureFile([]) },
      { path: '/contents/signatures.json', method: 'PUT', data: {} },
      { path: '/issues/comments/9/reactions', method: 'POST', data: {} },
      { path: '/statuses/head-sha', method: 'POST', data: {} },
      {
        path: '/issues/7/comments?per_page=100',
        data: [
          {
            id: 10,
            user: { type: 'Bot' },
            body: '<!-- meltype-bot --><!-- cla -->\noriginal agreement',
          },
        ],
      },
      { path: '/issues/comments/10', method: 'PATCH', data: {} },
    ],
  });
  expect(r.status, r.stderr).toBe(0);
  const content = r.calls.find((c) => c.method === 'PUT')?.body?.content ?? '';
  expect(JSON.parse(Buffer.from(content, 'base64').toString('utf8')).signed).toEqual([
    {
      login: 'alice',
      id: 1,
      version: 1,
      pullRequest: 7,
      comment: 'https://github.invalid/comment/9',
      createdAt: '2026-10-14T00:00:00Z',
    },
  ]);
  expect(r.calls.at(-1)?.body?.body).toContain('original agreement');
  expect(r.calls.at(-1)?.body?.body).toContain('同意ありがとうございます');
});
