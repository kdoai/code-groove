import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Bundle } from '../api';
import type { InvestigationResult } from '../../../../packages/contracts';
import { engine } from '../audio/engine';
import { playbackPlan } from '../audio/playback';
import { useWorkspace } from '../state';
import { SharedRules } from './SharedRules';
import { sharedRuleGroups } from '../audio/sharedRules';

type Trial = {
  name: string;
  status: string;
  model_requests: number;
  input_tokens: number;
  output_tokens: number;
  seconds: number;
  shared_occurrences?: number;
  comparable?: boolean;
  review?: string;
  error_code?: string;
};
type Inspection = {
  case: {
    case_id: string;
    revision: string;
    question: string;
    reference_status: string;
    rules: {
      occurrences: {
        label: string;
        path: string;
        start_line: number;
        end_line: number;
        full_span: NonNullable<Bundle['map']['units'][number]['primary_span']>;
      }[];
    }[];
    required_checks: {
      id: string;
      expected: string | string[];
      reason?: string;
      path?: string;
      lines?: number[];
      related?: { path: string; lines: number[] }[];
    }[];
  };
  initial_bundle: Bundle;
  draft_bundle: Bundle;
  investigation: {
    candidate: InvestigationResult;
    evidence: InvestigationResult['evidence'];
    trace: Bundle['trace'];
  };
  evaluation: {
    trials: Trial[];
    selected_initial_trial: string;
    selection_reason: string;
    summary: string;
    limitations: string[];
    reserved_max_yen: number;
    estimated_introductory_usd: number;
  };
};

