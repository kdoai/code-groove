import { useEffect, useMemo, useState } from 'react';
import type { ReviewSignal } from '../../../../packages/contracts/SemanticMap';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import type { Bundle } from '../api';
import { playbackPlan } from '../audio/playback';
import { reviewListening } from '../audio/excerpts';
import { engine } from '../audio/engine';
import { useWorkspace } from '../state';
import { useAudition } from '../hooks/useAudition';
import { motifColors } from '../responsibilityColors';

export function ReviewListening({ bundle, signal }: { bundle: Bundle; signal: ReviewSignal }) {
  const ws = useWorkspace();
  const auditionState = useAudition();
  const state = engine.auditionSceneId === `review_${signal.signal_id}` ? auditionState : 'idle';
  const [a, setA] = useState<string>(),
    [b, setB] = useState<string>();
  const [error, setError] = useState('');
  const [active, setActive] = useState({ unitId: '', eventId: '' });
  useEffect(() => {
    if (state !== 'playing') return;
    const timer = setInterval(() => {
      const notes = engine.soundingNotes;
      const note = notes.find((item) => item.kind === 'data') ?? notes.find((item) => item.event_id);
      const next = { unitId: note?.unit_id ?? '', eventId: note?.event_id ?? '' };
      setActive((previous) =>
        previous.unitId === next.unitId && previous.eventId === next.eventId ? previous : next,
      );
    }, 90);
    return () => clearInterval(timer);
  }, [state]);
  const source = useMemo(() => playbackPlan(bundle.score, 'repo', 0, true), [bundle.score]);
  const listening = useMemo(
    () => source && reviewListening(source, bundle.map, signal, a, b),
    [source, bundle.map, signal, a, b],
  );
  if (!listening) return null;
  const roles = new Set(
    bundle.map.events
      .filter((event) => listening.unitIds.includes(event.unit_id) && event.state === 'grounded')
      .map((event) => event.responsibility_id),
  );
  async function play(plan?: ScorePlan) {
    if (!plan?.notes.length) return;
    ws.set({ signalId: signal.signal_id });
    setError('');
    try {
      await engine.playAudition(plan, (note) => {
        if (useWorkspace.getState().following)
          ws.set({
            eventId: note.event_id ?? '',
            unitId: note.unit_id ?? '',
            codeSpan: null,
            signalId: signal.signal_id,
          });
      });
    } catch {
      setError('試聴できませんでした。元の再生設定に戻りました。根拠は音なしで読めます。');
    }
  }
  return (
    <section className="review-listening" aria-label="確認候補のフレーズ" data-testid="review-listening">
      <b>何を聴き比べるか</b>
      <p>
        旋律で責務を見分け、処理の打点を根拠コードと照合します。旋律の反復は識別用で、実行回数ではありません。
      </p>
      <div className="listening-sides">
        {(['A', 'B'] as const)
          .filter((side) => side === 'A' || listening.unitIds.length > 1)
          .map((side, index) => {
            const unitId = side === 'A' ? listening.unitA : listening.unitB;
            const unit = bundle.map.units.find((item) => item.unit_id === unitId);
            const plan = side === 'A' ? listening.a : listening.b;
            const events = bundle.map.events.filter(
              (event) =>
                event.state === 'grounded' &&
                plan.notes.some((note) => note.kind === 'data' && note.event_id === event.event_id),
            );
            const roleNames = [
              ...new Set(
                events.map(
                  (event) =>
                    bundle.map.responsibilities.find(
                      (role) => role.responsibility_id === event.responsibility_id,
                    )?.label,
                ),
              ),
            ];
            return (
              <div
                key={side}
                className={`listening-side ${state === 'playing' && active.unitId === unitId ? 'sounding' : ''}`}
              >
                <label>
                  {side}の実装
                  <select
                    aria-label={`試聴${side}の実装`}
                    value={unitId}
                    onChange={(event) => {
                      engine.pause();
                      (side === 'A' ? setA : setB)(event.target.value);
                    }}
                  >
                    {listening.unitIds.map((id) => (
                      <option key={id} value={id}>
                        {bundle.map.units.find((item) => item.unit_id === id)?.label ?? '未調査の実装'}
                      </option>
                    ))}
                  </select>
                </label>
                <small>{roleNames.join(' / ') || '責務の音は未記録'}</small>
                <small>
                  {plan.total_bars}小節 · 処理{events.length}打点 · 責務の旋律
                  {plan.notes.filter((note) => note.kind === 'accompaniment').length}音 · 省略
                  {listening.omittedBars[index]}小節
                </small>
                {!!listening.paddingBars[index] && (
                  <small>
                    末尾{listening.paddingBars[index]}小節は長さを揃える休符です。コードの間隔を表しません。
                  </small>
                )}
                <svg viewBox="0 0 320 42" role="img" aria-label={`${side}の責務の旋律と処理の打点`}>
                  <text x="0" y="13">
                    旋律
                  </text>
                  <text x="0" y="35">
                    処理
                  </text>
                  {Array.from({ length: plan.total_bars + 1 }, (_, bar) => (
                    <line
                      key={bar}
                      x1={40 + (bar * 275) / Math.max(1, plan.total_bars)}
                      x2={40 + (bar * 275) / Math.max(1, plan.total_bars)}
                      y1="2"
                      y2="39"
                      className="listening-bar"
                    />
                  ))}
                  {plan.notes.map((note) => (
                    <rect
                      key={note.note_id}
                      x={40 + (note.tick * 275) / Math.max(1920, plan.total_bars * 1920)}
                      y={note.kind === 'data' ? 27 : 5}
                      width={
                        note.kind === 'data'
                          ? 3
                          : Math.max(
                              2,
                              (note.duration_ms * 0.768 * 275) / Math.max(1920, plan.total_bars * 1920),
                            )
                      }
                      height="8"
                      className={note.kind === 'data' ? 'listening-point' : 'listening-melody'}
                      style={{
                        fill: motifColors[
                          Number(
                            bundle.map.responsibilities
                              .find((role) => role.responsibility_id === note.responsibility_id)
                              ?.motif_id.slice(1) ?? 0,
                          )
                        ],
                      }}
                    />
                  ))}
                </svg>
                <div className="listening-events">
                  {events.map((event) => (
                    <button
                      key={event.event_id}
                      className={active.eventId === event.event_id && state === 'playing' ? 'sounding' : ''}
                      onClick={() => {
                        engine.pause();
                        ws.set({
                          eventId: event.event_id,
                          unitId: event.unit_id,
                          codeSpan: null,
                          following: false,
                          signalId: signal.signal_id,
                        });
                      }}
                    >
                      {event.label} · {event.span.start_line}行
                      {signal.event_ids.includes(event.event_id) ? '（確認ポイント）' : '（周辺の処理）'}
                    </button>
                  ))}
                </div>
                {!plan.notes.length && <small>この実装の音は未記録です。補完しません。</small>}
                {unit && (
                  <small>
                    {unit.primary_span.path}:{unit.primary_span.start_line}–{unit.primary_span.end_line}
                  </small>
                )}
                <button disabled={!plan.notes.length} onClick={() => void play(plan)}>
                  {side}のフレーズを聴く
                </button>
              </div>
            );
          })}
      </div>
      <div className="listening-controls">
        {listening.unitIds.length > 1 && (
          <button disabled={!listening.sequence?.notes.length} onClick={() => void play(listening.sequence)}>
            A→Bのフレーズを聴く
          </button>
        )}
        {state !== 'idle' && <button onClick={() => engine.pause()}>フレーズの試聴を取消</button>}
        <span role="status">
          {state === 'idle' ? '停止中' : state === 'loading' ? '音源を準備中' : '試聴中'}
        </span>
      </div>
      <small>
        96 BPM · 共通の音量 · 各最大4小節。二実装は同じ小節数で聴きます。掲載順は実行順ではありません。
      </small>
      {listening.unitIds.length > 1 && (
        <p>
          同じ責務・意味キーが一対一で対応しない項目：
          {listening.uncertainKeys ? `${listening.uncertainKeys.length}件（対応不明）` : '比較未確認'}
          。値・条件・共有状態の安全性は、音だけでは比較できません。
        </p>
      )}
      {listening.unitA === listening.unitB && listening.unitIds.length > 1 && (
        <p>異なる二実装を選んでください。</p>
      )}
      {signal.category === 'responsibility_mixing' && roles.size === 1 && (
        <p>
          この保存結果は単一の責務に分類されています。「責務の混在」を異なる旋律では確認できません。説明と分類を根拠コードで確かめてください。
        </p>
      )}
      {listening.unitIds.length === 1 && (
        <small>別実装との比較は未記録です。この実装の文脈を聴きます。</small>
      )}
      {!!listening.omittedEventIds.length && (
        <p>
          音に含まれない確認ポイント：{listening.omittedEventIds.length}
          件。ほかの実装を選ぶか、根拠コードで確認してください。
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
