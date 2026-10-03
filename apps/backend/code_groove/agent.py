import asyncio
import hashlib
import json
import random
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from google.genai import errors, types
from pydantic import Field, ValidationError

from code_groove.errors import GrooveError
from code_groove.improvements import apply_edits
from code_groove.model_client import create_model_client
from code_groove.schemas import (
    AnalysisCandidate,
    Contract,
    Evidence,
    Hypothesis,
    ImprovementCandidate,
    InvestigationCandidate,
    Span,
)
from code_groove.settings import ROOT, Settings
from code_groove.source import build_index
from code_groove.validation import validate_candidate, validate_investigation


class PurposeArgs(Contract):
    purpose: str = Field(min_length=1, max_length=160)


class ListArgs(PurposeArgs):
    cursor: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=50, ge=1, le=50, strict=True)


class ReadArgs(PurposeArgs):
    file_id: str
    start_line: int = Field(ge=1, strict=True)
    end_line: int = Field(ge=1, strict=True)


class SearchArgs(PurposeArgs):
    query: str = Field(min_length=1, max_length=120)
    path_prefix: str = Field(default="", max_length=240)
    limit: int = Field(default=20, ge=1, le=20, strict=True)
    cursor: int = Field(default=0, ge=0, strict=True)


class RelationsArgs(PurposeArgs):
    unit_id: str
    direction: str = Field(pattern=r"^(callers|callees|tests)$")
    cursor: int = Field(default=0, ge=0, strict=True)


class HypothesisArgs(Contract):
    statement: str = Field(max_length=160)
    counter_question: str = Field(max_length=160)
    evidence_ids: list[str] = Field(max_length=96)
    status: str = Field(pattern=r"^(open|supported|rejected|undetermined)$")


class ProgressArgs(Contract):
    message: str = Field(min_length=1, max_length=120)


@dataclass
class AgentContext:
    settings: Settings
    project_id: str
    snapshot_id: str
    sources: dict[str, str]
    index: dict
    emit: Callable[[str, dict], None]
    guard: Callable[[], None]
    save_usage: Callable[[dict], None]
    base: dict | None = None
    cached_interpretation: dict | None = None
    changes: dict | None = None
    selection: dict | None = None
    proposing: bool = False
    analysis_depth: Literal["overview", "focused"] = "overview"
    prior_motifs: list[dict] = field(default_factory=list)
    repository_index: dict | None = None
    evidence: list[Evidence] = field(default_factory=list)
    hypotheses: list[Hypothesis] = field(default_factory=list)
    reads: Counter = field(default_factory=Counter)
    tool_count: int = 0
    model_count: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    final_errors: int = 0
    started: float = field(default_factory=time.monotonic)

    @property
    def investigating(self):
        return self.base is not None

    def check(self):
        self.guard()
        if time.monotonic() - self.started > (180 if self.investigating else 480):
            raise GrooveError("MODEL_TIMEOUT", "調査の制限時間を超えました。", 408)


TOOL_ARGS: dict[str, type[Contract]] = {
    "list_units": ListArgs,
    "list_repository_files": ListArgs,
    "read_code": ReadArgs,
    "search_code": SearchArgs,
    "inspect_relations": RelationsArgs,
    "record_hypothesis": HypothesisArgs,
    "update_progress": ProgressArgs,
}


def inline_schema(schema: dict) -> dict:
    definitions = schema.get("$defs", {})

    def walk(value):
        if isinstance(value, list):
            return [walk(v) for v in value]
        if not isinstance(value, dict):
            return value
        if "$ref" in value:
            return walk(definitions[value["$ref"].split("/")[-1]])
        return {
            k: {name: walk(item) for name, item in v.items()} if k == "properties" else walk(v)
            for k, v in value.items()
            if k not in ("$defs", "title", "additionalProperties", "default")
        }

    return walk(schema)


