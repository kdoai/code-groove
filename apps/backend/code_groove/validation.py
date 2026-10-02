from code_groove.errors import GrooveError
from code_groove.schemas import AnalysisCandidate, Evidence, InvestigationCandidate, Span


def contains(outer: Span, inner: Span) -> bool:
    return (
        outer.file_id == inner.file_id
        and outer.path == inner.path
        and outer.start_line <= inner.start_line <= inner.end_line <= outer.end_line
    )


def validate_candidate(candidate: AnalysisCandidate, index: dict, evidence: list[Evidence]) -> None:
    known_units = {u["unit_id"]: u for u in index["units"]}
    known_files = {f["file_id"]: f for f in index["files"]}
    proofs = {e.evidence_id: e for e in evidence}
    responsibilities = {r.responsibility_id for r in candidate.responsibilities}
    units = {u.unit_id: u for u in candidate.units}
    errors = []
    for values in (candidate.units, candidate.events, candidate.responsibilities):
        id_key = (
            "unit_id"
            if values is candidate.units
            else "event_id"
            if values is candidate.events
            else "responsibility_id"
        )
        if len({getattr(v, id_key) for v in values}) != len(values):
            errors.append("Duplicate IDs")
    if len({r.motif_id for r in candidate.responsibilities}) != len(candidate.responsibilities):
        errors.append("Duplicate motif IDs")
    orders, spans, members = set(), set(), set()
    for unit in candidate.units:
        expected = known_units.get(unit.unit_id)
        if not expected or unit.primary_span.model_dump() != expected["primary_span"]:
            errors.append(f"Unknown or altered unit {unit.unit_id}")
        for member in unit.member_symbol_ids:
            if member == unit.unit_id:
                continue
            target = known_units.get(member)
            callers = {r["caller"] for r in index["relations"] if r.get("callee") == member}
            if member in members or not target or callers != {unit.unit_id}:
                errors.append("Helper must have one confirmed owner")
            members.add(member)
        if unit.review_state == "inspected" and not any(
            e in proofs and contains(proofs[e].span, unit.primary_span) for e in unit.evidence_ids
        ):
            errors.append("Inspected unit requires covering read evidence")
    for obj in [*candidate.responsibilities, *candidate.units, *candidate.events, *candidate.hypotheses]:
        if any(e not in proofs for e in obj.model_dump()["evidence_ids"]):
            errors.append("Unknown evidence ID")
    for responsibility in candidate.responsibilities:
        if not any(proofs[e].source_kind == "code" for e in responsibility.evidence_ids if e in proofs):
            errors.append("Responsibility requires code evidence")
    for event in candidate.events:
        owner_unit = units.get(event.unit_id)
        file = known_files.get(event.span.file_id)
        if (
            event.responsibility_id not in responsibilities
            or not owner_unit
            or not file
            or file["path"] != event.span.path
        ):
            errors.append(f"Dangling reference {event.event_id}")
            continue
        allowed = contains(owner_unit.primary_span, event.span)
        for member in owner_unit.member_symbol_ids:
            if member in known_units:
                allowed = allowed or contains(Span(**known_units[member]["primary_span"]), event.span)
        if not allowed:
            errors.append("Event outside its owner")
        if event.state == "grounded" and owner_unit.review_state != "inspected":
            errors.append("Grounded event requires an inspected owner")
        if event.state == "grounded" and not any(
            e in proofs and proofs[e].source_kind == "code" and contains(proofs[e].span, event.span)
            for e in event.evidence_ids
        ):
            errors.append("Grounded event requires covering read_code evidence")
        key = (event.responsibility_id, event.semantic_order)
        if key in orders:
            errors.append("Duplicate semantic order")
        orders.add(key)
        span_key = (event.span.file_id, event.span.start_line, event.span.end_line, event.concept_key)
        if span_key in spans:
            errors.append("Same code decision counted twice")
        spans.add(span_key)
        if sum(e.unit_id == event.unit_id for e in candidate.events) > 24:
            errors.append("Unit exceeds 24 events")
    for signal in candidate.review_signals:
        if (
            not signal.unit_ids
            or not signal.evidence_ids
            or any(u not in units for u in signal.unit_ids)
            or any(e not in {item.event_id for item in candidate.events} for e in signal.event_ids)
            or any(e not in proofs for e in signal.evidence_ids)
        ):
            errors.append("Review signal requires known units, events and read evidence")
        if not any(e in proofs and proofs[e].source_kind == "code" for e in signal.evidence_ids):
            errors.append("Review signal requires code evidence")
        if signal.verdict == "concern" and not signal.event_ids:
            errors.append("Audible concern requires a grounded meaning event")
        if signal.verdict == "concern" and (
            not signal.change_scenario or not signal.alternative_evidence_ids
        ):
            errors.append(
                "Audible concern requires a concrete change scenario and checked alternative evidence"
            )
        if any(e not in proofs or e not in signal.evidence_ids for e in signal.alternative_evidence_ids):
            errors.append("Alternative evidence must be an actual read included in the signal")
        for unit_id in signal.unit_ids:
            if unit_id in units and not any(
                e in proofs and contains(proofs[e].span, units[unit_id].primary_span)
                for e in signal.evidence_ids
            ):
                errors.append("Review signal requires evidence covering its selected units")
        if any(
            e.event_id in signal.event_ids and (e.state != "grounded" or e.unit_id not in signal.unit_ids)
            for e in candidate.events
        ):
            errors.append("Review signal events must be grounded in its selected units")
    if len({s.signal_id for s in candidate.review_signals}) != len(candidate.review_signals):
        errors.append("Duplicate review signal IDs")
    if errors:
        raise GrooveError("INVALID_ANALYSIS", "; ".join(errors[:10]))


def validate_investigation(candidate: InvestigationCandidate, evidence: list[Evidence], base: dict) -> None:
    proofs = {e.evidence_id for e in evidence} | {e["evidence_id"] for e in base["evidence"]}
    fresh = {e.evidence_id for e in evidence}
    if not fresh or not any(e.source_kind == "code" for e in evidence):
        raise GrooveError("INVALID_EVIDENCE", "追加調査には新しいコード読取が必要です。")
    for finding in candidate.findings:
        if not finding.evidence_ids or any(e not in proofs for e in finding.evidence_ids):
            raise GrooveError("INVALID_EVIDENCE", "結論に有効な根拠が必要です。")
    for item in candidate.suggested_reclassification:
        original = next((e for e in base["events"] if e["event_id"] == item.event_id), None)
        if (
            not original
            or original["responsibility_id"] != item.from_responsibility_id
            or any(e not in proofs for e in item.evidence_ids)
        ):
            raise GrooveError("INVALID_ANALYSIS", "再分類対象または根拠が不正です。")
