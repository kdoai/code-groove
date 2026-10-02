import { test, expect } from '@playwright/test';

test('recorded Gemini evidence is replayable without sign-in or new model calls', async ({ page }) => {
  let modelRuns = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/v1\//.test(request.url())) modelRuns++;
  });
  await page.goto('/projects/sample-recorded-justified/arrange?scene=1');
  await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
  await page.getByRole('button', { name: 'あとで見る', exact: true }).click();
  await expect(page.getByText('保存済み実解析', { exact: true })).toBeVisible();
  await page.getByTestId('data-note').first().click();
  await page.getByRole('button', { name: '調べる', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Geminiがコードを読み、保存した解釈')).toBeVisible();
  await expect(page.locator('.finding-label').filter({ hasText: '理由のある違い' })).toBeVisible();
  await page.locator('.finding .evidence-link').first().click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.getByText(/実際の調査記録/).click();
  await expect(page.getByText('read_code', { exact: true }).first()).toBeVisible();
  expect(modelRuns).toBe(0);
});
