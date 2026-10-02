import time

import pytest
from code_groove.app import create_app
from code_groove.errors import GrooveError
from code_groove.settings import Settings
from fastapi.testclient import TestClient


@pytest.fixture
def setup(tmp_path):
    settings = Settings(local_data_dir=tmp_path, enable_live_analysis=True, model_mode="live")
    app = create_app(settings, verifier=lambda token: token)
    for user in ("alice", "bob"):
        app.state.store.put("accounts", user, {"enabled": True})
    return TestClient(app), app.state


def create(client, key="request001", user="alice"):
    return client.post(
        "/api/v1/projects",
        json={"source": {"kind": "sample", "sample_id": "mixed"}},
        headers={"Authorization": f"Bearer {user}", "Idempotency-Key": key},
    )


def test_access_expiry_origin_and_worker_separation(setup):
    client, state = setup
    assert client.get("/api/v1/samples/mixed/bundle").status_code == 200
    assert client.get("/api/v1/projects").status_code == 401
    assert client.get("/api/v1/projects", headers={"Authorization": "Bearer outsider"}).status_code == 403
    created = create(client).json()["data"]
    path = f"/api/v1/projects/{created['project_id']}"
    assert client.get(path, headers={"Authorization": "Bearer bob"}).status_code == 404
    state.store.update("projects", created["project_id"], {"expires_at": time.time() - 1})
    assert client.get(path, headers={"Authorization": "Bearer alice"}).status_code == 410
    assert client.post("/internal/tasks/run", json={"run_id": created["run_id"]}).status_code == 404
    assert (
        client.post("/api/v1/projects", json={}, headers={"Origin": "https://evil.example"}).status_code
        == 403
    )


def test_idempotency_single_active_and_cancel_quota(setup):
    client, state = setup
    first = create(client).json()["data"]
    second = create(client).json()["data"]
    assert first["run_id"] == second["run_id"]
    assert len(state.store.list("runs")) == 1
    assert create(client, key="request002").status_code == 429
    assert (
        client.post(
            f"/api/v1/runs/{first['run_id']}/cancel", json={}, headers={"Authorization": "Bearer alice"}
        ).status_code
        == 200
    )
    state.jobs.settle_quota(first["run_id"])
    quota = state.store.list("global_quotas")[0]
    assert quota["reserved_input"] == 0
    assert create(client, key="request003").status_code == 202


def test_lease_preserves_consumption_and_stale_worker_cannot_publish(setup):
    client, state = setup
    created = create(client).json()["data"]
    run_id = created["run_id"]
    state.jobs.claim(run_id, "first")
    with pytest.raises(GrooveError, match="LEASE_BUSY"):
        state.jobs.claim(run_id, "second")
    state.jobs.mutate(
        run_id, "first", {"input_tokens": 1000, "model_requests": 2, "lease_expires_at": time.time() - 1}
    )
    second = state.jobs.claim(run_id, "second")
    assert second["input_tokens"] == 1000 and second["model_requests"] == 2
    with pytest.raises(GrooveError, match="LEASE_LOST"):
        state.jobs.mutate(run_id, "first", {"status": "completed"})
    state.jobs.mutate(run_id, "second", {"lease_expires_at": time.time() - 1})
    assert state.jobs.claim(run_id, "third") is None
    assert state.store.get("runs", run_id)["status"] == "failed"


def test_delete_hides_immediately_and_removes_artifacts(setup):
    client, state = setup
    created = create(client).json()["data"]
    pid = created["project_id"]
    state.artifacts.put(f"projects/{pid}/snapshot.json.gz", {"source": "sanitized"})
    assert (
        client.delete(f"/api/v1/projects/{pid}", headers={"Authorization": "Bearer alice"}).status_code == 202
    )
    assert (
        client.get(f"/api/v1/runs/{created['run_id']}", headers={"Authorization": "Bearer alice"}).status_code
        == 404
    )
    state.jobs.delete(pid)
    state.jobs.delete(pid)
    assert state.store.get("runs", created["run_id"]) is None
    assert state.store.get("projects", pid)["status"] == "deleted"
    assert state.store.list("global_quotas")[0]["reserved_input"] == 0


def test_immutable_artifact_and_event_resume(setup):
    client, state = setup
    run_id = create(client).json()["data"]["run_id"]
    state.store.append_event(run_id, "progress", {"message": "reading"})
    state.store.append_event(run_id, "progress", {"message": "checked"})
    response = client.get(
        f"/api/v1/runs/{run_id}/events?after_seq=1", headers={"Authorization": "Bearer alice"}
    )
    assert [event["seq"] for event in response.json()["data"]] == [2]
    state.artifacts.put("projects/p_test/one.json.gz", {"x": 1})
    state.artifacts.put("projects/p_test/one.json.gz", {"x": 1})
    with pytest.raises(GrooveError, match="IMMUTABLE_CONFLICT"):
        state.artifacts.put("projects/p_test/one.json.gz", {"x": 2})
