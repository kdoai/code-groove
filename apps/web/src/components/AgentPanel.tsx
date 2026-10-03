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
  propose,
  proposing = false,
  proposalTitle,
  openProposal,
  cancelProposal,
}: {
  bundle: Bundle;
  result?: InvestigationResult;
  events: TraceEvent[];
  pending: boolean;
  investigate: (question: string) => void;
  publish: () => void;
  error: string;
  activateLive?: () => void;
  propose: (signalId: string) => void;
  proposing?: boolean;
  proposalTitle?: string;
  openProposal: () => void;
  cancelProposal: () => void;
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
          {fixture
            ? '模擬'
            : proposing
              ? '改善案を作成中'
              : pending
                ? '調査中'
                : bundle.map.origin === 'recorded_live'
                  ? '保存済み'
                  : '実解析'}
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
                ? selectedSignal.category === 'data_flow_opacity'
                  ? '処理の流れを追う負担'
                  : selectedSignal.category === 'responsibility_mixing'
                    ? '異なる判断が混ざる箇所'
                    : '同じ変更で、一緒に直す箇所'
                : selectedSignal.verdict === 'justified'
                  ? '理由のある境界'
                  : '判断は保留'}
            </div>
            <p>{selectedSignal.explanation}</p>
            {selectedSignal.change_scenario && (
              <div className="change-scenario">
                <b>
                  {selectedSignal.category === 'data_flow_opacity'
                    ? 'この処理を読み解くとき'
                    : '例えば、仕様がこう変わったら'}
                </b>
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
        {selectedSignal?.verdict === 'concern' && !fixture && (
          <div className="improvement-action" data-tour="improve">
            <button
              className="primary wide"
              disabled={pending || proposing}
              onClick={() => propose(selectedSignal.signal_id)}
            >
              <ScanLine size={15} />
              {proposing ? 'Geminiが改善案を作成中…' : 'Geminiに改善案を依頼'}
            </button>
            <small>コードの書き方と責務を検討 → 差分を確認 → あなたが採用</small>
          </div>
        )}
        {proposing && (
          <p className="progress-line">
            <span className="spinner" />
            {events.filter((e) => e.type === 'progress' || e.type === 'tool_started').at(-1)?.payload
              .message ??
              events.filter((e) => e.type === 'tool_started').at(-1)?.payload.purpose ??
              '関連コードを読み、変更の狙いと代案を検討しています…'}
          </p>
        )}
        {proposing && (
          <button className="wide" onClick={cancelProposal}>
            改善案の作成を停止
          </button>
        )}
        {proposalTitle && (
          <button className="proposal-ready wide" data-tour="proposal" onClick={openProposal}>
            差分を確認：{proposalTitle}
            <ArrowUpRight size={15} />
          </button>
        )}
        {fixture || recorded ? (
          <>
            {selectedSignal?.verdict === 'concern' && (
              <p className="rhythm-explanation">
                {selectedSignal.category === 'data_flow_opacity'
                  ? '応答が途切れる = 処理を追うために判断をまたぐ箇所。'
                  : '同じ旋律が別のファイルで戻る = 同じ判断の管理が分散。'}
                「意味で揃える」と同じ音を寄せて聴けます。オレンジから根拠へ戻れます。
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
            {!!bundle.trace?.length && (
              <details className="trace">
                <summary>
                  Agentの実行記録 · {bundle.trace.filter((e) => e.type === 'tool_completed').length}
                  回のツール調査
                </summary>
                {bundle.trace
                  .filter((e) => e.type === 'tool_completed' || e.type === 'hypothesis_recorded')
                  .map((e) => (
                    <div key={e.seq}>
                      <b>{e.payload.tool ?? e.type}</b>
                      <small>{e.payload.purpose ?? e.payload.message ?? e.payload.statement}</small>
                    </div>
                  ))}
              </details>
            )}
            {!!events.length && (
              <details className="trace">
                <summary>
                  追加調査の記録 · {events.filter((e) => e.type === 'tool_completed').length}
                  回のツール調査
                </summary>
                {events.map((e) => (
                  <div key={e.seq}>
                    <b>{e.payload.tool ?? e.type}</b>
                    <small>{e.payload.purpose ?? e.payload.message ?? e.payload.code}</small>
                  </div>
                ))}
              </details>
            )}
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
            disabled={pending || proposing}
            onClick={() => setQuestion('このファイルのどこを確認すべきですか？')}
          >
            どこを確認する？
          </button>
          <button
            type="button"
            disabled={pending || proposing}
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
          <button aria-label="質問を送信" disabled={pending || proposing}>
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
