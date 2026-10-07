export type Url = string;
export type HeadSha = string;
export type BaseSha = string;
export type SnapshotRevision = string;
export type HeadRepositoryUrl = string;
export type SnapshotId = string;
export type MatchesSnapshot = boolean;
export type Truncated = boolean;
export type Path = string;
export type PreviousPath = string | null;
export type Status = string;
export type Additions = number;
export type Deletions = number;
export type PatchMissing = boolean;
export type PatchIncomplete = boolean;
export type RangesTruncated = boolean;
export type SourceAvailable = boolean;
export type FileId = string;
export type Path1 = string;
export type StartLine = number;
export type EndLine = number;
/**
 * @maxItems 64
 */
export type ChangedSpans = Span[];
/**
 * @maxItems 96
 */
export type UnitIds = string[];
/**
 * @maxItems 96
 */
export type DirectUnitIds = string[];
/**
 * @maxItems 96
 */
export type SignalIds = string[];
/**
 * @maxItems 96
 */
export type EvidenceIds = string[];
export type EvidenceTruncated = boolean;
/**
 * @maxItems 300
 */
export type Files = PullRequestChange[];
/**
 * @maxItems 8
 */
export type Limitations =
  | []
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string];

export interface PullRequestNavigation {
  url: Url;
  head_sha: HeadSha;
  base_sha: BaseSha;
  snapshot_revision: SnapshotRevision;
  head_repository_url: HeadRepositoryUrl;
  snapshot_id: SnapshotId;
  matches_snapshot: MatchesSnapshot;
  truncated: Truncated;
  files: Files;
  limitations: Limitations;
}
export interface PullRequestChange {
  path: Path;
  previous_path: PreviousPath;
  status: Status;
  additions: Additions;
  deletions: Deletions;
  patch_missing: PatchMissing;
  patch_incomplete: PatchIncomplete;
  ranges_truncated: RangesTruncated;
  source_available: SourceAvailable;
  changed_spans: ChangedSpans;
  unit_ids: UnitIds;
  direct_unit_ids: DirectUnitIds;
  signal_ids: SignalIds;
  evidence_ids: EvidenceIds;
  evidence_truncated: EvidenceTruncated;
}
export interface Span {
  file_id: FileId;
  path: Path1;
  start_line: StartLine;
  end_line: EndLine;
}
