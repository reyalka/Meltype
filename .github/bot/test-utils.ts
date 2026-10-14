// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface MockResponse {
  path: string;
  method?: string;
  status?: number;
  data?: unknown;
}
interface Request {
  url: string;
  method: string;
  body?: { body?: string; state?: string; content?: string; variables?: { after?: string | null } };
}

// CLI を本番と同じ Node の型除去で実行する。未定義の API 呼び出しは必ず失敗させる。
export function runBot(
  script: string,
  options: {
    args?: string[];
    event?: unknown;
    env?: Record<string, string>;
    files?: Record<string, string>;
    mocks?: MockResponse[];
  } = {},
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meltype-cli-test-'));
  try {
    const requests = path.join(dir, 'requests.jsonl');
    const event = path.join(dir, 'event.json');
    fs.writeFileSync(event, JSON.stringify(options.event ?? {}));
    fs.writeFileSync(requests, '');
    for (const [name, content] of Object.entries(options.files ?? {}))
      fs.writeFileSync(path.join(dir, name), content);
    const stub = `
      import fs from 'node:fs';
      const mocks = ${JSON.stringify(options.mocks ?? [])};
      globalThis.fetch = async (url, options = {}) => {
        const method = options.method ?? 'GET';
        fs.appendFileSync(${JSON.stringify(requests)}, JSON.stringify({ url, method,
          body: options.body && JSON.parse(options.body) }) + '\\n');
        const i = mocks.findIndex(m => url.endsWith(m.path) && method === (m.method ?? 'GET'));
        if (i < 0) throw new Error('Unexpected API request: ' + method + ' ' + url);
        const mock = mocks.splice(i, 1)[0];
        const status = mock.status ?? 200;
        return { status, ok: status >= 200 && status < 300,
          json: async () => mock.data, text: async () => JSON.stringify(mock.data) };
      };
      process.argv = [process.execPath, ${JSON.stringify(script)}, ...${JSON.stringify(options.args ?? [])}];
      await import(${JSON.stringify(new URL(`./${script}`, import.meta.url).href)});
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', stub], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: path.join(dir, 'output.txt'),
        GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md'),
        GITHUB_REPOSITORY: 'test/Meltype',
        GITHUB_API_URL: 'https://api.invalid',
        GITHUB_GRAPHQL_URL: 'https://api.invalid/graphql',
        GITHUB_TOKEN: 'unused',
        ...options.env,
      },
    });
    const calls = fs
      .readFileSync(requests, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Request);
    const files = Object.fromEntries(
      fs.readdirSync(dir).map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]),
    );
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls, files };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
