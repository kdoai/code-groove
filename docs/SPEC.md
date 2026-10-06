# Code Groove - current contract (R17, 2026-10-06)

This file is the current specification. Earlier design alternatives and stage records are in [SPEC_HISTORY.md](SPEC_HISTORY.md); they are historical, not current requirements.

## M0: contracts and limits

Pydantic in `apps/backend/code_groove/schemas.py` is the source of truth; JSON Schema and TypeScript are generated. Existing recordings remain immutable. `fixture`, `recorded_live`, and `live` must be visibly distinct. No silent fallback or target-code execution. Human approval changes only an app-owned source snapshot; never the original repository.

A review separates `alternative` (discussion/proposed design) from `counter_explanation` (a competing explanation of the observed code). A checked counter-explanation has `counter_status` and actual `alternative_evidence_ids`. An unresolved counter-explanation requires an inconclusive verdict. Old recordings without these fields show “反証の確認記録なし”, never “確認しました”. Fresh receipt IDs, fixed snapshot and full implementation reads remain mandatory for grounded claims.

## M1: reproducible music and the primary demonstration

Fixed SemanticMap + chamber-v10 grammar + midnight-jazz-v4 kit generate the same score hash. Within a responsibility, equal concept keys have equal pitch; keys are ordered by first semantic order and map cyclically to eight motif slots. Different concepts may share a pitch, so pitch alone does not establish equivalence. Timing still follows semantic order and selected layout. Six responsibility motifs encode the Agent's assignment, not defects. Backing is common music, not a verdict. Design cues require a grounded comparison; human questions stay neutral. Unknown-only results retain their map and have an empty score, with an explicit unavailable-playback state.

The primary demonstration is `recorded-tsugiai-agents`, the saved real Checkout Agent review. Its immutable model recording covers nine inspected implementations and eleven imported files. A separate committed-source reference exposes all 51 source files / 19,541 lines from the same revision, with SHA-256 validation and the MIT notice. Reference browsing never extends model read receipts, coverage, Agent selection or the score. Unexamined references are labeled and silent. Remaining partitions and runtime behavior are unverified. Never promise mixing or cross-file recurring motifs for Tsugiai when its recording does not contain them. The small authored `recorded-returns-before` repository remains a separate lesson for paired semantic pitches.

Review candidates have explicit source links and counter-evidence state. Legacy unchecked candidates use a dashed visual marker and ordinary grounded meaning notes, never invented concern cues. Explicit focused playback removes accompaniment and plays the existing passage for at most ten seconds; it does not change the grammar, pitches, score hash or finding verdict.

## M2: safe static inventory and bounded reconciliation

TypeScript/TSX and Python use trusted parsers only. Python nested functions and lambdas keep lexical owners, including nested classes and async functions. Dynamic calls remain unresolved. External imports are distinguished from unresolved local imports. Cache fingerprints cover transitive dependencies and documents/tests; uncertain reachable local dependencies invalidate conservatively. Model/prompt/index/plan versions are cache boundaries.

Reconciliation selects 2-4 existing partitions and at most 32 explicit owners from one immutable snapshot. It starts only on user action, consumes one of the ten daily analyses, and uses the existing 400k-input/48k-output reservation, 48 tools and 480 seconds. Fresh code reads re-evaluate saved interpretations, compare reasons to change, and establish shared roles or retain differences/unknowns. Equal names or equal local motif IDs do not imply semantic equality. It does not classify unselected owners or imply repository-wide completion.

## M3: Agent and jobs

ADK 2.11.0 runs a single custom BaseAgent in an in-memory Runner and provides the Gemini model adapter, with Google Gen AI as its underlying client. The application owns the bounded tool loop, Pydantic validation, read receipts, closing phase, cancellation, quota reservation and CAS publication. Durable job state remains in Firestore. No parallel agents, automatic ADK tools, remote sessions, Agent Engine or vector services. Original function IDs and thought signatures are preserved. No additional model calls are added by migration. ADK provider errors are sanitized; one SDK attempt per application attempt.

## M4: user experience

One workspace with repository tree, music, read-only code and Agent panel. First use has one honest, zero-AI recorded demo: listen -> locate -> inspect evidence/limitations. All controls remain usable with keyboard; sound is supplementary to textual responsibility and span information. Saved explanations do not start fresh analysis. New analysis requires authentication and explicit action. Coverage describes the selected scope and remaining unknowns. Before/after interpretation and source changes are named separately.

The icon beside Gemini Agent collapses the window; the collapsed icon or top toolbar restores it. The question input is present before login. Sending while signed out opens authentication and retains the draft; logging in does not silently submit it. Explicit signed-in send adopts a recorded real sample before the bounded investigation. Reference-only files cannot silently select an unrelated implementation. Play resumes source following; the current audible evidence span is highlighted and revealed in the code editor. Users may turn following off during playback. Walkthrough outlines track the live DOM rectangle including text/scroll/layout/viewport changes.

The center prioritizes the file timeline and the selected sound's evidence code. The timeline fits its content up to a bounded viewport share; the code uses the remaining height. A compact candidate count opens a popover at every viewport size. Duplicate overview/selection controls are removed; function comparison stays in the timeline toolbar and the sound-free evidence list in the code header. Menus close on selection, outside click or Escape without resetting the selected source. The source header names the selected judgment and its exact span. Track scrolling measures the scroll container's viewport so selected rows remain visible. The walkthrough includes the open candidate popover in its measured outline. Production never advertises local mock investigation actions; authenticated comparison requests on actual recordings first adopt an owned copy without changing the compared source or closing the independent record.

R15 extends this Agent-first workflow: saved/initial explanation → human-selected two static functions → code/structure comparison with optional sound → expectation, observation and question → explicit bounded Agent follow-up → human-controlled reason confirmation. Selection is independent of SemanticMap events and scenes; static syntax supports questioning the Agent's explanation. Sound expresses syntax placement and call identity, never defects, severity or quality. Unextracted information, scope omissions and repository-wide coverage are outside the first version.

The normative structure-comparison contract, M0–M5 boundaries, deterministic encoding, conservative alignment and local record/export behavior are in [STRUCTURE_COMPARISON.md](STRUCTURE_COMPARISON.md). Existing semantic recordings and Python/TSX behavior remain compatible. Human evaluation is unperformed and is not a completion gate. The R16 request authorizes implementation, technical verification and redeployment of the current application. Live Gemini tests remain unrequested.

## M5: verification, operations and submission

Module checks and UI/API E2E must pass. Live Gemini tests require explicit user instruction; mocked tests never establish model accuracy. Human listening and task usefulness remain unverified until actually tested. Public immutable recordings stay available during judging; private copies keep seven-day access expiry. Infrastructure: Tokyo, scale to zero, JPY6,000/month excluding AI, private worker, durable Cloud Tasks, private artifacts, ownership checks and no secrets in repository or logs.

Submission requires a deployed app, repository access, test access and an approximately three-minute public YouTube demo. Official event page (checked 2026-10-04): https://zenn.dev/hackathons/google-cloud-japan-ai-hackathon-vol5 . Deadline 2026-10-15 23:59 JST. Freeze submitted default branch/content and keep deployment accessible through 2026-12-01. A local MP4 is not a completed YouTube submission. No publishing/deployment is performed without an authorized final action.
