import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setTimeout as wait } from 'node:timers/promises';

const url = process.env.E2E_BASE_URL ?? 'https://code-groove-web-a5ygiois2a-an.a.run.app';
await mkdir('artifacts/demo-recording', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: 'artifacts/demo-recording', size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const segments = [];
let paidRequests = 0;
page.on('request', (request) => {
  if (request.method() === 'POST' && /\/api\/v1\//.test(request.url())) paidRequests++;
});
const started = performance.now();
const seconds = () => (performance.now() - started) / 1000;
const at = async (second, label, action) => {
  await wait(Math.max(0, second * 1000 - (performance.now() - started)));
  console.log(`${second}s: ${label}`);
  await action();
};
const play = async (sample, mode) => {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  segments.push({ sample, mode, start: seconds(), end: 0 });
};
const pause = async () => {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  segments.at(-1).end = seconds();
};
const inspect = async () => {
  await page.getByTestId('data-note').first().click();
  await page.getByRole('button', { name: '調べる', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 });
};
try {
  await page.goto(url);
  await expect(page.getByRole('dialog')).toBeVisible();
  await at(12, 'Guide: open sample', async () => {
    await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
    await page.getByRole('button', { name: 'サンプルを開く', exact: true }).click();
  });
  await at(19, 'Guide: evidence', () => page.getByRole('button', { name: '次へ', exact: true }).click());
  await at(25, 'Mixed Repo', async () => {
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.getByRole('button', { name: /Repo.*実装の配置/ }).click();
    await play('mixed', 'repo');
  });
  await at(45, 'Same material in Theme', async () => {
    await pause();
    await page.getByRole('button', { name: /Theme.*責務ごと/ }).click();
    await play('mixed', 'theme');
  });
  await at(65, 'Inspect code', async () => {
    await pause();
    await inspect();
  });
  await at(85, 'Recorded Gemini result', async () => {
    await page.goto(`${url}/projects/sample-recorded-scattered/arrange?scene=1`);
    await page.getByRole('button', { name: /Repo.*実装の配置/ }).click();
    await play('recorded-scattered', 'repo');
  });
  await at(105, 'Real read-only tool trace', async () => {
    await pause();
    await inspect();
    await page.getByText(/実際の調査記録/).click();
  });
  await at(125, 'Recorded investigation: justified difference', async () => {
    await page.goto(`${url}/projects/sample-recorded-justified/arrange?scene=1`);
    await inspect();
    await page.locator('.finding').first().scrollIntoViewIfNeeded();
  });
  await at(150, 'Follow the proof to source', async () => {
    await page.locator('.finding .evidence-link').first().click();
  });
  await at(165, 'Return to the workspace', async () => {
    await page.getByRole('button', { name: 'Arrangeへ', exact: true }).click();
    await page.getByRole('button', { name: /Theme.*責務ごと/ }).click();
    await play('recorded-justified', 'theme');
  });
  await at(178, 'Pause', pause);
  await at(180, 'Finish', async () => {});
  if (paidRequests) throw new Error(`Unexpected paid API requests: ${paidRequests}`);
  const video = page.video();
  await context.close();
  await video.saveAs('artifacts/demo-browser.webm');
  await writeFile('artifacts/demo-timing.json', JSON.stringify({ url, paidRequests, segments }, null, 2));
  console.log('Recorded real deployed UI; zero new model requests.');
} finally {
  await browser.close();
}
