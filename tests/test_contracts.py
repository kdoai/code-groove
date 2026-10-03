import copy
import json
from pathlib import Path

import pytest
from code_groove.app import current_music
from code_groove.schemas import Span
from code_groove.settings import Settings
from pydantic import ValidationError


def test_span_rejects_unsafe_id_and_extra_fields():
    with pytest.raises(ValidationError):
        Span(file_id="../key", path="src/x.ts", start_line=1, end_line=1)
    with pytest.raises(ValidationError):
        Span(file_id="safe", path="src/x.ts", start_line=1, end_line=1, secret="x")


def test_production_refuses_fixture_and_local_storage():
    with pytest.raises(RuntimeError):
        Settings(environment="production").validate_runtime()


def test_saved_grammar_upgrade_preserves_examination_and_never_calls_agent(monkeypatch):
    bundle = json.loads(
        (Path(__file__).resolve().parents[1] / "fixtures/recorded-live/checkout-flow.json").read_text(
            encoding="utf-8"
        )
    )
    for scene in bundle["score"]["scenes"]:
        for mode in ("repo", "theme"):
            scene[mode]["grammar_version"] = "groove-chamber-v5"
    saved = copy.deepcopy(bundle)

    def forbidden(*args, **kwargs):
        raise AssertionError("Score replay must never call the Agent")

    monkeypatch.setattr("code_groove.jobs.run_agent", forbidden)
    upgraded = current_music(bundle)
    assert bundle == saved
    assert {key: value for key, value in upgraded.items() if key != "score"} == {
        key: value for key, value in saved.items() if key != "score"
    }
    assert all(s["repo"]["grammar_version"] == "groove-chamber-v7" for s in upgraded["score"]["scenes"])
    assert current_music(bundle)["score"]["score_hash"] == upgraded["score"]["score_hash"]
