import { test, expect } from '@playwright/test';

test('recorded GCP inspection keeps the initial version, auditions a grounded draft, and records a human input', async ({
  page,
}) => {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) posts++;
  });
  await page.goto('/inspections/tsugiai-session');
  const inspection = page.getByTestId('tsugiai-session-inspection');
  await expect(inspection.getByRole('heading', { level: 1 })).toContainText('同じセッションの前提');
  await expect(inspection).toContainText('baseline-1');
  await expect(inspection).toContainText('初回解析 · 0 共有関係');
  await inspection.getByRole('button', { name: '検査を開始して時間を記録' }).click();
  await inspection.getByRole('button', { name: '追加調査案を比較用に開く' }).click();
  await expect(inspection).toContainText('追加調査案・未採用');
  const shared = page.getByTestId('shared-rules');
  await shared.locator(':scope > summary').click();
  await expect(shared.getByLabel('比較する共有ルール')).toBeVisible();
  await shared.getByRole('button', { name: 'A→Bの識別フレーズを聴く', exact: true }).click();
  await expect(shared.getByRole('status')).toContainText('共有ルールを試聴中');
  await shared.getByRole('button', { name: '比較を停止', exact: true }).click();
  await shared.getByRole('button', { name: /^Bの根拠/ }).click();
  await expect(page.getByTestId('inspection-source')).toContainText('_current_session_id');
  const before = await shared.getByLabel('Bの出現箇所').inputValue();
  await inspection.getByLabel('音を使って比較する', { exact: true }).uncheck();
  await expect(shared.getByRole('button', { name: 'A→Bの識別フレーズを聴く', exact: true })).toBeDisabled();
  expect(await shared.getByLabel('Bの出現箇所').inputValue()).toBe(before);
  await shared.getByRole('button', { name: 'この関係を追加調査する質問を作る' }).click();
  await expect(inspection.getByLabel('選んだ関係から作った次の調査質問')).toHaveValue(/反証・未確認事項/);
  await inspection
    .getByLabel('確認する実装と根拠', { exact: true })
    .fill('E2E test input: confirm the five session consumers against source.');
  await inspection
    .getByLabel('分離を残す理由と根拠', { exact: true })
    .fill('E2E test input: photo is independent; preserve the Phase3 endpoint.');
  await inspection
    .getByLabel('未確認・追加調査が必要な事項', { exact: true })
    .fill('E2E test input: runtime isolation is unverified.');
  await inspection.getByLabel('検査の判断').selectOption('inconclusive');
  await inspection.getByRole('button', { name: '判断をこの端末に保存', exact: true }).click();
  const decision = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('code-groove-tsugiai-session-decision-v1')!),
  );
  expect(decision.condition).toBe('mixed');
  expect(decision.condition_history.map((c: { sound_enabled: boolean }) => c.sound_enabled)).toEqual([
    true,
    false,
  ]);
  expect(decision.interpretation_status).toBe('investigation_draft_not_published');
  expect(decision.utility_measurement).toBe('single_development_task_not_causal_comparison');
  const download = page.waitForEvent('download');
  await inspection.getByRole('button', { name: '判断をJSONで書き出す', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('tsugiai-session-decision.json');
  expect(posts).toBe(0);
  await page.screenshot({ path: 'artifacts/tsugiai-session-inspection.png', fullPage: true });
});

test('failed recording fetch does not manufacture a result or decision', async ({ page }) => {
  await page.route('**/api/v1/samples/recorded-tsugiai-agents/session-inspection', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Recording unavailable' } },
    }),
  );
  await page.goto('/inspections/tsugiai-session');
  await expect(page.getByRole('alert')).toContainText('模擬結果を表示しません');
  await expect(page.getByRole('button', { name: '追加調査案を比較用に開く' })).toHaveCount(0);
});

for (const width of [1440, 960, 390]) {
  test(`inspection keeps evidence and comparison usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/inspections/tsugiai-session');
    await expect(page.getByRole('button', { name: '追加調査案を比較用に開く' })).toBeVisible();
    await page.screenshot({ path: `artifacts/tsugiai-inspection-${width}-task.png` });
    await page.getByRole('button', { name: '追加調査案を比較用に開く' }).click();
    const shared = page.getByTestId('shared-rules');
    await shared.locator(':scope > summary').click();
    await expect(shared.getByLabel('Aの出現箇所')).toBeVisible();
    await shared.getByRole('button', { name: /^Aの根拠/ }).click();
    await expect(page.getByTestId('inspection-source')).toContainText('Session not initialized');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await shared.getByLabel('Aの出現箇所').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/tsugiai-inspection-${width}-comparison.png` });
  });
}
