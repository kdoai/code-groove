import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const input = JSON.parse(readFileSync(0, 'utf8')) as { snapshot_id: string; sources: Record<string, string> };
const id = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
const files: any[] = [],
  units: any[] = [],
  relations: any[] = [];
for (const [path, source] of Object.entries(input.sources).sort()) {
  const fileId = `file_${id(path)}`;
  const isSource = /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path);
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  files.push({
    file_id: fileId,
    path,
    lines: source.split('\n').length,
    is_source: isSource,
    parse_errors: (file as any).parseDiagnostics?.length ?? 0,
  });
  if (!isSource) continue;
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const start = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      const end = file.getLineAndCharacterOfPosition(node.end).line + 1;
      const name =
        (node as ts.FunctionDeclaration).name?.getText(file) ??
        (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(file) : `anonymous_${start}`);
      const unitId = `unit_${id(`${input.snapshot_id}:${path}:${node.kind}:${start}:${end}`)}`;
      const calls: string[] = [];
      function readCalls(child: ts.Node) {
        if (ts.isCallExpression(child)) calls.push(child.expression.getText(file));
        ts.forEachChild(child, readCalls);
      }
      ts.forEachChild(node, readCalls);
      units.push({
        unit_id: unitId,
        symbol_id: unitId,
        label: name,
        primary_span: { file_id: fileId, path, start_line: start, end_line: end },
        calls,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
for (const unit of units)
  for (const call of unit.calls) {
    const candidates = units.filter((u) => u.label === call);
    relations.push({
      caller: unit.unit_id,
      callee: candidates.length === 1 ? candidates[0].unit_id : null,
      name: call,
      resolved: candidates.length === 1,
    });
  }
process.stdout.write(JSON.stringify({ files, units, relations }));
