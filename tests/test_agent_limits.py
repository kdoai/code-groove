from dataclasses import asdict

from code_groove.agent_limits import (
    ANALYSIS_LIMITS,
    FOCUSED_LIMITS,
    LEGACY_ANALYSIS_LIMITS,
    LEGACY_FOCUSED_LIMITS,
    limits_for_kind,
    limits_for_run,
)


def test_old_reserved_jobs_keep_their_original_budgets_and_deadlines():
    assert limits_for_run({"kind": "analysis"}) == LEGACY_ANALYSIS_LIMITS
    for kind in ("investigation", "proposal"):
        assert limits_for_run({"kind": kind}) == LEGACY_FOCUSED_LIMITS
    frozen = asdict(LEGACY_FOCUSED_LIMITS)
    assert limits_for_run({"kind": "investigation", "agent_limits": frozen}) == LEGACY_FOCUSED_LIMITS
    assert frozen == asdict(LEGACY_FOCUSED_LIMITS)


def test_new_job_limits_reserve_enough_for_submission_and_fit_worker_timeout():
    for kind, expected in (
        ("analysis", ANALYSIS_LIMITS),
        ("investigation", FOCUSED_LIMITS),
        ("proposal", FOCUSED_LIMITS),
    ):
        limits = limits_for_kind(kind)
        assert limits == expected
        assert limits.output_tokens >= limits.response_tokens + 3 * limits.final_response_tokens
        assert limits.tool_calls > 3 and limits.model_requests - limits.exploration_requests >= 3
        assert limits.seconds + 60 <= 600
