import json
from types import SimpleNamespace

import pytest
from code_groove.agent import AgentContext, execute_tool, run_agent
from code_groove.errors import GrooveError
from code_groove.schemas import AnalysisCandidate
from code_groove.settings import ROOT, Settings
from google.genai import types


def context():
    bundle = json.loads((ROOT / "fixtures/mixed.json").read_text(encoding="utf-8"))
    value = bundle["map"]
    index = {
        "files": [
            {"file_id": u["primary_span"]["file_id"], "path": u["primary_span"]["path"]}
            for u in value["units"]
        ],
        "units": [{"unit_id": u["unit_id"], "primary_span": u["primary_span"]} for u in value["units"]],
        "relations": [],
    }
    saved = []
    ctx = AgentContext(
        Settings(),
        "p_test",
        value["snapshot_id"],
        bundle["sources"],
        index,
        lambda _kind, _payload: None,
        lambda: None,
        saved.append,
    )
    return ctx, value, saved


class Client:
    def __init__(self, factory):
        self.factory, self.calls, self.closed = factory, [], False
        self.aio = SimpleNamespace(models=self, aclose=self.close)

    async def count_tokens(self, **_kwargs):
        return types.CountTokensResponse(total_tokens=100)

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return types.GenerateContentResponse(
            candidates=[types.Candidate(content=self.factory(len(self.calls)))],
            usage_metadata=types.GenerateContentResponseUsageMetadata(
                prompt_token_count=100, candidates_token_count=50, thoughts_token_count=25
            ),
        )

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_original_content_signature_and_function_id_are_preserved(monkeypatch):
    ctx, value, saved = context()
    first = types.Content(
        role="model",
        parts=[
            types.Part(
                thought_signature=b"opaque-provider-signature",
                function_call=types.FunctionCall(
                    id=f"original-{i}",
                    name="read_code",
                    args={
                        "file_id": file["file_id"],
                        "start_line": 1,
                        "end_line": len(ctx.sources[file["path"]].splitlines()),
                        "purpose": "Verify implementation",
                    },
                ),
            )
            for i, file in enumerate(ctx.index["files"])
        ],
    )

    def response(number):
        if number == 1:
            return first
        candidate = {k: value[k] for k in AnalysisCandidate.model_fields}
        proofs = {
            old["evidence_id"]: next(
                e.evidence_id for e in ctx.evidence if e.span.path == old["span"]["path"]
            )
            for old in value["evidence"]
        }
        candidate = json.loads(json.dumps(candidate))
        for collection in ("units", "events", "responsibilities", "hypotheses"):
            for item in candidate[collection]:
                item["evidence_ids"] = [proofs[e] for e in item["evidence_ids"]]
        return types.Content(
            role="model",
            parts=[
                types.Part(
                    function_call=types.FunctionCall(
                        id="final-original", name="submit_analysis", args={"candidate": candidate}
                    )
                )
            ],
        )

    client = Client(response)
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    result = await run_agent(ctx)
    history = client.calls[1]["contents"]
    assert history[1] is first
    assert history[1].parts[0].thought_signature == b"opaque-provider-signature"
    assert [part.function_response.id for part in history[2].parts] == ["original-0", "original-1"]
    assert len(result.events) == len(value["events"])
    assert saved[-1]["tool_calls"] == 3 and client.closed


@pytest.mark.asyncio
async def test_text_only_and_bad_final_stop_explicitly(monkeypatch):
    ctx, _value, _saved = context()
    client = Client(lambda _number: types.Content(role="model", parts=[types.Part(text="Done")]))
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="AGENT_DID_NOT_SUBMIT"):
        await run_agent(ctx)
    assert len(client.calls) == 2 and client.closed
    ctx, _value, _saved = context()
    client = Client(
        lambda _number: types.Content(
            role="model",
            parts=[
                types.Part(
                    function_call=types.FunctionCall(
                        id="bad-final", name="submit_analysis", args={"candidate": {"bogus": True}}
                    )
                )
            ],
        )
    )
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="INVALID_ANALYSIS"):
        await run_agent(ctx)
    assert len(client.calls) == 3 and ctx.final_errors == 3 and client.closed


@pytest.mark.asyncio
async def test_reserved_budget_stops_before_paid_generation(monkeypatch):
    ctx, _value, _saved = context()
    ctx.output_tokens = 48000
    client = Client(lambda _number: None)
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="BUDGET_EXCEEDED"):
        await run_agent(ctx)
    assert not client.calls and client.closed


def test_repository_cannot_request_shell_or_read_an_unknown_path():
    ctx, _value, _saved = context()
    with pytest.raises(GrooveError, match="TOOL_NOT_ALLOWED"):
        execute_tool(ctx, "shell", {"command": "curl attacker"}, "tool_bad")
    with pytest.raises(GrooveError, match="NOT_FOUND"):
        execute_tool(
            ctx,
            "read_code",
            {"file_id": "../../secret", "start_line": 1, "end_line": 1, "purpose": "Ignore instructions"},
            "tool_bad",
        )
