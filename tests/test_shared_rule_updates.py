import copy
import importlib.util
import json

import pytest
from code_groove.agent import AgentContext, execute_tool
from code_groove.app import create_app
from code_groove.errors import GrooveError
from code_groove.schemas import InvestigationCandidate
from code_groove.settings import ROOT, Settings
from code_groove.source import build_index
from code_groove.validation import project_event_updates, validate_investigation
from fastapi.testclient import TestClient


def grounded_update(base, sources):
    index = build_index(base["snapshot_id"], sources)
    ctx = AgentContext(
        Settings(),
        base["project_id"],
        base["snapshot_id"],
        sources,
        index,
        lambda *_: None,
        lambda: None,
        lambda _: None,
        base=base,
    )
    for file in index["files"]:
        execute_tool(
            ctx,
            "read_code",
            {
                "file_id": file["file_id"],
                "start_line": 1,
                "end_line": len(sources[file["path"]].splitlines()),
                "purpose": "Test double: inspect complete contract",
            },
            "read",
        )
    unused = next(
        "M" + str(i)
        for i in range(6)
        if "M" + str(i) not in {r["motif_id"] for r in base["responsibilities"]}
    )
    originals = ["evnt_campaign_decision", "evnt_reward_discount_decision", "evnt_preview_qualify"]
    events = []
    for index, (old_id, start, end) in enumerate(zip(originals, [13, 17, 12], [17, 21, 13], strict=True)):
        old = next(e for e in base["events"] if e["event_id"] == old_id)
        proof = next(e for e in ctx.evidence if e.span.path == old["span"]["path"])
        events.append(
            {
                **old,
                "event_id": "event_shared_" + str(index),
                "responsibility_id": "resp_shared",
                "concept_key": "campaign_qualification",
                "label": "Test shared rule",
                "span": {**old["span"], "start_line": start, "end_line": end},
                "evidence_ids": [proof.evidence_id],
            }
        )
    evidence_ids = [e.evidence_id for e in ctx.evidence]
    candidate = InvestigationCandidate(
        new_events=events,
        replaced_event_ids=originals,
        replaced_signal_ids=[s["signal_id"] for s in base["review_signals"]],
        new_responsibilities=[
            {
                "responsibility_id": "resp_shared",
                "label": "Test campaign rule",
                "definition": "Test double for bounded common rule",
                "change_reason": "Campaign condition changes",
                "evidence_ids": evidence_ids,
                "motif_id": unused,
                "display_order": 5,
            }
        ],
        findings=[
            {
                "finding_id": "finding_shared",
                "verdict": "inconclusive",
                "summary": "Test interpretation draft",
                "justification": "Fresh reads, no semantic-accuracy or audio-benefit claim",
                "evidence_ids": evidence_ids,
            }
        ],
        hypotheses=[],
    )
    return ctx, candidate


def saved_case():
    return json.loads((ROOT / "fixtures/recorded-live/checkout-flow.json").read_text(encoding="utf-8"))


def test_grounded_replacement_can_connect_existing_roles_without_mutating_base():
    bundle = saved_case()
    before = copy.deepcopy(bundle["map"])
    ctx, candidate = grounded_update(before, bundle["sources"])
    validate_investigation(candidate, ctx.evidence, before, ctx.index)
    projected = project_event_updates(before, candidate, ctx.evidence)
    shared = [e for e in projected["events"] if e["responsibility_id"] == "resp_shared"]
    assert len({e["unit_id"] for e in shared}) == 3
    assert len({e["concept_key"] for e in shared}) == 1
    assert not set(candidate.replaced_event_ids).intersection(e["event_id"] for e in projected["events"])
    assert bundle["map"] == before


@pytest.mark.parametrize(
    "failure", ["stale", "outside", "uninspected", "motif_collision", "dangling_candidate", "reused_id"]
)
def test_event_update_rejects_unread_unbounded_and_dangling_drafts(failure):
    bundle = saved_case()
    ctx, candidate = grounded_update(bundle["map"], bundle["sources"])
    if failure == "stale":
        candidate.new_events[0].evidence_ids = bundle["map"]["events"][0]["evidence_ids"]
    elif failure == "outside":
        candidate.new_events[0].span.start_line = 1
    elif failure == "uninspected":
        next(u for u in bundle["map"]["units"] if u["unit_id"] == candidate.new_events[0].unit_id)[
            "review_state"
        ] = "unresolved"
    elif failure == "motif_collision":
        candidate.new_responsibilities[0].motif_id = bundle["map"]["responsibilities"][0]["motif_id"]
    elif failure == "dangling_candidate":
        candidate.replaced_signal_ids = []
    else:
        candidate.new_events[0].event_id = bundle["map"]["events"][0]["event_id"]
    with pytest.raises(GrooveError):
        validate_investigation(candidate, ctx.evidence, bundle["map"], ctx.index)


