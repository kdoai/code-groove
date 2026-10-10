"""Validate and aggregate a source review. Never run source or request a model."""

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS = ("supported", "partial", "contradicted", "undetermined")
COLLECTIONS = {
    "responsibility": ("responsibilities", "responsibility_id"),
    "meaning_event": ("events", "event_id"),
    "hypothesis": ("hypotheses", "hypothesis_id"),
    "review_signal": ("review_signals", "signal_id"),
    "saved_investigation": ("findings", "finding_id"),
    "investigation_hypothesis": ("hypotheses", "hypothesis_id"),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_span(span: dict, sources: dict[str, str], name: str) -> str:
    require(span["path"] in sources, f"{name}: missing source")
    lines = sources[span["path"]].splitlines()
    start, end = span["start_line"], span["end_line"]
    require(isinstance(start, int) and isinstance(end, int), f"{name}: invalid line type")
    require(1 <= start <= end <= len(lines), f"{name}: invalid range")
    return "\n".join(lines[start - 1 : end])


def evaluate(assessment: dict, root: Path = ROOT) -> dict:
    require(assessment["protocol"]["version"] == "recorded-source-review-v1", "Unknown review version")
    expected_paths = {
        p.relative_to(root).as_posix()
        for p in (root / "fixtures/recorded-live").glob("*.json")
        # This development protocol has its own reference/results, outside the frozen six-case review.
        if p.name != "tsugiai-session-inspection.json"
    }
    corpus = assessment["corpus"]
    require(len(corpus) == len({c["case"] for c in corpus}), "Duplicate corpus case")
    require({c["path"] for c in corpus} == expected_paths, "Incomplete or unexpected corpus")
    expected = {}
    counts = []
    proof_count = primary_count = reference_count = 0
    for entry in corpus:
        path = root / entry["path"]
        raw = path.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == entry["sha256"], f"{entry['case']}: stale review")
        bundle = json.loads(raw)
        semantic = bundle["map"]
        require(semantic["origin"] == entry["origin"] == "recorded_live", "Not a recorded real analysis")
        for field in ("model_id", "prompt_version"):
            require(semantic[field] == entry[field], f"{entry['case']}: provenance mismatch")
        sources = bundle["sources"]
        for scope in (semantic, bundle.get("investigation", {})):
            proofs = {e["evidence_id"]: e for e in scope.get("evidence", [])}
            require(len(proofs) == len(scope.get("evidence", [])), "Duplicate evidence")
            for proof in proofs.values():
                projection = validate_span(proof["span"], sources, proof["evidence_id"])
                require(
                    hashlib.sha256(projection.encode()).hexdigest() == proof["projection_sha256"],
                    f"{proof['evidence_id']}: projection mismatch",
                )
                require(proof["snapshot_id"] == semantic["snapshot_id"], "Evidence snapshot mismatch")
                proof_count += 1
        for group, (collection, id_field) in COLLECTIONS.items():
            scope = (
                bundle.get("investigation", {})
                if group.startswith(("saved_", "investigation_"))
                else semantic
            )
            proofs = {e["evidence_id"]: e for e in scope.get("evidence", [])}
            for item in scope.get(collection, []):
                refs = item.get("evidence_ids", [])
                if group == "review_signal":
                    refs = refs + item.get("alternative_evidence_ids", [])
                require(all(r in proofs for r in refs), f"{item[id_field]}: dangling evidence")
                reference_count += len(refs)
                if group == "meaning_event":
                    validate_span(item["span"], sources, item[id_field])
                    primary_count += 1
                key = (entry["case"], group, item[id_field])
                require(key not in expected, f"{key}: duplicate input")
                expected[key] = [proofs[r]["span"] for r in item.get("evidence_ids", [])]
        expected[(entry["case"], "repository_profile", "profile")] = []
        counts.append(
            {
                "case": entry["case"],
                "units": len(semantic["units"]),
                "responsibilities": len(semantic["responsibilities"]),
                "events": len(semantic["events"]),
                "signals": len(semantic.get("review_signals", [])),
                "hypotheses": len(semantic.get("hypotheses", [])),
            }
        )
    seen = set()
    groups = defaultdict(Counter)
    by_case = defaultdict(lambda: defaultdict(Counter))
    content = Counter()
    for annotation in assessment["annotations"]:
        key = (annotation["case"], annotation["group"], annotation["id"])
        require(key in expected and key not in seen, f"{key}: unexpected/duplicate annotation")
        seen.add(key)
        require(annotation["label"] in LABELS, f"{key}: invalid label")
        require(bool(annotation["rationale"].strip()), f"{key}: missing review rationale")
        require(annotation["linked_source_spans"] == expected[key], f"{key}: stale evidence links")
        groups[annotation["group"]][annotation["label"]] += 1
        by_case[annotation["case"]][annotation["group"]][annotation["label"]] += 1
        if annotation["group"] == "meaning_event":
            label = annotation["meaning_content_label"]
            require(label in LABELS, f"{key}: invalid content label")
            content[label] += 1
    require(seen == set(expected), f"Missing {len(set(expected) - seen)} annotations")

    def distribution(values: Counter) -> dict:
        total = sum(values.values())
        return {
            **{label: values[label] for label in LABELS},
            "total": total,
            "supported_fraction": f"{values['supported']}/{total}",
        }

    return {
        "review_version": assessment["protocol"]["version"],
        "scope": "Source support on curated historical recordings, not model general accuracy",
        "corpus": counts,
        "annotations": len(seen),
        "groups": {group: distribution(values) for group, values in sorted(groups.items())},
        "event_content": distribution(content),
        "by_case": {
            case: {group: distribution(values) for group, values in sorted(values_by_group.items())}
            for case, values_by_group in sorted(by_case.items())
        },
        "mechanical_checks": {
            "evidence_projections": proof_count,
            "primary_event_spans": primary_count,
            "evidence_references": reference_count,
            "semantic_accuracy_proved_by_checks": False,
        },
        "new_analysis_requests": 0,
        "analyzed_code_executed": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--assessment", type=Path, default=ROOT / "evaluations/recorded-interpretation-v1.json"
    )
    parser.add_argument(
        "--report", type=Path, help="Optional local JSON summary; keep runtime output ignored"
    )
    args = parser.parse_args()
    try:
        result = evaluate(json.loads(args.assessment.read_text(encoding="utf-8")))
    except (ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Invalid source review: {error}\n")
    output = json.dumps(result, ensure_ascii=True, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output, encoding="utf-8")
    print(output, end="")


if __name__ == "__main__":
    main()
