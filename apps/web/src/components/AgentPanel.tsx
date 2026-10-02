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
  activateLive,
}: {
  bundle: Bundle;
  result?: InvestigationResult;
  events: TraceEvent[];
  pending: boolean;
  investigate: (question: string) => void;
  publish: () => void;
  error: string;
  activateLive?: () => void;
}) {
  const ws = useWorkspace(),
    [question, setQuestion] = useState(''),
    [savedAnswer, setSavedAnswer] = useState('');
  const event = bundle.map.events.find((e) => e.event_id === ws.eventId);
  const unit = bundle.map.units.find((u) => u.unit_id === ws.unitId) ?? bundle.map.units[0];
  const supportingFile =
    !!ws.codeSpan && !bundle.map.units.some((u) => u.primary_span.path === ws.codeSpan?.path);
  const selectedSignal = supportingFile
    ? undefined
    : bundle.map.review_signals?.find(
        (s) => s.event_ids.includes(ws.eventId) || s.unit_ids.includes(unit.unit_id),
      );
  const fixture = bundle.map.origin === 'fixture';
  const recorded = bundle.map.origin === 'recorded_live' && !!ws.sampleId;
  return (
    <section className="agent-panel">
      <div className="panel-heading">
        <span>
          <ScanLine size={15} /> {fixture ? 'サンプルの説明' : 'Gemini Agent'}
        </span>
        <span className={`agent-indicator ${pending ? 'working' : ''}`}>
          {fixture ? '模擬' : recorded ? '保存済み' : pending ? '調査中' : '実解析'}
        </span>
      </div>
      <div className="agent-content">
        <div className="selected-file">
          {ws.codeSpan?.path ?? event?.span.path ?? unit?.primary_span.path}
        </div>
        {!selectedSignal && (
          <>
            <h3>{supportingFile ? '関連資料・型定義' : 'この箇所の判断'}</h3>
            <p>
              {supportingFile
                ? 'このファイルに直接の発音イベントはありません。Agentが実装の意味を判断する際の関連資料として確認できます。'
                : (event?.meaning ?? unit?.boundary_reason)}
            </p>
          </>
        )}
        {selectedSignal && (
          <div className={`structural-finding ${selectedSignal.verdict}`}>
            <div className="finding-label">
              {selectedSignal.verdict === 'concern'
                ? '同じ変更で、一緒に直す箇所'
                : selectedSignal.verdict === 'justified'
                  ? '理由のある境界'
                  : '判断は保留'}
            </div>
            <p>{selectedSignal.explanation}</p>
            {selectedSignal.change_scenario && (
              <div className="change-scenario">
                <b>例えば、仕様がこう変わったら</b>
                {selectedSignal.change_scenario}
              </div>
            )}
            <details className="alternative">
              <summary>別の設計理由も確認しました</summary>
              <p>{selectedSignal.alternative}</p>
            </details>
            {selectedSignal.evidence_ids.map((id) => {
              const proof = bundle.map.evidence.find((e) => e.evidence_id === id);
              return (
                proof && (
                  <button
                    key={id}
                    className="evidence-link"
                    onClick={() => {
                      const target = bundle.map.units.find(
                        (u) =>
                          u.primary_span.path === proof.span.path &&
                          u.primary_span.start_line <= proof.span.start_line &&
                          u.primary_span.end_line >= proof.span.end_line,
                      );
                      ws.set({
                        codeSpan: proof.span,
                        screen: 'inspect',
                        ...(target ? { unitId: target.unit_id } : {}),
                      });
                    }}
                  >
                    {proof.span.path}:{proof.span.start_line}
                    <ArrowUpRight size={14} />
                  </button>
                )
              );
            })}
          </div>
        )}
        {fixture || recorded ? (
          <>
            {selectedSignal?.verdict === 'concern' && (
              <p className="rhythm-explanation">
                同じ旋律の応答が重なる = 複数の場所で同じ判断を管理。オレンジの区間から該当コードへ移れます。
              </p>
            )}
            {recorded && bundle.investigation && (
              <>
                <div className="section-label">保存済み追加調査</div>
                <FindingCards result={bundle.investigation} map={bundle.map} />
              </>
            )}
            {recorded && (
              <details className="trace">
                <summary>
                  Agentの実行記録 · {bundle.trace?.filter((e) => e.type === 'tool_completed').length ?? 0}{' '}
                  回のツール調査
                </summary>
                {bundle.trace
                  ?.filter((e) => e.type === 'tool_completed' || e.type === 'hypothesis_recorded')
                  .map((e) => (
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
      {savedAnswer && (
        <div className="saved-answer">
          <small>保存済み解釈からの回答 · 新しいモデル呼び出しなし</small>
          <p>{savedAnswer}</p>
        </div>
      )}
      <form
        className="question-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (fixture || recorded) {
            const signal =
              bundle.map.review_signals?.find((s) => s.unit_ids.includes(ws.unitId)) ??
              bundle.map.review_signals?.[0];
            setSavedAnswer(
              signal
                ? `${signal.explanation} ${signal.verdict === 'concern' ? '同じ判断の管理が重なるため、同じ旋律の応答を重ねて表しています。根拠のファイル行から確認できます。' : '独立した変更理由が確認されているため、懸念のリズムは追加していません。'}`
                : `${event?.meaning ?? unit?.boundary_reason ?? bundle.map.profile.purpose} 保存された範囲を超える質問には、新しいAgent調査が必要です。`,
            );
          } else
            investigate(question || 'ここの設計判断と、この音になった理由を根拠付きで説明してください。');
          setQuestion('');
        }}
      >
        <div className="question-presets">
          <button
            type="button"
            disabled={pending}
            onClick={() => setQuestion('このファイルのどこを確認すべきですか？')}
          >
            どこを確認する？
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setQuestion('理由のある例外はありますか？')}
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
            placeholder="ここの何が、こんな音になるの？"
          />
          <button aria-label="質問を送信" disabled={pending}>
            <Send size={16} />
          </button>
        </div>
        <small>
          {fixture || recorded
            ? '保存済み根拠を読む · 新規Agent調査はログイン後'
            : '選択範囲と関連コードだけ調査 · 読み取り専用'}
        </small>
        {(fixture || recorded) && (
          <button type="button" className="live-question" onClick={activateLive}>
            Agentに新しく質問する
          </button>
        )}
      </form>
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
