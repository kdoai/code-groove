"""Read public PR metadata and link only to an identical saved source revision."""

import json
import re
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from code_groove.errors import GrooveError
from code_groove.schemas import PullRequestNavigation, Span
from code_groove.source import parse_github_url

MAX_FILES = 300
MAX_RANGES = 64


class GitHubFile(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    previous_filename: str | None = Field(default=None, max_length=500)
    status: str = Field(max_length=40)
    additions: int = Field(ge=0)
    deletions: int = Field(ge=0)
    patch: str | None = Field(default=None, max_length=200_000)


def parse_pull_request_url(url: str) -> tuple[str, str, int]:
    parsed = urlparse(url)
    match = re.fullmatch(r"/([\w-]+)/([\w.-]+)/pull/([1-9][0-9]{0,8})/?", parsed.path)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "github.com"
        or parsed.query
        or parsed.fragment
        or not match
    ):
        raise GrooveError("INVALID_PR_URL", "公開PRのURLを指定してください。")
    owner, repo, number = match.groups()
    parse_github_url(f"https://github.com/{owner}/{repo}")
    return owner, repo, int(number)


def added_ranges(patch: str) -> tuple[list[tuple[int, int]], bool]:
    """Added lines have a head location; removed lines deliberately have none."""
    line = None
    ranges: list[tuple[int, int]] = []
    for text in patch.splitlines():
        header = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", text)
        if header:
            line = int(header[1])
        elif line is not None and text.startswith("+"):
            if ranges and ranges[-1][1] == line - 1:
                ranges[-1] = (ranges[-1][0], line)
            else:
                ranges.append((line, line))
            line += 1
        elif line is not None and text.startswith(" "):
            line += 1
    return ranges[:MAX_RANGES], len(ranges) > MAX_RANGES


async def read_json(client: httpx.AsyncClient, path: str) -> dict | list:
    async with client.stream("GET", f"https://api.github.com{path}") as response:
        if response.status_code in (403, 429):
            raise GrooveError("SOURCE_RATE_LIMITED", "GitHubの読取上限です。時間を置いてください。", 429)
        if response.status_code != 200:
            raise GrooveError("PR_NOT_AVAILABLE", "公開PRを読み取れません。", 404)
        raw = bytearray()
        async for chunk in response.aiter_bytes():
            raw.extend(chunk)
            if len(raw) > 2 * 1024 * 1024:
                raise GrooveError("PR_TOO_LARGE", "PRの読取上限を超えています。GitHubで確認してください。")
        return json.loads(raw)


def change_navigation(files: list, snapshot: dict, semantic: dict, matches: bool) -> list[dict]:
    result = []
    for file in files[:MAX_FILES]:
        path = file["filename"]
        patch = file.get("patch")
        ranges, truncated = added_ranges(patch) if isinstance(patch, str) else ([], False)
        source = snapshot["sources"].get(path)
        file_id = next((f["file_id"] for f in snapshot["index"]["files"] if f["path"] == path), "pr_change")
        spans = [
            Span(file_id=file_id, path=path, start_line=start, end_line=end).model_dump()
            for start, end in ranges
            if matches and source is not None and 1 <= start <= end <= len(source.splitlines())
        ]

        def intersects(location: dict, locations: list[dict] = spans) -> bool:
            return any(
                location["path"] == span["path"]
                and location["start_line"] <= span["end_line"]
                and span["start_line"] <= location["end_line"]
                for span in locations
            )

        changed_proofs = {proof["evidence_id"] for proof in semantic["evidence"] if intersects(proof["span"])}
        changed_events = {
            event["unit_id"]
            for event in semantic["events"]
            if changed_proofs.intersection(event["evidence_ids"])
        }
        changed_signals = {
            unit
            for signal in semantic.get("review_signals", [])
            if changed_proofs.intersection(
                [*signal["evidence_ids"], *signal.get("alternative_evidence_ids", [])]
            )
            for unit in signal["unit_ids"]
        }
        direct_units = {unit["unit_id"] for unit in semantic["units"] if intersects(unit["primary_span"])}
        units = [
            unit
            for unit in semantic["units"]
            if unit["unit_id"] in direct_units | changed_events | changed_signals
            or changed_proofs.intersection(unit["evidence_ids"])
        ]
        unit_ids = {unit["unit_id"] for unit in units}
        signals = [
            signal
            for signal in semantic.get("review_signals", [])
            if unit_ids.intersection(signal["unit_ids"])
        ]
        proof_ids = changed_proofs | {proof for unit in units for proof in unit["evidence_ids"]}
        proof_ids.update(
            proof
            for event in semantic["events"]
            if event["unit_id"] in unit_ids
            for proof in event["evidence_ids"]
        )
        proof_ids.update(
            proof
            for signal in signals
            for proof in [*signal["evidence_ids"], *signal.get("alternative_evidence_ids", [])]
        )
        proofs = [proof for proof in semantic["evidence"] if proof["evidence_id"] in proof_ids]
        result.append(
            {
                "path": path,
                "previous_path": file.get("previous_filename"),
                "status": file["status"],
                "additions": file["additions"],
                "deletions": file["deletions"],
                "patch_missing": patch is None,
                "patch_incomplete": not isinstance(patch, str)
                or sum(text.startswith("+") for text in patch.splitlines()) != file["additions"],
                "ranges_truncated": truncated,
                "changed_spans": spans,
                "unit_ids": [unit["unit_id"] for unit in units],
                "direct_unit_ids": sorted(direct_units),
                "signal_ids": [signal["signal_id"] for signal in signals],
                "evidence_ids": [proof["evidence_id"] for proof in proofs[:96]],
                "evidence_truncated": len(proofs) > 96,
                "source_available": matches and source is not None,
            }
        )
    return result


