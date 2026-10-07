import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { PullRequestNavigation } from '../../../packages/contracts';

const bundle = JSON.parse(readFileSync('fixtures/recorded-live/tsugiai-agents.json', 'utf8'));
const signal = bundle.map.review_signals[0];
const unit = bundle.map.units.find((unit: any) => unit.unit_id === signal.unit_ids[0]);
const proof = bundle.map.evidence.find((proof: any) => signal.evidence_ids.includes(proof.evidence_id));

function navigation(matches = true): PullRequestNavigation {
  return {
    url: 'https://github.com/kdoai/tsugiai/pull/1',
    head_sha: matches ? bundle.case_study.revision : 'a'.repeat(40),
    base_sha: 'b'.repeat(40),
    snapshot_revision: bundle.case_study.revision,
    head_repository_url: 'https://github.com/kdoai/tsugiai',
    snapshot_id: bundle.map.snapshot_id,
    matches_snapshot: matches,
    truncated: true,
    limitations: ['静的な読取記録です。動作と網羅性は未確認。'],
    files: [
      {
        path: unit.primary_span.path,
        previous_path: null,
        status: 'modified',
        additions: 1,
        deletions: 1,
        patch_missing: false,
        patch_incomplete: false,
        ranges_truncated: false,
        source_available: matches,
        changed_spans: matches ? [{ ...unit.primary_span, end_line: unit.primary_span.start_line }] : [],
        unit_ids: matches ? [unit.unit_id] : [],
        direct_unit_ids: matches ? [unit.unit_id] : [],
        signal_ids: matches ? [signal.signal_id] : [],
        evidence_ids: matches ? [proof.evidence_id] : [],
        evidence_truncated: false,
      },
      {
        path: 'removed.py',
        previous_path: null,
        status: 'removed',
        additions: 0,
        deletions: 10,
        patch_missing: false,
        patch_incomplete: false,
        ranges_truncated: false,
        source_available: false,
        changed_spans: [],
        unit_ids: [],
        direct_unit_ids: [],
        signal_ids: [],
        evidence_ids: [],
        evidence_truncated: false,
      },
      {
        path: 'uninspected.ts',
        previous_path: null,
        status: 'added',
        additions: 10,
        deletions: 0,
        patch_missing: true,
        patch_incomplete: true,
        ranges_truncated: false,
        source_available: false,
        changed_spans: [],
        unit_ids: [],
        direct_unit_ids: [],
        signal_ids: [],
        evidence_ids: [],
        evidence_truncated: false,
      },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
});

test('PR changes open the exact code, saved interpretation and related evidence with no API write (mock PR)', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes.push(request.url());
  });
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/pull-request?**', (route) =>
    route.fulfill({ json: { data: navigation() } }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  const panel = page.locator('.pr-evidence');
  await panel.locator(':scope > summary').click();
  await panel.getByLabel('公開PRのURL').fill('https://github.com/kdoai/tsugiai/pull/1');
  await panel.getByRole('button', { name: 'PRを読む', exact: true }).click();
  await expect(panel).toContainText('headと同じ固定版');
  await expect(panel).toContainText('先頭300ファイル');
  await panel.locator('.pr-file').first().locator('summary').click();
  await panel.getByRole('button', { name: /^変更行/ }).click();
  await expect(page.getByTestId('code-location')).toHaveText(
    `${unit.primary_span.path}:${unit.primary_span.start_line}–${unit.primary_span.start_line}`,
  );
  await expect(page.getByRole('button', { name: '演奏に追従', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await panel.getByRole('button', { name: /^保存された説明/ }).click();
  await expect(page.getByTestId('candidate-details')).toContainText(signal.label);
  await expect(page.getByTestId('candidate-details')).toContainText('未確認事項');
  await panel.getByRole('button', { name: /^関連する読取根拠/ }).click();
  await expect(page.getByTestId('code-location')).toHaveText(
    `${proof.span.path}:${proof.span.start_line}–${proof.span.end_line}`,
  );
  await expect(page.getByTestId('candidate-details')).toHaveCount(0);
  await expect(page.locator('.agent-content')).toContainText('選択行の解釈は未対応');
  await panel.locator('.pr-file').nth(1).locator('summary').click();
  await expect(panel).toContainText('削除された行はheadにありません');
  await panel.locator('.pr-file').nth(2).locator('summary').click();
  await expect(panel).toContainText('差分が提供されていません');
  await expect(panel).toContainText('問題なしという判定ではありません');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 980, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.review-code')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `artifacts/${process.env.E2E_BASE_URL ? 'deployed-' : ''}pr-evidence-mock-${viewport.width}.png`,
    });
  }
  expect(writes).toEqual([]);
});

