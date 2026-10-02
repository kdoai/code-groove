import { describe, expect, it } from 'vitest';
import { quoteWebReturn } from '../../../fixtures/repos/returns-before/src/web-return';
import { quoteStoreReturn } from '../../../fixtures/repos/returns-before/src/store-return';
import { evaluateReturnPolicy } from '../../../fixtures/repos/returns-after/src/return-policy';
import type { ReturnRequest } from '../../../fixtures/repos/returns-before/src/contracts';

describe('authored comparison preserves product behavior', () => {
  it('preserves both channel quotes across policy boundaries and line exclusions', () => {
    for (const tier of ['standard', 'plus'] as const)
      for (const days of [-1, 0, 30, 31, 45, 46])
        for (const receiptVerified of [false, true]) {
          const request: ReturnRequest = {
            orderId: 'order-042',
            customerId: 'customer-7',
            purchasedAt: '2026-01-01T00:00:00Z',
            requestedAt: new Date(Date.parse('2026-01-01T00:00:00Z') + days * 86_400_000).toISOString(),
            tier,
            receiptVerified,
            lines: [
              { sku: 'record', paidCents: 49000, quantity: 2, returnedQuantity: 1, finalSale: false },
              { sku: 'sleeve', paidCents: 12000, quantity: 1, returnedQuantity: 0, finalSale: true },
              { sku: 'stand', paidCents: 35000, quantity: 1, returnedQuantity: 1, finalSale: false },
            ],
          };
          const after = evaluateReturnPolicy(request);
          expect(quoteWebReturn(request)).toEqual(after);
          expect(quoteStoreReturn(request)).toEqual(after);
          if (receiptVerified && days >= 0 && days <= (tier === 'plus' ? 45 : 30)) {
            expect(after.eligibleSkus).toEqual(['record']);
            expect(after.amountCents).toBe(tier === 'plus' ? 49000 : 47530);
          } else expect(after.amountCents).toBe(0);
        }
  });
});