def declarations(investigating: bool, proposing: bool = False) -> list[types.FunctionDeclaration]:
    result = [
        types.FunctionDeclaration(
            name=name,
            description=f"Authorized read-only repository tool: {name}",
            parameters_json_schema=inline_schema(model.model_json_schema()),
        )
        for name, model in TOOL_ARGS.items()
    ]
    name = "submit_proposal" if proposing else "submit_investigation" if investigating else "submit_analysis"
    model = (
        ImprovementCandidate if proposing else InvestigationCandidate if investigating else AnalysisCandidate
    )
    result.append(
        types.FunctionDeclaration(
            name=name,
            description="Submit the grounded candidate, alone in a batch.",
            parameters_json_schema={
                "type": "object",
                "properties": {"candidate": inline_schema(model.model_json_schema())},
                "required": ["candidate"],
            },
        )
    )
    return result


def model_error_reason(message: str | None) -> str:
    text = (message or "").lower()
    for fragment, reason in (
        ("signature", "signature_validation"),
        ("schema", "schema_validation"),
        ("turn", "conversation_validation"),
        ("thinking", "thinking_configuration"),
        ("function", "tool_configuration"),
        ("tool", "tool_configuration"),
    ):
        if fragment in text:
            return reason
    return "provider_rejected"


def execute_tool(ctx: AgentContext, name: str, args: dict, event_id: str) -> Any:
    ctx.check()
    if ctx.tool_count >= (20 if ctx.investigating else 48):
        raise GrooveError("BUDGET_EXCEEDED", "ツール呼び出し上限に達しました。", 429)
    ctx.tool_count += 1
    ctx.save_usage(
        {
            "model_requests": ctx.model_count,
            "tool_calls": ctx.tool_count,
            "input_tokens": ctx.input_tokens,
            "output_tokens": ctx.output_tokens,
        }
    )
    if name in ("submit_analysis", "submit_investigation", "submit_proposal"):
        try:
            candidate: Any
            if set(args) != {"candidate"}:
                raise GrooveError("INVALID_ANALYSIS", "candidateだけを提出してください。")
            if name == "submit_proposal" and ctx.proposing:
                candidate = ImprovementCandidate.model_validate(args["candidate"])
                assert ctx.base is not None
                signals = {s["signal_id"] for s in ctx.base.get("review_signals", [])}
                if not candidate.signal_ids or any(s not in signals for s in candidate.signal_ids):
                    raise GrooveError("INVALID_PROPOSAL", "既存の診断に結び付く改善案が必要です。")
                changed = apply_edits(candidate, ctx.sources, ctx.evidence)
                proposed_index = build_index(
                    ctx.snapshot_id, changed, repository=ctx.repository_index is not None
                )
                if any(
                    not item["resolved"] and item["module"].startswith(".")
                    for file in proposed_index["files"]
                    for item in file.get("imports", [])
                ):
                    raise GrooveError("INVALID_PROPOSAL", "ローカル参照先のないimportは提案できません。")
                ctx.check()
            elif name == "submit_analysis" and not ctx.investigating:
                candidate = AnalysisCandidate.model_validate(args["candidate"])
                validate_candidate(candidate, ctx.index, ctx.evidence)
                if {u.unit_id for u in candidate.units} != {u["unit_id"] for u in ctx.index["units"]}:
                    raise GrooveError("INVALID_ANALYSIS", "全unitを分類または未確認として含めてください。")
            elif name == "submit_investigation" and ctx.investigating and not ctx.proposing:
                candidate = InvestigationCandidate.model_validate(args["candidate"])  # type: ignore[assignment]
                assert ctx.base is not None
                validate_investigation(candidate, ctx.evidence, ctx.base)  # type: ignore[arg-type]
            else:
                raise GrooveError("INVALID_ANALYSIS", "このrunでは利用できない提出ツールです。")
            return candidate
        except (ValidationError, GrooveError):
            ctx.final_errors += 1
            if ctx.final_errors > 2:
                raise GrooveError("INVALID_ANALYSIS", "2回の修復で検証を通過できませんでした。") from None
            raise
    if name not in TOOL_ARGS:
        raise GrooveError("TOOL_NOT_ALLOWED", "許可されていないツールです。")
    parsed: Any = TOOL_ARGS[name].model_validate(args)
    source_index = ctx.repository_index or ctx.index
    files = {f["file_id"]: f for f in source_index["files"]}
    if isinstance(parsed, ListArgs):
        if name == "list_repository_files":
            rows = source_index["files"]
            return {
                "files": rows[parsed.cursor : parsed.cursor + parsed.limit],
                "truncated": len(rows) > parsed.cursor + parsed.limit,
                "next_cursor": parsed.cursor + parsed.limit
                if len(rows) > parsed.cursor + parsed.limit
                else None,
            }
        return {
            "units": ctx.index["units"][parsed.cursor : parsed.cursor + parsed.limit],
            "files": ctx.index["files"],
            "next_cursor": parsed.cursor + parsed.limit
            if len(ctx.index["units"]) > parsed.cursor + parsed.limit
            else None,
        }
    if isinstance(parsed, ReadArgs):
        file = files.get(parsed.file_id)
        if not file:
            raise GrooveError("NOT_FOUND", "索引に存在しないファイルです。", 404)
        lines = ctx.sources[file["path"]].splitlines()
        if (
            parsed.end_line < parsed.start_line
            or parsed.end_line > len(lines)
            or parsed.end_line - parsed.start_line >= 160
        ):
            raise GrooveError("INVALID_EVIDENCE", "有効な最大160行の範囲で読んでください。")
        key = (parsed.file_id, parsed.start_line, parsed.end_line)
        ctx.reads[key] += 1
        if ctx.reads[key] > 2:
            raise GrooveError("BUDGET_EXCEEDED", "同一範囲の読取は2回までです。", 429)
        source = "\n".join(lines[parsed.start_line - 1 : parsed.end_line])
        if len(source) > 12000:
            raise GrooveError("INVALID_EVIDENCE", "範囲を12,000文字以内に縮小してください。")
        evidence = Evidence(
            evidence_id=f"ev_{uuid.uuid4().hex}",
            snapshot_id=ctx.snapshot_id,
            span=Span(
                file_id=parsed.file_id,
                path=file["path"],
                start_line=parsed.start_line,
                end_line=parsed.end_line,
            ),
            projection_sha256=hashlib.sha256(source.encode()).hexdigest(),
            source_kind="test"
            if ".test." in file["path"]
            or ".spec." in file["path"]
            or "/tests/" in f"/{file['path']}"
            or file["path"].split("/")[-1].startswith("test_")
            else "code"
            if file["path"].endswith((".ts", ".tsx", ".py"))
            else "document",
            observation=parsed.purpose,
            created_by_tool_event_id=event_id,
        )
        ctx.evidence.append(evidence)
        return {
            "source": source,
            "span": evidence.span.model_dump(),
            "evidence_ids": [evidence.evidence_id],
            "untrusted_repository_data": True,
        }
    if isinstance(parsed, SearchArgs):
        matches = []
        for file in source_index["files"]:
            if not file["path"].startswith(parsed.path_prefix):
                continue
            for line, content in enumerate(ctx.sources[file["path"]].splitlines(), 1):
                if parsed.query in content:
                    matches.append(
                        {
                            "file_id": file["file_id"],
                            "path": file["path"],
                            "line": line,
                            "snippet": content[:240],
                        }
                    )
        return {
            "matches": matches[parsed.cursor : parsed.cursor + parsed.limit],
            "truncated": len(matches) > parsed.cursor + parsed.limit,
            "next_cursor": parsed.cursor + parsed.limit
            if len(matches) > parsed.cursor + parsed.limit
            else None,
        }
    if isinstance(parsed, RelationsArgs):
        unit = next((u for u in ctx.index["units"] if u["unit_id"] == parsed.unit_id), None)
        if not unit:
            raise GrooveError("NOT_FOUND", "unitが存在しません。", 404)
        if parsed.direction == "tests":
            candidates = [
                f
                for f in source_index["files"]
                if (
                    ".test." in f["path"]
                    or ".spec." in f["path"]
                    or f["path"].endswith(".py")
                    and ("tests/" in f["path"] or f["path"].split("/")[-1].startswith("test_"))
                )
                and unit["label"].split(".")[-1] in ctx.sources[f["path"]]
            ]
            return {
                "candidates": candidates[parsed.cursor : parsed.cursor + 20],
                "truncated": len(candidates) > parsed.cursor + 20,
                "next_cursor": parsed.cursor + 20 if len(candidates) > parsed.cursor + 20 else None,
                "resolved": False,
            }
        rows = [
            r
            for r in ctx.index["relations"]
            if r["caller" if parsed.direction == "callees" else "callee"] == parsed.unit_id
        ]
        return {
            "relations": rows[parsed.cursor : parsed.cursor + 20],
            "truncated": len(rows) > parsed.cursor + 20,
            "next_cursor": parsed.cursor + 20 if len(rows) > parsed.cursor + 20 else None,
        }
    if isinstance(parsed, HypothesisArgs):
        if any(e not in {p.evidence_id for p in ctx.evidence} for e in parsed.evidence_ids):
            raise GrooveError("INVALID_EVIDENCE", "仮説は読取済みの根拠を参照してください。")
        hypothesis = Hypothesis(hypothesis_id=f"hyp_{uuid.uuid4().hex}", **parsed.model_dump())
        ctx.hypotheses.append(hypothesis)
        ctx.emit("hypothesis_recorded", hypothesis.model_dump())
        return hypothesis.model_dump()
    ctx.emit("progress", {"message": parsed.message})
    return {"updated": True}


