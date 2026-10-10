"""Publish validated, already completed local runs; makes no model requests."""

import argparse
import importlib.util
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/backend"))
from code_groove.schemas import Evidence, InvestigationCandidate, SemanticMap  # noqa: E402
from code_groove.session_inspection import project_recorded_draft, recorded_session_inspection  # noqa: E402
from code_groove.source import run_node  # noqa: E402


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--investigation", required=True)
    parser.add_argument("--corrects")
    args = parser.parse_args()
    local = ROOT / ".local/tsugiai-session-evaluation"
    target = ROOT / "fixtures/recorded-live/tsugiai-session-inspection.json"
    if target.exists():
        raise RuntimeError("Recording exists; explicitly version it rather than overwriting")
    checker_spec = importlib.util.spec_from_file_location(
        "representation", ROOT / "scripts/evaluate-shared-rules.py"
    )
    checker = importlib.util.module_from_spec(checker_spec)
    checker_spec.loader.exec_module(checker)
    case = read(ROOT / "evaluations/tsugiai-session-explicit-v1.json")
    initial = read(local / "current-1/bundle.json")
    completed = [
        r
        for r in read(local / "budget.json")["runs"]
        if r["name"].startswith("investigation-") and r["status"] == "completed"
    ]
    if not any(r["name"] == args.investigation for r in completed):
        raise RuntimeError("Use a completed investigation, preserving all earlier failures")
    folder = local / args.investigation
    result = read(folder / "result.json")
    if result["status"] != "completed":
        raise RuntimeError("Investigation did not complete; never publish a substitute")
    candidate = InvestigationCandidate.model_validate(read(folder / "candidate.json"))
    evidence = [Evidence.model_validate(e) for e in read(folder / "evidence.json")]
    semantic = project_recorded_draft(initial["map"], candidate, evidence)
    semantic.update(
        analysis_id="analysis_" + uuid.uuid4().hex,
        parent_analysis_id=initial["map"]["analysis_id"],
        interpretation_update_version="investigation-v2-grounded-event-updates",
        analysis_depth="focused",
        created_at=result["finished_at"],
    )
    SemanticMap.model_validate(semantic)
    kit = read(ROOT / "apps/web/public/audio/midnight-jazz-v4/manifest.json")
    draft = {
        **initial,
        "map": semantic,
        "score": run_node("groove-core", {"map": semantic, "kit_hash": kit["kit_hash"]}),
        "trace": read(folder / "trace.json"),
        "interpretation_status": "investigation_draft_not_published",
    }
    draft_check = checker.inspect_representation(case, draft)
    if not draft_check["checks"][0]["comparable_by_covering_saved_key"]:
        raise RuntimeError("The five complete preconditions are not represented; never publish a substitute")
    trials = []
    checks = []
    names = [f"{kind}-{i}" for i in range(1, 4) for kind in ("current", "baseline")]
    names += [
        r["name"] for r in read(local / "budget.json")["runs"] if r["name"].startswith("investigation-")
    ]
    for name in names:
        trial = read(local / name / "result.json")
        entry = {
            "name": name,
            "status": trial["status"],
            "model": trial["model"],
            "prompt_version": trial["prompt_version"],
            "runtime_version": trial.get("runtime_version", "bounded-loop-v1-all-tool-schemas"),
            "started_at": trial["started_at"],
            "finished_at": trial["finished_at"],
            **trial["usage"],
            "seconds": trial["seconds"],
        }
        if trial["status"] != "completed":
            entry["error_code"] = str(trial.get("error_code") or trial["error_type"])
        elif name.startswith("baseline"):
            entry["review"] = read(local / name / "answer.json")["review"]
        elif name.startswith("current"):
            check = checker.inspect_representation(case, read(local / name / "bundle.json"))
            check["evaluation_run"] = name
            check["current_agent_evaluation"] = "completed"
            checks.append(check)
            entry.update(
                shared_occurrences=check["checks"][0]["occurrences_with_covering_events"],
                comparable=check["checks"][0]["comparable_by_covering_saved_key"],
            )
        if name.startswith("investigation"):
            entry["selection"] = trial.get(
                "selection", {"question": "initial broad follow-up; source reads exceeded boundary"}
            )
            entry["trace"] = read(local / name / "trace.json")
            if trial["status"] == "completed":
                proposal = InvestigationCandidate.model_validate(read(local / name / "candidate.json"))
                fresh_evidence = [Evidence.model_validate(e) for e in read(local / name / "evidence.json")]
                projected = project_recorded_draft(initial["map"], proposal, fresh_evidence)
                check = checker.inspect_representation(case, {**initial, "map": projected})
                check.update(
                    evaluation_run=name, current_agent_evaluation="completed_after_focused_follow_up"
                )
                checks.append(check)
                entry.update(
                    shared_occurrences=check["checks"][0]["occurrences_with_covering_events"],
                    comparable=check["checks"][0]["comparable_by_covering_saved_key"],
                    candidate=proposal.model_dump(mode="json"),
                )
                if entry["comparable"] and name not in (args.investigation, args.corrects):
                    raise RuntimeError("Use the first investigation covering all five preconditions")
        trials.append(entry)
    draft_check["evaluation_run"] = args.investigation
    draft_check["current_agent_evaluation"] = "completed_after_focused_follow_up"
    checks = [c for c in checks if c["evaluation_run"] != args.investigation] + [draft_check]
    ledger = read(local / "budget.json")
    evaluation = {
        "trials": trials,
        "representation_checks": checks,
        "selected_initial_trial": "current-1",
        "selection_reason": "最初に完了した試行を親版に固定しました。最良回の選別ではありません。",
        "selected_investigation": args.investigation,
        "investigation_selection_reason": f"5条件の対応が成立した先行案{args.corrects or 'なし'}から、初回の誤ったガード行指定も訂正した開発用の案です。先行案と全失敗も記録しています。",
        "summary": f"現行Agentは3回とも初回の共有対応を作れませんでした。通常レビューは2回完了し、1回はGCPの429で失敗しました。成功した通常レビューも主要な確認箇所と例外を説明しています。追加調査は{len(completed) + sum(t['name'].startswith('investigation-') and t['status'] == 'failed' for t in trials)}回試行し、読取範囲の限定と実行処理の修正を経て完了しました。Agentが通常レビューより優れているという結果ではありません。",
        "limitations": [
            "開発用1題材、参照表はソース照合済みのAgent草案で、人による独立評価は未実施",
            "通常レビューは自由記述のため音への構造化対応は評価対象外。対応0件を診断の誤り数とは扱わない",
            "同じモデル・資料・読取手段・予算上限を使用。現行Agentには既存の一時エラー再試行があり、通常レビューにはない",
            "追加調査には対象の前提契約と根拠位置を示す補助質問を与えた。自力の初回発見と区別する",
            "investigation-9は提出検証を通過したが、正しい条件範囲全体を表していなかった。行番号付き読取と明示した範囲の補助後に再評価した",
            "行の引用精度と解釈妥当性の独立採点、未使用ケース、知覚的識別、音あり・なしの効果は未評価",
        ],
        "reserved_max_yen": sum(r["reserved_max_yen"] for r in ledger["runs"]),
        "estimated_introductory_usd": sum(r.get("estimated_introductory_usd", 0) for r in ledger["runs"]),
        "human_sound_effect": "not_measured",
        "reference_ratification": "pending",
    }
    value = {
        "case": case,
        "initial_bundle": initial,
        "draft_bundle": draft,
        "investigation": {
            "candidate": candidate.model_dump(mode="json"),
            "evidence": [e.model_dump(mode="json") for e in evidence],
            "trace": read(folder / "trace.json"),
        },
        "evaluation": evaluation,
    }
    write(target, value)
    try:
        recorded_session_inspection()
    except Exception:
        target.unlink()
        raise
    write(ROOT / "evaluations/tsugiai-session-results-v1.json", {"case_id": case["case_id"], **evaluation})
    print(
        json.dumps(
            {
                "recorded": True,
                "draft_representation": draft_check["checks"],
                "reserved_max_yen": evaluation["reserved_max_yen"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
