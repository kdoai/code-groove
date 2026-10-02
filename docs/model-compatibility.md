# Model compatibility

2026-10-02: `google-genai==2.27.0`, `gemini-3.8-flash`, enterprise client, global, ADC, v1.
Actual function call/response roundtrip succeeded with original call IDs preserved. Usage metadata available.
Evidence: `artifacts/model-preflight.json`. No alternate model or fixture fallback.
Production uses service identity ADC. The preflight-only gcloud credential path is never used by runtime.
