# Saved work and differential analysis

Replay retrieves immutable source snapshots, interpretations and scores. It calls
no model. New grammar can compile a stored interpretation without another Agent
review. Source selection is scoped to the owner and to the analysis's original
snapshot, including historical analyses after Git refresh.

“Gitの差分を調べる” queues a bounded refresh of the configured public repository
ref. A compatible identical snapshot completes with `analysis_cache_hit` and zero
model requests. New source bytes trigger comparison against the previous snapshot.
Changed source files and their transitive callers are re-investigated; removed
callees invalidate old callers too. README, tests and config changes invalidate
semantic reuse conservatively. Unaffected unit/event interpretations are retained
only after source bytes and each cited SHA-256 line projection are reverified.
The Agent receives server-issued remapped evidence and must re-evaluate structural
signals. Reuse is visible in `incremental_scope` trace events.

Cache boundaries: owner/project, source snapshot, `conductor-system-v4`, model ID
and `typescript-6-python-3.13-v2` index adapter. Grammar/kit changes invalidate
scores independently. No cross-account cache or arbitrary filesystem access exists.
The archive is still checked; identical source bytes reuse the static index too. For changed snapshots the bounded static index is rebuilt; “differential” refers to expensive
semantic investigation, not skipping source security checks.

Ten refresh checks/day are allowed; only changed semantic investigations consume
the existing three-analysis/day limit. Worker attempts preserve reservations,
deadline and usage. Cancellation and global kill switch still apply before tools,
model calls and result publication.

TypeScript/TSX uses a virtual TypeScript 6 compiler without tsconfig, plugins,
packages or execution. Python 3.13 uses stdlib AST in an isolated child process,
five-second deadline and Linux 256 MiB/three-second CPU limits. It supports module
functions/async functions and direct local `from ... import` aliases. Python class
methods, dynamic dispatch, import execution and third-party inference are outside
this adapter's scope. Syntax parsing does not prove type correctness or behavior.
The UI preserves code text and evidence ranges for both languages.

Upgrade procedure: update locked runtime/parser/SDK dependencies in a PR, change
adapter or prompt version when semantic behavior changes, run affected contract,
parser, evidence and compiler checks; run E2E only for UI/API effects. Live SDK
checks are opt-in, not scheduled on every dependency or documentation edit.
