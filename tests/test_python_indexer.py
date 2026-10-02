from code_groove.source import build_index


def test_python_is_static_and_resolves_only_local_function_imports(tmp_path):
    marker = tmp_path / "must-not-exist"
    sources = {
        "policy.py": "def evaluate(value):\n    return value * 2\n",
        "service.py": f'from policy import evaluate as policy\nopen({str(marker)!r}, "w").write("unsafe")\n\ndef submit(value):\n    return policy(value)\n',
        "tests/test_policy.py": "from policy import evaluate\n\ndef test_policy():\n    assert evaluate(1) == 2\n",
    }
    index = build_index("python_static", sources)
    assert not marker.exists()
    assert {u["label"] for u in index["units"]} == {"evaluate", "submit"}
    assert index["relations"][0]["resolved"]
    assert index["relations"][0]["callee"] in {u["unit_id"] for u in index["units"]}
    assert not next(f for f in index["files"] if f["path"].startswith("tests/"))["is_source"]
