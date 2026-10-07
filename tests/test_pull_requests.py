import copy
import json
import time

import httpx
import pytest
from code_groove.app import create_app
from code_groove.errors import GrooveError
from code_groove.pull_requests import (
    added_ranges,
    change_navigation,
    parse_pull_request_url,
    pull_request_data,
)
from code_groove.schemas import PullRequestNavigation
from code_groove.settings import ROOT, Settings
from fastapi.testclient import TestClient


def recording():
    bundle = json.loads((ROOT / "fixtures/recorded-live/tsugiai-agents.json").read_text(encoding="utf-8"))
    snapshot = {
        "snapshot_id": bundle["map"]["snapshot_id"],
        "sources": bundle["sources"],
        "index": {"files": []},
    }
    return snapshot, bundle


def github(monkeypatch, sha, files, *, moved=False, private=False, changed_files=None):
    original = httpx.AsyncClient
    reads = []
    metadata = {
        "head": {"sha": sha, "repo": {"full_name": "kdoai/tsugiai", "private": private}},
        "base": {"sha": "b" * 40, "repo": {"full_name": "kdoai/tsugiai", "private": False}},
        "changed_files": len(files) if changed_files is None else changed_files,
    }

    def respond(request):
        assert request.url.host == "api.github.com" and request.method == "GET"
        reads.append(str(request.url))
        if request.url.path.endswith("/files"):
            return httpx.Response(200, json=files if request.url.params["page"] == "1" else [])
        value = copy.deepcopy(metadata)
        if moved and len(reads) > 1:
            value["head"]["sha"] = "c" * 40
        return httpx.Response(200, json=value)

    monkeypatch.setattr(
        "code_groove.pull_requests.httpx.AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    return reads


def changed(path, line=1, **values):
    return {
        "filename": path,
        "status": "modified",
        "additions": 1,
        "deletions": 1,
        "patch": f"@@ -{line},1 +{line},1 @@\n-old\n+new",
        **values,
    }


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/a/b/pull/1",
        "https://github.com:443/a/b/pull/1",
        "https://github.com/a/b/pull/0",
        "https://github.com/a/b/pull/1?x=1",
        "https://github.com/a/../pull/1",
        "https://evil.invalid/a/b/pull/1",
    ],
)
def test_pr_url_rejects_unsafe_or_ambiguous_urls(url):
    with pytest.raises(GrooveError):
        parse_pull_request_url(url)


def test_diff_head_ranges_do_not_assign_deleted_lines_or_context():
    patch = "@@ -2,4 +2,4 @@\n keep\n-old\n+new\n keep\n-old\n+new\n@@ -9,1 +9,0 @@\n-old"
    assert added_ranges(patch) == ([(3, 3), (5, 5)], False)
    ranges, truncated = added_ranges("\n".join(f"@@ -{i},1 +{i},1 @@\n+x" for i in range(1, 140, 2)))
    assert len(ranges) == 64 and truncated


def test_changed_test_evidence_links_to_implementation_without_claiming_its_body_changed():
    span = {"file_id": "test_file", "path": "tests/policy.test.ts", "start_line": 1, "end_line": 2}
    semantic = {
        "units": [
            {
                "unit_id": "policy",
                "primary_span": {**span, "path": "src/policy.ts"},
                "evidence_ids": ["test_proof"],
            }
        ],
        "events": [],
        "review_signals": [],
        "evidence": [{"evidence_id": "test_proof", "span": span}],
    }
    snapshot = {"sources": {span["path"]: "one\ntwo"}, "index": {"files": []}}
    result = change_navigation([changed(span["path"])], snapshot, semantic, True)[0]
    assert result["unit_ids"] == ["policy"] and result["direct_unit_ids"] == []
    assert result["evidence_ids"] == ["test_proof"]
    assert change_navigation([changed(span["path"])], snapshot, semantic, False)[0]["evidence_ids"] == []


