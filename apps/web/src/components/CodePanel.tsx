import { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/typescript/register';
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
    decorations.current = editor.current.createDecorationsCollection([
      {
        range: new monaco.Range(span.start_line, 1, span.end_line, 1),
        options: {
          isWholeLine: true,
          className: 'code-highlight',
          linesDecorationsClassName: 'code-line-marker',
        },
      },
    ]);
    editor.current.revealLineInCenter(span.start_line);
  };
  useEffect(highlight, [span.path, span.start_line, span.end_line]);
  const mount: OnMount = (value) => {
    editor.current = value;
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
        language="typescript"
        value={bundle.sources[span.path] ?? ''}
        theme="vs"
        onMount={mount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'Consolas, monospace',
          padding: { top: 18 },
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
        <span>UTF-8 · TypeScript</span>
      </div>
    </section>
  );
}
