import { test, expect } from '@playwright/test';

const samplePath = '/projects/sample-recorded-tsugiai-agents/inspect';

function trackRequests(page: import('@playwright/test').Page) {
  const bundles: string[] = [];
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/samples/') && request.url().includes('/bundle')) bundles.push(request.url());
    if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes.push(request.url());
  });
  return { bundles, writes };
}

test('home, sample menu and repository dialog keep the public sample on TSUGIAI', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
  const requests = trackRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'TSUGIAIの実コードを聴く', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(samplePath));
  await expect(page.getByTestId('repository-scale')).toContainText('51 ファイル');
  await expect(page.locator('.tree-file')).toHaveCount(51);
  const menu = page.locator('.sample-switch').first();
  await menu.locator(':scope > summary').click();
  await expect(menu.getByRole('button')).toHaveCount(1);
  await expect(menu).toContainText('サンプルリポジトリ / TSUGIAI');
  await expect(menu.getByRole('link')).toHaveAttribute(
    'href',
    /kdoai\/tsugiai\/tree\/35a951488d7b00518e7e73a329d46713cbeacbe8$/,
  );
  await menu.getByRole('button', { name: 'TSUGIAIを開く', exact: true }).click();
  await page.getByRole('button', { name: 'Repositoryを開く', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Repositoryを開く' });
  const samples = dialog.locator('.sample-list > button');
  await expect(samples).toHaveCount(1);
  await expect(samples).toContainText('TSUGIAIの実在コード');
  await samples.click();
  await expect(page).toHaveURL(new RegExp(samplePath));
  const rules = page.getByTestId('shared-rules');
  await rules.locator(':scope > summary').click();
  await expect(rules).toContainText('0 関係');
  await expect(rules).toContainText('関係がない・問題がないという判定ではありません');
  await rules.getByRole('button', { name: 'この関係を追加調査する質問を作る' }).click();
  await expect(page.getByRole('textbox', { name: '選択した範囲への質問' })).toHaveValue(/初回の音にない関係/);
  expect(requests.bundles.length).toBeGreaterThan(0);
  expect(requests.bundles.every((url) => url.includes('/recorded-tsugiai-agents/'))).toBe(true);
  expect(requests.writes).toEqual([]);
  await page.screenshot({ path: 'artifacts/tsugiai-primary-sample.png' });
});

test('first-time guide opens the same TSUGIAI sample', async ({ page }) => {
  const requests = trackRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: '実画面のデモを見る', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(samplePath));
  await expect(page.getByTestId('repository-scale')).toContainText('51 ファイル');
  expect(requests.bundles.every((url) => url.includes('/recorded-tsugiai-agents/'))).toBe(true);
  expect(requests.writes).toEqual([]);
});

for (const sampleId of ['recorded-returns-before', 'recorded-checkout-flow']) {
  test(`home restores TSUGIAI after previously saved ${sampleId} selection`, async ({ page }) => {
    await page.addInitScript((id) => {
      localStorage.setItem('code-groove-hide-guide', 'true');
      localStorage.setItem(
        'code-groove-workspace-v1',
        JSON.stringify({
          state: {
            projectId: 'sample-' + id,
            sampleId: id,
            screen: 'inspect',
            scene: 0,
            analysisId: 'old_analysis',
            unitId: 'old_unit',
            eventId: 'old_event',
            signalId: 'old_signal',
          },
          version: 0,
        }),
      );
    }, sampleId);
    const requests = trackRequests(page);
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(samplePath));
    await expect(page.getByTestId('repository-scale')).toContainText('51 ファイル');
    await expect(page.getByTestId('case-provenance')).toContainText('9/9 実装を確認');
    expect(page.url()).not.toContain('old_');
    expect(requests.bundles.length).toBeGreaterThan(0);
    expect(requests.bundles.every((url) => url.includes('/recorded-tsugiai-agents/'))).toBe(true);
    expect(requests.writes).toEqual([]);
  });
}

test('home preserves a saved private project instead of replacing its source', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('code-groove-hide-guide', 'true');
    localStorage.setItem(
      'code-groove-workspace-v1',
      JSON.stringify({
        state: {
          projectId: 'private_project',
          sampleId: '',
          screen: 'inspect',
          scene: 0,
        },
        version: 0,
      }),
    );
  });
  const requests = trackRequests(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/projects\/private_project\/inspect/);
  expect(requests.bundles).toEqual([]);
  expect(requests.writes).toEqual([]);
});

test('brand returns an older explicit sample link to TSUGIAI', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('code-groove-hide-guide', 'true'));
  const requests = trackRequests(page);
  await page.goto('/projects/sample-recorded-returns-before/inspect');
  await expect(page.locator('.tree-file')).toHaveCount(5);
  await page.getByRole('link', { name: 'Code Groove', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(samplePath));
  await expect(page.getByTestId('repository-scale')).toContainText('51 ファイル');
  expect(requests.bundles.at(-1)).toContain('/recorded-tsugiai-agents/');
  expect(requests.writes).toEqual([]);
});