@pytest.mark.asyncio
async def test_same_revision_links_only_saved_ranges_and_reports_missing_deleted_and_unknown(monkeypatch):
    snapshot, bundle = recording()
    unit = bundle["map"]["units"][0]
    span = unit["primary_span"]
    files = [
        changed(span["path"], span["start_line"]),
        changed("deleted.py", status="removed", additions=0, patch="@@ -1,1 +0,0 @@\n-old"),
        changed("binary.dat", patch=None),
        changed("outside.py"),
        changed(span["path"], additions=2),
    ]
    reads = github(monkeypatch, bundle["case_study"]["revision"], files)
    before = copy.deepcopy(snapshot)
    value = await pull_request_data(
        "https://github.com/kdoai/tsugiai/pull/1",
        "https://github.com/kdoai/tsugiai",
        bundle["case_study"]["revision"],
        snapshot,
        bundle["map"],
    )
    PullRequestNavigation.model_validate(value)
    assert value["matches_snapshot"] and value["files"][0]["direct_unit_ids"] == [unit["unit_id"]]
    assert value["files"][0]["evidence_ids"]
    assert value["files"][1]["changed_spans"] == []
    assert value["files"][2]["patch_missing"]
    assert not value["files"][3]["source_available"]
    assert value["files"][4]["patch_incomplete"]
    assert len(reads) == 3 and snapshot == before


@pytest.mark.asyncio
async def test_revision_mismatch_and_file_limit_keep_unknown_instead_of_old_evidence(monkeypatch):
    snapshot, bundle = recording()
    span = bundle["map"]["units"][0]["primary_span"]
    github(monkeypatch, "a" * 40, [changed(span["path"], span["start_line"])], changed_files=301)
    result = await pull_request_data(
        "https://github.com/kdoai/tsugiai/pull/1",
        "https://github.com/kdoai/tsugiai",
        bundle["case_study"]["revision"],
        snapshot,
        bundle["map"],
    )
    assert not result["matches_snapshot"] and result["truncated"]
    assert not result["files"][0]["changed_spans"] and not result["files"][0]["unit_ids"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "condition,code",
    [("moved", "PR_MOVED"), ("private", "PR_NOT_AVAILABLE"), ("repository", "PR_REPOSITORY_MISMATCH")],
)
async def test_pr_move_private_and_unrelated_repository_are_explicit(monkeypatch, condition, code):
    snapshot, bundle = recording()
    github(
        monkeypatch,
        bundle["case_study"]["revision"],
        [],
        moved=condition == "moved",
        private=condition == "private",
    )
    with pytest.raises(GrooveError, match=code):
        await pull_request_data(
            "https://github.com/kdoai/tsugiai/pull/1",
            "https://github.com/other/project"
            if condition == "repository"
            else "https://github.com/kdoai/tsugiai",
            bundle["case_study"]["revision"],
            snapshot,
            bundle["map"],
        )


def test_pr_read_routes_enforce_ownership_expiration_and_preserve_jobs_and_sources(tmp_path, monkeypatch):
    snapshot, bundle = recording()
    github(monkeypatch, bundle["case_study"]["revision"], [])
    app = create_app(
        Settings(local_data_dir=tmp_path, model_mode="fixture", store_mode="local"),
        verifier=lambda token: token,
    )
    for user in ("alice", "bob"):
        app.state.store.put("accounts", user, {"enabled": True})
    client = TestClient(app)
    query = {"url": "https://github.com/kdoai/tsugiai/pull/1"}
    assert client.get("/api/v1/samples/recorded-tsugiai-agents/pull-request", params=query).status_code == 200
    assert client.get("/api/v1/samples/justified/pull-request", params=query).status_code == 400
    headers = {"Authorization": "Bearer alice", "Idempotency-Key": "copy_pr_read"}
    copied = client.post("/api/v1/samples/recorded-tsugiai-agents/projects", headers=headers, json={}).json()[
        "data"
    ]
    path = f"/api/v1/analyses/{copied['analysis_id']}/pull-request"
    assert client.get(path, params=query).status_code == 401
    assert client.get(path, params=query, headers={"Authorization": "Bearer bob"}).status_code == 404
    assert client.get(path, params=query, headers=headers).status_code == 200
    assert app.state.store.list("runs", "owner_uid", "alice") == []
    assert (
        client.get(f"/api/v1/projects/{copied['project_id']}/bundle", headers=headers).json()["data"][
            "sources"
        ]
        == snapshot["sources"]
    )
    meta = app.state.store.get("analyses", copied["analysis_id"])
    saved = app.state.artifacts.get(meta["snapshot_key"])
    saved["sources"][next(iter(saved["sources"]))] += "\n# local change"
    changed_key = f"projects/{copied['project_id']}/snapshots/changed/snapshot.json.gz"
    app.state.artifacts.put(changed_key, saved)
    app.state.store.update("analyses", copied["analysis_id"], {"snapshot_key": changed_key})
    assert client.get(path, params=query, headers=headers).status_code == 400
    app.state.store.update("analyses", copied["analysis_id"], {"expires_at": time.time() - 1})
    assert client.get(path, params=query, headers=headers).status_code == 410
