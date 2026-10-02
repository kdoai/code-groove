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
let playbackStarted = 0;
const play = async (sample, offset = 0, audition = false) => {
  if (audition) await page.getByRole('button', { name: '懸念の前後を聴く', exact: true }).click();
  else await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  playbackStarted = seconds() - offset;
  segments.push({ sample, mode: 'repo', start: seconds(), end: 0, offset, focusEvidence: false });
};
const finishSegment = () => {
  if (segments.at(-1)?.end === 0) segments.at(-1).end = seconds();
};
try {
  await page.goto(url);
  await expect(page.getByRole('dialog')).toBeVisible();
  await at(8, 'Actual-screen tour invitation', async () => {
    await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
    await page.getByRole('button', { name: '実画面のデモを見る', exact: true }).click();
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30000 });
  });
  await at(13, 'Open arrangement', () =>
    page.getByRole('button', { name: 'デモを閉じる', exact: true }).click(),
  );
  await at(15, 'Before: whole arrangement', () => play('recorded-returns-before'));
  await at(36, 'Checked design alternative', () => page.locator('.alternative summary').click());
  await at(48, 'Solo the evidence notes', async () => {
    finishSegment();
    await page.getByRole('button', { name: '根拠の音だけ', exact: true }).click();
    segments.push({
      sample: 'recorded-returns-before',
      mode: 'repo',
      start: seconds(),
      end: playbackStarted + 50,
      offset: seconds() - playbackStarted,
      focusEvidence: true,
    });
  });
  await at(68, 'After: same behavior, different ownership', async () => {
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'B 改善後', exact: true }).click();
    await expect(page.getByTestId('cue-note')).toHaveCount(0);
  });
  await at(73, 'After: whole arrangement', async () => {
    await play('recorded-returns-after');
    segments.at(-1).end = playbackStarted + 40;
  });
  await at(118, 'Return to the diagnostic passage', async () => {
    await page.getByRole('button', { name: 'A 改善前', exact: true }).click();
    await expect(page.getByTestId('cue-note').first()).toBeVisible();
    await play('recorded-returns-before', 10, true);
  });
  await at(137, 'Follow the exact code', async () => {
    finishSegment();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.locator('.structural-finding .evidence-link').first().click();
  });
  await at(147, 'Real Agent tool record', () => page.getByText(/Agentの実行記録/).click());
  await at(160, 'Ask from saved interpretation', async () => {
    await page
      .getByRole('textbox', { name: '選択した範囲への質問' })
      .fill('この設計のどの判断が、このリズムになっていますか？');
    await page.getByRole('button', { name: '質問を送信', exact: true }).click();
  });
  await at(173, 'Comparison remains reproducible', () =>
    page.getByRole('button', { name: 'B 改善後', exact: true }).click(),
  );
  await at(180, 'Finish', async () => {});
  if (paidRequests) throw new Error(`Unexpected paid API requests: ${paidRequests}`);
  const video = page.video();
  await context.close();
  await video.saveAs('artifacts/demo-browser.webm');
  await writeFile('artifacts/demo-timing.json', JSON.stringify({ url, paidRequests, segments }, null, 2));
  console.log('Recorded actual deployed arrangement; zero new model requests.');
} finally {
  await browser.close();
}
