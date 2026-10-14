// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: { include: ['**/*.test.ts'] },
  lint: { options: { typeAware: true } },
  fmt: { semi: true, singleQuote: true },
});
