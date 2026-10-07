import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Span } from '../../../../packages/contracts/SemanticMap';
import { api, type Bundle, type PullRequestNavigation } from '../api';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';

const overlaps = (a: Span, b: Span) =>
  a.path === b.path && a.start_line <= b.end_line && b.start_line <= a.end_line;

const statusText: Record<string, string> = {
  added: '追加',
  modified: '変更',
  removed: '削除',
  renamed: '名前変更',
  copied: 'コピー',
  changed: '変更',
  unchanged: '変更なし',
};

export function PullRequestEvidence({
  bundle,
  analyzeHead,
  pending,
}: {
  bundle: Bundle;
  analyzeHead: (url: string, sha: string) => void;
  pending: boolean;
}) {
  const ws = useWorkspace();
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');
  const base = ws.sampleId ? `/samples/${ws.sampleId}` : `/analyses/${bundle.map.analysis_id}`;
  const query = useQuery({
    queryKey: ['pull-request-evidence', base, bundle.map.snapshot_id, submitted],
    queryFn: () => api<PullRequestNavigation>(`${base}/pull-request?url=${encodeURIComponent(submitted)}`),
    enabled: !!submitted,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const result = query.data?.snapshot_id === bundle.map.snapshot_id ? query.data : undefined;
  function reveal(span: Span, unitId = '', signalId = '') {
    const event = bundle.map.events.find(
      (event) => event.unit_id === unitId && event.state === 'grounded' && overlaps(event.span, span),
    );
    const scene = bundle.score.scenes.findIndex((scene) => scene.unit_ids.includes(unitId));
    engine.pause();
    ws.set({
      codeSpan: span,
      unitId,
      eventId: event?.event_id ?? '',
      signalId,
      following: false,
      ...(signalId ? { agentVisible: true } : {}),
      ...(scene >= 0 ? { scene } : {}),
    });
  }
  return (
    <details className="pr-evidence" key={base}>
      <summary>PRの変更箇所から根拠へ</summary>
      <div className="pr-evidence-body">
        <p>公開PRと表示中の保存済み解析を照合します。読取だけでは新しいAI解析を始めません。</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (submitted === url.trim()) void query.refetch();
            else setSubmitted(url.trim());
          }}
        >
          <label>
            公開PRのURL
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/owner/repo/pull/1"
              required
              maxLength={300}
            />
          </label>
          <button disabled={query.isFetching}>PRを読む</button>
        </form>
        {query.isFetching && <p role="status">PRの版と変更行を読み取り中…</p>}
        {query.error && <p role="alert">{query.error.message}</p>}
        {result && !query.isFetching && !query.error && (
          <>
            <a href={result.url} target="_blank" rel="noreferrer">
              GitHubでPRを確認
            </a>
            <p className="pr-revisions">
              head: {result.head_sha.slice(0, 12)}
              <br />
              base: {result.base_sha.slice(0, 12)}
              <br />
              保存版: {result.snapshot_revision.slice(0, 12)}
            </p>
            {result.matches_snapshot ? (
              <p>headと同じ固定版の保存済み根拠</p>
            ) : (
              <>
                <p>保存版とheadが異なります。変更行へ古い根拠を対応付けません。</p>
                <button
                  disabled={pending}
                  onClick={() => analyzeHead(result.head_repository_url, result.head_sha)}
                >
                  このhead版をAgentで新規解析
                </button>
                <small>ログイン・利用枠が必要です。この操作で新しいモデル要求を開始します。</small>
              </>
            )}
            {result.truncated && <p>先頭300ファイルのみ。残りは未確認です。</p>}
            {result.files.map((file) => (
              <details className="pr-file" key={file.path}>
                <summary>
                  {file.path} · {statusText[file.status] ?? '状態不明'} (+{file.additions} / −{file.deletions}
                  )
                </summary>
                {file.previous_path && <p>以前のパス: {file.previous_path}</p>}
                {!!file.deletions && <p>削除された行はheadにありません。削除の妥当性は未確認です。</p>}
                {file.patch_missing && <p>差分が提供されていません。変更範囲は不明です。</p>}
                {!file.patch_missing && file.patch_incomplete && (
                  <p>差分の一部が欠落しています。読めた範囲だけを表示し、残りは未確認です。</p>
                )}
                {file.ranges_truncated && <p>先頭64行範囲のみ。残りは未確認です。</p>}
                {result.matches_snapshot && !file.source_available && (
                  <p>このファイルは保存済みソースの範囲外です。</p>
                )}
                {file.changed_spans.map((span) => (
                  <button
                    className="evidence-link"
                    key={span.start_line}
                    onClick={() => {
                      const units = bundle.map.units.filter(
                        (unit) =>
                          file.direct_unit_ids.includes(unit.unit_id) && overlaps(unit.primary_span, span),
                      );
                      reveal(span, units.length === 1 ? units[0].unit_id : '');
                    }}
                  >
                    変更行 · {span.path}:{span.start_line}–{span.end_line}
                  </button>
                ))}
                {file.unit_ids.map((id) => {
                  const unit = bundle.map.units.find((unit) => unit.unit_id === id);
                  return (
                    unit && (
                      <button
                        className="evidence-link"
                        key={id}
                        onClick={() => reveal(unit.primary_span, id)}
                      >
                        {file.direct_unit_ids.includes(id) ? '変更のある実装' : '読取根拠に変更がある実装'} ·{' '}
                        {unit.label} · {unit.review_state === 'inspected' ? '保存済み検査' : '未解決・未調査'}
                      </button>
                    )
                  );
                })}
                {file.signal_ids.map((id) => {
                  const signal = bundle.map.review_signals?.find((signal) => signal.signal_id === id);
                  const unit = bundle.map.units.find(
                    (unit) => unit.unit_id === signal?.unit_ids.find((id) => file.unit_ids.includes(id)),
                  );
                  return (
                    signal &&
                    unit && (
                      <button
                        className="evidence-link"
                        key={id}
                        onClick={() => reveal(unit.primary_span, unit.unit_id, id)}
                      >
                        保存された説明 · {signal.label}
                      </button>
                    )
                  );
                })}
                {file.evidence_ids.map((id) => {
                  const proof = bundle.map.evidence.find((proof) => proof.evidence_id === id);
                  return (
                    proof && (
                      <button className="evidence-link" key={id} onClick={() => reveal(proof.span)}>
                        関連する読取根拠 · {proof.span.path}:{proof.span.start_line}–{proof.span.end_line}
                      </button>
                    )
                  );
                })}
                {file.evidence_truncated && <p>読取根拠は先頭96件のみ。残りは未表示です。</p>}
                {result.matches_snapshot && !file.unit_ids.length && (
                  <p>変更行に対応する保存済みの実装・解釈はありません。問題なしという判定ではありません。</p>
                )}
              </details>
            ))}
            <small>実装を開くと、Agent欄の「呼出・返却・利用の根拠」から静的な関係も確認できます。</small>
            {result.limitations.map((text) => (
              <p className="limit-note" key={text}>
                {text}
              </p>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
