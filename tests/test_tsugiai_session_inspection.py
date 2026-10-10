import copy
import json

import pytest
from code_groove.app import create_app
from code_groove.errors import GrooveError
from code_groove.session_inspection import REVISION, recorded_session_inspection
from code_groove.settings import ROOT, Settings
from fastapi.testclient import TestClient


def test_recorded_draft_connects_five_guards_and_keeps_the_photo_exception():
    value = recorded_session_inspection()
    base, draft = value["initial_bundle"], value["draft_bundle"]
    assert draft["sources"] == base["sources"]
    assert draft["map"]["parent_analysis_id"] == base["map"]["analysis_id"]
    assert draft["interpretation_status"] == "investigation_draft_not_published"
    assert any(e["event_id"] == "ev_item_5" for e in base["map"]["events"])
    assert not any(e["event_id"] == "ev_item_5" for e in draft["map"]["events"])
    case = value["case"]
    keys = []
    for occurrence in case["rules"][0]["occurrences"]:
        keys.append(
            {
                (e["responsibility_id"], e["concept_key"])
                for e in draft["map"]["events"]
                if e["unit_id"] == occurrence["unit_id"]
                and e["span"]["start_line"] <= occurrence["start_line"] <= e["span"]["end_line"]
            }
        )
    shared = set.intersection(*keys)
    assert shared
    photo = next(u for u in draft["map"]["units"] if u["label"] == "request_photo")
    assert not any(
        e["unit_id"] == photo["unit_id"] and (e["responsibility_id"], e["concept_key"]) in shared
        for e in draft["map"]["events"]
    )
    evaluation = value["evaluation"]
    assert len([t for t in evaluation["trials"] if t["name"].startswith("current")]) == 3
    assert len([t for t in evaluation["trials"] if t["name"].startswith("baseline")]) == 3
    assert any(t["status"] == "failed" for t in evaluation["trials"])
    assert evaluation["reserved_max_yen"] <= 4000
    assert evaluation["human_sound_effect"] == "not_measured"


def test_public_inspection_is_read_only_and_preserves_original_recording(tmp_path, monkeypatch):
    def forbid_model(*_args, **_kwargs):
        raise AssertionError("Recorded inspection must not request a model")

    monkeypatch.setattr("code_groove.agent.run_agent", forbid_model)
    original_path = ROOT / "fixtures/recorded-live/tsugiai-agents.json"
    original_bytes = original_path.read_bytes()
    app = create_app(Settings(local_data_dir=tmp_path))
    client = TestClient(app)
    response = client.get("/api/v1/samples/recorded-tsugiai-agents/session-inspection")
    assert response.status_code == 200, response.text
    assert response.json()["data"]["case"]["revision"] == REVISION
    assert client.get("/api/v1/samples/recorded-checkout-flow/session-inspection").status_code == 404
    original = client.get("/api/v1/samples/recorded-tsugiai-agents/bundle").json()["data"]
    assert original["map"] == json.loads(original_bytes)["map"]
    assert original_path.read_bytes() == original_bytes
    assert not app.state.store.list("runs")
    assert not app.state.store.list("analyses")


@pytest.mark.parametrize("damage", ["source", "interpretation"])
def test_recording_rejects_unpinned_sources_and_unsubmitted_interpretations(tmp_path, monkeypatch, damage):
    value = copy.deepcopy(recorded_session_inspection())
    if damage == "source":
        for key in ("initial_bundle", "draft_bundle"):
            value[key]["sources"]["agents/checkout_agent/tools.py"] += "\n# changed"
    else:
        value["draft_bundle"]["map"]["events"][-1]["meaning"] += "unsubmitted change"
    folder = tmp_path / "fixtures/recorded-live"
    folder.mkdir(parents=True)
    (folder / "tsugiai-session-inspection.json").write_text(json.dumps(value), encoding="utf-8")
    reference = tmp_path / "fixtures/repository-reference"
    reference.mkdir()
    (reference / "tsugiai.json").write_bytes(
        (ROOT / "fixtures/repository-reference/tsugiai.json").read_bytes()
    )
    monkeypatch.setattr("code_groove.session_inspection.ROOT", tmp_path)
    recorded_session_inspection.cache_clear()
    try:
        with pytest.raises(GrooveError, match="INVALID_SOURCE" if damage == "source" else "INVALID_ANALYSIS"):
            recorded_session_inspection()
    finally:
        recorded_session_inspection.cache_clear()