test('different head exposes no evidence and requests login only after explicit new analysis (mock PR)', async ({
  page,
}) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes++;
  });
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/pull-request?**', (route) =>
    route.fulfill({ json: { data: navigation(false) } }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  const panel = page.locator('.pr-evidence');
  await panel.locator(':scope > summary').click();
  await panel.getByLabel('公開PRのURL').fill('https://github.com/kdoai/tsugiai/pull/1');
  await panel.getByRole('button', { name: 'PRを読む', exact: true }).click();
  await expect(panel).toContainText('保存版とheadが異なります');
  await panel.locator('.pr-file').first().locator('summary').click();
  await expect(panel.getByRole('button', { name: /変更行|関連する読取根拠/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await panel.getByRole('button', { name: 'このhead版をAgentで新規解析', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ログイン' })).toBeVisible();
  expect(writes).toBe(0);
});

test('failed re-read hides stale PR navigation instead of presenting it as current (mock PR)', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/pull-request?**', (route) =>
    ++attempts === 1
      ? route.fulfill({ json: { data: navigation() } })
      : route.fulfill({
          status: 409,
          json: { error: { message: '読取中にPRの版が変わりました。再表示してください。' } },
        }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  const panel = page.locator('.pr-evidence');
  await panel.locator(':scope > summary').click();
  await panel.getByLabel('公開PRのURL').fill('https://github.com/kdoai/tsugiai/pull/1');
  await panel.getByRole('button', { name: 'PRを読む', exact: true }).click();
  await expect(panel).toContainText('headと同じ固定版');
  await panel.getByRole('button', { name: 'PRを読む', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('版が変わりました');
  await expect(panel.locator('.pr-file')).toHaveCount(0);
});

test('authenticated explicit head analysis submits exactly the pinned revision (mock auth and API)', async ({
  page,
}) => {
  const jwt = [
    'eyJhbGciOiJub25lIn0',
    Buffer.from(
      JSON.stringify({
        sub: 'e2e-reviewer',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'code-groove-e2e',
      }),
    ).toString('base64url'),
    'e2e',
  ].join('.');
  await page.route('https://identitytoolkit.googleapis.com/**', (route) =>
    route.fulfill({
      json: route.request().url().includes('lookup')
        ? { users: [{ localId: 'e2e-reviewer', email: 'reviewer@example.invalid' }] }
        : {
            idToken: jwt,
            refreshToken: 'e2e-refresh',
            expiresIn: '3600',
            localId: 'e2e-reviewer',
            email: 'reviewer@example.invalid',
            registered: true,
          },
    }),
  );
  await page.route('**/api/v1/config', (route) =>
    route.fulfill({
      json: {
        data: {
          live_enabled: true,
          model_id: 'mock',
          firebase: {
            apiKey: 'e2e-firebase-key',
            authDomain: 'code-groove-e2e.firebaseapp.com',
            projectId: 'code-groove-e2e',
            appId: '1:123:web:e2e',
          },
        },
      },
    }),
  );
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/pull-request?**', (route) =>
    route.fulfill({ json: { data: navigation(false) } }),
  );
  const writes: unknown[] = [];
  await page.route('**/api/v1/projects', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { data: [] } });
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { project_id: 'p_head_mock', run_id: 'run_head_mock' } } });
  });
  await page.route('**/api/v1/runs/run_head_mock', (route) =>
    route.fulfill({ json: { data: { status: 'cancelled' } } }),
  );
  await page.route('**/api/v1/projects/p_head_mock', (route) =>
    route.fulfill({ json: { data: { run_id: 'run_head_mock' } } }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  const panel = page.locator('.pr-evidence');
  await panel.locator(':scope > summary').click();
  await panel.getByLabel('公開PRのURL').fill('https://github.com/kdoai/tsugiai/pull/1');
  await panel.getByRole('button', { name: 'PRを読む', exact: true }).click();
  await panel.getByRole('button', { name: 'このhead版をAgentで新規解析', exact: true }).click();
  const auth = page.getByRole('dialog', { name: 'ログイン' });
  await auth.getByLabel('メールアドレス', { exact: true }).fill('reviewer@example.invalid');
  await auth.getByLabel('パスワード', { exact: true }).fill('mock-password-only');
  await auth.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(auth).toHaveCount(0);
  expect(writes).toEqual([]);
  await panel.getByRole('button', { name: 'このhead版をAgentで新規解析', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes).toEqual([
    {
      source: {
        kind: 'github_public',
        url: 'https://github.com/kdoai/tsugiai',
        scope_path: null,
        ref: 'a'.repeat(40),
      },
    },
  ]);
});
