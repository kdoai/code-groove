import { execFileSync } from 'node:child_process';

if (process.env.E2E_LIVE_IMPROVEMENT !== '1') {
  throw new Error(
    'Set E2E_LIVE_IMPROVEMENT=1 to authorize paid Gemini proposal and re-analysis. This records an explicit test approval.',
  );
}
execFileSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'playwright', 'test', 'tests/e2e/live-improvement.spec.ts', '--workers=1'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      E2E_BASE_URL: process.env.E2E_BASE_URL ?? 'https://code-groove-web-a5ygiois2a-an.a.run.app',
    },
  },
);
console.log('Recorded actual deployed HITL. Run scripts/assemble-demo.py without another model call.');
