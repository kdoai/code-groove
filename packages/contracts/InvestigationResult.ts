/**
 * @maxItems 6
 */
export type ReviewSignals =
  | []
  | [ReviewSignal]
  | [ReviewSignal, ReviewSignal]
  | [ReviewSignal, ReviewSignal, ReviewSignal]
  | [ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal]
  | [ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal]
  | [ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal, ReviewSignal];
export type SignalId = string;
export type Category =
  "policy_scattering" | "responsibility_mixing" | "change_coupling" | "data_flow_opacity" | "justified_boundary";
export type Verdict = "concern" | "justified" | "inconclusive";
export type Label = string;
export type Explanation = string;
export type Alternative = string;
export type ChangeScenario = string;
/**
 * @maxItems 96
 */
export type AlternativeEvidenceIds = string[];
/**
 * @maxItems 96
 */
export type UnitIds = string[];
/**
 * @maxItems 96
 */
export type EventIds = string[];
/**
 * @maxItems 96
 */
export type EvidenceIds = string[];
/**
 * @minItems 1
 * @maxItems 3
 */
export type Findings = [Finding] | [Finding, Finding] | [Finding, Finding, Finding];
export type FindingId = string;
export type Verdict1 = "concern" | "justified_difference" | "inconclusive" | "no_specific_concern";
export type Summary = string;
/**
 * @maxItems 96
 */
export type EvidenceIds1 = string[];
export type Justification = string;
export type Limitation = string | null;
export type DiscussionQuestion = string | null;
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
export type EvidenceIds2 = string[];
export type Status = "open" | "supported" | "rejected" | "undetermined";
export type EventId = string;
export type FromResponsibilityId = string;
export type ToResponsibilityId = string;
/**
 * @maxItems 96
 */
export type EvidenceIds3 = string[];
export type Reason = string;
/**
 * @maxItems 96
 */
export type SuggestedReclassification = Reclassification[];
/**
 * @maxItems 6
 */
export type NewResponsibilities =
  | []
  | [Responsibility]
  | [Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility, Responsibility]
  | [Responsibility, Responsibility, Responsibility, Responsibility, Responsibility, Responsibility];
export type ResponsibilityId = string;
export type Label1 = string;
export type Definition = string;
export type ChangeReason = string;
/**
 * @maxItems 96
 */
export type EvidenceIds4 = string[];
export type MotifId = "M0" | "M1" | "M2" | "M3" | "M4" | "M5";
export type DisplayOrder = number;
export type InvestigationId = string;
export type BaseAnalysisId = string;
/**
 * @maxItems 96
 */
export type SelectedUnitIds = string[];
/**
 * @maxItems 96
 */
export type SelectedEventIds = string[];
export type EvidenceId = string;
export type SnapshotId = string;
export type FileId = string;
export type Path = string;
export type StartLine = number;
export type EndLine = number;
export type ProjectionSha256 = string;
export type SourceKind = "code" | "test" | "document";
export type Observation = string;
export type CreatedByToolEventId = string;
export type Evidence = Evidence1[];

export interface InvestigationResult {
  review_signals?: ReviewSignals;
  findings: Findings;
  hypotheses: Hypotheses;
  suggested_reclassification?: SuggestedReclassification;
  new_responsibilities?: NewResponsibilities;
  investigation_id: InvestigationId;
  base_analysis_id: BaseAnalysisId;
  selected_unit_ids: SelectedUnitIds;
  selected_event_ids: SelectedEventIds;
  evidence: Evidence;
}
export interface ReviewSignal {
  signal_id: SignalId;
  category: Category;
  verdict: Verdict;
  label: Label;
  explanation: Explanation;
  alternative: Alternative;
  change_scenario?: ChangeScenario;
  alternative_evidence_ids?: AlternativeEvidenceIds;
  unit_ids: UnitIds;
  event_ids: EventIds;
  evidence_ids: EvidenceIds;
}
export interface Finding {
  finding_id: FindingId;
  verdict: Verdict1;
  summary: Summary;
  evidence_ids: EvidenceIds1;
  justification: Justification;
  limitation?: Limitation;
  discussion_question?: DiscussionQuestion;
}
export interface Hypothesis {
  hypothesis_id: HypothesisId;
  statement: Statement;
  counter_question: CounterQuestion;
  evidence_ids: EvidenceIds2;
  status: Status;
}
export interface Reclassification {
  event_id: EventId;
  from_responsibility_id: FromResponsibilityId;
  to_responsibility_id: ToResponsibilityId;
  evidence_ids: EvidenceIds3;
  reason: Reason;
}
export interface Responsibility {
  responsibility_id: ResponsibilityId;
  label: Label1;
  definition: Definition;
  change_reason: ChangeReason;
  evidence_ids: EvidenceIds4;
  motif_id: MotifId;
  display_order: DisplayOrder;
}
export interface Evidence1 {
  evidence_id: EvidenceId;
  snapshot_id: SnapshotId;
  span: Span;
  projection_sha256: ProjectionSha256;
  source_kind: SourceKind;
  observation: Observation;
  created_by_tool_event_id: CreatedByToolEventId;
}
export interface Span {
  file_id: FileId;
  path: Path;
  start_line: StartLine;
  end_line: EndLine;
}
