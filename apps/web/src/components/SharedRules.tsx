import { useMemo, useState } from 'react';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import type { Bundle } from '../api';
import { engine } from '../audio/engine';
import { focusedExcerpt, sequenceExcerpts } from '../audio/excerpts';
import { playbackPlan } from '../audio/playback';
import { ruleIdentifier, sharedRuleGroups } from '../audio/sharedRules';
import { useAudition } from '../hooks/useAudition';
import { useWorkspace } from '../state';

export function SharedRules({
  bundle,
  setQuestion,
}: {
  bundle: Bundle;
  setQuestion: (question: string) => void;
}) {
  const ws = useWorkspace();
  const groups = useMemo(() => sharedRuleGroups(bundle.map), [bundle.map]);
  const source = useMemo(() => playbackPlan(bundle.score, 'repo', 0, true), [bundle.score]);
  const [key, setKey] = useState('');
  const [aId, setA] = useState('');
  const [bId, setB] = useState('');
  const [error, setError] = useState('');
  const audition = useAudition();
  const group =
    groups.find((g) => g.key === key) ??
    groups.find((g) => g.events.some((e) => e.unit_id === ws.unitId)) ??
    groups[0];
  const a = group?.events.find((e) => e.event_id === aId) ?? group?.events[0];
  const b =
    group?.events.find((e) => e.event_id === bId) ?? group?.events.find((e) => e.unit_id !== a?.unit_id);
  const unrepresented = bundle.map.units.filter(
    (u) =>
      u.review_state !== 'excluded' &&
      !bundle.map.events.some((e) => e.unit_id === u.unit_id && e.state === 'grounded'),
  ).length;
  async function play(plan?: ScorePlan) {
    if (!plan?.notes.length) return;
    if (group) setKey(group.key);
    setError('');
    try {
      await engine.playAudition(plan, (note) => {
        if (useWorkspace.getState().following)
          useWorkspace
            .getState()
            .set({ eventId: note.event_id ?? '', unitId: note.unit_id ?? '', codeSpan: null });
      });
    } catch {
      setError('試聴できませんでした。根拠と関係表示は音なしで確認できます。');
    }
  }
  function prepareQuestion() {
    const selected = a ?? bundle.map.events.find((e) => e.unit_id === ws.unitId);
    if (selected) ws.set({ unitId: selected.unit_id, eventId: selected.event_id, codeSpan: null });
    setQuestion(
      group
        ? group.responsibility.label +
            'の共有ルール（意味キー: ' +
            (a?.concept_key ?? group.events[0].concept_key) +
            '、A: ' +
            (a?.event_id ?? '未選択') +
            '、B: ' +
            (b?.event_id ?? '未選択') +
            '）について、関連実装、呼出元、型、契約、テストを読み直してください。仕様変更時に合わせて確認する範囲と、分離を残す理由・反証・未確認事項を調べてください。初回分類の取りこぼしや過度に広い意味イベントがあれば、根拠付きの追加・置換を提案してください。'
        : 'この実装と別の実装が共有する下位の業務ルールを探してください。名前の違う実装、呼出元、型、契約、テストも確認し、共有する判断と周囲の役割を分けてください。初回の音にない関係と、未確認事項を示してください。',
    );
  }
  return (
    <details className="shared-rules" data-testid="shared-rules">
      <summary>
        共有ルールを比較 <small>{groups.length} 関係</small>
      </summary>
      <p>
        問題判定前から、保存された共有ルールの対応と周囲の役割を比べられます。条件・値・挙動の完全一致は、根拠で確認します。
      </p>
      {group ? (
        <>
          <label>
            比較する共有ルール
            <select
              aria-label="比較する共有ルール"
              value={group.key}
              onChange={(e) => {
                if (engine.auditionSceneId === 'shared_rule_identifier_v1') engine.pause();
                setKey(e.target.value);
                setA('');
                setB('');
              }}
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.responsibility.label} · {g.events[0].label}
                </option>
              ))}
            </select>
          </label>
          <p>{group.responsibility.definition}</p>
          <small>変更理由: {group.responsibility.change_reason}</small>
          {group.ambiguous && <p>同じ実装内に複数の出現があります。対応する範囲を個別に選んでください。</p>}
          <div className="shared-rule-pair">
            {(
              [
                ['A', a, setA],
                ['B', b, setB],
              ] as const
            ).map(([side, selected, setSelected]) => (
              <label key={side}>
                {side}の出現箇所
                <select
                  aria-label={side + 'の出現箇所'}
                  value={selected?.event_id ?? ''}
                  onChange={(e) => {
                    if (engine.auditionSceneId === 'shared_rule_identifier_v1') engine.pause();
                    setSelected(e.target.value);
                  }}
                >
                  {group.events.map((event) => (
                    <option key={event.event_id} value={event.event_id}>
                      {bundle.map.units.find((u) => u.unit_id === event.unit_id)?.label} ·{' '}
                      {event.span.start_line}行
                    </option>
                  ))}
                </select>
                {selected && (
                  <>
                    <button
                      className="evidence-link"
                      onClick={() =>
                        ws.set({
                          unitId: selected.unit_id,
                          eventId: selected.event_id,
                          codeSpan: selected.span,
                          following: false,
                        })
                      }
                    >
                      {side}の根拠 · {selected.span.path}:{selected.span.start_line}–{selected.span.end_line}
                    </button>
                    <small>
                      実装の役割:{' '}
                      {bundle.map.units.find((u) => u.unit_id === selected.unit_id)?.boundary_reason}
                    </small>
                    <p>{selected.meaning}</p>
                    <button
                      onClick={() =>
                        void play(source && ruleIdentifier(source, bundle.map, selected.event_id))
                      }
                    >
                      {side}の識別フレーズを聴く
                    </button>
                    <button
                      onClick={() => void play(source && focusedExcerpt(source, [selected.event_id]).plan)}
                    >
                      {side}の周囲の処理を聴く
                    </button>
                  </>
                )}
              </label>
            ))}
          </div>
          <button
            disabled={!a || !b || a.unit_id === b.unit_id}
            onClick={() => {
              if (!source || !a || !b) return;
              const first = ruleIdentifier(source, bundle.map, a.event_id);
              const second = ruleIdentifier(source, bundle.map, b.event_id);
              if (first && second) void play(sequenceExcerpts(first, second));
            }}
          >
            A→Bの識別フレーズを聴く
          </button>
          <p>
            識別用の固定8音 · 各2.5秒 · 96 BPM ·
            共通の音量。元の演奏の抜粋や実行順ではありません。同じ責務内の意味の違いは、この旋律には表していません。
          </p>
          <p role="status">
            {engine.auditionSceneId === 'shared_rule_identifier_v1' && audition !== 'idle'
              ? audition === 'loading'
                ? '音源を準備中'
                : '共有ルールを試聴中'
              : '停止中'}
          </p>
          {engine.auditionSceneId === 'shared_rule_identifier_v1' && (
            <button onClick={() => engine.pause()}>比較を停止</button>
          )}
        </>
      ) : (
        <p>
          別実装との共有ルールは、この保存結果に対応付けられていません。関係がない・問題がないという判定ではありません。
        </p>
      )}
      <p>音に未対応の実装: {unrepresented}。読取件数は、全ルールや変更影響を確認した件数ではありません。</p>
      <details>
        <summary>比較の版と表現範囲</summary>
        <small>
          コード版: {bundle.map.snapshot_id} · 解釈版: {bundle.map.analysis_id}
        </small>
        <small>
          初回解析: {bundle.map.prompt_version} · 追加解釈:{' '}
          {bundle.map.interpretation_update_version ?? '未記録'}
        </small>
        <small>
          識別比較 v1。音源と音量は現在の再生設定。条件・値と同じ責務内の意味の違いは音へ反映していません。
        </small>
      </details>
      <button onClick={prepareQuestion}>この関係を追加調査する質問を作る</button>
      <small>質問の下書きではモデルを呼び出しません。質問欄で内容を確認して送信します。</small>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
