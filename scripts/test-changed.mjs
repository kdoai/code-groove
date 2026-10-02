import { spawnSync } from 'node:child_process';

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === 'pnpm',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const all = process.argv.includes('--all');
const base = process.argv[process.argv.indexOf('--base') + 1];
const diff = spawnSync(
  'git',
  ['diff', '--name-only', ...(process.argv.includes('--base') ? [`${base}...HEAD`] : ['HEAD'])],
  { encoding: 'utf8' },
);
const files = diff.status === 0 ? diff.stdout.split('\n').filter(Boolean) : [];
const contracts =
  all ||
  files.some((path) =>
    /^(contracts\/|packages\/contracts\/|pnpm-lock|uv.lock|package.json|pyproject|scripts\/(generate|build-tools))/.test(
      path,
    ),
  );
const backend = contracts || files.some((path) => /^(apps\/backend\/|tests\/test_|prompts\/)/.test(path));
const music =
  contracts ||
  files.some((path) =>
    /^(packages\/(groove-core|repo-indexer)\/|fixtures\/|apps\/web\/public\/audio\/)/.test(path),
  );
const web =
  contracts || music || files.some((path) => /^(apps\/web\/|tests\/e2e\/|playwright.config)/.test(path));
const tooling = files.some((path) => /^(infra\/|scripts\/|\.github\/)/.test(path));
console.log(JSON.stringify({ backend, music, web, files: files.length }));
if (tooling && !backend) run('uv', ['run', 'ruff', 'check', 'infra', 'scripts']);
if (tooling && !web) run('pnpm', ['exec', 'eslint', 'scripts/*.mjs']);
if (backend || music || web) run('pnpm', ['build:tools']);
if (backend) {
  run('uv', ['run', 'ruff', 'check', 'apps/backend', 'scripts', 'tests', 'infra']);
  run('uv', ['run', 'mypy', 'apps/backend']);
  run('uv', ['run', 'pytest', '-m', 'not live', '-q']);
  run('uv', ['run', 'python', 'scripts/generate-contracts.py', '--check']);
}
if (music) {
  run('pnpm', ['test']);
  run('uv', ['run', 'python', 'scripts/build-kit.py', '--verify']);
}
if (web) {
  run('pnpm', ['typecheck']);
  run('pnpm', ['lint']);
  run('pnpm', ['build']);
  run('pnpm', ['test:e2e']);
}
if (!(backend || music || web))
  console.log('Documentation/infrastructure-only change: application suites skipped.');