async def run_agent(ctx: AgentContext) -> Any:
    client = create_model_client(ctx.settings)
    prompt = (ROOT / "prompts/conductor-system-v1.txt").read_text(encoding="utf-8")
    if ctx.proposing:
        prompt = (ROOT / "prompts/improvement-system-v1.txt").read_text(encoding="utf-8")
    elif ctx.investigating:
        prompt += "\n" + (ROOT / "prompts/investigation-system-v1.txt").read_text(encoding="utf-8")
    payload = {
        "index": {
            **ctx.index,
            "relations": {"count": len(ctx.index["relations"]), "retrieve": "inspect_relations"},
        }
        if ctx.repository_index
        else ctx.index,
        "snapshot_id": ctx.snapshot_id,
        "analysis_depth": ctx.analysis_depth,
        "goal": "意味と所有境界を復元し、必要な反証を調べる",
        "limits": {"responsibilities": 6, "events": 96},
        "base": ctx.base,
        "selection": ctx.selection,
        "verified_unchanged_interpretation": ctx.cached_interpretation,
        "changes": ctx.changes,
        "prior_motif_assignments": ctx.prior_motifs,
    }
    if ctx.repository_index:
        prompt += "\nThis is a repository partition. Classify only the supplied units. Nested callbacks belong to their indexed lexical owner; use member_symbol_ids=[unit_id]. Repository context is static inventory, not a semantic verdict. Use list_repository_files/search_code/read_code to verify dependencies outside the partition. Do not claim cross-partition consistency or whole-repository completion. For long units read adjacent bounded ranges and cite all ranges covering the unit. Unit calls are paginated through inspect_relations."
    history = [types.Content(role="user", parts=[types.Part(text=json.dumps(payload, ensure_ascii=False))])]
    output_limit = 8192 if ctx.investigating else 16384
    max_input, max_output = (160000, 20000) if ctx.investigating else (400000, 48000)
    config = types.GenerateContentConfig(
        system_instruction=prompt,
        tools=[types.Tool(function_declarations=declarations(ctx.investigating, ctx.proposing))],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        max_output_tokens=output_limit,
    )
    text_only = 0
    try:
        while True:
            ctx.check()
            closing = (
                ctx.model_count >= (6 if ctx.investigating else 10)
                or max_output - ctx.output_tokens < output_limit + 4096
                or time.monotonic() - ctx.started > (110 if ctx.investigating else 300)
            )
            if closing:
                if config.tool_config is None:
                    history.append(
                        types.Content(
                            role="user",
                            parts=[
                                types.Part(
                                    text="The exploration boundary is reached. Submit concise grounded "
                                    "results using existing evidence. Mark unsupported units and claims "
                                    "as unknown; do not perform further reads."
                                )
                            ],
                        )
                    )
                final_name = (
                    "submit_proposal"
                    if ctx.proposing
                    else "submit_investigation"
                    if ctx.investigating
                    else "submit_analysis"
                )
                config.tools = [
                    types.Tool(
                        function_declarations=[
                            d for d in declarations(ctx.investigating, ctx.proposing) if d.name == final_name
                        ]
                    )
                ]
                config.tool_config = types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode=types.FunctionCallingConfigMode.AUTO,
                    )
                )
            try:
                counted = await asyncio.wait_for(
                    client.aio.models.count_tokens(model=ctx.settings.gemini_model, contents=history),
                    min(30, (180 if ctx.investigating else 480) - (time.monotonic() - ctx.started)),
                )
            except TimeoutError as exc:
                raise GrooveError("MODEL_TIMEOUT", "トークン計数がタイムアウトしました。", 504) from exc
            input_count = (
                int(counted.total_tokens or 0)
                + len(prompt) // 2
                + len(
                    json.dumps(
                        [d.model_dump(mode="json") for d in declarations(ctx.investigating, ctx.proposing)]
                    )
                )
                // 2
            )
            if (
                input_count > (32000 if ctx.investigating else 48000)
                or ctx.input_tokens + input_count > max_input
                or max_output - ctx.output_tokens < 1024
            ):
                raise GrooveError("BUDGET_EXCEEDED", "トークン予算に達しました。", 429)
            for retry in range(3):
                ctx.check()
                request_output_limit = min(output_limit, max_output - ctx.output_tokens)
                if ctx.input_tokens + input_count > max_input or request_output_limit < 1024:
                    raise GrooveError("BUDGET_EXCEEDED", "再試行のトークン予算に達しました。", 429)
                if ctx.model_count >= (8 if ctx.investigating else 18):
                    raise GrooveError("BUDGET_EXCEEDED", "モデル呼び出し上限に達しました。", 429)
                ctx.model_count += 1
                ctx.input_tokens += input_count
                ctx.output_tokens += request_output_limit
                ctx.save_usage(
                    {
                        "model_requests": ctx.model_count,
                        "tool_calls": ctx.tool_count,
                        "input_tokens": ctx.input_tokens,
                        "output_tokens": ctx.output_tokens,
                    }
                )
                try:
                    request_config = config.model_copy(deep=True)
                    request_config.max_output_tokens = request_output_limit
                    response = await asyncio.wait_for(
                        client.aio.models.generate_content(
                            model=ctx.settings.gemini_model,
                            contents=history,
                            config=request_config,
                        ),
                        min(95, (180 if ctx.investigating else 480) - (time.monotonic() - ctx.started)),
                    )
                    break
                except errors.APIError as exc:
                    if exc.code not in (429, 503, 504) or retry == 2:
                        ctx.emit(
                            "model_error",
                            {
                                "code": exc.code,
                                "error_type": type(exc).__name__,
                                "phase": "submission" if closing else "exploration",
                                "reason": model_error_reason(exc.message),
                            },
                        )
                        code = "MODEL_UNAVAILABLE" if exc.code in (401, 403, 404) else "MODEL_ERROR"
                        raise GrooveError(
                            code, "モデルの接続・権限・利用可能性を確認してください。", 503
                        ) from exc
                    ctx.emit("model_retry", {"code": exc.code, "attempt": retry + 1})
                    await asyncio.sleep(min(2**retry + random.random(), 4))
                except TimeoutError as exc:
                    raise GrooveError("MODEL_TIMEOUT", "モデル応答がタイムアウトしました。", 504) from exc
            usage = response.usage_metadata
            if usage:
                ctx.input_tokens += int(usage.prompt_token_count or 0) - input_count
                ctx.output_tokens += (
                    int(usage.candidates_token_count or 0)
                    + int(usage.thoughts_token_count or 0)
                    - request_output_limit
                )
            usage_data = {
                "model_requests": ctx.model_count,
                "tool_calls": ctx.tool_count,
                "input_tokens": ctx.input_tokens,
                "output_tokens": ctx.output_tokens,
            }
            ctx.save_usage(usage_data)
            ctx.emit("budget_updated", usage_data)
            if not response.candidates or not response.candidates[0].content:
                raise GrooveError("MODEL_BLOCKED", "モデルが有効な応答を返しませんでした。", 503)
            content = response.candidates[0].content
            history.append(content)
            calls = [p.function_call for p in content.parts or [] if p.function_call]
            if not calls:
                text_only += 1
                if text_only > 1:
                    raise GrooveError("AGENT_DID_NOT_SUBMIT", "Agentが検証済み結果を提出しませんでした。")
                history.append(
                    types.Content(
                        role="user",
                        parts=[types.Part(text="Submit via the final tool with grounded evidence.")],
                    )
                )
                continue
            response_parts = []
            for call in calls:
                ctx.check()
                if not call.name or not call.id:
                    raise GrooveError("INVALID_MODEL_CALL", "モデルの関数呼び出しIDを検証できません。")
                event_id = f"tool_{uuid.uuid4().hex}"
                purpose = str((call.args or {}).get("purpose", ""))[:160]
                ctx.emit("tool_started", {"tool": call.name, "purpose": purpose, "tool_event_id": event_id})
                started = time.monotonic()
                try:
                    if closing and call.name != (
                        "submit_proposal"
                        if ctx.proposing
                        else "submit_investigation"
                        if ctx.investigating
                        else "submit_analysis"
                    ):
                        raise GrooveError("FINALIZATION_REQUIRED", "取得済みの根拠で提出してください。")
                    if call.name.startswith("submit_") and len(calls) != 1:
                        raise GrooveError("FINALIZE_MUST_BE_ALONE", "提出は単独のbatchで行ってください。")
                    result = execute_tool(ctx, call.name, call.args or {}, event_id)
                    if isinstance(result, (AnalysisCandidate, InvestigationCandidate, ImprovementCandidate)):
                        ctx.check()
                        ctx.emit(
                            "tool_completed", {"tool": call.name, "purpose": "検証済み候補を提出", "ok": True}
                        )
                        return result
                    tool_response = {
                        "ok": True,
                        "data": result,
                        "evidence_ids": result.get("evidence_ids", []),
                        "budget_remaining": {
                            "tool_calls": (20 if ctx.investigating else 48) - ctx.tool_count,
                            "model_requests": (8 if ctx.investigating else 18) - ctx.model_count,
                            "output_tokens": max_output - ctx.output_tokens,
                            "seconds": max(
                                0,
                                round((180 if ctx.investigating else 480) - (time.monotonic() - ctx.started)),
                            ),
                            "finalize_next": closing,
                        },
                    }
                    ctx.emit(
                        "tool_completed",
                        {
                            "tool": call.name,
                            "purpose": purpose,
                            "evidence_ids": result.get("evidence_ids", []),
                            "target": result.get("span", {}),
                            "duration_ms": round((time.monotonic() - started) * 1000),
                            "ok": True,
                        },
                    )
                except (GrooveError, ValidationError) as exc:
                    if isinstance(exc, GrooveError) and (
                        exc.code == "BUDGET_EXCEEDED" or ctx.final_errors > 2
                    ):
                        raise
                    message = (
                        exc.message
                        if isinstance(exc, GrooveError)
                        else json.dumps([{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()[:10]])
                    )
                    code = exc.code if isinstance(exc, GrooveError) else "INVALID_ARGUMENTS"
                    tool_response = {"ok": False, "error": {"code": code, "message": message}}
                    ctx.emit(
                        "tool_failed",
                        {"tool": call.name, "code": code, "purpose": purpose, "validation": message[:1600]},
                    )
                response_parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            id=call.id, name=call.name, response=tool_response
                        )
                    )
                )
            history.append(types.Content(role="user", parts=response_parts))
    finally:
        await client.aio.aclose()
