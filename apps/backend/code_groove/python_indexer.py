"""Trusted static parser, run in an isolated child process; never imports repository code."""

import ast
import hashlib
import json
import posixpath
import sys
from typing import Any


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def index_python(snapshot_id: str, sources: dict[str, str]) -> dict:
    files: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    trees, symbols, bindings = {}, {}, {}
    for path, source in sorted(sources.items()):
        if not path.endswith(".py"):
            continue
        is_source = not (path.startswith("tests/") or posixpath.basename(path).startswith("test_"))
        file_id = f"file_{digest(path)}"
        file: dict[str, Any] = {
            "file_id": file_id,
            "path": path,
            "lines": len(source.splitlines()),
            "is_source": is_source,
            "parse_errors": 0,
            "imports": [],
        }
        files.append(file)
        try:
            tree = ast.parse(source, filename=path)
        except (SyntaxError, ValueError, RecursionError):
            file["parse_errors"] = 1
            continue
        trees[path] = tree
        imported = {}
        for node in tree.body:
            if isinstance(node, ast.ImportFrom):
                base = posixpath.dirname(path) if node.level else ""
                for _ in range(max(0, node.level - 1)):
                    base = posixpath.dirname(base)
                module = posixpath.join(base, (node.module or "").replace(".", "/"))
                target = next((p for p in [module + ".py", module + "/__init__.py"] if p in sources), None)
                file["imports"].append({"module": node.module or ".", "resolved": bool(target)})
                for alias in node.names:
                    imported[alias.asname or alias.name] = (target, alias.name)
        bindings[path] = imported
        if not is_source:
            continue
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            unit_id = f"unit_{digest(f'{snapshot_id}:{path}:python:{node.lineno}:{node.end_lineno}')}"
            units.append(
                {
                    "unit_id": unit_id,
                    "symbol_id": unit_id,
                    "label": node.name,
                    "primary_span": {
                        "file_id": file_id,
                        "path": path,
                        "start_line": node.lineno,
                        "end_line": node.end_lineno,
                    },
                    "calls": [],
                }
            )
            symbols[(path, node.name)] = unit_id
    for unit in units:
        path = unit["primary_span"]["path"]
        tree = trees[path]
        node = next(
            n
            for n in tree.body
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == unit["label"]
        )
        stack: list[ast.AST] = list(node.body)
        while stack:
            child = stack.pop()
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
                continue
            if isinstance(child, ast.Call):
                name = ast.unparse(child.func)[:160]
                target = None
                if isinstance(child.func, ast.Name):
                    imported_path, imported_name = bindings[path].get(name, (path, name))
                    target = symbols.get((imported_path, imported_name))
                unit["calls"].append(name)
                relations.append(
                    {"caller": unit["unit_id"], "callee": target, "name": name, "resolved": bool(target)}
                )
            stack.extend(ast.iter_child_nodes(child))
    return {"files": files, "units": units, "relations": relations}


def main():
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    payload = json.loads(sys.stdin.read(3 * 1024 * 1024))
    print(json.dumps(index_python(payload["snapshot_id"], payload["sources"])))


if __name__ == "__main__":
    main()
