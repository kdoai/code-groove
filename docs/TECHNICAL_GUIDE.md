# Code Groove — technical guide

| Layer | Implementation | Purpose |
|---|---|---|
| Arrangement workspace | React 19 / TypeScript 6 / Vite / Zustand / TanStack Query | Directory tree, file/function MIDI clips, all backing lanes, exact code dock, full-work transport, spotlight tour, persistent questions |
| Code inspection | Monaco, self-hosted workers | Read-only TypeScript/Python evidence, exact line highlighting |
| Sonification | Pure TS compiler + Tone.js + authored PCM | Six reproducible motifs, jazz accompaniment, evidence-linked rhythmic responses; no generative music |
| Agent | FastAPI / Python 3.13 / Google Gen AI SDK / Gemini 3.8 Flash on Google Cloud | Adaptive read/search/relations/hypothesis tools; grounded structural/readability interpretation and validated draft proposals |
| Index | Virtual TS Compiler API / isolated Python AST | Bounded code structure without executing submitted code |
| Jobs | Cloud Tasks + private Cloud Run worker | OIDC, cancellation, attempts, lease, durable quotas and traces |
| Web | Public Cloud Run | Authenticated owner API and static app, scale to zero |
| Identity | Firebase Authentication + server allowlist | Reviewer password login without email receipt; no social login requirement |
| Persistence | Firestore + private Cloud Storage | Metadata, immutable snapshots/results, TTL, differential reuse |
| Secrets / release | Secret Manager / GitHub Actions WIF / Cloud Build / Artifact Registry | No service-account keys; scoped verified releases |

![Architecture](../artifacts/architecture.png)
![Agent and playback sequence](../artifacts/sequence.png)
![Data flow and trust boundaries](../artifacts/data-flow.png)
![Musical explanation pipeline](../artifacts/sonification.png)
![Human-approved improvement sequence](../artifacts/approval-sequence.png)
![Whole-health listening and focused examination](../artifacts/health-sequence.png)

Initial Gemini examination uses the complete eligible index and full model capability.
Detected future-debt candidates remain accessible alongside unknowns. The overview
music describes responsibility placement; it never treats repetition alone as a defect.
Human selection directs fresh examination of future change friction, readability and
legitimate boundaries. Reflecting that result creates an immutable focused map before
any optional source proposal. Investigation progress/results survive reload through
owned metadata, without a new model call. Independent accepted re-analysis can retain
a concern; hearing comfort is not proof of correctness or health.

Detailed grammars and boundaries are in SONIFICATION.md, INCREMENTAL.md and
SECURITY_REVIEW_R1.md. Infrastructure remains scale-to-zero Cloud Run, not GKE or
an always-on database VM. The ¥6,000 infrastructure budget excludes AI and raises
alerts; it is not a hard billing cap. Runtime instance caps, short retention,
bounded jobs and reusable analyses reduce cost; a large traffic increase still
requires budget review before scaling further.