async def pull_request_data(
    url: str, repository_url: str, revision: str, snapshot: dict, semantic: dict
) -> dict:
    owner, repo, number = parse_pull_request_url(url)
    expected = parse_github_url(repository_url)
    path = f"/repos/{owner}/{repo}/pulls/{number}"
    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=False,
            trust_env=False,
            headers={"Accept": "application/vnd.github+json", "User-Agent": "Code-Groove"},
        ) as client:
            metadata = await read_json(client, path)
            assert isinstance(metadata, dict)
            base_repo, head_repo = metadata["base"]["repo"], metadata["head"]["repo"]
            if base_repo["private"] or not head_repo or head_repo["private"]:
                raise GrooveError("PR_NOT_AVAILABLE", "公開リポジトリのPRのみ対象です。")
            repositories = [
                parse_github_url(f"https://github.com/{item['full_name']}") for item in (base_repo, head_repo)
            ]
            if tuple(s.lower() for s in expected) not in [
                tuple(s.lower() for s in pair) for pair in repositories
            ]:
                raise GrooveError(
                    "PR_REPOSITORY_MISMATCH", "表示中の解析と同じリポジトリのPRを指定してください。"
                )
            head_sha, base_sha = metadata["head"]["sha"], metadata["base"]["sha"]
            if not all(re.fullmatch(r"[0-9a-f]{40}", sha) for sha in (head_sha, base_sha)):
                raise ValueError("invalid revision")
            files: list = []
            for page in range(1, 4):
                batch = await read_json(client, f"{path}/files?per_page=100&page={page}")
                if not isinstance(batch, list):
                    raise ValueError("invalid files")
                files.extend(GitHubFile.model_validate(file).model_dump() for file in batch[:100])
                if len(batch) < 100:
                    break
            latest = await read_json(client, path)
            if (
                not isinstance(latest, dict)
                or latest["head"]["sha"] != head_sha
                or latest["base"]["sha"] != base_sha
            ):
                raise GrooveError("PR_MOVED", "読取中にPRの版が変わりました。再表示してください。", 409)
            matches = revision == head_sha
            return PullRequestNavigation.model_validate(
                {
                    "url": f"https://github.com/{owner}/{repo}/pull/{number}",
                    "head_sha": head_sha,
                    "base_sha": base_sha,
                    "snapshot_revision": revision,
                    "head_repository_url": f"https://github.com/{head_repo['full_name']}",
                    "matches_snapshot": matches,
                    "snapshot_id": snapshot["snapshot_id"],
                    "files": change_navigation(files, snapshot, semantic, matches),
                    "truncated": metadata["changed_files"] > MAX_FILES,
                    "limitations": [
                        "変更行はPRのhead版。関連根拠は同じ版の保存済み読取記録だけです。新しいAI調査はありません。",
                        "削除行にはheadの行位置を割り当てません。差分の欠落・範囲外・未調査は問題なしを意味しません。",
                        "関連する根拠の網羅性と実行時の動作は未確認です。呼出関係は実装を選んで静的に確認してください。",
                    ],
                }
            ).model_dump()
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AssertionError) as exc:
        raise GrooveError(
            "PR_READ_FAILED", "PRの読取に失敗しました。GitHubで確認してください。", 502
        ) from exc
