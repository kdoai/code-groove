# Cost envelope (infrastructure only)

Target ¥6,000/month, excluding AI. Small hackathon traffic: 2 reviewer users, 3 analyses + 10 investigations each per day, ~90s/30s average. No minimum instances, no GPU, SQL instance, Redis, NAT or load balancer. Firestore/GCS are usage based. Artifacts expire after 7 days (API) and 14 days (physical cleanup).

Cloud Run: web 1 vCPU / 512 MiB, max 2; worker 1 vCPU / 1 GiB, max 1. Cloud Tasks concurrent dispatch 1. This deliberately reduces the specification's CPU/instance settings to respect the user's cost requirement. Increase explicit limits after observing latency and billing; the architecture already supports scaling.

The [Cloud Run price sheet](https://cloud.google.com/run/pricing) lists a request-billing monthly allowance of 180,000 vCPU-s and 360,000 GiB-s (us-central1 price basis). Account-wide allowances can be consumed by other apps. At the example workload, worker use is ~34,200 vCPU-s/month. Registry/build/storage and egress remain separately billed. The intended traffic should fit the envelope; a monthly hard cap cannot be guaranteed by max instances or budget alerts.

Model cost: reserved per-run tokens, user daily limits, global input/output token limits, one active run per user, persistent kill switch. Replay never calls the model. Amount estimates remain disabled until verified pricing is configured.

Configure a billing budget restricted to this project's non-AI services at ¥6,000 with 50/80/100% notifications. Budget notifications do not stop billing. Preserve AI as a separate budget. Deployment records will identify whether budget creation is permitted.
