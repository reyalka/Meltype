// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 reyalka
// Bot が読む GitHub API・イベントと、.NET テストの JSON の形。
export interface User {
  id: number;
  login: string;
  type: string;
}
export interface Issue {
  number: number;
  body?: string | null;
  labels: { name: string }[];
  pull_request?: { url: string };
}
export interface Comment {
  id: number;
  body?: string | null;
  user: User;
  author_association: string;
  html_url: string;
  created_at: string;
}
export interface PullRequest {
  number: number;
  body?: string | null;
  user: User;
  author_association: string;
  head: { sha: string };
}
export interface BotEvent {
  action: string;
  issue: Issue;
  comment?: Comment;
  pull_request?: PullRequest;
}
export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string;
}
export interface Finding {
  file: string;
  problems: string[];
}
export interface Signatures {
  signed: {
    login: string;
    id: number;
    version: number;
    pullRequest: number;
    comment: string;
    createdAt: string;
  }[];
}
export interface ContentFile {
  content: string;
  sha: string;
}
export interface GitObject {
  sha: string;
}
export interface ReproResult {
  committed?: string;
  composing?: string;
  converted?: string;
  engine?: string;
  clauses?: string[];
  candidates?: string[];
}
export interface JhtResult {
  error?: string;
  expected: string;
  reading?: string;
  engine?: string;
  results?: {
    keys: string;
    entered: string;
    first: string;
    liveOk: boolean;
    firstOk: boolean;
    notes?: string[];
  }[];
}
export interface ExpectResult {
  ok: boolean;
  typed: string;
  expected: string;
  actual: string;
  kind: string;
}
export interface QualityCase {
  key: string;
  ok: boolean;
  detail: string;
}
export interface QualityResult {
  pass: number;
  total: number;
  cases: QualityCase[];
}
export interface SponsorsData {
  user?: {
    sponsorshipsAsMaintainer?: {
      nodes: { privacyLevel: string; sponsorEntity?: { login: string } }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
