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
export function CodePanel({
  bundle,
  following,
  toggleFollowing,
  referenceSources,
}: {
  bundle: Bundle;
  following?: boolean;
  toggleFollowing?: () => void;
  referenceSources?: Record<string, string>;
}) {
  const ws = useWorkspace();
  const event = bundle.map.events.find((e) => e.event_id === ws.eventId);
  const unit = bundle.map.units.find((u) => u.unit_id === ws.unitId) ?? bundle.map.units[0];
  const span = ws.codeSpan ?? event?.span ?? unit.primary_span;
  const currentSpan = useRef(span);
  currentSpan.current = span;
  const referenceOnly = !(span.path in bundle.sources);
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
          className: 'code-highlight',
          linesDecorationsClassName: 'code-line-marker',
        },
      },
    ]);
    editor.current.revealLinesInCenterIfOutsideViewport(span.start_line, span.end_line);
  };
  useEffect(highlight, [span.path, span.start_line, span.end_line]);
  const mount: OnMount = (value) => {
    editor.current = value;
    value.onDidLayoutChange(() => {
      value.revealLinesInCenterIfOutsideViewport(
        currentSpan.current.start_line,
        currentSpan.current.end_line,
      );
    });
    highlight();
  };
  return (
    <section className="code-panel">
      <div className="panel-heading">
        <span data-testid="code-location">
          {span.path}:{span.start_line}–{span.end_line}
        </span>
        {toggleFollowing && (
          <button aria-pressed={following} onClick={toggleFollowing}>
            演奏に追従
          </button>
        )}
      </div>
      {referenceOnly && (
        <p className="reference-code-note">
          同じ確定版の参考コード · Geminiの保存済み検査の対象外 · 演奏なし
        </p>
      )}
      <Editor
        path={span.path}
        height="100%"
        language={span.path.endsWith('.py') ? 'python' : 'typescript'}
        value={bundle.sources[span.path] ?? referenceSources?.[span.path] ?? ''}
        theme={ws.theme === 'dark' ? 'vs-dark' : 'vs'}
        onMount={mount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
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
    </section>
  );
}
