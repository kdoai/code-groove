import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
});

test('timeline marks open observations, counter state and unknowns without an API write', async ({
  page,
}) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes++;
  });
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.getByTestId('candidate-mark').first().click();
  const details = page.getByTestId('candidate-details');
  await expect(details).toContainText('観察した違い');
  await expect(details).toContainText('別の説明と確認状態');
  await expect(details).toContainText('未確認事項');
  await expect(details).toContainText('反証未確認');
  await expect(page.getByTestId('code-location')).toBeVisible();
  await expect(page.locator('.monaco-editor .code-highlight')).not.toHaveCount(0);
  expect(writes).toBe(0);
});

test('focus completion and cancellation preserve all playback settings and permit full playback', async ({
  page,
}) => {
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.locator('.playback-settings summary').click();
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await page.getByRole('button', { name: 'Melody', exact: true }).click();
  await page.getByRole('button', { name: '演奏に追従', exact: true }).click();
  await page.locator('.playback-settings summary').click();
  const settings = () =>
    page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('code-groove-workspace-v1')!).state;
      return Object.fromEntries(
        [
          'volume',
          'loop',
          'muted',
          'solo',
          'pulseMuted',
          'instrumentMutes',
          'focusEvidence',
          'playbackFile',
          'wholeWork',
          'following',
        ].map((key) => [key, state[key]]),
      );
    });
  const before = await settings();
  for (const cancel of [true, false]) {
    await page.locator('.review-focus summary').click();
    await page.locator('.review-focus-item').last().getByRole('button', { name: '伴奏なしで聴く' }).click();
    await expect(page.getByTestId('audition-status')).toContainText('試聴中');
    expect(await settings()).toEqual(before);
    if (cancel) await page.getByRole('button', { name: '試聴を取消', exact: true }).click();
    await expect(page.getByRole('button', { name: '試聴を取消', exact: true })).toHaveCount(0, {
      timeout: 13000,
    });
    expect(await settings()).toEqual(before);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('audio failure restores configuration; justified, deferred and uninvestigated remain distinct (mock)', async ({
  page,
}) => {
  const bundle = JSON.parse(readFileSync('fixtures/recorded-live/tsugiai-agents.json', 'utf8'));
  bundle.map.origin = 'fixture';
  bundle.map.review_signals[0].verdict = 'justified';
  bundle.map.review_signals[0].counter_status = 'supported';
  bundle.map.review_signals[1].verdict = 'inconclusive';
  bundle.map.review_signals[1].counter_status = 'undetermined';
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/bundle', (route) =>
    route.fulfill({ json: { data: bundle } }),
  );
  await page.route('**/audio/**/manifest.json', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.locator('.review-focus summary').click();
  await expect(page.locator('.review-focus-item').first()).toContainText('理由のある違い');
  await expect(page.locator('.review-focus-item').nth(1)).toContainText('判断保留');
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('code-groove-workspace-v1')!).state,
  );
  await page.locator('.review-focus-item').first().getByRole('button', { name: '伴奏なしで聴く' }).click();
  await expect(page.locator('.review-focus').getByRole('alert')).toContainText('根拠行は音なし');
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('code-groove-workspace-v1')!).state,
  );
  for (const key of ['loop', 'muted', 'solo', 'instrumentMutes', 'focusEvidence', 'volume', 'following'])
    expect(after[key]).toEqual(before[key]);
  await page.locator('.review-focus-item').nth(1).getByRole('button', { name: '根拠行' }).click();
  await expect(page.getByTestId('candidate-details')).toContainText('判断保留');
  await expect(page.locator('.file-scope')).toContainText('解析済み');
});
