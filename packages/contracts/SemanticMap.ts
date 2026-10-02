export type Title = string;
export type Purpose = string;
/**
 * @maxItems 3
 */
export type Assumptions = [] | [string] | [string, string] | [string, string, string];
/**
 * @maxItems 16
 */
export type Unknowns =
  | []
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
  | [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ]
  | [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ];
/**
 * @minItems 1
 * @maxItems 6
 */
export type Responsibilities =
  | [Responsibility]
  | [Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility, Responsibility, Responsibility];
export type ResponsibilityId = string;
export type Label = string;
export type Definition = string;
export type ChangeReason = string;
/**
 * @maxItems 96
 */
export type EvidenceIds = string[];
export type MotifId = "M0" | "M1" | "M2" | "M3" | "M4" | "M5";
export type DisplayOrder = number;
/**
 * @minItems 1
 * @maxItems 32
 */
export type Units = [ImplementationUnit, ...ImplementationUnit[]];
export type UnitId = string;
export type Label1 = string;
export type FileId = string;
export type Path = string;
export type StartLine = number;
export type EndLine = number;
/**
 * @maxItems 96
 */
export type MemberSymbolIds = string[];
export type Role = "policy" | "calculation" | "adapter" | "orchestrator" | "other";
export type ReviewState = "inspected" | "unresolved" | "excluded";
export type BoundaryReason = string;
/**
 * @maxItems 96
 */
export type EvidenceIds1 = string[];
export type EventId = string;
export type ConceptKey = string;
export type Label2 = string;
export type Meaning = string;
export type ResponsibilityId1 = string;
export type UnitId1 = string;
export type SemanticOrder = number;
export type Kind = "decision" | "calculation" | "update";
/**
 * @maxItems 96
 */
export type EvidenceIds2 = string[];
export type State = "grounded" | "unresolved";
/**
 * @maxItems 96
 */
export type Events = MeaningEvent[];
/**
 * @maxItems 16
 */
export type Hypotheses =
  | []
  | [Hypothesis]
  | [Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis, Hypothesis]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ]
  | [
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis,
      Hypothesis
    ];
export type HypothesisId = string;
export type Statement = string;
export type CounterQuestion = string;
/**
 * @maxItems 96
 */
export type EvidenceIds3 = string[];
export type Status = "open" | "supported" | "rejected" | "undetermined";
export type SchemaVersion = "1.0";
export type AnalysisId = string;
export type ProjectId = string;
export type SnapshotId = string;
export type ParentAnalysisId = string | null;
export type Origin = "live" | "recorded_live" | "fixture";
export type EvidenceId = string;
export type SnapshotId1 = string;
export type ProjectionSha256 = string;
export type SourceKind = "code" | "test" | "document";
export type Observation = string;
export type CreatedByToolEventId = string;
export type Evidence = Evidence1[];
export type IndexedSourceFiles = number;
export type EligibleSourceFiles = number;
export type IndexedUnits = number;
export type InspectedUnits = number;
/**
 * @maxItems 96
 */
export type UnresolvedUnitIds = string[];
export type Path1 = string;
export type Reason = string;
export type ExcludedPaths = ExcludedPath[];
export type InspectedLineRanges = Span[];
export type ModelId = string;
export type PromptVersion = string;
export type CreatedAt = string;

export interface SemanticMap {
  profile: RepositoryProfile;
  responsibilities: Responsibilities;
  units: Units;
  events: Events;
  hypotheses: Hypotheses;
  schema_version: SchemaVersion;
  analysis_id: AnalysisId;
  project_id: ProjectId;
  snapshot_id: SnapshotId;
  parent_analysis_id?: ParentAnalysisId;
  origin: Origin;
  evidence: Evidence;
  coverage: Coverage;
  model_id: ModelId;
  prompt_version: PromptVersion;
  created_at: CreatedAt;
}
export interface RepositoryProfile {
  title: Title;
  purpose: Purpose;
  assumptions: Assumptions;
  unknowns: Unknowns;
}
export interface Responsibility {
  responsibility_id: ResponsibilityId;
  label: Label;
  definition: Definition;
  change_reason: ChangeReason;
  evidence_ids: EvidenceIds;
  motif_id: MotifId;
  display_order: DisplayOrder;
}
export interface ImplementationUnit {
  unit_id: UnitId;
  label: Label1;
  primary_span: Span;
  member_symbol_ids: MemberSymbolIds;
  role: Role;
  review_state: ReviewState;
  boundary_reason: BoundaryReason;
  evidence_ids: EvidenceIds1;
}
export interface Span {
  file_id: FileId;
  path: Path;
  start_line: StartLine;
  end_line: EndLine;
}
export interface MeaningEvent {
  event_id: EventId;
  concept_key: ConceptKey;
  label: Label2;
  meaning: Meaning;
  responsibility_id: ResponsibilityId1;
  unit_id: UnitId1;
  semantic_order: SemanticOrder;
  kind: Kind;
  span: Span;
  evidence_ids: EvidenceIds2;
  state: State;
}
export interface Hypothesis {
  hypothesis_id: HypothesisId;
  statement: Statement;
  counter_question: CounterQuestion;
  evidence_ids: EvidenceIds3;
  status: Status;
}
export interface Evidence1 {
  evidence_id: EvidenceId;
  snapshot_id: SnapshotId1;
  span: Span;
  projection_sha256: ProjectionSha256;
  source_kind: SourceKind;
  observation: Observation;
  created_by_tool_event_id: CreatedByToolEventId;
}
export interface Coverage {
  indexed_source_files: IndexedSourceFiles;
  eligible_source_files: EligibleSourceFiles;
  indexed_units: IndexedUnits;
  inspected_units: InspectedUnits;
  unresolved_unit_ids: UnresolvedUnitIds;
  excluded_paths: ExcludedPaths;
  inspected_line_ranges: InspectedLineRanges;
}
export interface ExcludedPath {
  path: Path1;
  reason: Reason;
}
