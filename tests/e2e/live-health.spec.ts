import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({ trace: 'off', video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('paid whole-health passage investigation and optional human-approved refactoring', async ({ page }) => {
  test.skip(process.env.E2E_LIVE_HEALTH !== '1', 'Paid health workflow is explicitly opt-in.');
  test.setTimeout(900000);
  const projectId =
    process.env.E2E_HEALTH_PROJECT ??
    JSON.parse(readFileSync('artifacts/deployed-r5-smoke.json', 'utf8')).project_id;
  const password = execFileSync(
    process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
    [
      'secrets',
      'versions',
      'access',
      'latest',
      '--secret=reviewer-password-placeholder',
      '--project=artful-bonsai-491601-p3',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  ).trim();
  const started = Date.now(),
    time = () => (Date.now() - started) / 1000;
  const timings: Record<string, number> = {};
  const runs: Record<string, any> = {},
    bundles: any[] = [],
    errors: string[] = [];
  let investigation: any, result: any, proposed: any, approved: any, proposal: any;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', async (r) => {
    if (!r.ok() || !r.url().includes('/api/v1/')) return;
    const path = new URL(r.url()).pathname.replace('/api/v1', '');
    const data = (await r.json()).data;
    if (/^\/runs\/[^/]+$/.test(path)) runs[data.run_id] = data;
    if (path.startsWith('/projects/') && path.endsWith('/bundle')) bundles.push(data);
    if (/^\/analyses\/[^/]+\/investigations$/.test(path)) investigation = data;
    if (/^\/investigations\/[^/]+$/.test(path)) result = data;
    if (/^\/analyses\/[^/]+\/proposals$/.test(path)) proposed = data;
    if (/^\/proposals\/[^/]+\/accept$/.test(path)) approved = data;
    if (/^\/proposals\/[^/]+$/.test(path)) proposal = data;
  });
  await page.goto('/projects/sample-checkout-flow/inspect?scene=1');
  await page.getByRole('checkbox', { name: '今後このメッセージを表示しない', exact: true }).check();
  await page.getByRole('button', { name: 'あとで見る', exact: true }).click();
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.getByLabel('メールアドレス', { exact: true }).fill('reviewer@example.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/projects/${projectId}/inspect?scene=1`);
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.health-stage')).toContainText('全体健診');
  await expect(page.getByRole('button', { name: 'Geminiに改善案を依頼', exact: true })).toHaveCount(0);
  const initial = bundles.find((b) => b.map.analysis_depth === 'overview');
  expect(initial).toBeTruthy();
  timings.login_complete = time();
  await page.getByRole('button', { name: 'pricing.ts', exact: true }).click();
  const selectedUnit = new URL(page.url()).searchParams.get('unit');
  await page.getByRole('button', { name: 'この区間を聴く', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  timings.before_play = time();
  const firstNote = initial.score.scenes
    .flatMap((s: any) => s.repo.notes)
    .find((n: any) => n.event_id && n.unit_id === selectedUnit);
  timings.before_offset_seconds = Math.max(0, firstNote.tick - 1920) / 768;
  await page.waitForTimeout(18000);
  await page.getByRole('button', { name: 'この区間を選ぶ', exact: true }).click();
  timings.before_pause = time();
  await page.getByRole('button', { name: 'pricing.ts', exact: true }).click();
  await page
    .getByRole('textbox', { name: '選択した範囲への質問' })
    .fill(
      'この割引の旋律が別ファイルで戻る理由を、関係するコードを読み直して調べてください。今は正常に動きます。将来キャンペーンが増えたときの変更・読み解く負担と、オフラインのプレビューやポイントの境界を保つ理由を検討してください。must-fixやバグとは扱わず、経過観察か、サーバー側の判断を共有する候補か、その代償を説明してください。初回の意味分類が機能単位に寄っているなら、共通の変更理由を持つ既存の判断イベントについて根拠付きで再分類も検討してください。別の理由で変わる計算や表示まで同じ旋律に寄せないでください。',
    );
  await page.getByRole('button', { name: '質問を送信', exact: true }).click();
  timings.investigation_requested = time();
  await expect(page.locator('.finding').first()).toBeVisible({ timeout: 220000 });
  timings.investigation_ready = time();
  expect(result?.evidence.length).toBeGreaterThan(0);
  expect(proposed).toBeUndefined();
  await page.screenshot({ path: 'artifacts/deployed-r5-precision.png' });
  writeFileSync('.local/deployed-r5-investigation.json', JSON.stringify(result, null, 2));
  await page.waitForTimeout(8000);
  if (
    result.review_signals?.length ||
    result.suggested_reclassification?.length ||
    result.replaced_signal_ids?.length
  ) {
    await page.getByRole('button', { name: '調査結果を演奏に反映', exact: true }).click();
    await expect(page.locator('.health-stage')).toHaveCount(0);
    timings.reflected = time();
    const focused = bundles.find((b) => b.map.analysis_depth === 'focused');
    expect(focused.sources).toEqual(initial.sources);
    const concern = focused.map.review_signals.find((s: any) => s.verdict === 'concern');
    if (concern) {
      const unit = focused.map.units.find((u: any) => u.unit_id === concern.unit_ids[0]);
      await page.getByRole('button', { name: unit.primary_span.path.split('/').at(-1), exact: true }).click();
      await page.getByRole('button', { name: 'Geminiに改善案を依頼', exact: true }).click();
      timings.requested = time();
      await expect(page.getByRole('dialog', { name: '改善案を確認' })).toBeVisible({ timeout: 220000 });
      timings.proposal_ready = time();
      expect(approved).toBeUndefined();
      await page.screenshot({ path: 'artifacts/deployed-r5-proposal.png' });
      writeFileSync('.local/deployed-r5-proposal.json', JSON.stringify(proposal, null, 2));
      await page.waitForTimeout(8000);
      await page.getByRole('button', { name: '差分を閉じる', exact: true }).click();
      expect(approved).toBeUndefined();
      await page.getByRole('button', { name: `差分を確認：${proposal.title}`, exact: true }).click();
      await page.getByTestId('accept-proposal').click();
      timings.accepted = time();
      await expect(page.getByRole('button', { name: '採用後', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 520000 },
      );
      timings.analysis_ready = time();
      const after = bundles.find(
        (b) =>
          b.map.parent_analysis_id === focused.map.analysis_id &&
          b.map.snapshot_id !== initial.map.snapshot_id,
      );
      expect(after).toBeTruthy();
      expect(after.sources).not.toEqual(initial.sources);
      expect(after.sources['src/preview.ts']).toBe(initial.sources['src/preview.ts']);
      const common = focused.map.responsibilities.filter((r: any) =>
        after.map.responsibilities.some((a: any) => a.responsibility_id === r.responsibility_id),
      );
      expect(common.length).toBeGreaterThan(0);
      expect(
        common.every(
          (r: any) =>
            after.map.responsibilities.find((a: any) => a.responsibility_id === r.responsibility_id)
              .motif_id === r.motif_id,
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      timings.after_play = time();
      await page.waitForTimeout(16000);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      timings.after_pause = time();
      await page.screenshot({ path: 'artifacts/deployed-r5-after.png' });
      writeFileSync('.local/deployed-r5-after-bundle.json', JSON.stringify(after, null, 2));
      writeFileSync('.local/deployed-r5-focused-bundle.json', JSON.stringify(focused, null, 2));
    }
  }
  expect(errors).toEqual([]);
  writeFileSync('.local/deployed-r5-before-bundle.json', JSON.stringify(initial, null, 2));
  const usage = (created: any) =>
    created && runs[created.run_id]
      ? Object.fromEntries(
          ['status', 'model_requests', 'tool_calls', 'input_tokens', 'output_tokens'].map((k) => [
            k,
            runs[created.run_id][k],
          ]),
        )
      : null;
  const report = {
    status: 'PASS',
    project_id: projectId,
    initial_analysis_id: initial.map.analysis_id,
    investigation: usage(investigation),
    proposal: usage(proposed),
    reanalysis: usage(approved),
    human_accepted: !!approved,
    no_preset_improved_version: true,
    page_errors: errors,
    timings,
  };
  writeFileSync('artifacts/deployed-r5-health-browser.json', JSON.stringify(report, null, 2));
  const video = page.video();
  await page.close();
  if (video) {
    await video.saveAs('.local/deployed-r5-browser.webm');
    writeFileSync(
      '.local/deployed-r5-video.json',
      JSON.stringify(
        { video_path: '.local/deployed-r5-browser.webm', timings, project_id: projectId },
        null,
        2,
      ),
    );
  }
});
