import hashlib
import json

from code_groove.app import create_app
from code_groove.repository_reference import tsugiai_reference
from code_groove.settings import ROOT, Settings
from code_groove.source import sanitize
from fastapi.testclient import TestClient


def test_reference_keeps_full_committed_source_separate_from_model_recording(tmp_path, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Reference browsing must not invoke Gemini")

    monkeypatch.setattr("code_groove.jobs.run_agent", forbidden)
    app = create_app(Settings(local_data_dir=tmp_path, model_mode="fixture", store_mode="local"))
    client = TestClient(app)
    before = (ROOT / "fixtures/recorded-live/tsugiai-agents.json").read_bytes()
    reference = client.get("/api/v1/samples/recorded-tsugiai-agents/repository-reference")
    assert reference.status_code == 200
    data = reference.json()["data"]
    assert data["origin"] == "committed_source_reference" and data["semantic_analysis"] == "not_run"
    assert len(data["sources"]) == 51 and data["source_lines"] == 19541
    assert "agents/main.py" in data["sources"] and "frontend/src/pages/TemplateBuilderPage.tsx" in data["sources"]
    recording = client.get("/api/v1/samples/recorded-tsugiai-agents/bundle").json()["data"]
    assert len(recording["sources"]) == 11 and recording["map"]["coverage"]["inspected_units"] == 9
    assert recording["case_study"]["revision"] == data["revision"]
    assert all(data["sources"][path] == text for path, text in recording["sources"].items())
    assert (ROOT / "fixtures/recorded-live/tsugiai-agents.json").read_bytes() == before
    assert client.get("/api/v1/samples/mixed/repository-reference").status_code == 404
    assert app.state.store.list("runs") == []
    assert app.state.store.list("daily_quotas") == []


def test_reference_has_sanitized_integrity_and_cannot_change_music_scope():
    reference = tsugiai_reference()
    for path, source in reference.sources.items():
        assert sanitize(source) == source
        assert hashlib.sha256(source.encode()).hexdigest() == reference.source_sha256[path]
    recording = json.loads((ROOT / "fixtures/recorded-live/tsugiai-agents.json").read_text(encoding="utf-8"))
    assert all(event["span"]["path"] in recording["sources"] for event in recording["map"]["events"])
    assert not any(note["kind"] == "cue" for scene in recording["score"]["scenes"] for mode in ("repo", "theme") for note in scene[mode]["notes"])
