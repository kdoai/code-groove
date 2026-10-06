import { useEffect, useRef, useState } from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import type { ScorePlan, ScheduledNote } from '../../../../packages/contracts/ScoreBundle';
import type { Bundle } from '../api';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';

export function ReviewFocus({
  bundle,
  plan,
  select,
  followPlayback,
}: {
  bundle: Bundle;
  plan: ScorePlan;
  select: (note: ScheduledNote, seek?: boolean) => void;
  followPlayback: () => void;
}) {
  const ws = useWorkspace();
  const [error, setError] = useState('');
  const generation = useRef(0);
  const frame = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
    },
    [plan],
  );
  const signals = bundle.map.review_signals?.filter((signal) => signal.verdict === 'concern') ?? [];
  if (!signals.length) return null;
  async function listen(note: ScheduledNote) {
    const request = ++generation.current;
    cancelAnimationFrame(frame.current);
    engine.pause();
    ws.set({ focusEvidence: true, instrumentMutes: [], muted: [], solo: [], following: true, loop: false });
    select(note, false);
    followPlayback();
    engine.seek(note.tick);
    try {
      await engine.play(() => generation.current === request);
      if (generation.current !== request) return;
      setError('');
      const end = Math.min(plan.total_bars * 1920, note.tick + 4 * 1920);
      const deadline = performance.now() + 10000;
      const session = engine.playbackSession;
      const finish = () => {
        if (engine.playbackSession !== session || generation.current !== request) return;
        if (engine.tick >= end || performance.now() >= deadline) engine.pause();
        else frame.current = requestAnimationFrame(finish);
      };
      frame.current = requestAnimationFrame(finish);
    } catch {
      setError('音源を読み込めません。根拠行は音なしでも選べます。');
    }
  }
  return (
    <details className="review-focus" data-tour="review-focus" open>
      <summary>
        確認する箇所 · {signals.length} 件 <small>音の心地よさで良否は判定しません</small>
      </summary>
      <div className="review-focus-list">
        {signals.map((signal) => {
          const event = bundle.map.events.find(
            (event) => signal.event_ids.includes(event.event_id) && event.state === 'grounded',
          );
          const note = plan.notes.find((note) => note.kind === 'data' && note.event_id === event?.event_id);
          const checked = signal.counter_status === 'rejected' && !!signal.comparison;
          return (
            <div
              className={`review-focus-item ${ws.signalId === signal.signal_id ? 'selected' : ''}`}
              key={signal.signal_id}
            >
              <span>
                <b>{signal.label}</b>
                <small>
                  {event
                    ? `${event.span.path}:${event.span.start_line}–${event.span.end_line}`
                    : '根拠は右の説明へ'}{' '}
                  · {checked ? '比較・反証の確認あり' : '懸念候補 · 反証未確認／保留'}
                </small>
              </span>
              <button
                disabled={!note}
                onClick={() => {
                  engine.pause();
                  select(note!);
                  ws.set({ signalId: signal.signal_id, agentVisible: true });
                }}
              >
                根拠行 <ArrowUpRight size={12} />
              </button>
              <button disabled={!note} onClick={() => void listen(note!)}>
                <Play size={12} />
                伴奏なしで聴く
              </button>
            </div>
          );
        })}
      </div>
      <small className="focus-explanation">
        伴奏を外し、保存された判断の打点を最大10秒聴きます。懸念の音は、比較と反証の確認がある場合だけ付きます。
      </small>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
