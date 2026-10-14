# GitHub bot

Node.js 24.11 以降と npm を使います。開発用の Vite+ (format・lint・Vitest) はこのディレクトリだけに設定しています。

```sh
cd .github/bot
npm ci
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
```

GitHub API に書き込むスクリプトを手元で直接実行せず、API をスタブにしたテストで確かめてください。
