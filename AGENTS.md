# Code Groove

- Read `docs/SPEC.md` before changing contracts, music, Agent behavior, or deployment.
- Implement in M0–M5 order; record actual checks and remaining work in `EXECUTION_PLAN.md`.
- Use subagents only when the user explicitly requests them in the current request.
- Never execute code from an analyzed repository. All Agent tools are bounded, read-only, and authorized.
- Keep fixture, recorded live, and live results visibly distinct. Never fall back silently.
- Use Python snake_case, TypeScript camelCase, PascalCase components/types, and descriptive domain names.
- Validate at boundaries. Keep functions focused and comments for non-obvious constraints only.
- Run checks relevant to changed modules; E2E for UI/API workflow changes, live tests only explicitly requested.
- Keep secrets, credentials, personal reviewer information, and local runtime data out of Git.
- Infrastructure target: `artful-bonsai-491601-p3`, Tokyo, scale to zero, infrastructure budget ¥6,000/month excluding AI.
