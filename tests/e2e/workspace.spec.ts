import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('whole-health listening and real-screen tour keep investigation human-directed', async ({ page }) => {
  const errors: string[] = [];
  let modelRuns = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/v1\//.test(r.url())) modelRuns++;
  });
  await page.goto('/');
  await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
  await page.getByRole('button', { name: '実画面のデモを見る', exact: true }).click();
  await expect(page.locator('.spotlight-window')).toBeVisible();
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.file-list')).toContainText('pricing.ts');
  await expect(page.getByRole('button', { name: 'Geminiに改善案を依頼', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: '演奏に追従', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '演奏に追従', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await page.getByRole('button', { name: '自分で使ってみる', exact: true }).click();
  await expect(page.getByRole('button', { name: '採用後', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('cue-note')).toHaveCount(0);
  await page.getByText('旋律と色の凡例', { exact: true }).click();
  await expect(page.locator('.motif-legend button')).toHaveCount(4);
  await page.getByText('旋律と色の凡例', { exact: true }).click();
  await page.getByRole('button', { name: 'contracts.ts', exact: true }).click();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('src/contracts.ts');
  await page.getByTestId('data-note').first().click();
  await expect(page.locator('.agent-panel')).toContainText('この音が表す役割');
  await page.getByRole('textbox', { name: '選択した範囲への質問' }).fill('この旋律が戻る理由は？');
  await page.getByRole('button', { name: '質問を送信' }).click();
  await expect(page.locator('.saved-answer')).toContainText('新しいAgent調査が必要');
  await expect(page.locator('.backing-track')).toHaveCount(0);
  await page.getByText('再生設定', { exact: true }).click();
  await page.getByRole('button', { name: '伴奏トラックを表示', exact: true }).click();
  await page.getByRole('button', { name: '伴奏を消してコードのリズムを聴く', exact: true }).click();
  await expect(page.locator('.backing-track.muted-track')).toHaveCount(2);
  await page.getByRole('button', { name: '伴奏を戻す', exact: true }).click();
  await page.getByRole('button', { name: '伴奏トラックを表示', exact: true }).click();
  await page.getByText('再生設定', { exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 980, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeInViewport();
    await expect(page.locator('.backing-track')).toHaveCount(0);
    const size = await page.evaluate(() => [
      document.documentElement.scrollHeight,
      innerHeight,
      document.documentElement.scrollWidth,
      innerWidth,
    ]);
    expect(size[0]).toBe(size[1]);
    expect(size[2]).toBe(size[3]);
    await page.screenshot({ path: `artifacts/workspace-r7-${viewport.width}.png` });
  }
  expect(
    await page.locator('.review-code').evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(180);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(modelRuns).toBe(0);
  expect(errors).toEqual([]);
});

test('selected-file listening, supporting files and theme switching preserve the workspace', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/projects/sample-recorded-checkout-flow/inspect?scene=1');
  await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
  await page.getByRole('button', { name: 'あとで見る', exact: true }).click();
  await page.getByRole('button', { name: 'pricing.ts', exact: true }).click();
  async function expectContinuousCodeClips() {
    const clips = await page.locator('.midi-clip').evaluateAll((elements) =>
      elements
        .map((element) => ({
          start: parseFloat((element as HTMLElement).style.left),
          length: parseFloat((element as HTMLElement).style.width),
        }))
        .sort((a, b) => a.start - b.start),
    );
    expect(clips.length).toBeGreaterThan(0);
    let end = 0;
    for (const clip of clips) {
      expect(clip.start).toBeCloseTo(end);
      end += clip.length;
    }
    expect(end).toBeCloseTo(100);
  }
  await expectContinuousCodeClips();
  const fullLength = await page.locator('.time-display small').innerText();
  await page.getByRole('combobox', { name: '再生範囲', exact: true }).selectOption('file');
  await expect(page.locator('.time-display small')).not.toHaveText(fullLength);
  await expectContinuousCodeClips();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.time-display b').innerText()).not.toBe('00:00');
  await page.getByRole('button', { name: 'contracts.ts', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'rewards.ts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.locator('.code-panel .panel-heading')).toContainText('rewards.ts');
  await page.getByRole('combobox', { name: '再生範囲', exact: true }).selectOption('all');
  await expect(page.locator('.time-display small')).toHaveText(fullLength);
  await page.getByRole('button', { name: 'ダークモードに切り替え', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/workspace-r7-dark.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'ライトモードに切り替え', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('whole-work playback continues when code selection crosses scenes', async ({ page }) => {
  const fixture = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8'));
  fixture.map.origin = 'fixture';
  const original = fixture.score.scenes[0],
    splitBar = original.repo.phrases[1].start_bar,
    cut = splitBar * 1920;
  fixture.score.scenes = [0, 1].map((index) => {
    const first = index === 0,
      start = first ? 0 : cut;
    const repo = structuredClone(original.repo);
    repo.scene_id = `scene_${index + 1}`;
    repo.total_bars = first ? splitBar : original.repo.total_bars - splitBar;
    repo.notes = repo.notes
      .filter((n: { tick: number }) => (first ? n.tick < cut : n.tick >= cut))
      .map((n: { tick: number }) => ({ ...n, tick: n.tick - start }));
    repo.phrases = repo.phrases
      .filter((p: { start_bar: number }) => (first ? p.start_bar < splitBar : p.start_bar >= splitBar))
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
