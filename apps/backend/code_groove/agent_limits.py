"""One bounded policy for job reservations, worker deadlines and Agent execution."""

from dataclasses import dataclass

MODEL_HTTP_TIMEOUT_SECONDS = 120
FINALIZATION_ATTEMPTS = 3


@dataclass(frozen=True)
class AgentLimits:
    input_tokens: int
    output_tokens: int
    request_input_tokens: int
    model_requests: int
    tool_calls: int
    seconds: int
    exploration_requests: int
    response_tokens: int
    final_response_tokens: int
    finalization_seconds: int


ANALYSIS_LIMITS = AgentLimits(
    input_tokens=1200000,
    output_tokens=96000,
    request_input_tokens=144000,
    model_requests=18,
    tool_calls=100,
    seconds=480,
    exploration_requests=10,
    response_tokens=16384,
    final_response_tokens=16384,
    finalization_seconds=240,
)
FOCUSED_LIMITS = AgentLimits(
    input_tokens=480000,
    output_tokens=64000,
    request_input_tokens=144000,
    model_requests=12,
    tool_calls=100,
    seconds=360,
    exploration_requests=6,
    response_tokens=8192,
    final_response_tokens=12288,
    finalization_seconds=180,
)
LEGACY_ANALYSIS_LIMITS = AgentLimits(400000, 48000, 48000, 18, 48, 480, 10, 16384, 16384, 180)
LEGACY_FOCUSED_LIMITS = AgentLimits(160000, 20000, 48000, 8, 20, 180, 6, 8192, 12288, 70)


def limits_for_kind(kind: str) -> AgentLimits:
    return FOCUSED_LIMITS if kind in ("investigation", "proposal") else ANALYSIS_LIMITS


def limits_for_run(run: dict) -> AgentLimits:
    if run.get("agent_limits"):
        return AgentLimits(**run["agent_limits"])
    # Already-reserved jobs must not gain a larger budget after a deployment.
    return LEGACY_FOCUSED_LIMITS if run["kind"] in ("investigation", "proposal") else LEGACY_ANALYSIS_LIMITS
