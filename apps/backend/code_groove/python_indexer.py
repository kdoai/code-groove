"""Trusted static parser, run in an isolated child process; never imports repository code."""

import ast
import hashlib
import json
import posixpath
import sys
from io import TextIOWrapper
from typing import Any, cast


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def index_python(snapshot_id: str, sources: dict[str, str]) -> dict:
    files: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    trees, symbols, bindings, unit_nodes = {}, {}, {}, {}
    for path, source in sorted(sources.items()):
        if not path.endswith(".py"):
            continue
        is_source = not ("/tests/" in f"/{path}" or posixpath.basename(path).startswith("test_"))
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
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module = alias.name.replace(".", "/")
                    target = next(
                        (p for p in [module + ".py", module + "/__init__.py"] if p in sources), None
                    )
                    file["imports"].append({"module": alias.name, "resolved": bool(target), "path": target})
                    imported[alias.asname or alias.name] = (target, "")
            if isinstance(node, ast.ImportFrom):
                base = posixpath.dirname(path) if node.level else ""
                for _ in range(max(0, node.level - 1)):
                    base = posixpath.dirname(base)
                module = posixpath.join(base, (node.module or "").replace(".", "/"))
                target = next((p for p in [module + ".py", module + "/__init__.py"] if p in sources), None)
                file["imports"].append(
                    {"module": node.module or ".", "resolved": bool(target), "path": target}
                )
                for alias in node.names:
                    imported[alias.asname or alias.name] = (target, alias.name)
        bindings[path] = imported
        if not is_source:
            continue
        declarations: list[tuple[ast.FunctionDef | ast.AsyncFunctionDef, str | None]] = [
            (node, None) for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        declarations.extend(
            (method, parent.name)
            for parent in tree.body
            if isinstance(parent, ast.ClassDef)
            for method in parent.body
            if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef))
        )
        for node, class_name in declarations:
            label = f"{class_name}.{node.name}" if class_name else node.name
            unit_id = f"unit_{digest(f'{snapshot_id}:{path}:python:{node.lineno}:{node.end_lineno}')}"
            units.append(
                {
                    "unit_id": unit_id,
                    "symbol_id": unit_id,
                    "label": label,
                    "primary_span": {
                        "file_id": file_id,
                        "path": path,
                        "start_line": node.lineno,
                        "end_line": node.end_lineno,
                    },
                    "calls": [],
                }
            )
            symbols[(path, label)] = unit_id
            unit_nodes[unit_id] = (node, class_name)
    for unit in units:
        path = unit["primary_span"]["path"]
        node, class_name = unit_nodes[unit["unit_id"]]
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
                elif isinstance(child.func, ast.Attribute) and isinstance(child.func.value, ast.Name):
                    receiver = child.func.value.id
                    if receiver in ("self", "cls") and class_name:
                        target = symbols.get((path, f"{class_name}.{child.func.attr}"))
                    else:
                        imported_path, imported_name = bindings[path].get(receiver, (path, receiver))
                        target = symbols.get(
                            (
                                imported_path,
                                f"{imported_name}.{child.func.attr}" if imported_name else child.func.attr,
                            )
                        )
                unit["calls"].append(name)
                relations.append(
                    {"caller": unit["unit_id"], "callee": target, "name": name, "resolved": bool(target)}
                )
            stack.extend(ast.iter_child_nodes(child))
    return {"files": files, "units": units, "relations": relations}


def main():
    cast(TextIOWrapper, sys.stdin).reconfigure(encoding="utf-8")
    cast(TextIOWrapper, sys.stdout).reconfigure(encoding="utf-8")
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    payload = json.loads(sys.stdin.read(8 * 1024 * 1024))
    print(json.dumps(index_python(payload["snapshot_id"], payload["sources"]), ensure_ascii=False))


if __name__ == "__main__":
    main()
