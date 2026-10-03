# Tsugiai as the real-project demonstration

2026-10-03: use the existing Tsugiai implementation as the principal demonstration candidate. The checkout shop remains a small development fixture; it does not establish usefulness on a real repository.

## Verified input

The local repository is `C:\Users\kfkf1\Desktop\Zenn4回目\tsugiai`. Its current committed revision is `35a951488d7b00518e7e73a329d46713cbeacbe8` (2026-02-09). This is not independently verified as the exact hackathon submission revision. The working tree has changes to TemplateBuilderPage and Phase2PhotoPage; the prepared inputs exclude those changes. No source file, branch, service or database in Tsugiai was changed.

The inventory reads committed Git blobs and runs only Code Groove's trusted static parsers. It does not install dependencies, import the target Python modules, run target scripts, seed data or deploy Tsugiai. The source license is MIT; any later distributed source snapshot must retain that notice.

| Scope | Source files | Lines | Indexed functions | Python class methods outside the current index | Static preparation |
|---|---:|---:|---:|---:|---|
| Entire tracked implementation | 51 | 19,541 | 810 | 63 | Rejected: current limits and incomplete method indexing |
| Three Agent implementations, models, frontend types | 11 | 2,385 | 18 | 0 | Accepted as this specific scope |
| CheckoutFlowPage, checkout Agent factory/prompt, shared contracts | 5 | 1,775 | 30 | 0 | Accepted as this specific scope |

Functions include nested TypeScript callbacks; these counts are not independent business capabilities or quality scores. The complete raw-source inventory has zero syntax errors. Sanitized input uses the existing boundary rules. Both prepared scopes require no redaction; the full inventory reports two files whose sanitized projection differs from the original.

The snapshots and complete per-file inventory are in the ignored `.local/repository-preflight/35a951488d7b00518e7e73a329d46713cbeacbe8/` directory. Scope `a21b70eb15ef` is the Agent scope; `f9ce1834f016` is the orchestration scope; `4f53cda18c2b` is the full inventory. Reports retain selected and unselected files, original content hashes, limits and rejection reasons. No raw repository source is added to Code Groove's Git history or public assets.

## What the demonstration should establish

Tsugiai has a real workflow: checklist creation, form/photo input, conversation and a generated handover. Its React phase orchestration, Python request handlers, tool callbacks and prompt instructions give a concrete reason to inspect how responsibilities are placed across layers.

Use a practical change question such as adding a new checklist answer type or changing the review-stage flow. These are investigation questions, not pre-established diagnoses. Ask whether the affected responsibilities have a deliberate boundary, whether callers and contracts support that boundary, and where future changes would require coordinated edits. React render callbacks and service adapters can be legitimate separation; repetition alone must not produce a debt verdict.

Keep the listen → select a passage → fresh related-code investigation → optional proposal → human acceptance → independent examination sequence. Do not manufacture a bad version or preload an improved version. A candidate may be withdrawn or remain under observation. Bugs or security problems discovered during examination must still be reported normally; they are not concealed to make music more valuable.

The Agent scope is an initial bounded case. It excludes request handlers and service implementations and therefore cannot establish end-to-end session isolation, storage behavior or whole-repository health. The orchestration scope similarly excludes most phase pages and the API transport. These limits must appear with any saved result. An unexamined dependency is not healthy and must not receive a fabricated melody.

## Remaining product work

### R10 update — 2026-10-03

The R9 limitations below describe the earlier checkpoint. R10 now indexes all63 Python methods and preserves873 total symbols, grouped into281 lexical owners and28 bounded analysis partitions. Static preparation of all51 sources/19,541 lines succeeds with zero parse errors; the two original dirty files remain unchanged. Dynamic password expressions and type annotations are preserved during secret projection, correcting the previous two false redactions.

Authenticated local ingestion, whole inventory/unknown counts, range selection, saved playback with zero new model calls, and explicit continuation/retry are implemented. Use `--partitioned --prepare` to generate the full `629dbbb5d73e/import.json` under the same ignored revision directory. Upload it from the authenticated Repository dialog. It contains source code and remains private/local; it is not part of the public sample or this Git repository.

At R10 verification the old daily cap of three analyses was exhausted. R11 raises the cap to ten per user at the user's explicit request, preserving consumed counts and the global token budget. No new Tsugiai Gemini result or music is claimed. API/model mock regressions and actual browser checks establish the implemented workflow, not actual Tsugiai semantic quality. Cross-partition meaning/motif reconciliation and aggregate playback remain unimplemented, even if each partition later has a saved result. Seven-day retention and shared token limits still require prioritizing useful scopes. Details are in [Repository Agent R10](REPOSITORY_AGENT_R10.md).

### Historical R9 remaining work

This checkpoint prepares static input only. It does **not** integrate local snapshots into the authenticated web ingestion API, call Gemini, create a SemanticMap, generate music, replace the public sample or validate Tsugiai's runtime.

For a whole-repository demonstration, improve Python method indexing and add bounded analysis partitions with a shared repository context, explicit unknowns and persistent caching. Do not just increase the function cap or send the whole repository on every question. Aggregate module listening and detailed file listening need a real semantic map and musical validation. Existing GCP capacity and AI quota controls remain in force.

An initial scoped real examination can follow the existing validated Agent path once local snapshot ingestion and provenance are supported. Save its actual source, trace and map; use zero-model replay for the public demo. Public distribution should include only reviewed source code, the MIT notice and actual results, with secrets and production data excluded.

## Reproduce preparation

From the Code Groove repository in PowerShell:

```powershell
$env:PYTHONPATH = 'apps/backend;.'
uv run python scripts/repository-preflight.py 'C:\Users\kfkf1\Desktop\Zenn4回目\tsugiai'
uv run python scripts/repository-preflight.py 'C:\Users\kfkf1\Desktop\Zenn4回目\tsugiai' --scope agents/checkout_agent --scope agents/handover_agent --scope agents/template_agent --scope agents/models --scope frontend/src/types/handover.ts --prepare
```

`--ref` pins another existing commit. Uncommitted edits are intentionally excluded. `--prepare` refuses oversized, unparsable or incomplete-method scopes; it writes a source/index snapshot only for an accepted scope. The command does not upload anything and is not a browser import feature.

## Runtime and verification

The current `firebase.json` names `tsugiaizenn004` as its Hosting site. Actual in-app browser access to `https://tsugiaizenn004.web.app/` returned **Site Not Found**. The project-default candidate `https://tsugiai.web.app/` also returned that page. This does not establish that all Tsugiai deployments are unavailable. A current URL is requested from the user; authenticated workflows and local runtime remain unverified.

Four targeted preparation regressions pass: committed input despite a dirty worktree and executable top-level code; oversized full scope versus a smaller explicit scope; disclosure/refusal of Python methods and Git links; visible redaction and safe scope paths. Ruff passes. No web/API/music runtime code changed, so application E2E, paid tests, music suites and a GCP deployment were not rerun for this checkpoint.

GitHub CI37109009803 passes for preparation commit `da73d83a1d79b7fb8f1243017dd4092a28de527b`: only the four preparation regressions run (4.35s), alongside parser build and static checks. The selector skips unchanged application suites.
