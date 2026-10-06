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
    child: ast.AST
    files: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    symbols, bindings, unit_nodes = {}, {}, {}
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

        def resolve_import(node, path=path, file=file):
            imported: dict[str, tuple[str | None, str]] = {}
            if isinstance(node, ast.Import):
                entries = [(alias, alias.name, 0, "") for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                entries = [(alias, node.module or "", node.level, alias.name) for alias in node.names]
            else:
                return imported
            for alias, module_name, level, symbol in entries:
                base = posixpath.dirname(path) if level else ""
                for _ in range(max(0, level - 1)):
                    base = posixpath.dirname(base)
                module = posixpath.join(base, module_name.replace(".", "/"))
                options = [module + ".py", module + "/__init__.py"]
                # A common src-layout is resolved only when its target is unambiguous.
                if not level:
                    options += ["src/" + option for option in options]
                targets = [option for option in options if option in sources]
                target = targets[0] if len(targets) == 1 else None
                imported_symbol = symbol
                if isinstance(node, ast.ImportFrom) and (not target or not module_name):
                    submodule = posixpath.join(module, symbol)
                    children = [p for p in (submodule + ".py", submodule + "/__init__.py") if p in sources]
                    if len(children) == 1:
                        target, imported_symbol = children[0], ""
                external = not level and module_name.split(".")[0] in sys.stdlib_module_names
                file["imports"].append(
                    {
                        "module": "." * level + module_name,
                        "resolved": bool(target),
                        "path": target,
                        "resolution": "local" if target else "external" if external else "unresolved_local",
                    }
                )
                imported[alias.asname or alias.name] = (target, imported_symbol)
            return imported

        global_bindings = {}
        for child in tree.body:
            global_bindings.update(resolve_import(child))
        bindings[path] = global_bindings
        if not is_source:
            continue

        def visit(
            node,
            prefix="",
            parent_id=None,
            class_name=None,
            scope_bindings=None,
            path=path,
            file_id=file_id,
            global_bindings=global_bindings,
        ):
            child: ast.AST
            current_bindings = dict(scope_bindings or global_bindings)
            if isinstance(node, ast.ClassDef):
                name = f"{prefix}.{node.name}" if prefix else node.name
                for child in node.body:
                    visit(child, name, parent_id, name, current_bindings)
                return
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                name = (
                    node.name
                    if not isinstance(node, ast.Lambda)
                    else f"lambda_{node.lineno}_{node.col_offset}"
                )
                label = f"{prefix}.{name}" if prefix else name
                start_line = min([node.lineno, *[d.lineno for d in getattr(node, "decorator_list", [])]])
                identity = f"{snapshot_id}:{path}:python:{node.lineno}:{node.end_lineno}"
                if isinstance(node, ast.Lambda):
                    identity += f":lambda:{node.col_offset}"
                unit_id = f"unit_{digest(identity)}"
                unit = {
                    "unit_id": unit_id,
                    "symbol_id": unit_id,
                    "label": label,
                    "primary_span": {
                        "file_id": file_id,
                        "path": path,
                        "start_line": start_line,
                        "end_line": node.end_lineno,
                    },
                    "calls": [],
                }
                if parent_id:
                    unit["parent_unit_id"] = parent_id
                units.append(unit)
                symbols[(path, label)] = unit_id
                # Collect this scope's imports, skipping nested definitions.
                pending = list(ast.iter_child_nodes(node))
                while pending:
                    child = pending.pop()
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
                        continue
                    current_bindings.update(resolve_import(child))
                    pending.extend(ast.iter_child_nodes(child))
                unit_nodes[unit_id] = (node, class_name, label, current_bindings)
                for child in ast.iter_child_nodes(node):
                    visit(child, label, unit_id, class_name, current_bindings)
                return
            for child in ast.iter_child_nodes(node):
                visit(child, prefix, parent_id, class_name, current_bindings)

        for child in tree.body:
            visit(child)
    for unit in units:
        path = unit["primary_span"]["path"]
        node, class_name, label, scope_bindings = unit_nodes[unit["unit_id"]]
        stack: list[ast.AST] = [node.body] if isinstance(node, ast.Lambda) else list(node.body)
        while stack:
            child = stack.pop()
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
                continue
            if isinstance(child, ast.Call):
                name = ast.unparse(child.func)[:160]
                target = None
                if isinstance(child.func, ast.Name):
                    imported_path, imported_name = scope_bindings.get(name, (path, name))
                    target = symbols.get((imported_path, imported_name))
                    if name not in scope_bindings:
                        lexical = label.split(".")
                        while lexical and not target:
                            target = symbols.get((path, ".".join([*lexical, name])))
                            lexical.pop()
                elif isinstance(child.func, ast.Attribute) and isinstance(child.func.value, ast.Name):
                    receiver = child.func.value.id
                    if receiver in ("self", "cls") and class_name:
                        target = symbols.get((path, f"{class_name}.{child.func.attr}"))
                    else:
                        imported_path, imported_name = scope_bindings.get(receiver, (path, receiver))
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
