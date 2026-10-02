import { useState } from 'react';
import { ArrowUpRight, Send, ScanLine } from 'lucide-react';
import type { InvestigationResult, SemanticMap } from '../../../../packages/contracts';
import type { Bundle } from '../api';
import { useWorkspace } from '../state';
export type TraceEvent = { seq: number; type: string; timestamp: string; payload: Record<string, any> };
export function AgentPanel({
  bundle,
  result,
  events,
  pending,
  investigate,
  publish,
  error,
}: {
  bundle: Bundle;
  result?: InvestigationResult;
  events: TraceEvent[];
  pending: boolean;
  investigate: (question: string) => void;
  publish: () => void;
  error: string;
}) {
  const ws = useWorkspace(),
    [question, setQuestion] = useState('');
  const event = bundle.map.events.find((e) => e.event_id === ws.eventId);
  const unit = bundle.map.units.find((u) => u.unit_id === ws.unitId);
  const fixture = bundle.map.origin === 'fixture';
  const recorded = bundle.map.origin === 'recorded_live' && !!ws.sampleId;
  return (
    <section className="agent-panel">
      <div className="panel-heading">
        <span>
          <ScanLine size={15} />{' '}
          {fixture ? 'サンプルの読み方' : recorded ? '保存済み実解析' : 'Agent investigation'}
        </span>
        <span className={`agent-indicator ${pending ? 'working' : ''}`}>
          {fixture ? 'FIXTURE' : recorded ? 'RECORDED LIVE' : pending ? 'INVESTIGATING' : 'READ ONLY'}
        </span>
      </div>
      <div className="agent-content">
        <div className="section-label">SELECTED PHRASE</div>
        <h3>{event?.label ?? unit?.label ?? '実装の意味を調べる'}</h3>
        <p className="muted">{event?.meaning ?? unit?.boundary_reason}</p>
        {fixture || recorded ? (
          <>
            <div className="finding-label">
              {fixture ? '手作業サンプルの説明' : 'Geminiがコードを読み、保存した解釈'}
            </div>
            <p>{bundle.map.profile.purpose}</p>
            <p className="muted">
              打点は判断・計算・更新に対応しています。ThemeとRepoで音の素材は同じ。変わるのは実装の場所を表す時間です。
            </p>
            <div className="section-label">CODE EVIDENCE</div>
            <button
              className="evidence-link"
              onClick={() => ws.set({ eventId: event?.event_id ?? '', unitId: unit?.unit_id ?? '' })}
            >
              {event?.span.path ?? unit?.primary_span.path}
              <ArrowUpRight size={14} />
            </button>
            {recorded && bundle.investigation && (
              <>
                <div className="section-label">関連する返品ポリシーの保存済み追加調査</div>
                <FindingCards result={bundle.investigation} map={bundle.map} />
              </>
            )}
            {recorded && (
              <details className="trace">
                <summary>
                  実際の調査記録 · {bundle.trace?.filter((e) => e.type === 'tool_completed').length ?? 0}{' '}
                  tools
                </summary>
                {bundle.trace?.map((e) => (
                  <div key={e.seq}>
                    <b>{e.payload.tool ?? e.type}</b>
                    <small>
                      {e.payload.purpose ?? e.payload.message ?? e.payload.statement ?? e.payload.code}
                    </small>
                  </div>
                ))}
              </details>
            )}
            <p className="limit-note">
              {fixture
                ? 'この説明は模擬データです。Agentの実調査ログではありません。'
                : '保存した実解析の再生です。追加調査は「このサンプルを実解析」から始められます。'}
            </p>
          </>
        ) : (
          <>
            {pending && (
              <p className="progress-line">
                <span className="spinner" />
                選択した範囲と関連する実装を調べています…
              </p>
            )}
            <FindingCards result={result} map={bundle.map} />
            {result?.suggested_reclassification?.length ? (
              <button className="primary wide" onClick={publish}>
                解釈を更新して再生
                <ArrowUpRight size={15} />
              </button>
            ) : null}
            <details className="trace">
              <summary>調査の記録 · {events.filter((e) => e.type === 'tool_completed').length} tools</summary>
              {events.map((e) => (
                <div key={e.seq}>
                  <b>{e.payload.tool ?? e.type}</b>
                  <small>{e.payload.purpose ?? e.payload.message ?? e.payload.code}</small>
                </div>
              ))}
            </details>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!fixture && !recorded && (
        <form
          className="question-form"
          onSubmit={(e) => {
            e.preventDefault();
            investigate(question || 'このフレーズが分かれている理由を調べてください。');
            setQuestion('');
          }}
        >
          <div className="question-presets">
            <button
              type="button"
              disabled={pending}
              onClick={() => investigate('なぜ同じ責務と判断したのですか？')}
            >
              なぜ同じ責務？
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => investigate('理由のある例外はありますか？')}
            >
              例外はある？
            </button>
          </div>
          <div>
            <input
              aria-label="選択した範囲への質問"
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="このフレーズについて質問…"
            />
            <button aria-label="質問を送信" disabled={pending}>
              <Send size={16} />
            </button>
          </div>
          <small>解釈の調査です。ソースコードは変更しません。</small>
        </form>
      )}
    </section>
  );
}

function FindingCards({ result, map }: { result?: InvestigationResult; map: SemanticMap }) {
  const ws = useWorkspace();
  const titles = {
    concern: '懸念あり',
    justified_difference: '理由のある違い',
    inconclusive: '判断保留',
    no_specific_concern: '注目点なし',
  };
  return (
    <>
      {result?.findings.map((finding) => (
        <div className="finding" key={finding.finding_id}>
          <div className="finding-label">{titles[finding.verdict]}</div>
          <p>{finding.summary}</p>
          <small>{finding.justification}</small>
          <div className="section-label">EVIDENCE</div>
          {finding.evidence_ids.slice(0, 3).map((id) => {
            const evidence =
              result.evidence.find((e) => e.evidence_id === id) ??
              map.evidence.find((e) => e.evidence_id === id);
            return (
              evidence && (
                <button
                  key={id}
                  className="evidence-link"
                  onClick={() => ws.set({ codeSpan: evidence.span })}
                >
                  {evidence.span.path}:{evidence.span.start_line}
                  <ArrowUpRight size={14} />
                </button>
              )
            );
          })}
          {finding.limitation && <p className="limit-note">限界：{finding.limitation}</p>}
          {finding.discussion_question && <blockquote>{finding.discussion_question}</blockquote>}
        </div>
      ))}
    </>
  );
}
