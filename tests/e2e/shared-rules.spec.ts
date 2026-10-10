import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
});

test('shared-rule comparison precedes verdict and leads to evidence and an unsent follow-up question', async ({
  page,
}) => {
  const bundle = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8'));
  bundle.map.origin = 'fixture';
  bundle.map.review_signals = [];
  await page.route('**/api/v1/samples/recorded-returns-before/bundle', (route) =>
    route.fulfill({ json: { data: bundle } }),
  );
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) posts++;
  });
  await page.goto('/projects/sample-recorded-returns-before/inspect');
  const comparison = page.getByTestId('shared-rules');
  await comparison.locator(':scope > summary').click();
  await expect(comparison.getByLabel('比較する共有ルール')).toBeVisible();
  await expect(comparison).toContainText('条件・値・挙動の完全一致');
  await comparison.getByRole('button', { name: 'A→Bの識別フレーズを聴く', exact: true }).click();
  await expect(comparison.getByRole('status')).toContainText('共有ルールを試聴中');
  await expect(page.getByTestId('audition-status')).toContainText('試聴中');
  await comparison.getByRole('button', { name: '比較を停止', exact: true }).click();
  await expect(comparison.getByRole('status')).toHaveText('停止中');
  await comparison.getByRole('button', { name: /^Bの根拠/ }).click();
  await expect(page.getByTestId('code-location')).toBeVisible();
  const selectedA = await comparison.getByLabel('Aの出現箇所').inputValue();
  const selectedB = await comparison.getByLabel('Bの出現箇所').inputValue();
  await comparison.getByRole('button', { name: 'この関係を追加調査する質問を作る' }).click();
  await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toHaveValue(/反証・未確認事項/);
  const question = await page.getByRole('textbox', { name: '選択した範囲への質問' }).inputValue();
  expect(question).toContain('A: ' + selectedA);
  expect(question).toContain('B: ' + selectedB);
  expect(question.length).toBeLessThanOrEqual(1000);
  expect(posts).toBe(0);
  await page.screenshot({ path: 'artifacts/shared-rules-pre-verdict.png' });
});

test('real checkout honestly exposes absent shared mappings without silently repairing the recording', async ({
  page,
}) => {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) posts++;
  });
  await page.goto('/projects/sample-recorded-checkout-flow/inspect');
  const comparison = page.getByTestId('shared-rules');
  await comparison.locator(':scope > summary').click();
  await expect(comparison).toContainText('0 関係');
  await expect(comparison).toContainText('関係がない・問題がないという判定ではありません');
  await expect(comparison.getByLabel('比較する共有ルール')).toHaveCount(0);
  await comparison.getByRole('button', { name: 'この関係を追加調査する質問を作る' }).click();
  await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toHaveValue(/初回の音にない関係/);
  expect(posts).toBe(0);
});
