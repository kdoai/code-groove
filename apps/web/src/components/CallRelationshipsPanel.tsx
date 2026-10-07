import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CallRelationships, Span } from '../../../../packages/contracts/CallRelationships';
import { api, type Bundle } from '../api';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';
import { focusedExcerpt } from '../audio/excerpts';
import { playbackPlan } from '../audio/playback';
import { useAudition } from '../hooks/useAudition';

const overlaps = (a: Span, b: Span) =>
  a.path === b.path && a.start_line <= b.end_line && b.start_line <= a.end_line;

export function CallRelationshipsPanel({ bundle }: { bundle: Bundle }) {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const auditionState = useAudition();
  const base = ws.sampleId ? `/samples/${ws.sampleId}` : `/analyses/${bundle.map.analysis_id}`;
  const data = useQuery({
    queryKey: ['call-relationships', base, bundle.map.snapshot_id, ws.unitId],
    queryFn: () => api<CallRelationships>(`${base}/relationships?unit_id=${encodeURIComponent(ws.unitId)}`),
    enabled: open && !!ws.unitId,
    staleTime: Infinity,
    retry: false,
  });
  const result = data.data?.snapshot_id === bundle.map.snapshot_id ? data.data : undefined;
  const link = result?.links.find((item) => item.link_id === selected) ?? result?.links[0];
  const spans = link ? [link.call_span, ...link.return_spans, ...link.use_spans] : [];
  const events = bundle.map.events.filter(
    (event) => event.state === 'grounded' && spans.some((span) => overlaps(event.span, span)),
  );
  const original = playbackPlan(bundle.score, 'repo', 0, true);
  const excerpt = original
    ? focusedExcerpt(
        original,
        events.map((event) => event.event_id),
        4,
        bundle.map.events.filter((event) => event.state === 'grounded').map((event) => event.event_id),
      )
    : undefined;
  function source(title: string, span: Span) {
    const lines = bundle.sources[span.path]?.split('\n').slice(span.start_line - 1, span.end_line);
    return (
      <div className="relationship-source" key={`${title}:${span.path}:${span.start_line}`}>
        <button
          className="evidence-link"
          onClick={() => {
            engine.pause();
            ws.set({ codeSpan: span, following: false });
          }}
        >
          {title} · {span.path}:{span.start_line}–{span.end_line}
        </button>
        {lines ? (
          <pre>{lines.slice(0, 4).join('\n').slice(0, 800)}</pre>
        ) : (
          <small>この表示のソース範囲外です。音を補完しません。</small>
        )}
        {!!lines && lines.length > 4 && <small>冒頭4行 · 行番号から全範囲へ</small>}
      </div>
    );
  }
  async function listen() {
    if (!excerpt?.plan.notes.length) return;
    setError('');
    try {
      await engine.playAudition(excerpt.plan, (note) => {
        const event = events.find((event) => event.event_id === note.event_id);
        if (event) ws.set({ codeSpan: event.span });
      });
    } catch {
      setError('試聴できませんでした。元の再生設定に戻りました。根拠は音なしで読めます。');
    }
  }
  return (
    <details
      className="call-relationships"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>呼出・返却・利用の根拠</summary>
      <small>静的に読み取れる関係です。実行時の経路ではありません。新しいモデル呼び出しはありません。</small>
      {data.isFetching && <p role="status">静的な関係を読み取り中…</p>}
      {data.error && <p role="alert">{data.error.message} 元コードで確認してください。</p>}
      {result && (
        <>
          {result.limitations.map((text) => (
            <p className="limit-note" key={text}>
              {text}
            </p>
          ))}
          {result.truncated && <p>先頭24呼出のみ表示しています。残りは未確認です。</p>}
          {!result.links.length && (
            <p>この範囲で表示できる呼出箇所はありません。問題なしという判定ではありません。</p>
          )}
          {!!result.links.length && (
            <label>
              呼出箇所
              <select
                aria-label="呼出箇所"
                value={link?.link_id}
                onChange={(event) => {
                  engine.pause();
                  setSelected(event.target.value);
                }}
              >
                {result.links.map((item) => (
                  <option key={item.link_id} value={item.link_id}>
                    {item.name} · {item.call_span.start_line}行 ·{' '}
                    {item.resolution === 'unresolved' ? '相手は未解決' : '静的な定義候補'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {link && (
            <article data-testid="call-relationship">
              {source('呼び出す箇所', link.call_span)}
              {link.callee_span ? (
                source('相手の静的な定義', link.callee_span)
              ) : (
                <p>相手の定義は未解決です。</p>
              )}
              <b>
                返却候補 · {link.return_spans.length}箇所（
                {link.truncated ? '一部省略の可能性あり' : '全候補を表示'}）
              </b>
              {link.return_spans.map((span, index) => source(`返却候補${index + 1}`, span))}
              {!link.return_spans.length && <p>明示的な返却候補は確認できません。返却値を推測しません。</p>}
              <b>結果の静的な利用 {link.result_binding && `· ${link.result_binding}`}</b>
              {link.use_spans.map((span, index) => source(`利用箇所${index + 1}`, span))}
              {(!link.use_spans.length || link.use_status === 'unresolved') && (
                <p>結果の利用は未確認／追跡範囲外です。</p>
              )}
              {link.truncated && <p>返却候補・利用の表示上限は各16箇所です。残りは未確認です。</p>}
              {link.limitations.map((text) => (
                <small key={text}>{text}</small>
              ))}
              <button disabled={!excerpt?.plan.notes.length} onClick={() => void listen()}>
                この関係の旋律を試聴
              </button>
              {auditionState !== 'idle' && <button onClick={() => engine.pause()}>関係の試聴を取消</button>}
              <small>
                根拠に関連する周辺実装の責務の旋律と処理の打点を、最大10秒聴きます。小節内の間隔を保ち、対象外の小節を省略します。実行順や実行されたreturn経路ではありません。未調査箇所には音を追加しません。
              </small>
              {!!excerpt?.omittedBars && <small>残り{excerpt.omittedBars}小節は省略しています。</small>}
              {!!excerpt?.omittedEventIds.length && (
                <small>
                  関係に重なる打点のうち{excerpt.omittedEventIds.length}
                  件は範囲外です。根拠コードで確認してください。
                </small>
              )}
              {error && <p role="alert">{error}</p>}
            </article>
          )}
        </>
      )}
    </details>
  );
}
