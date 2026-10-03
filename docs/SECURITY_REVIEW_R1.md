# Refinement security review

Threat boundaries: browser / public API; Firebase identity / server allowlist;
public GitHub archive / trusted parsers; untrusted repository content / Agent
authority; web / private OIDC worker; owner metadata / immutable artifacts; GitHub
Actions OIDC / scoped deployment IAM. Repository source is data, never executable.

R1–R3 checks and hardening:

- Structural signals require known grounded events, their actual owners, covering
  code reads, valid evidence, a hypothetical change scenario and actual alternative-check reads. Inspected units require
  covering reads. Unknown evidence and altered owners are rejected.
- Cached evidence is rehashed against unchanged source lines and remapped to the
  new snapshot; changed context and callers invalidate reuse. Historical bundles
  retain their source key rather than joining old events to new code.
- Python parsing runs in a trusted isolated child, never importing repository
  modules; a test includes a top-level file-write payload and verifies no execution.
  Linux enforces CPU/address-space limits; Node parsing has a 128 MiB heap cap.
- Agent tools remain bounded read/search/relations operations. No shell, arbitrary
  fetch, write or deploy tools are exposed. Repository instructions cannot grant
  privileges. Trace responses are escaped React text; no HTML rendering was added.
- The chat requires authorized ownership for fresh investigations. Public recorded
  answers are explicitly saved interpretations and make no paid model request.
  Viewing code no longer starts a paid investigation automatically.
- Body, archive, file, unit, token, model/tool, lease/deadline and daily quotas
  remain enforced. Refresh adds a separate bounded check counter; changed work
  must obtain an analysis allowance before its first model request.
- Secret Manager, Firebase email/password allowlist, disabled self-registration,
  revoked-token checks, private worker, restricted browser API key, storage PAP,
  CSP/HSTS/nosniff, owner checks and WIF deployment remain the existing boundaries.

Validation is recorded in EXECUTION_PLAN.md and deployment artifacts. The locked
runtime dependencies are unchanged; no third-party package was added in R1–R3.
R3 locked runtime audits: npm 114 dependencies and Python 56 packages, zero known
vulnerabilities (`artifacts/npm-audit-r3.json`, `artifacts/python-audit-r3.json`).
Dependency advisories and deployed permission probes detect known issues and
tested boundary failures; this review does not claim that every possible attack
or vulnerability has been eliminated. Private GitHub OAuth is outside scope.

Provider recovery preserves the conservative charge for responses whose usage is
unknown. Every retry fits inside the remaining output allowance; no token budget
is enlarged. After bounded exploration, the server permits only final submission
with validated existing evidence. Unsupported claims must stay unknown. A single
administrative analysis-count credit used for release verification is audited in
artifacts/r3-verification-credit.json; consumed tokens and global ceilings remain.

R4 adds a separate draft/approval boundary. Drafts require fresh covering reads,
exact unique source replacements, at most six hunks/four normal source files,
restricted paths/new-file directories and bounded size. The trusted parsers check
syntax and relative imports without executing submitted source. The Agent cannot
approve a draft, modify a score rule, change dependencies/CI/secrets, or push GitHub.

Accept/reject endpoints require the owner and unexpired parent. Acceptance atomically
checks current base + draft state + active-run and token/daily allowances; duplicate
idempotency keys recover the same run. The original source and result remain immutable.
Re-analysis publication checks the base again, retains honest concerns and cannot
replace a newer interpretation. A rejected or expired draft cannot change source.
All diffs are escaped React text; the dialog traps focus and supports Escape. Paid
generation is never started by the tour. Proposal generation shares investigation
quotas; re-analysis is reserved before acceptance. New proposals metadata has TTL,
private artifacts use the existing lifecycle, and project deletion removes proposals.

No new dependency or widened IAM permission is required. Automated checks cover the
listed boundaries; generated code is a proposal, with behavior/testing obligations
shown to the human, not a proven safe refactoring.
# R5 health-review boundaries

`analysis_depth` is server-owned and absent from model submit candidates and client create bodies. An overview can retain detected concerns but cannot start a source proposal. A human-selected investigation must cite fresh code evidence; interpreted signals must reference existing grounded events and freshly read covering functions. Publication revalidates evidence against the immutable base snapshot, then atomically checks the current base and project lifecycle. It creates a separate map and never changes source. Interpretation and later refactoring are separate decisions.

Updating or withdrawing a prior candidate also requires newly read evidence covering every originally referenced function. Explicit replacement IDs must exist in the base map; duplicate IDs and oversized merged candidate sets are rejected. Withdrawn candidates cannot continue producing concern cues or start a proposal. The original examination remains immutable, including the initial concern, so a later conclusion cannot erase its history.

Owned investigation metadata persists the active run and latest result for reload. Stale results are not presented as belonging to a newer analysis. Public recorded health data contains only the trusted bundled sample and allowlisted actual tool trace, not reviewer credentials or metadata owner IDs. The new flow adds no IAM, dependencies or services; quotas, retention and keyless release remain unchanged. Subjective health interpretation is not a security audit; source bugs encountered by the Agent are disclosed for ordinary review, not hidden to motivate listening.

Finalization advertises only the submission function in AUTO mode; the server independently rejects further exploration at that boundary. Grounded evidence, time/token ceilings, conservative unknown usage and bounded text-only replies remain required. Provider errors expose only HTTP code, phase and an allowlisted diagnostic category, never the raw message, source or credential. A production400 failure is retained before corrected verification; no daily allowance is credited.
