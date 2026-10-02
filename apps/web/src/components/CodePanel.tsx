import { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/typescript/register';
import 'monaco-editor/languages/definitions/python/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import type { Bundle } from '../api';
import { useWorkspace } from '../state';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export function CodePanel({ bundle }: { bundle: Bundle }) {
  const ws = useWorkspace();
  const event = bundle.map.events.find((e) => e.event_id === ws.eventId);
  const unit = bundle.map.units.find((u) => u.unit_id === ws.unitId) ?? bundle.map.units[0];
  const span = ws.codeSpan ?? event?.span ?? unit.primary_span;
  const editor = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection>(null);
  const highlight = () => {
    if (!editor.current) return;
    decorations.current?.clear();
    const concernEvents = bundle.map.events.filter(
      (e) =>
        e.span.path === span.path &&
        bundle.map.review_signals?.some((s) => s.verdict === 'concern' && s.event_ids.includes(e.event_id)),
    );
    decorations.current = editor.current.createDecorationsCollection([
      ...concernEvents.map((e) => ({
        range: new monaco.Range(e.span.start_line, 1, e.span.end_line, 1),
        options: {
          isWholeLine: true,
          className: 'code-concern',
          linesDecorationsClassName: 'concern-line-marker',
          hoverMessage: {
            value: 'Agentの懸念：同じ変更で一緒に確認する判断。右側に根拠と別の説明があります。',
          },
        },
      })),
      {
        range: new monaco.Range(span.start_line, 1, span.end_line, 1),
        options: {
          isWholeLine: true,
          className: concernEvents.some(
            (e) => e.span.start_line <= span.start_line && e.span.end_line >= span.end_line,
          )
            ? 'code-concern'
            : 'code-highlight',
          linesDecorationsClassName: 'code-line-marker',
        },
      },
    ]);
    editor.current.setScrollTop(Math.max(0, editor.current.getTopForLineNumber(span.start_line) - 8));
  };
  useEffect(highlight, [span.path, span.start_line, span.end_line]);
  const mount: OnMount = (value) => {
    editor.current = value;
    value.onDidLayoutChange(() => {
      const line = useWorkspace.getState().codeSpan?.start_line ?? span.start_line;
      value.setScrollTop(Math.max(0, value.getTopForLineNumber(line) - 8));
    });
    highlight();
  };
  return (
    <section className="code-panel">
      <div className="panel-heading">
        <span>{span.path}</span>
        <span className="read-only">READ ONLY</span>
      </div>
      <Editor
        height="100%"
        language={span.path.endsWith('.py') ? 'python' : 'typescript'}
        value={bundle.sources[span.path] ?? ''}
        theme="vs"
        onMount={mount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'Consolas, monospace',
          padding: { top: 10 },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
          lineNumbersMinChars: 3,
          automaticLayout: true,
          wordWrap: 'on',
          folding: true,
          contextmenu: false,
        }}
      />
      <div className="code-footer">
        {span.path}:{span.start_line}–{span.end_line}
        <span>UTF-8 · {span.path.endsWith('.py') ? 'Python' : 'TypeScript'}</span>
      </div>
    </section>
  );
}
