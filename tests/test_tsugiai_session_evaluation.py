import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "session_evaluation", ROOT / "scripts/tsugiai-session-evaluation.py"
)
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


def test_failed_or_unfinished_calls_keep_budget_and_cannot_be_repeated(tmp_path, monkeypatch):
    monkeypatch.setattr(evaluation, "OUTPUT", tmp_path)
    evaluation.reserve_run("failed-first-call", False)
    with pytest.raises(RuntimeError, match="already reserved"):
        evaluation.reserve_run("failed-first-call", False)
    for number in range(10):
        evaluation.reserve_run(f"additional-{number}", False)
    with pytest.raises(RuntimeError, match="budget boundary"):
        evaluation.reserve_run("would-exceed-ceiling", False)
    ledger = json.loads((tmp_path / "budget.json").read_text())
    assert sum(run["reserved_max_yen"] for run in ledger["runs"]) <= 4000 < 5000
    assert len(ledger["runs"]) == 11


def test_reference_keeps_photo_outside_shared_session_precondition():
    case = evaluation.read_json(evaluation.CASE)
    occurrences = case["rules"][0]["occurrences"]
    assert len(occurrences) == 5
    assert "request_photo" not in {o["label"] for o in occurrences}
    sources = evaluation.read_json(ROOT / "fixtures/repository-reference/tsugiai.json")["sources"]
    for occurrence in occurrences:
        lines = sources[occurrence["path"]].splitlines()
        assert "if not _firestore_service or not _current_session_id:" in lines[occurrence["start_line"] - 1]
    assert case["reference_status"] == "source_checked_agent_draft_awaiting_human_ratification"
    assert evaluation.source_hashes(case) == {
        p: hashlib.sha256("\n".join(s.splitlines()).encode()).hexdigest() for p, s in sources.items()
    }


def test_typed_hash_manifest_reconstructs_the_unchanged_pre_run_reference():
    case = evaluation.read_json(evaluation.CASE)
    encoding = case.pop("record_encoding")
    case["source_sha256"] = evaluation.source_hashes(case)
    serialized = json.dumps(case, ensure_ascii=False, indent=2) + "\n"
    if encoding["original_newline"] == "CRLF":
        serialized = serialized.replace("\n", "\r\n")
    assert hashlib.sha256(serialized.encode()).hexdigest() == encoding["original_document_sha256"]
