# Implementation decisions

- Specification copied verbatim to SPEC.md. Missing referenced UI images are not fabricated; its tokens and layout are authoritative.
- Direct google-genai SDK loop as specified. No second Agent framework. Tools, budget and adapter boundary support later ADK migration.
- Infrastructure uses request billing, zero minimum instances, private worker and bounded concurrency. No database VM, load balancer, NAT, GPU or vector database.
- Small modules may be consolidated around a responsibility instead of empty per-endpoint files.
- Onboarding is a dismissible three-step overlay in Arrange, with a persistent “do not show again” preference and Help replay.
- The reviewer email was supplied by the user. The password is generated with secrets, stored in Secret Manager and never committed. Email verification is not required for the allowlisted review account.
- /health is added for external Cloud Run verification: direct /healthz requests returned a Google Frontend 404 before reaching the container, while /readyz and business APIs worked. The original /healthz remains available internally.
- Model request timeout is 90 seconds, bounded by the overall run deadline, after observed provider 504 responses at 60 seconds. There is no model fallback.
- Public recorded samples contain genuine SDK runs and source evidence. Their replay costs no model call and remains available after personal project TTL expiry. Fixture labels remain separate.
- Compiler hashes normalize read evidence identifiers to source spans and projection hashes; random attempt UUIDs do not affect reproduction.
