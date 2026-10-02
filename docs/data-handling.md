# Data handling

Only public GitHub source and server-allowlisted samples. Snapshots pin commit SHA, are sanitized before persistence/inference, and never execute. Archive links and traversal are rejected; source scope is bounded. Redaction is best effort, so never submit a repository containing secrets.

Model inference uses global; Tokyo application hosting does not imply inference stays in Japan. Source comments, README and tool content are untrusted. Tools cannot reach arbitrary URLs, shell, other owners, or cloud credentials. User-visible trace contains actual action purposes and evidence, not private reasoning.

Project access expires 7 days after creation. Lifecycle physically cleans artifacts after 14 days; TTL/lifecycle are not immediate deletion guarantees. DELETE immediately denies access and durably schedules cleanup. Samples contain no personal data and remain public. Stored live results keep model/prompt/snapshot/usage provenance.

Firebase config is public. Server verifies tokens, account allowlist and resource ownership. Firebase session persistence is used; application code never writes tokens/passwords to localStorage. Client Firestore/Storage direct access is denied. Service identities use ADC without downloadable account keys.
