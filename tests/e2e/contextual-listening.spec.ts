import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
});

test('the real sparse candidate keeps its recorded phrase and honestly shows the single-role limit', async ({
  page,
}) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes++;
  });
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.locator('.review-focus summary').click();
  await page.locator('.review-focus-item').first().getByRole('button', { name: '伴奏なしで聴く' }).click();
  const guide = page.getByTestId('review-listening');
  await expect(guide).toContainText('処理3打点');
  await expect(guide).toContainText('責務の旋律12音');
  await expect(guide).toContainText('単一の責務');
  await expect(guide).toContainText('別実装との比較は未記録');
  await expect(guide.getByRole('button', { name: 'A→Bのフレーズを聴く' })).toHaveCount(0);
  await expect(page.getByTestId('audition-status')).toContainText('試聴中');
  await page.getByRole('button', { name: '演奏位置の根拠へ', exact: true }).click();
  await expect(page.getByTestId('candidate-details')).toBeVisible();
  await expect(guide.getByRole('status')).toHaveText('停止中');
  await guide
    .getByRole('button', { name: /（確認ポイント）/ })
    .first()
    .click();
  await expect(page.getByTestId('code-location')).toBeVisible();
  await expect(page.locator('.monaco-editor .code-highlight')).not.toHaveCount(0);
  await page.screenshot({ path: 'artifacts/contextual-listening-single-role.png' });
  expect(writes).toBe(0);
});

test('related implementations can be chosen at equal range and reread without claiming value or runtime comparisons', async ({
  page,
}) => {
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.locator('.review-focus summary').click();
  await page.locator('.review-focus-item').last().getByRole('button', { name: '伴奏なしで聴く' }).click();
  const guide = page.getByTestId('review-listening');
  await expect(guide).toContainText('共通の音量');
  await expect(guide).toContainText('値・条件・共有状態の安全性');
  await expect(guide).toContainText('掲載順は実行順ではありません');
  await guide.getByLabel('試聴Bの実装').selectOption({ label: 'save_check_response' });
  await expect(guide).toContainText('チェック回答と状態更新');
  await expect(guide.getByRole('status')).toHaveText('停止中');
  await guide.getByRole('button', { name: 'A→Bのフレーズを聴く' }).click();
  await expect(guide.getByRole('status')).toHaveText('試聴中');
  await expect(guide.locator('.listening-side.sounding')).toHaveCount(1);
  await page.getByRole('button', { name: '演奏位置の根拠へ', exact: true }).click();
  await expect(guide.getByLabel('試聴Bの実装')).toHaveValue(
    (await guide
      .getByLabel('試聴Bの実装')
      .locator('option')
      .filter({ hasText: /^save_check_response$/ })
      .getAttribute('value')) as string,
  );
  await expect(guide.getByRole('status')).toHaveText('停止中');
  await guide.getByLabel('試聴Bの実装').selectOption({ label: 'set_services' });
  await expect(guide).toContainText('異なる二実装');
  await expect(guide.getByRole('button', { name: 'A→Bのフレーズを聴く' })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/contextual-listening-related-pair.png' });
});

test('an uninvestigated partner has no invented phrase or zero-unknown verdict (mock)', async ({ page }) => {
  const bundle = JSON.parse(readFileSync('fixtures/recorded-live/tsugiai-agents.json', 'utf8'));
  bundle.map.origin = 'fixture';
  const signal = bundle.map.review_signals[1];
  bundle.map.events = bundle.map.events.map((event: any) =>
    event.unit_id === signal.unit_ids[1] ? { ...event, state: 'unresolved' } : event,
  );
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/bundle', (route) =>
    route.fulfill({ json: { data: bundle } }),
  );
  await page.goto('/projects/sample-recorded-tsugiai-agents/inspect');
  await page.locator('.review-focus summary').click();
  await page.locator('.review-focus-item').last().getByRole('button', { name: '根拠行' }).click();
  const guide = page.getByTestId('review-listening');
  await expect(guide).toContainText('音は未記録');
  await expect(guide).toContainText('比較未確認');
  await expect(guide.getByRole('button', { name: 'Bのフレーズを聴く', exact: true })).toBeDisabled();
  await expect(guide.getByRole('button', { name: 'A→Bのフレーズを聴く', exact: true })).toBeDisabled();
});
