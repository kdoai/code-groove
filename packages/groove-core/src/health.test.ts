import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileGroove } from './compiler';
import type { SemanticMap } from '../../contracts';
import { previewCart } from '../../../fixtures/repos/checkout-flow/src/preview';
import { quoteInvoice } from '../../../fixtures/repos/checkout-flow/src/pricing';
import { accrueReward } from '../../../fixtures/repos/checkout-flow/src/rewards';

it('overview preserves detected observations and semantic rhythm without verdict-based cues', async () => {
  const { map } = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8')) as {
    map: SemanticMap;
  };
  map.analysis_depth = 'overview';
  const one = await compileGroove(map, 'health-test');
  const two = await compileGroove(structuredClone(map), 'health-test');
  expect(one.score_hash).toBe(two.score_hash);
  expect(map.review_signals?.some((s) => s.verdict === 'concern')).toBe(true);
  expect(one.scenes.flatMap((s) => s.repo.notes).some((n) => n.kind === 'cue')).toBe(false);
  map.analysis_depth = 'focused';
  const focused = await compileGroove(map, 'health-test');
  expect(focused.score_hash).not.toBe(one.score_hash);
  expect(focused.scenes.flatMap((s) => s.repo.notes).some((n) => n.kind === 'cue')).toBe(true);
  for (const scene of one.scenes) {
    const focusedScene = focused.scenes.find((s) => s.scene_id === scene.scene_id)!;
    expect(scene.repo.notes.filter((n) => n.kind === 'data')).toEqual(
      focusedScene.repo.notes.filter((n) => n.kind === 'data'),
    );
  }
});

it('trusted authored health example works across campaign, cap, gift and expiry boundaries', () => {
  for (const amount of [0, 999, 1000, 8000])
    for (const now of [99, 100, 101]) {
      const lines = [
        { sku: 'book', label: 'Book', unitPriceCents: amount, quantity: 2, category: 'merchandise' as const },
        { sku: 'gift', label: 'Gift', unitPriceCents: 5000, quantity: 1, category: 'gift-card' as const },
      ];
      const campaign = { code: 'READ', rate: 0.1, minimumCents: 2000, capCents: 600, expiresAt: 100 };
      const expectedSaving =
        now <= 100 && amount * 2 >= 2000 ? Math.min(600, Math.round(amount * 2 * 0.1)) : 0;
      const invoice = quoteInvoice(lines, campaign, now, 300);
      const preview = previewCart(lines, campaign, now);
      const reward = accrueReward('member', lines, campaign, now);
      expect(invoice.discountCents).toBe(expectedSaving);
      expect(invoice.totalCents).toBe(amount * 2 + 5300 - expectedSaving);
      expect(preview.totalCents).toBe(invoice.totalCents - 300);
      expect(reward.basisCents).toBe(amount * 2 - expectedSaving);
      expect(reward.points).toBe(Math.floor((amount * 2 - expectedSaving) / 100));
    }
});
