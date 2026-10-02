import json
from pathlib import Path

import pytest
from code_groove.errors import GrooveError
from code_groove.schemas import AnalysisCandidate, Evidence
from code_groove.validation import validate_candidate

ROOT = Path(__file__).resolve().parents[1]


def case():
    value = json.loads((ROOT / "fixtures/mixed.json").read_text(encoding="utf-8"))["map"]
    candidate = AnalysisCandidate.model_validate({k: value[k] for k in AnalysisCandidate.model_fields})
    index = {
        "units": [{"unit_id": u["unit_id"], "primary_span": u["primary_span"]} for u in value["units"]],
        "files": [
            {"file_id": u["primary_span"]["file_id"], "path": u["primary_span"]["path"]}
            for u in value["units"]
        ],
        "relations": [],
    }
    return candidate, index, [Evidence(**e) for e in value["evidence"]]


def test_grounded_fixture_and_unknown_evidence_rejection():
    candidate, index, proofs = case()
    validate_candidate(candidate, index, proofs)
    candidate.events[0].evidence_ids = ["invented_evidence"]
    with pytest.raises(GrooveError):
        validate_candidate(candidate, index, proofs)


def test_wrong_owner_and_duplicate_order_rejection():
    candidate, index, proofs = case()
    candidate.events[0].span.start_line = 999
    candidate.events[0].span.end_line = 999
    with pytest.raises(GrooveError):
        validate_candidate(candidate, index, proofs)
    candidate, index, proofs = case()
    candidate.events[1].semantic_order = candidate.events[0].semantic_order
    with pytest.raises(GrooveError):
        validate_candidate(candidate, index, proofs)
