> Historical record. This describes the version at that time, not R14 acceptance. Current specification: [SPEC.md](SPEC.md).

# Implementation decisions

- Specification copied verbatim to SPEC.md. R1–R3 user feedback supersedes the original presentation: the current workspace uses a directory tree and DTM-style arrangement with a compact code dock and persistent Agent panel.
- Direct google-genai SDK loop as specified. No second Agent framework. Tools, budget and adapter boundary support later ADK migration.
- Infrastructure uses request billing, zero minimum instances, private worker and bounded concurrency. No database VM, load balancer, NAT, GPU or vector database.
- Small modules may be consolidated around a responsibility instead of empty per-endpoint files.
- Onboarding has a dismissible invitation and six steps that spotlight and operate actual controls: play, grounded concern, improved comparison, playback and questions. It retains a device-local “do not show again” preference and Help replay.
- The reviewer email was supplied by the user. The password is generated with secrets, stored in Secret Manager and never committed. Email verification is not required for the allowlisted review account.
- /health is added for external Cloud Run verification: direct /healthz requests returned a Google Frontend 404 before reaching the container, while /readyz and business APIs worked. The original /healthz remains available internally.
- Model request timeout is 90 seconds, bounded by the overall run deadline, after observed provider 504 responses at 60 seconds. There is no model fallback.
- Public recorded samples contain genuine SDK runs and source evidence. Their replay costs no model call and remains available after personal project TTL expiry. Fixture labels remain separate.
- Compiler hashes normalize read evidence identifiers to source spans and projection hashes; random attempt UUIDs do not affect reproduction.
- Musical grammar v4 uses fixed motifs, rootless jazz chords, voice leading, walking bass, 2:1 swing and four-bar phrasing. Cue timing follows checked structural concerns; common accompaniment is explicitly labeled and can be muted separately. The Agent judges design; it never synthesizes random audio.
- Conductor prompt v3 requires a hypothetical change scenario and freshly read alternative evidence for concern signals. Legitimate storage/audit boundaries are kept distinct from duplicated shared policy.
- TypeScript 6 and Python 3.13 adapters are intentionally bounded. Classes, dynamic dispatch and external Python modules are not claimed as fully resolved. Weekly Dependabot updates remain reviewable, with tests before deployment.
- Identical snapshots reuse the index and compatible analysis without Gemini. Changed snapshots re-index bounded source, reuse unchanged verified proofs and limit expensive review to changed units and transitive callers. Documentation/tests invalidate semantic reuse.
- Deployment reuses successful main CI for the exact release SHA; otherwise full release checks run. Ordinary changes retain module-based selective verification.

- R4 user instructions supersede the original ban on code proposals: bounded drafts are allowed, with explicit human acceptance before a separate app-only snapshot changes. No arbitrary write/command/GitHub tools are added.
- An improvement is an atomic coherent diff. Partial hunk acceptance is deliberately omitted because dependent helper/import edits can become inconsistent; reject or request another proposal instead.
- Proposal generation shares the existing 10/day investigation counter and 160k/20k token allowance. Acceptance reserves one of the 3/day analysis allowances before changing draft state. No limit is raised.
- Recorded sample adoption copies genuine saved interpretation/sanitized source into owner-scoped storage without a model call and keeps recorded_live origin. New improvements use fresh reads and actual Gemini; no B is loaded in advance.
- Prompt v5 adds grounded data-flow readability, preserves prior motif assignments where roles match, and explicitly forbids assuming adoption is improvement. Grammar v5 removes all percussion/pulses and links each response to its actual cited decision.
- Score reproduction is deterministic; Gemini reruns and hardware speaker output are not claimed deterministic. Stored source/analysis/version hashes delimit comparisons.
- R7 grammar v6 removes unvoiced-unit backing slots and empty whole bars; every performed bar contains a grounded onset. Motif offsets within a bar, event identity and96 BPM remain fixed. Clip lengths vary with their material, with bounded musical tails/cues. Recorded checkout130s becomes35s without changing its actual examination or invoking Gemini; shorter duration is not a code-health score.
# R5: whole-repository health examination

The latest user clarification overrides diagnosis-first R4 and any inferred restriction on initial detection. Gemini performs the full structural examination and preserves every grounded observation it can establish. `overview` describes the scope and presentation, not lower reasoning capability. Initial concerns are available as health notes; source bugs, security issues and lint remain ordinary review/testing responsibilities, disclosed when encountered rather than concealed for the music.

Music first encodes responsibility placement: returning motifs across files, multiple roles within a function, and file-order versus semantic-order arrangements. These are observations, not a quality score. A human selects a passage and requests fresh inspection of future change/reading friction and legitimate boundaries. Checked signals can be explicitly reflected into an immutable focused map. Source proposals require that focused map and a grounded concern; acceptance still requires a human and independent re-analysis. Initial notes remain visible even before focused work.

The working checkout sample replaces the return-policy default. It has offline advisory preview, authoritative invoice, loyalty and persistence, different representations, and a legitimate client/server boundary. No fixed improved version exists. Whole-health usefulness and reduced review burden are hypotheses requiring practitioner evaluation; sound cannot recover information Gemini never mapped.
