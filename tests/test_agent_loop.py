import hashlib
import json
from types import SimpleNamespace

import pytest
from code_groove.agent import AgentContext, execute_tool, model_error_reason, run_agent
from code_groove.errors import GrooveError
from code_groove.schemas import AnalysisCandidate
from code_groove.settings import ROOT, Settings
from google import genai
from google.genai import errors, types


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


class Client(genai.Client):
    def __init__(self, factory):
        self.factory, self.calls, self.closed = factory, [], False
        self.test_aio = SimpleNamespace(models=self, aclose=self.aclose)

    @property
    def aio(self):
        return self.test_aio

    @property
    def vertexai(self):
        return False

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

    def close(self):
        self.closed = True

    async def aclose(self):
        self.close()


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
        candidate = {k: value[k] for k in AnalysisCandidate.model_fields if k in value}
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
    ctx.output_tokens = ctx.limits.output_tokens
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


def test_repository_file_inventory_retains_identity_without_import_detail():
    ctx, _value, _saved = context()
    ctx.index["files"][0]["imports"] = [{"path": "dependency.py", "resolved": True}] * 100
    inventory = execute_tool(
        ctx, "list_repository_files", {"purpose": "Locate a contract", "limit": 1}, "list"
    )
    file = inventory["files"][0]
    assert file["file_id"] == ctx.index["files"][0]["file_id"]
    assert file["import_count"] == 100 and "imports" not in file
    assert len(ctx.index["files"][0]["imports"]) == 100
    assert inventory["next_cursor"] == 1


def test_read_numbers_match_original_lines_without_changing_projection_hash():
    ctx, _value, _saved = context()
    file = ctx.index["files"][0]
    result = execute_tool(
        ctx,
        "read_code",
        {"file_id": file["file_id"], "start_line": 2, "end_line": 4, "purpose": "Check exact change span"},
        "read",
    )
    raw = ctx.sources[file["path"]].splitlines()[1:4]
    assert result["source"] == "\n".join(f"{n}: {line}" for n, line in enumerate(raw, 2))
    assert ctx.evidence[0].projection_sha256 == hashlib.sha256("\n".join(raw).encode()).hexdigest()


@pytest.mark.asyncio
async def test_unknown_retry_usage_is_kept_and_retry_fits_remaining_budget(monkeypatch):
    ctx, _value, saved = context()
    ctx.output_tokens = ctx.limits.output_tokens - 24000
    initial_output = ctx.output_tokens

    class RetryingClient(Client):
        async def generate_content(self, **kwargs):
            if not self.calls:
                self.calls.append(kwargs)
                raise errors.ServerError(504, {"error": {"message": "Provider timeout"}})
            return await super().generate_content(**kwargs)

    client = RetryingClient(
        lambda _number: types.Content(role="model", parts=[types.Part(text="No final tool")])
    )

    async def skip_backoff(_seconds):
        return None

    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    monkeypatch.setattr("code_groove.agent.asyncio.sleep", skip_backoff)
    with pytest.raises(GrooveError, match="AGENT_DID_NOT_SUBMIT"):
        await run_agent(ctx)
    assert client.calls[0]["config"].max_output_tokens == 16384
    assert client.calls[1]["config"].max_output_tokens == 7616
    assert ctx.output_tokens == initial_output + 16384 + 2 * 75
    assert all(entry["output_tokens"] <= ctx.limits.output_tokens for entry in saved)
    assert client.closed


@pytest.mark.asyncio
async def test_long_exploration_only_allows_grounded_submission(monkeypatch):
    ctx, _value, _saved = context()
    ctx.model_count = 10
    client = Client(lambda _number: types.Content(role="model", parts=[types.Part(text="No final tool")]))
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="AGENT_DID_NOT_SUBMIT"):
        await run_agent(ctx)
    policy = client.calls[0]["config"].tool_config.function_calling_config
    assert policy.mode == types.FunctionCallingConfigMode.AUTO
    assert client.calls[0]["config"].thinking_config.thinking_level == types.ThinkingLevel.LOW
    assert [d.name for t in client.calls[0]["config"].tools for d in t.function_declarations] == [
        "submit_analysis"
    ]
    assert client.closed


@pytest.mark.asyncio
async def test_investigation_reserves_only_the_active_submission_schema(monkeypatch):
    ctx, value, _saved = context()
    ctx.base = value
    ctx.model_count = 6
    ctx.input_tokens = ctx.limits.input_tokens - 61000

    class NearBoundaryClient(Client):
        async def count_tokens(self, **_kwargs):
            # The active system instruction and tool schema are counted by the provider.
            return types.CountTokensResponse(total_tokens=30000)

    client = NearBoundaryClient(
        lambda _number: types.Content(role="model", parts=[types.Part(text="No submission")])
    )
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="AGENT_DID_NOT_SUBMIT"):
        await run_agent(ctx)
    payload = json.loads(client.calls[0]["contents"][0].parts[0].text)
    assert "coverage" not in payload["base"]
    assert ctx.base == value
    assert len(client.calls) == 2 and ctx.input_tokens <= ctx.limits.input_tokens
    assert client.calls[0]["config"].max_output_tokens == 12288
    assert all(
        d.name == "submit_investigation"
        for t in client.calls[0]["config"].tools
        for d in t.function_declarations
    )