export function TsugiaiSessionInspection() {
  const ws = useWorkspace();
  const [draftOpened, setDraftOpened] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [question, setQuestion] = useState('');
  const [startedAt, setStartedAt] = useState<number>();
  const [conditionHistory, setConditionHistory] = useState<
    { sound_enabled: boolean; elapsed_seconds: number }[]
  >([]);
  const [judgment, setJudgment] = useState('');
  const [targets, setTargets] = useState('');
  const [boundaries, setBoundaries] = useState('');
  const [unknowns, setUnknowns] = useState('');
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ['tsugiai-session-inspection-v1'],
    queryFn: () => api<Inspection>('/samples/recorded-tsugiai-agents/session-inspection'),
    retry: false,
    staleTime: Infinity,
  });
  const inspection = query.data;
  const bundle = inspection && (draftOpened ? inspection.draft_bundle : inspection.initial_bundle);
  const score = bundle?.score;
  const activeEvent = bundle?.map.events.find((e) => e.event_id === ws.eventId);
  const span = ws.codeSpan ?? activeEvent?.span;
  const lines = span && bundle?.sources[span.path]?.split('\n');
  useEffect(() => {
    ws.set({ following: true, codeSpan: null, eventId: '', unitId: '' });
    return () => engine.pause();
  }, []);
  useEffect(() => {
    const plan = score && playbackPlan(score, 'repo', 0, true);
    if (plan) engine.configure(plan);
    return () => engine.pause();
  }, [score]);
  function openDraft() {
    engine.pause();
    ws.set({ following: true, codeSpan: null, eventId: '', unitId: '' });
    setDraftOpened(true);
    setSaved(false);
  }
  function decision() {
    return {
      protocol: 'tsugiai-session-human-decision-v1',
      case_id: inspection!.case.case_id,
      revision: inspection!.case.revision,
      analysis_id: bundle!.map.analysis_id,
      interpretation_status: draftOpened ? 'investigation_draft_not_published' : 'initial',
      condition:
        startedAt === undefined
          ? 'untracked'
          : new Set(conditionHistory.map((c) => c.sound_enabled)).size > 1
            ? 'mixed'
            : soundEnabled
              ? 'sound_on'
              : 'sound_off',
      condition_history: conditionHistory,
      elapsed_seconds: startedAt ? Math.round((performance.now() - startedAt) / 1000) : null,
      judgment,
      targets,
      boundaries,
      unknowns,
      created_at: new Date().toISOString(),
      utility_measurement: 'single_development_task_not_causal_comparison',
    };
  }
  function saveDecision(exportFile: boolean) {
    const value = decision();
    localStorage.setItem('code-groove-tsugiai-session-decision-v1', JSON.stringify(value));
    setSaved(true);
    if (exportFile) {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tsugiai-session-decision.json';
      anchor.click();
      URL.revokeObjectURL(url);
    }
  }
  return (
    <main className="session-inspection" data-testid="tsugiai-session-inspection">
      <a href="/projects/sample-recorded-tsugiai-agents/inspect">← TSUGIAIの保存済み解析へ</a>
      <span className="eyebrow">TSUGIAI · CHANGE INSPECTION</span>
      <h1>同じセッションの前提を、どこまで一緒に確認するか。</h1>
      <p>変更課題 → Agentの探索と反例 → 音と根拠の比較 → あなたの判断</p>
      {query.isPending && <p role="status">GCPで実行した記録を読み込んでいます。</p>}
      {query.error && <p role="alert">{query.error.message} 記録の代わりに模擬結果を表示しません。</p>}
      {inspection && bundle && (
        <>
          <section>
            <h2>1. 変更課題と確認範囲</h2>
            <p>{inspection.case.question}</p>
            <small>
              固定版: {inspection.case.revision} · 分類対象9実装 · 参考コード51ファイル ·
              対象コードの実行・変更なし
            </small>
            <p>
              評価表はモデル実行前に作成した、ソース照合済みのAgent草案です。独立した人の正解評価と、音による効果の測定は別に必要です。
            </p>
            <details>
              <summary>事前に作った根拠付き評価表</summary>
              <div className="inspection-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>確認対象</th>
                      <th>期待する確認と境界</th>
                      <th>根拠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspection.case.required_checks.map((check) => (
                      <tr key={check.id}>
                        <td>{check.id}</td>
                        <td>
                          {Array.isArray(check.expected) ? check.expected.join('、') : check.expected}{' '}
                          {check.reason}
                        </td>
                        <td>
                          {[
                            ...(check.path && check.lines ? [{ path: check.path, lines: check.lines }] : []),
                            ...(check.related ?? []),
                            ...(check.id === 'five_context_consumers'
                              ? inspection.case.rules[0].occurrences.map((o) => ({
                                  path: o.path,
                                  lines: [o.start_line, o.end_line],
                                }))
                              : []),
                          ].map((proof) => (
                            <button
                              key={`${proof.path}:${proof.lines[0]}`}
                              className="evidence-link"
                              onClick={() =>
                                ws.set({
                                  codeSpan: {
                                    file_id: '',
                                    path: proof.path,
                                    start_line: proof.lines[0],
                                    end_line: proof.lines[1],
                                  },
                                  following: false,
                                })
                              }
                            >
                              {proof.path}:{proof.lines.join('–')}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <button
              disabled={startedAt !== undefined}
              onClick={() => {
                setStartedAt(performance.now());
                setConditionHistory([{ sound_enabled: soundEnabled, elapsed_seconds: 0 }]);
              }}
            >
              {startedAt === undefined ? '検査を開始して時間を記録' : '検査時間を記録中'}
            </button>
          </section>
          <section>
            <h2>2. 現行Agentと通常AIレビューの実行結果</h2>
            <p>{inspection.evaluation.summary}</p>
            <div className="inspection-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>試行</th>
                    <th>状態</th>
                    <th>モデル要求</th>
                    <th>入出力トークン</th>
                    <th>秒</th>
                    <th>共有対応</th>
                  </tr>
                </thead>
                <tbody>
                  {inspection.evaluation.trials.map((trial) => (
                    <tr key={trial.name}>
                      <td>{trial.name}</td>
                      <td>
                        {trial.status}
                        {trial.error_code ? ` / ${trial.error_code}` : ''}
                      </td>
                      <td>{trial.model_requests}</td>
                      <td>
                        {trial.input_tokens.toLocaleString()} / {trial.output_tokens.toLocaleString()}
                      </td>
                      <td>{trial.seconds}</td>
                      <td>
                        {trial.shared_occurrences === undefined
                          ? trial.name.startsWith('baseline')
                            ? '自由記述・対象外'
                            : '提出なし'
                          : `${trial.shared_occurrences}/5 · ${trial.comparable ? '対応あり' : '比較未成立'}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small>
              表示する初回版: {inspection.evaluation.selected_initial_trial}。
              {inspection.evaluation.selection_reason}
            </small>
            <small>失敗した試行のトークン数には、応答前に確保した予約値が含まれます。</small>
            <details>
              <summary>比較条件と評価の限界</summary>
              <ul>
                {inspection.evaluation.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </details>
            <details>
              <summary>通常AIレビューの回答をすべて読む</summary>
              {inspection.evaluation.trials
                .filter((t) => t.name.startsWith('baseline'))
                .map((trial) => (
                  <article key={trial.name}>
                    <h3>{trial.name}</h3>
                    <pre className="inspection-review">{trial.review ?? trial.error_code ?? '回答なし'}</pre>
                  </article>
                ))}
            </details>
            <small>
              AI利用の保守的な予約上限合計: {inspection.evaluation.reserved_max_yen.toFixed(0)}円 /
              許可5,000円。記録トークン（失敗時は予約値）と導入料金による推計: $
              {inspection.evaluation.estimated_introductory_usd.toFixed(3)}。実請求額ではありません。
            </small>
          </section>
          <section>
            <h2>3. 追加調査で分かったことと反例</h2>
            {inspection.investigation.candidate.findings.map((finding) => (
              <article key={finding.finding_id}>
                <h3>{finding.summary}</h3>
                <p>{finding.justification}</p>
                {finding.limitation && <p>未確認: {finding.limitation}</p>}
                {finding.evidence_ids.map((id) => {
                  const proof = inspection.investigation.evidence.find((e) => e.evidence_id === id);
                  return (
                    proof && (
                      <button
                        key={id}
                        className="evidence-link"
                        onClick={() => ws.set({ codeSpan: proof.span, following: false })}
                      >
                        {proof.span.path}:{proof.span.start_line}–{proof.span.end_line}
                      </button>
                    )
                  );
                })}
              </article>
            ))}
            <details>
              <summary>仮説と反証の確認状態</summary>
              {inspection.investigation.candidate.hypotheses.map((hypothesis) => (
                <article key={hypothesis.hypothesis_id}>
                  <p>{hypothesis.statement}</p>
                  <p>
                    反証の問い: {hypothesis.counter_question} · {hypothesis.status}
                  </p>
                </article>
              ))}
            </details>
            <details>
              <summary>今回の探索記録</summary>
              <ol>
                {inspection.investigation.trace
                  ?.filter((e) => ['tool_completed', 'tool_failed', 'model_error'].includes(e.type))
                  .map((event) => (
                    <li key={event.seq}>
                      {String(event.payload.tool ?? event.type)} ·{' '}
                      {String(event.payload.purpose ?? event.payload.validation ?? '')}
                    </li>
                  ))}
              </ol>
            </details>
            <button onClick={openDraft} disabled={draftOpened}>
              追加調査案を比較用に開く
            </button>
            <p>
              内容を確認してから、未採用の解釈案をこの画面で試聴します。元の記録・ソース・公開サンプルは保持します。
            </p>
          </section>
          <section>
            <h2>4. 同じ前提と、異なる周囲の役割を比較する</h2>
            <p role="status">
              {draftOpened ? '追加調査案・未採用' : '初回解析'} · {sharedRuleGroups(bundle.map).length}{' '}
              共有関係
            </p>
            <label>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => {
                  engine.pause();
                  setSoundEnabled(event.target.checked);
                  if (startedAt !== undefined)
                    setConditionHistory((history) => [
                      ...history,
                      {
                        sound_enabled: event.target.checked,
                        elapsed_seconds: Math.round((performance.now() - startedAt) / 1000),
                      },
                    ]);
                  setSaved(false);
                }}
              />
              音を使って比較する
            </label>
            <label>
              <input
                type="checkbox"
                checked={ws.following}
                onChange={(event) => ws.set({ following: event.target.checked })}
              />
              再生中の箇所を根拠へ表示
            </label>
            <SharedRules
              key={bundle.map.analysis_id}
              bundle={bundle}
              setQuestion={setQuestion}
              soundEnabled={soundEnabled}
            />
            {question && (
              <label>
                選んだ関係から作った次の調査質問
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
              </label>
            )}
            <p>
              ここでは質問の下書きまでで、新しいAI利用は始まりません。識別フレーズは条件・値・実行時の隔離を表しません。
            </p>
            <div className="inspection-source" data-testid="inspection-source">
              {span && lines ? (
                <>
                  <strong>
                    {span.path}:{span.start_line}–{span.end_line}
                  </strong>
                  {!ws.codeSpan && activeEvent && (
                    <p>
                      {activeEvent.label}: {activeEvent.meaning}
                    </p>
                  )}
                  <pre>
                    {lines
                      .slice(Math.max(0, span.start_line - 3), span.end_line + 2)
                      .map((line, offset) => `${Math.max(1, span.start_line - 2) + offset}: ${line}`)
                      .join('\n')}
                  </pre>
                </>
              ) : (
                <p>根拠リンクか音を選ぶと、固定ソースの該当行を表示します。</p>
              )}
            </div>
          </section>
          <section>
            <h2>5. あなたの判断を残す</h2>
            <p>
              一緒に確認する実装と、写真依頼・Phase3の境界を残す理由を根拠付きで説明してください。AIはこの欄を自動で埋めません。
            </p>
            <label>
              確認する実装と根拠
              <textarea
                aria-label="確認する実装と根拠"
                value={targets}
                onChange={(e) => {
                  setTargets(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              分離を残す理由と根拠
              <textarea
                aria-label="分離を残す理由と根拠"
                value={boundaries}
                onChange={(e) => {
                  setBoundaries(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              未確認・追加調査が必要な事項
              <textarea
                aria-label="未確認・追加調査が必要な事項"
                value={unknowns}
                onChange={(e) => {
                  setUnknowns(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              判断
              <select
                aria-label="検査の判断"
                value={judgment}
                onChange={(e) => {
                  setJudgment(e.target.value);
                  setSaved(false);
                }}
              >
                <option value="">選択してください</option>
                <option value="impact_explained">変更影響と残す境界を説明できた</option>
                <option value="needs_investigation">追加調査が必要</option>
                <option value="inconclusive">判断保留</option>
              </select>
            </label>
            <button
              disabled={!judgment || !targets.trim() || !boundaries.trim() || !unknowns.trim()}
              onClick={() => saveDecision(false)}
            >
              判断をこの端末に保存
            </button>
            <button
              disabled={!judgment || !targets.trim() || !boundaries.trim() || !unknowns.trim()}
              onClick={() => saveDecision(true)}
            >
              判断をJSONで書き出す
            </button>
            {saved && (
              <p role="status">
                判断をこの端末に保存しました。サーバーへの送信や調査案の採用は行っていません。
              </p>
            )}
            <small>
              この一件は操作確認用です。同じ答えを覚えた後の音あり／なしの再試行から、音の優位性は判定しません。
            </small>
          </section>
        </>
      )}
    </main>
  );
}
