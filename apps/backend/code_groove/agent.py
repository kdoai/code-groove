import asyncio
import hashlib
import json
import random
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable

from google.genai import errors, types
from pydantic import Field, ValidationError

from code_groove.errors import GrooveError
from code_groove.model_client import create_model_client
from code_groove.schemas import (
    AnalysisCandidate,
    Contract,
    Evidence,
    Hypothesis,
    InvestigationCandidate,
    Span,
)
from code_groove.settings import ROOT, Settings
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


def declarations(investigating: bool) -> list[types.FunctionDeclaration]:
    result = [
        types.FunctionDeclaration(
            name=name,
            description=f"Authorized read-only repository tool: {name}",
            parameters_json_schema=inline_schema(model.model_json_schema()),
        )
        for name, model in TOOL_ARGS.items()
    ]
    name = "submit_investigation" if investigating else "submit_analysis"
    model = InvestigationCandidate if investigating else AnalysisCandidate
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
    if name in ("submit_analysis", "submit_investigation"):
        try:
            if set(args) != {"candidate"}:
                raise GrooveError("INVALID_ANALYSIS", "candidateだけを提出してください。")
            if name == "submit_analysis" and not ctx.investigating:
                candidate = AnalysisCandidate.model_validate(args["candidate"])
                validate_candidate(candidate, ctx.index, ctx.evidence)
                if {u.unit_id for u in candidate.units} != {u["unit_id"] for u in ctx.index["units"]}:
                    raise GrooveError("INVALID_ANALYSIS", "全unitを分類または未確認として含めてください。")
            elif name == "submit_investigation" and ctx.investigating:
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
    files = {f["file_id"]: f for f in ctx.index["files"]}
    if isinstance(parsed, ListArgs):
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
            if ".test." in file["path"] or ".spec." in file["path"]
            else "code"
            if file["path"].endswith((".ts", ".tsx"))
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
        for file in ctx.index["files"]:
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
            return {
                "candidates": [
                    f
                    for f in ctx.index["files"]
                    if (
                        ".test." in f["path"]
                        or ".spec." in f["path"]
                        or f["path"].endswith(".py")
                        and ("tests/" in f["path"] or f["path"].split("/")[-1].startswith("test_"))
                    )
                    and unit["label"] in ctx.sources[f["path"]]
                ][:20],
                "resolved": False,
            }
        return {
            "relations": [
                r
                for r in ctx.index["relations"]
                if r["caller" if parsed.direction == "callees" else "callee"] == parsed.unit_id
            ][:20]
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
    if ctx.investigating:
        prompt += "\n" + (ROOT / "prompts/investigation-system-v1.txt").read_text(encoding="utf-8")
    payload = {
        "index": ctx.index,
        "snapshot_id": ctx.snapshot_id,
        "goal": "意味と所有境界を復元し、必要な反証を調べる",
        "limits": {"responsibilities": 6, "events": 96},
        "base": ctx.base,
        "selection": ctx.selection,
        "verified_unchanged_interpretation": ctx.cached_interpretation,
        "changes": ctx.changes,
    }
    history = [types.Content(role="user", parts=[types.Part(text=json.dumps(payload, ensure_ascii=False))])]
    output_limit = 8192 if ctx.investigating else 16384
    max_input, max_output = (160000, 20000) if ctx.investigating else (400000, 48000)
    config = types.GenerateContentConfig(
        system_instruction=prompt,
        tools=[types.Tool(function_declarations=declarations(ctx.investigating))],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        max_output_tokens=output_limit,
    )
    text_only = 0
    try:
        while True:
            ctx.check()
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
                + len(json.dumps([d.model_dump(mode="json") for d in declarations(ctx.investigating)])) // 2
            )
            if (
                input_count > (32000 if ctx.investigating else 48000)
                or ctx.input_tokens + input_count > max_input
                or ctx.output_tokens + output_limit > max_output
            ):
                raise GrooveError("BUDGET_EXCEEDED", "トークン予算に達しました。", 429)
            for retry in range(3):
                ctx.check()
                if (
                    ctx.input_tokens + input_count > max_input
                    or ctx.output_tokens + output_limit > max_output
                ):
                    raise GrooveError("BUDGET_EXCEEDED", "再試行のトークン予算に達しました。", 429)
                if ctx.model_count >= (8 if ctx.investigating else 18):
                    raise GrooveError("BUDGET_EXCEEDED", "モデル呼び出し上限に達しました。", 429)
                ctx.model_count += 1
                ctx.input_tokens += input_count
                ctx.output_tokens += output_limit
                ctx.save_usage(
                    {
                        "model_requests": ctx.model_count,
                        "tool_calls": ctx.tool_count,
                        "input_tokens": ctx.input_tokens,
                        "output_tokens": ctx.output_tokens,
                    }
                )
                try:
                    response = await asyncio.wait_for(
                        client.aio.models.generate_content(
                            model=ctx.settings.gemini_model,
                            contents=history,
                            config=config.model_copy(deep=True),
                        ),
                        min(95, (180 if ctx.investigating else 480) - (time.monotonic() - ctx.started)),
                    )
                    break
                except errors.APIError as exc:
                    if exc.code not in (429, 503, 504) or retry == 2:
                        ctx.emit("model_error", {"code": exc.code, "error_type": type(exc).__name__})
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
                    - output_limit
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
                    if call.name.startswith("submit_") and len(calls) != 1:
                        raise GrooveError("FINALIZE_MUST_BE_ALONE", "提出は単独のbatchで行ってください。")
                    result = execute_tool(ctx, call.name, call.args or {}, event_id)
                    if isinstance(result, (AnalysisCandidate, InvestigationCandidate)):
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
                            "tool_calls": (20 if ctx.investigating else 48) - ctx.tool_count
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