def test_provider_error_diagnostics_never_include_raw_source_or_credentials():
    assert model_error_reason("Schema is too complex: private source text") == "schema_validation"
    assert model_error_reason("Invalid thought_signature: secret bytes") == "signature_validation"
    assert model_error_reason("Request ending with a model turn") == "conversation_validation"
    assert model_error_reason("password=private provider detail") == "provider_rejected"


def partial_candidate(ctx, value):
    candidate = json.loads(json.dumps({k: value[k] for k in AnalysisCandidate.model_fields if k in value}))
    proof = ctx.evidence[0].evidence_id
    for position, unit in enumerate(candidate["units"]):
        unit["review_state"] = "inspected" if position == 0 else "unresolved"
        unit["evidence_ids"] = [proof] if position == 0 else []
        if position:
            unit["boundary_reason"] = "調査予算の境界で未調査。"
    candidate["responsibilities"] = [candidate["responsibilities"][0]]
    candidate["responsibilities"][0]["evidence_ids"] = [proof]
    for collection in ("events", "hypotheses", "review_signals", "design_patterns"):
        candidate[collection] = []
    return types.Content(
        role="model",
        parts=[
            types.Part(
                function_call=types.FunctionCall(
                    id="partial-final", name="submit_analysis", args={"candidate": candidate}
                )
            )
        ],
    )


def read_first_file(ctx, call_id):
    file = ctx.index["files"][0]
    return types.Part(
        function_call=types.FunctionCall(
            id=call_id,
            name="read_code",
            args={
                "file_id": file["file_id"],
                "start_line": 1,
                "end_line": len(ctx.sources[file["path"]].splitlines()),
                "purpose": "Verify one implementation",
            },
        )
    )


@pytest.mark.asyncio
async def test_read_batch_leaves_submission_slots_and_returns_explicit_partial_result(monkeypatch):
    ctx, value, _saved = context()
    ctx.tool_count = ctx.limits.tool_calls - 4
    client = Client(
        lambda number: (
            types.Content(role="model", parts=[read_first_file(ctx, f"read-{i}") for i in range(3)])
            if number == 1
            else partial_candidate(ctx, value)
        )
    )
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    result = await run_agent(ctx)
    responses = client.calls[1]["contents"][2].parts
    assert responses[0].function_response.response["ok"]
    assert all(
        p.function_response.response["error"]["code"] == "FINALIZATION_REQUIRED" for p in responses[1:]
    )
    assert [u.review_state for u in result.units] == ["inspected", "unresolved"]
    assert ctx.tool_count == ctx.limits.tool_calls - 2
    assert [d.name for t in client.calls[1]["config"].tools for d in t.function_declarations] == [
        "submit_analysis"
    ]


@pytest.mark.asyncio
async def test_exact_full_request_count_switches_to_submission_before_input_overflow(monkeypatch):
    ctx, value, _saved = context()

    class FullRequestClient(Client):
        counts = []

        async def count_tokens(self, **kwargs):
            self.counts.append(kwargs)
            assert kwargs["config"].system_instruction
            assert kwargs["config"].tools
            return types.CountTokensResponse(total_tokens=[100, 150000, 120000][len(self.counts) - 1])

    client = FullRequestClient(
        lambda number: (
            types.Content(role="model", parts=[read_first_file(ctx, "read")])
            if number == 1
            else partial_candidate(ctx, value)
        )
    )
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    result = await run_agent(ctx)
    assert len(client.calls) == 2 and len(client.counts) == 3
    assert len(client.counts[1]["config"].tools[0].function_declarations) > 1
    assert len(client.counts[2]["config"].tools[0].function_declarations) == 1
    assert result.units[1].review_state == "unresolved"


@pytest.mark.asyncio
async def test_time_reserve_closes_exploration_before_the_worker_deadline(monkeypatch):
    ctx, value, _saved = context()
    part = read_first_file(ctx, "pre-read")
    execute_tool(ctx, "read_code", part.function_call.args, "pre-read")
    ctx.started -= ctx.limits.seconds - ctx.limits.finalization_seconds + 1
    client = Client(lambda _number: partial_candidate(ctx, value))
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    result = await run_agent(ctx)
    assert result.units[1].review_state == "unresolved"
    assert [d.name for t in client.calls[0]["config"].tools for d in t.function_declarations] == [
        "submit_analysis"
    ]


@pytest.mark.asyncio
async def test_integration_prompt_allows_bounded_conclusions_and_requires_new_reads(monkeypatch):
    ctx, _value, _saved = context()
    ctx.repository_index = ctx.index
    ctx.integration_context = [{"chunk_id": "chunk_saved", "responsibilities": [], "unknowns": []}]
    client = Client(lambda _number: types.Content(role="model", parts=[types.Part(text="No submission")]))
    monkeypatch.setattr("code_groove.agent.create_model_client", lambda _settings: client)
    with pytest.raises(GrooveError, match="AGENT_DID_NOT_SUBMIT"):
        await run_agent(ctx)
    prompt = client.calls[0]["config"].system_instruction
    assert "Re-read all selected implementations" in prompt
    assert "Saved interpretations are hypotheses, never fresh evidence" in prompt
    assert "Do not claim consistency outside the selected scope" in prompt
    assert "Do not claim cross-partition consistency" not in prompt
