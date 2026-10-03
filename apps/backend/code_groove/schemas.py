from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Id = Annotated[str, Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")]
Text = Annotated[str, Field(min_length=1, max_length=160)]
Ids = Annotated[list[Id], Field(max_length=96)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Span(Contract):
    file_id: Id
    path: str = Field(min_length=1, max_length=240)
    start_line: int = Field(ge=1, strict=True)
    end_line: int = Field(ge=1, strict=True)


class Evidence(Contract):
    evidence_id: Id
    snapshot_id: Id
    span: Span
    projection_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_kind: Literal["code", "test", "document"]
    observation: Text
    created_by_tool_event_id: Id


class Responsibility(Contract):
    responsibility_id: Id
    label: str = Field(min_length=1, max_length=24)
    definition: Text
    change_reason: str = Field(min_length=1, max_length=120)
    evidence_ids: Ids
    motif_id: Literal["M0", "M1", "M2", "M3", "M4", "M5"]
    display_order: int = Field(ge=0, strict=True)


class ImplementationUnit(Contract):
    unit_id: Id
    label: str = Field(min_length=1, max_length=80)
    primary_span: Span
    member_symbol_ids: Ids
    role: Literal["policy", "calculation", "adapter", "orchestrator", "other"]
    review_state: Literal["inspected", "unresolved", "excluded"]
    boundary_reason: Text
    evidence_ids: Ids


class MeaningEvent(Contract):
    event_id: Id
    concept_key: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=48)
    meaning: Text
    responsibility_id: Id
    unit_id: Id
    semantic_order: int = Field(ge=0, strict=True)
    kind: Literal["decision", "calculation", "update"]
    span: Span
    evidence_ids: Ids
    state: Literal["grounded", "unresolved"]


class Hypothesis(Contract):
    hypothesis_id: Id
    statement: Text
    counter_question: Text
    evidence_ids: Ids
    status: Literal["open", "supported", "rejected", "undetermined"]


class ExcludedPath(Contract):
    path: str
    reason: str


class Coverage(Contract):
    indexed_source_files: int = Field(ge=0)
    eligible_source_files: int = Field(ge=0)
    indexed_units: int = Field(ge=0)
    inspected_units: int = Field(ge=0)
    unresolved_unit_ids: Ids
    excluded_paths: list[ExcludedPath]
    inspected_line_ranges: list[Span]


class RepositoryProfile(Contract):
    title: str = Field(min_length=1, max_length=80)
    purpose: Text
    assumptions: list[Text] = Field(max_length=3)
    unknowns: list[Text] = Field(max_length=16)


class ReviewSignal(Contract):
    signal_id: Id
    category: Literal[
        "policy_scattering",
        "responsibility_mixing",
        "change_coupling",
        "data_flow_opacity",
        "justified_boundary",
    ]
    verdict: Literal["concern", "justified", "inconclusive"]
    label: str = Field(min_length=1, max_length=48)
    explanation: Text
    alternative: Text
    change_scenario: str = Field(default="", max_length=800)
    alternative_evidence_ids: Ids = Field(default_factory=list)
    unit_ids: Ids
    event_ids: Ids
    evidence_ids: Ids


class AnalysisCandidate(Contract):
    profile: RepositoryProfile
    responsibilities: list[Responsibility] = Field(min_length=1, max_length=6)
    units: list[ImplementationUnit] = Field(min_length=1, max_length=32)
    events: list[MeaningEvent] = Field(max_length=96)
    hypotheses: list[Hypothesis] = Field(max_length=16)
    review_signals: list[ReviewSignal] = Field(default_factory=list, max_length=12)


class SemanticMap(AnalysisCandidate):
    schema_version: Literal["1.0"]
    analysis_id: Id
    project_id: Id
    snapshot_id: Id
    parent_analysis_id: Id | None = None
    analysis_depth: Literal["overview", "focused"] = "focused"
    origin: Literal["live", "recorded_live", "fixture"]
    evidence: list[Evidence]
    coverage: Coverage
    model_id: str
    prompt_version: str
    created_at: str


class ScheduledNote(Contract):
    note_id: Id
    kind: Literal["data", "pulse", "accompaniment", "cue"]
    event_id: Id | None = None
    responsibility_id: Id | None = None
    unit_id: Id | None = None
    tick: int = Field(ge=0)
    duration_ms: int = Field(gt=0)
    voice: Literal["kick", "snare", "hat", "wood", "bass", "piano", "vibes"]
    midi: int | None = Field(default=None, ge=24, le=96)
    signal_id: Id | None = None
    variant: int = Field(ge=0, le=5)
    velocity: float = Field(ge=0, le=1)
    pan: float = Field(ge=-1, le=1)
    evidence_ids: Ids


class Phrase(Contract):
    phrase_id: Id
    start_bar: int = Field(ge=0)
    bar_count: int = Field(ge=1)
    label: str
    unit_id: Id | None = None
    responsibility_id: Id | None = None


class ScorePlan(Contract):
    mode: Literal["theme", "repo"]
    scene_id: Id
    grammar_version: Literal[
        "groove-v1",
        "groove-jazz-v2",
        "groove-rhythm-v3",
        "groove-arrangement-v4",
        "groove-chamber-v5",
        "groove-chamber-v6",
    ]
    kit_id: Literal["paper-studio-v1", "midnight-jazz-v2", "midnight-jazz-v3", "midnight-jazz-v4"]
    kit_hash: str
    bpm: Literal[96]
    beats_per_bar: Literal[4]
    steps_per_bar: Literal[16]
    ppq: Literal[480]
    total_bars: int = Field(ge=1, le=32)
    phrases: list[Phrase]
    notes: list[ScheduledNote]


class ScoreScene(Contract):
    scene_id: Id
    unit_ids: Ids
    theme: ScorePlan
    repo: ScorePlan


class ScoreBundle(Contract):
    analysis_id: Id
    score_hash: str
    scenes: list[ScoreScene]


class Finding(Contract):
    finding_id: Id
    verdict: Literal["concern", "justified_difference", "inconclusive", "no_specific_concern"]
    summary: str = Field(min_length=1, max_length=180)
    evidence_ids: Ids
    justification: Text
    limitation: Text | None = None
    discussion_question: Text | None = None


class Reclassification(Contract):
    event_id: Id
    from_responsibility_id: Id
    to_responsibility_id: Id
    evidence_ids: Ids
    reason: Text


class InvestigationCandidate(Contract):
    replaced_signal_ids: Ids = Field(default_factory=list, max_length=12)
    review_signals: list[ReviewSignal] = Field(default_factory=list, max_length=6)
    findings: list[Finding] = Field(min_length=1, max_length=3)
    hypotheses: list[Hypothesis] = Field(max_length=16)
    suggested_reclassification: list[Reclassification] = Field(default_factory=list, max_length=96)
    new_responsibilities: list[Responsibility] = Field(default_factory=list, max_length=6)


class InvestigationResult(InvestigationCandidate):
    investigation_id: Id
    base_analysis_id: Id
    selected_unit_ids: Ids
    selected_event_ids: Ids
    evidence: list[Evidence]


class SourceEdit(Contract):
    path: str = Field(min_length=1, max_length=240)
    before: str = Field(max_length=12000)
    after: str = Field(min_length=1, max_length=16000)


class ImprovementCandidate(Contract):
    title: str = Field(min_length=1, max_length=80)
    rationale: Text
    tradeoffs: Text
    verification: Text
    signal_ids: Ids
    evidence_ids: Ids
    edits: list[SourceEdit] = Field(min_length=1, max_length=6)


class ImprovementProposal(ImprovementCandidate):
    proposal_id: Id
    base_analysis_id: Id
    base_snapshot_id: Id
    source_hash: str
    evidence: list[Evidence]
    diff: str = Field(max_length=64000)
    status: Literal["draft", "accepted", "rejected"] = "draft"
