import { useRef, useState } from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import type { ReviewSignal } from '../../../../packages/contracts/SemanticMap';
import type { Bundle } from '../api';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';
import { reviewListening } from '../audio/excerpts';
import { playbackPlan } from '../audio/playback';
import { counterStatusText, signalSelection, verdictText } from '../reviewNavigation';

export function ReviewFocus({ bundle, plan }: { bundle: Bundle; plan: ScorePlan }) {
  const ws = useWorkspace();
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const signals = bundle.map.review_signals ?? [];
  const sourcePlan = playbackPlan(bundle.score, 'repo', 0, true) ?? plan;
  if (!signals.length) return null;
  function dismiss() {
    setExpanded(false);
    menu.current?.querySelector<HTMLElement>('summary')?.focus();
  }
  async function listen(signal: ReviewSignal) {
    dismiss();
    ws.set(signalSelection(bundle, signal));
    const excerpt = reviewListening(sourcePlan, bundle.map, signal);
    if (!excerpt.sequence?.notes.length) return;
    try {
      setError('');
      await engine.playAudition(excerpt.sequence, (note) => {
        if (useWorkspace.getState().following)
          ws.set({
            eventId: note.event_id ?? '',
            unitId: note.unit_id ?? '',
            codeSpan: null,
            signalId: signal.signal_id,
          });
      });
    } catch {
      setError('音源を読み込めません。根拠行は音なしでも選べます。');
      setExpanded(true);
    }
  }
  return (
    <details
      className="review-focus workspace-menu"
      ref={menu}
      data-tour="review-focus"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        確認候補 <span className="candidate-count">{signals.length}</span>
      </summary>
      <div className="review-focus-list" data-tour-content>
        <p className="candidate-intro">保存された解釈です。理由のある違いや判断保留も含みます。</p>
        {signals.map((signal) => {
          const selection = signalSelection(bundle, signal);
          const event = bundle.map.events.find((item) => item.event_id === selection.eventId);
          const span = selection.codeSpan ?? event?.span;
          const excerpt = reviewListening(sourcePlan, bundle.map, signal);
          return (
            <div
              className={`review-focus-item ${ws.signalId === signal.signal_id ? 'selected' : ''}`}
              key={signal.signal_id}
            >
              <span>
                <b>{signal.label}</b>
                <small>
                  {span ? `${span.path}:${span.start_line}–${span.end_line}` : '根拠は右の説明へ'} ·{' '}
                  {verdictText[signal.verdict]} · {counterStatusText[signal.counter_status ?? 'not_checked']}
                </small>
              </span>
              <button
                onClick={() => {
                  engine.pause();
                  ws.set({ ...selection, following: false });
                  dismiss();
                }}
              >
                根拠行 <ArrowUpRight size={12} />
              </button>
              <button disabled={!excerpt.sequence?.notes.length} onClick={() => void listen(signal)}>
                <Play size={12} />
                伴奏なしで聴く
              </button>
              <small>
                {excerpt.unitIds.length > 1
                  ? '先頭二実装をA→Bで聴く。対象は下の比較欄で変更できます。'
                  : '処理の打点と責務のフレーズを聴く。音に表れない違いはコードへ。'}
              </small>
            </div>
          );
        })}
        <small className="focus-explanation">
          共通のベース・和音を外し、関連実装の責務の旋律を残します。各最大10秒、A→Bは最大20秒。比較する対象と音の限界は下の欄に表示します。終了・取消・失敗後は元の位置と再生設定に戻り、一時停止します。
        </small>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
