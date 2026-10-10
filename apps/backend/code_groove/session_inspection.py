"""A fixed TSUGIAI development case, with original and unaccepted draft separated."""

import hashlib
import json
from functools import lru_cache

from code_groove.errors import GrooveError
from code_groove.schemas import Evidence, InvestigationCandidate, SemanticMap
from code_groove.settings import ROOT
from code_groove.source import build_index
from code_groove.validation import project_event_updates, validate_candidate, validate_investigation

REVISION = "35a951488d7b00518e7e73a329d46713cbeacbe8"


def project_recorded_draft(base: dict, candidate: InvestigationCandidate, evidence: list[Evidence]) -> dict:
    projected = project_event_updates(base, candidate, evidence)
    patterns = {p["pattern_id"]: p for p in projected.get("design_patterns", [])}
    patterns.update({p.pattern_id: p.model_dump(mode="json") for p in candidate.design_patterns})
    projected["design_patterns"] = list(patterns.values())
    updates = {s.signal_id: s.model_dump(mode="json") for s in candidate.review_signals}
    projected["review_signals"] = [
        s
        for s in projected.get("review_signals", [])
        if s["signal_id"] not in updates and s["signal_id"] not in candidate.replaced_signal_ids
    ] + list(updates.values())
    return projected


@lru_cache(maxsize=1)
def recorded_session_inspection() -> dict:
    file = ROOT / "fixtures/recorded-live/tsugiai-session-inspection.json"
    if not file.is_file():
        raise GrooveError("NOT_FOUND", "この検査の実行記録はまだありません。", 404)
    value = json.loads(file.read_text(encoding="utf-8"))
    if value["case"]["revision"] != REVISION:
        raise GrooveError("STALE_ANALYSIS", "検査記録のコード版が一致しません。")
    for name in ("initial_bundle", "draft_bundle"):
        bundle = value[name]
        SemanticMap.model_validate(bundle["map"])
        if bundle["case_study"]["revision"] != REVISION or bundle["map"]["origin"] != "recorded_live":
            raise GrooveError("INVALID_ANALYSIS", "実解析の出典を確認できません。")
    if value["initial_bundle"]["sources"] != value["draft_bundle"]["sources"]:
        raise GrooveError("INVALID_SOURCE", "解釈比較でソースが変わっています。")
    base = value["initial_bundle"]["map"]
    sources = value["initial_bundle"]["sources"]
    reference = json.loads((ROOT / "fixtures/repository-reference/tsugiai.json").read_text(encoding="utf-8"))
    if reference["revision"] != REVISION or sources != reference["sources"]:
        raise GrooveError("INVALID_SOURCE", "固定版TSUGIAIのソースと一致しません。")
    for bundle in (value["initial_bundle"], value["draft_bundle"]):
        for proof in bundle["map"]["evidence"]:
            span = proof["span"]
            projection = "\n".join(
                sources[span["path"]].splitlines()[span["start_line"] - 1 : span["end_line"]]
            )
            if hashlib.sha256(projection.encode()).hexdigest() != proof["projection_sha256"]:
                raise GrooveError("INVALID_EVIDENCE", "保存した読取根拠がソースと一致しません。")
    index = build_index(base["snapshot_id"], sources, repository=True)
    investigation = value["investigation"]
    candidate = InvestigationCandidate.model_validate(investigation["candidate"])
    evidence = [Evidence.model_validate(e) for e in investigation["evidence"]]
    validate_investigation(candidate, evidence, base, index)
    if value["draft_bundle"]["map"]["parent_analysis_id"] != base["analysis_id"]:
        raise GrooveError("INVALID_ANALYSIS", "調査案の親版が一致しません。")
    projected = project_recorded_draft(base, candidate, evidence)
    draft = value["draft_bundle"]["map"]
    metadata = {
        "analysis_id",
        "parent_analysis_id",
        "interpretation_update_version",
        "analysis_depth",
        "created_at",
    }
    if {k: v for k, v in projected.items() if k not in metadata} != {
        k: v for k, v in draft.items() if k not in metadata
    }:
        raise GrooveError("INVALID_ANALYSIS", "調査案が実際のAgent提案と一致しません。")
    validate_candidate(SemanticMap.model_validate(draft), index, [Evidence(**p) for p in draft["evidence"]])
    return value
