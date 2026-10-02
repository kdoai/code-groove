# Implementation decisions

- Specification copied verbatim to SPEC.md. Missing referenced UI images are not fabricated; its tokens and layout are authoritative.
- Direct google-genai SDK loop as specified. No second Agent framework. Tools, budget and adapter boundary support later ADK migration.
- Infrastructure uses request billing, zero minimum instances, private worker and bounded concurrency. No database VM, load balancer, NAT, GPU or vector database.
- Small modules may be consolidated around a responsibility instead of empty per-endpoint files.
- Onboarding is a dismissible three-step overlay in Arrange, with a persistent “do not show again” preference and Help replay.
- Reviewer credentials are external inputs; the secure creation script does not invent/reset passwords.