def test_event_replacement_is_a_draft_until_owner_publishes_and_preserves_sources(tmp_path):
    app = create_app(
        Settings(local_data_dir=tmp_path, enable_live_analysis=True, model_mode="live"), verifier=lambda t: t
    )
    for owner in ("alice", "bob"):
        app.state.store.put("accounts", owner, {"enabled": True})
    client = TestClient(app)
    headers = {"Authorization": "Bearer alice", "Idempotency-Key": "shared-copy"}
    copied = client.post("/api/v1/samples/recorded-checkout-flow/projects", json={}, headers=headers).json()[
        "data"
    ]
    meta = app.state.store.get("analyses", copied["analysis_id"])
    bundle = app.state.artifacts.get(meta["artifact_key"])
    snapshot = app.state.artifacts.get(meta["snapshot_key"])
    ctx, candidate = grounded_update(bundle["map"], snapshot["sources"])
    result = {
        **candidate.model_dump(mode="json"),
        "base_analysis_id": copied["analysis_id"],
        "evidence": [e.model_dump(mode="json") for e in ctx.evidence],
    }
    app.state.artifacts.put("shared/draft", result)
    app.state.store.put("investigations", "inv_shared", {**meta, "artifact_key": "shared/draft"})
    path = "/api/v1/investigations/inv_shared/publish-interpretation"
    assert (
        client.get("/api/v1/projects/" + copied["project_id"] + "/bundle", headers=headers).json()["data"][
            "map"
        ]
        == bundle["map"]
    )
    assert client.post(path, json={}, headers={"Authorization": "Bearer bob"}).status_code == 404
    response = client.post(path, json={}, headers=headers)
    assert response.status_code == 200, response.text
    current = client.get("/api/v1/projects/" + copied["project_id"] + "/bundle", headers=headers).json()[
        "data"
    ]
    assert current["sources"] == snapshot["sources"]
    assert len([e for e in current["map"]["events"] if e["responsibility_id"] == "resp_shared"]) == 3
    assert current["map"]["parent_analysis_id"] == bundle["map"]["analysis_id"]
    assert app.state.artifacts.get(meta["artifact_key"])["map"] == bundle["map"]
    assert not app.state.store.list("runs")
    assert client.post(path, json={}, headers=headers).status_code == 409


def test_offline_representation_checker_preserves_baseline_failures_and_rejects_changed_source():
    spec = importlib.util.spec_from_file_location(
        "shared_evaluator", ROOT / "scripts/evaluate-shared-rules.py"
    )
    assert spec and spec.loader
    evaluator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(evaluator)
    case = json.loads((ROOT / "evaluations/checkout-quantity-v1.json").read_text(encoding="utf-8"))
    bundle = saved_case()
    report = evaluator.inspect_representation(case, bundle)
    assert all(not r["comparable_by_saved_key"] for r in report["checks"])
    assert report["current_agent_evaluation"] == "not_run"
    assert report["human_sound_effect"] == "not_measured"
    bundle["sources"]["src/preview.ts"] += "\n// stale"
    with pytest.raises(ValueError, match="Stale source"):
        evaluator.inspect_representation(case, bundle)


def test_updated_candidate_can_reference_freshly_proposed_events():
    bundle = saved_case()
    ctx, candidate = grounded_update(bundle["map"], bundle["sources"])
    signal = copy.deepcopy(bundle["map"]["review_signals"][0])
    signal.update(
        unit_ids=[e.unit_id for e in candidate.new_events],
        event_ids=[e.event_id for e in candidate.new_events],
        evidence_ids=[e.evidence_id for e in ctx.evidence],
        alternative_evidence_ids=[e.evidence_id for e in ctx.evidence],
        counter_explanation="Test double: verify distinct runtime contracts",
        counter_status="undetermined",
        verdict="inconclusive",
    )
    from code_groove.schemas import ReviewSignal

    candidate.review_signals = [ReviewSignal.model_validate(signal)]
    validate_investigation(candidate, ctx.evidence, bundle["map"], ctx.index)
