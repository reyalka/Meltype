// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
// parse → report を GitHub API のスタブで確かめる。外部には何も送らない。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bot = new URL('./meltype-bot.ts', import.meta.url).href;

function reproduce({ typed = 'enshittification', reported, expected, actual, converted }: { typed?: string; reported: string; expected: string; actual: string; converted?: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meltype-bot-test-'));
  try {
    const event = path.join(dir, 'event.json');
    const output = path.join(dir, 'output.txt');
    const requests = path.join(dir, 'requests.jsonl');
    fs.writeFileSync(event, JSON.stringify({
      action: 'opened',
      issue: {
        number: 686, labels: [{ name: '誤判定' }],
        body: `### 打ったもの (キーをそのまま)\n\n${typed}\n\n### 出たもの\n\n${reported}\n\n### 期待した結果\n\n${expected}\n\n### Meltype の版\n\n1.2.2-pre.1`,
      },
    }));
    fs.writeFileSync(output, '');
    const env = {
      ...process.env, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output,
      GITHUB_REPOSITORY: 'test/Meltype', GITHUB_TOKEN: 'unused',
      GITHUB_API_URL: 'https://api.invalid', GITHUB_SERVER_URL: 'https://github.invalid',
      GITHUB_RUN_ID: '1', BOT_RESULTS: dir,
    };
    function run(mode: string, extra: Record<string, string> = {}) {
      const stub = `
        import fs from 'node:fs';
        globalThis.fetch = async (url, options) => {
          fs.appendFileSync(${JSON.stringify(requests)}, JSON.stringify({
            url, method: options.method, body: options.body && JSON.parse(options.body),
          }) + '\\n');
          return { ok: true, status: 200, json: async () => options.method === 'GET' ? [] : {} };
        };
        process.argv[2] = ${JSON.stringify(mode)};
        await import(${JSON.stringify(bot)});
      `;
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval', stub], {
        env: { ...env, ...extra }, encoding: 'utf8', timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr || String(result.error ?? ''));
    }
    run('parse');
    const parsed: Record<string, string> = {};
    const lines = fs.readFileSync(output, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\w+)<<(\S+)$/);
      if (!match) continue;
      const value = [];
      while (lines[++i] !== match[2]) {
        assert.ok(i < lines.length, 'output delimiter is missing');
        value.push(lines[i]);
      }
      parsed[match[1]] = value.join('\n');
    }
    assert.equal(parsed.action, 'repro', 'form should be accepted');
    fs.writeFileSync(requests, '');
    fs.writeFileSync(path.join(dir, 'repro-main.json'), JSON.stringify({
      committed: actual, composing: '', converted, engine: 'Mozc',
    }));
    const reportEnv = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [`BOT_${k.toUpperCase()}`, v]));
    run('report', reportEnv);
    const calls = fs.readFileSync(requests, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { url: string; method: string; body?: { body?: string; labels?: string[] } });
    return {
      parsed,
      comment: calls.find(r => r.method === 'POST' && r.url.endsWith('/comments'))?.body?.body ?? '',
      reproducedLabel: calls.some(r => r.body?.labels?.includes('再現済み')),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('issue #686: inline code in reported text is reproduced', () => {
  const r = reproduce({ reported: '`エン湿地フィcation`', expected: '`enshittification`', actual: 'エン湿地フィcation' });
  assert.equal(r.parsed.reported, 'エン湿地フィcation');
  assert.equal(r.parsed.expected, 'enshittification');
  assert.match(r.comment, /再現しました/);
  assert.equal(r.reproducedLabel, true);
});

test('inline code in typed and expected text is accepted and matches', () => {
  const r = reproduce({ typed: '`enshittification`', reported: '`エン湿地フィcation`', expected: '`enshittification`', actual: 'enshittification' });
  assert.equal(r.parsed.keys, 'enshittification');
  assert.match(r.comment, /期待どおり/);
  assert.equal(r.reproducedLabel, false);
});

test('plain form values still reproduce', () => {
  assert.match(reproduce({ reported: 'エン湿地フィcation', expected: 'enshittification', actual: 'エン湿地フィcation' }).comment, /再現しました/);
});

test('PR #649: different Japanese strings never match via empty ASCII words', () => {
  const r = reproduce({ typed: 'yahoyaho', reported: '`谷保谷保`', expected: '`やほやほ`', actual: '谷保谷保' });
  assert.match(r.comment, /再現しました/);
  assert.doesNotMatch(r.comment, /期待どおり/);
});

test('different strings sharing ASCII words remain different', () => {
  const r = reproduce({ reported: '`別のcation`', expected: '`期待cation`', actual: 'エン湿地フィcation' });
  assert.match(r.comment, /報告とは違う結果/);
  assert.equal(r.reproducedLabel, false);
});

test('converted result is still compared exactly', () => {
  assert.match(reproduce({ reported: '`谷保谷保`', expected: '`やほやほ`', actual: 'やほやほ', converted: '谷保谷保' }).comment, /期待どおり/);
  assert.match(reproduce({ reported: '`谷保谷保`', expected: '`期待`', actual: 'やほやほ', converted: '谷保谷保' }).comment, /再現しました/);
});

test('spaces inside code delimiters are preserved', () => {
  const r = reproduce({ reported: '`エン湿地フィcation `', expected: '`enshittification`', actual: 'エン湿地フィcation' });
  assert.equal(r.parsed.reported, 'エン湿地フィcation ');
  assert.match(r.comment, /報告とは違う結果/);
});

test('multiple backtick delimiters preserve a literal backtick', () => {
  const r = reproduce({ reported: '``a`b``', expected: '`other`', actual: 'a`b' });
  assert.equal(r.parsed.reported, 'a`b');
  assert.match(r.comment, /再現しました/);
});

test('unpaired backticks and prose are not stripped', () => {
  for (const text of ['`value', 'value`', '`value``', '`a` and `b`']) {
    const r = reproduce({ reported: text, expected: 'other', actual: 'value' });
    assert.equal(r.parsed.reported, text);
    assert.match(r.comment, /報告とは違う結果/);
  }
});
