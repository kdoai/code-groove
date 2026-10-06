import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('recorded comparison lesson pairs equal pitches, code and honest counter-evidence without model requests', async ({
  page,
}) => {
  let writes = 0;
  const errors: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/v1/')) writes++;
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
  await page.goto('/projects/sample-recorded-returns-before/inspect');
  await expect(page.locator('.demo-comparison')).toContainText('教材の保存済み実解析');
  await expect(page.locator('.file-list')).toContainText('store-return.ts');
  const pair = page.locator('.demo-pairs > div').first();
  await expect(pair).toContainText('返品期限');
  await pair.getByRole('button').first().click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('src/store-return.ts');
  await pair.getByRole('button').last().click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('src/web-return.ts');
  await expect(page.locator('.demo-pairs > div')).toHaveCount(3);
  await expect(page.locator('.counter-evidence').first()).toContainText('確認記録なし');
  await page.locator('.event-navigation summary').click();
  await page.locator('.event-navigation button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.code-panel .panel-heading')).toContainText('src/notification.ts');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.demo-comparison')).toBeInViewport();
    await expect(page.locator('.review-code')).toBeInViewport();
    await page.screenshot({ path: `artifacts/comparison-lesson-r16-${viewport.width}.png` });
  }
  expect(writes).toBe(0);
  expect(errors).toEqual([]);
});

test('unknown-only analysis preserves its limits and disables playback (mock API)', async ({ page }) => {
  const bundle = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8'));
  bundle.map.origin = 'fixture';
  bundle.map.profile.title = '模擬の判断保留';
  bundle.map.profile.unknowns = ['この模擬結果では変更理由を確定できません'];
  bundle.map.events = [];
  bundle.map.responsibilities = [];
  bundle.map.review_signals = [];
  bundle.score.scenes = [];
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes++;
  });
  await page.route('**/api/v1/samples/recorded-returns-before/bundle', (route) =>
    route.fulfill({ json: { data: bundle } }),
  );
  await page.goto('/projects/sample-recorded-returns-before/inspect');
  await page.getByRole('button', { name: 'あとで見る', exact: true }).click();
  await expect(page.getByRole('heading', { name: '判断を保留しました' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await expect(page.locator('.analysis-progress')).toContainText('無音は良い設計を意味しません');
  await expect(page.locator('.analysis-progress')).toContainText('この模擬結果では変更理由を確定できません');
  expect(writes).toBe(0);
});
