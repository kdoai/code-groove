import io
import tarfile

import pytest
from code_groove.agent import AgentContext, execute_tool
from code_groove.errors import GrooveError
from code_groove.settings import Settings
from code_groove.source import build_index, parse_github_url, safe_archive, sample_snapshot, sanitize


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/a/b",
        "https://github.com/a/b?x=y",
        "https://github.com@127.0.0.1/a/b",
        "https://github.com:443/a/b",
        "https://evil.test/a/b",
        "https://github.com/a/b/pull/1",
    ],
)
def test_rejects_untrusted_url(url):
    with pytest.raises(GrooveError):
        parse_github_url(url)


@pytest.mark.parametrize(
    "name,link",
    [
        ("repo/../escape.ts", False),
        ("/absolute.ts", False),
        ("repo/link.ts", True),
        ("repo/C:/key.ts", False),
    ],
)
def test_archive_does_not_allow_traversal_or_links(name, link):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        item = tarfile.TarInfo(name)
        item.size = 1
        if link:
            item.type = tarfile.SYMTYPE
            item.linkname = "outside"
        tar.addfile(item, io.BytesIO(b"x"))
    with pytest.raises(GrooveError):
        safe_archive(buffer.getvalue())


def test_sanitization_preserves_lines_and_masks_secrets():
    source = 'const api_key = "AIza' + "a" * 35 + '";\nconst password = "danger";\n'
    projection = sanitize(source)
    assert "danger" not in projection and "AIza" not in projection
    assert projection.count("\n") == source.count("\n")


def test_indexer_parses_without_executing_repository_code():
    index = build_index(
        "snapshot_safe",
        {"src/attack.ts": "throw new Error('must never execute');\nexport function example() { return 1; }"},
    )
    assert index["units"][0]["label"] == "example"


def test_bounded_evidence_and_no_privilege_tool():
    _, sources = sample_snapshot("mixed")
    index = build_index("snapshot_safe", sources)
    ctx = AgentContext(
        Settings(),
        "project_safe",
        "snapshot_safe",
        sources,
        index,
        lambda *_: None,
        lambda: None,
        lambda _: None,
    )
    file = index["files"][0]
    args = {
        "file_id": file["file_id"],
        "start_line": 1,
        "end_line": file["lines"] - 1,
        "purpose": "境界を確認",
    }
    execute_tool(ctx, "read_code", args, "tool_safe")
    execute_tool(ctx, "read_code", args, "tool_safe_2")
    with pytest.raises(GrooveError):
        execute_tool(ctx, "read_code", args, "tool_safe_3")
    with pytest.raises(GrooveError):
        execute_tool(ctx, "shell", {"command": "echo x"}, "tool_safe_4")
