import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('one-screen drumless review and tour without preset B or paid automation', async ({ page }) => {
  const errors: string[] = [];
  let modelRuns = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/v1\//.test(request.url())) modelRuns++;
  });
  await page.goto('/');
  await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
  await page.getByRole('button', { name: '実画面のデモを見る', exact: true }).click();
  await expect(page.locator('.spotlight-window')).toBeVisible();
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.file-list')).toContainText('web-return.ts');
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.locator('.finding-label').first()).toHaveText('同じ変更で、一緒に直す箇所');
  await expect(page.locator('.code-concern').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/rhythm-tour-evidence.png' });
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Geminiに改善案を依頼', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '採用後', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toBeVisible();
  await page.getByRole('button', { name: '自分で使ってみる', exact: true }).click();
  await page.getByRole('button', { name: 'サンプルを開く', exact: true }).click();
  await expect(page.getByTestId('cue-note').first()).toBeVisible();
  await page.getByTestId('cue-note').first().click();
  await expect(page.locator('[data-testid=repository-tree]')).toContainText('contracts.ts');
  await page.getByRole('button', { name: 'contracts.ts', exact: true }).click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('src/contracts.ts');
  await page.getByTestId('cue-note').first().click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('return.ts');
  await page
    .getByRole('textbox', { name: '選択した範囲への質問' })
    .fill('どこの判断が、このリズムになっている？');
  await page.getByRole('button', { name: '質問を送信' }).click();
  await expect(page.locator('.saved-answer')).toContainText('応答');
  await page.getByRole('button', { name: '根拠の音だけ', exact: true }).click();
  await expect(page.getByRole('button', { name: '根拠の音だけ', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.backing-track.muted-track')).toHaveCount(2);
  await page.getByRole('button', { name: '根拠の音だけ', exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 980, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeInViewport();
    await expect(page.locator('.backing-track').filter({ hasText: 'Piano' })).toBeInViewport();
    await expect(page.getByTestId('cue-note').first()).toBeInViewport();
    const size = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      viewH: innerHeight,
      viewW: innerWidth,
    }));
    expect(size.height).toBe(size.viewH);
    expect(size.width).toBe(size.viewW);
    await page.screenshot({ path: `artifacts/rhythm-review-${viewport.width}.png` });
  }
  await expect(page.getByRole('button', { name: 'B 改善後', exact: true })).toHaveCount(0);
  expect(
    await page.locator('.review-code').evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(180);
  await page.getByRole('button', { name: 'Geminiに改善案を依頼', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '実解析にログイン' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByText('再生設定', { exact: true }).click();
  await page.getByRole('button', { name: 'Bass', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bass', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(modelRuns).toBe(0);
  expect(errors).toEqual([]);
});

test('whole-work playback continues when code selection crosses scenes', async ({ page }) => {
  const fixture = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8'));
  fixture.map.origin = 'fixture';
  const original = fixture.score.scenes[0],
    cut = 8 * 1920;
  fixture.score.scenes = [0, 1].map((index) => {
    const first = index === 0,
      start = first ? 0 : cut;
    const repo = structuredClone(original.repo);
    repo.scene_id = `scene_${index + 1}`;
    repo.total_bars = first ? 8 : original.repo.total_bars - 8;
    repo.notes = repo.notes
      .filter((n: { tick: number }) => (first ? n.tick < cut : n.tick >= cut))
      .map((n: { tick: number }) => ({ ...n, tick: n.tick - start }));
    repo.phrases = repo.phrases
      .filter((p: { start_bar: number }) => (first ? p.start_bar < 8 : p.start_bar >= 8))
      .map((p: { start_bar: number }) => ({ ...p, start_bar: p.start_bar - start / 1920 }));
    return {
      ...original,
      scene_id: repo.scene_id,
      unit_ids: repo.phrases.map((p: { unit_id: string }) => p.unit_id),
      repo,
    };
  });
  await page.route('**/api/v1/samples/recorded-returns-before/bundle', (route) =>
    route.fulfill({ json: { data: fixture } }),
  );
  await page.goto('/projects/sample-recorded-returns-before/inspect?scene=1');
  await page.getByRole('button', { name: 'あとで見る', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'web-return.ts', exact: true }).click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('web-return.ts');
  await expect.poll(async () => page.locator('.time-display b').innerText()).not.toBe('00:00');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});
