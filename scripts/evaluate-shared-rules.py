"""Check representational coverage only; never execute analyzed code or request a model."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(text: str) -> str:
    return hashlib.sha256("\n".join(text.splitlines()).encode()).hexdigest()


def inspect_representation(case: dict, bundle: dict) -> dict:
    if case["protocol"] != "shared-rule-development-v1":
        raise ValueError("Unknown case protocol")
    for path, expected in case["source_sha256"].items():
        if path not in bundle["sources"] or digest(bundle["sources"][path]) != expected:
            raise ValueError(f"Stale source: {path}")
    semantic = bundle["map"]
    units = {u["unit_id"]: u for u in semantic["units"]}
    proofs = {p["evidence_id"]: p for p in semantic["evidence"]}
    events = []
    for event in semantic["events"]:
        if event["state"] != "grounded":
            continue
        span = event["span"]
        owner = units.get(event["unit_id"])
        if not owner or owner["review_state"] != "inspected":
            raise ValueError("Grounded event without inspected owner")
        for evidence_id in event["evidence_ids"]:
            proof = proofs[evidence_id]
            source = bundle["sources"][proof["span"]["path"]].splitlines()
            projection = "\n".join(source[proof["span"]["start_line"] - 1 : proof["span"]["end_line"]])
            if hashlib.sha256(projection.encode()).hexdigest() != proof["projection_sha256"]:
                raise ValueError("Stale read evidence")
        if not any(
            p["source_kind"] == "code"
            and p["span"]["path"] == span["path"]
            and p["span"]["start_line"] <= span["start_line"] <= span["end_line"] <= p["span"]["end_line"]
            for p in (proofs[e] for e in event["evidence_ids"])
        ):
            raise ValueError("Event without covering read")
        events.append(event)
    checks = []
    for rule in case["rules"]:
        per_occurrence = []
        for expected in rule["occurrences"]:
            matched = [
                e
                for e in events
                if e["span"]["path"] == expected["path"]
                and e["span"]["start_line"] <= expected["end_line"]
                and expected["start_line"] <= e["span"]["end_line"]
            ]
            per_occurrence.append(matched)
        keys = [set((e["responsibility_id"], e["concept_key"]) for e in found) for found in per_occurrence]
        common = set.intersection(*keys) if keys else set()
        checks.append(
            {
                "rule_id": rule["rule_id"],
                "expected_occurrences": len(keys),
                "occurrences_with_overlapping_events": sum(bool(k) for k in keys),
                "common_saved_keys": [list(k) for k in sorted(common)],
                "comparable_by_saved_key": bool(common),
                "semantic_equivalence": "requires_human_review",
            }
        )
    return {
        "case_id": case["case_id"],
        "reference_status": case["reference_status"],
        "input_bundle_sha256": hashlib.sha256(
            json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "input_origin": semantic["origin"],
        "input_prompt_version": semantic["prompt_version"],
        "input_model_id": semantic["model_id"],
        "checks": checks,
        "metric_scope": "saved key and evidence coverage, not semantic accuracy or listening utility",
        "current_agent_evaluation": "not_run",
        "human_sound_effect": "not_measured",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", type=Path, default=ROOT / "evaluations/checkout-quantity-v1.json")
    parser.add_argument("--bundle", type=Path, default=ROOT / "fixtures/recorded-live/checkout-flow.json")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = inspect_representation(
        json.loads(args.case.read_text(encoding="utf-8")), json.loads(args.bundle.read_text(encoding="utf-8"))
    )
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
