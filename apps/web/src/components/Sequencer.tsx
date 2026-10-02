import { useEffect, useRef } from 'react';
import type { SemanticMap } from '../../../../packages/contracts';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';

const colors = ['#b6a2d5', '#91bea9', '#cdae7a', '#86b0ca', '#c99baf', '#9cafa7'];
export function Sequencer({
  map,
  plan,
  compact = false,
}: {
  map: SemanticMap;
  plan: ScorePlan;
  compact?: boolean;
}) {
  const workspace = useWorkspace();
  const playhead = useRef<SVGLineElement>(null);
  const w = 1024,
    rowHeight = compact ? 29 : 92,
    top = compact ? 36 : 76;
  const height = top + (map.responsibilities.length + 1) * rowHeight;
  const total = plan.total_bars * 1920;
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const x = (engine.tick / total) * w;
      playhead.current?.setAttribute('x1', String(x));
      playhead.current?.setAttribute('x2', String(x));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [total]);
  const select = (unitId?: string | null, eventId = '') =>
    workspace.set({ unitId: unitId ?? '', eventId, codeSpan: null });
  const inspect = () => workspace.set({ screen: 'inspect' });
  const unresolved = (unitId?: string | null) =>
    map.units.find((unit) => unit.unit_id === unitId)?.review_state === 'unresolved';
  return (
    <div className={`sequencer ${compact ? 'compact' : ''}`} data-testid="sequencer">
      <div className="track-rail" style={{ paddingTop: top }}>
        {!compact && <div className="track-title">RESPONSIBILITIES</div>}
        {map.responsibilities.map((r, i) => (
          <div
            className="track"
            style={{ height: rowHeight, borderLeftColor: colors[i] }}
            key={r.responsibility_id}
          >
            <span className="track-number">{String(i + 1).padStart(2, '0')}</span>
            <strong>{r.label}</strong>
            {!compact && (
              <>
                <small>
                  {r.motif_id} ·{' '}
                  {map.events.filter((e) => e.responsibility_id === r.responsibility_id).length} events
                </small>
                <div className="track-controls">
                  <button
                    title={`${r.label}をミュート`}
                    aria-label={`${r.label}をミュート`}
                    aria-pressed={workspace.muted.includes(r.responsibility_id)}
                    onClick={() =>
                      workspace.set({
                        muted: workspace.muted.includes(r.responsibility_id)
                          ? workspace.muted.filter((id) => id !== r.responsibility_id)
                          : [...workspace.muted, r.responsibility_id],
                      })
                    }
                  >
                    M
                  </button>
                  <button
                    title={`${r.label}をソロ`}
                    aria-label={`${r.label}をソロ`}
                    aria-pressed={workspace.solo.includes(r.responsibility_id)}
                    onClick={() =>
                      workspace.set({
                        solo: workspace.solo.includes(r.responsibility_id)
                          ? workspace.solo.filter((id) => id !== r.responsibility_id)
                          : [...workspace.solo, r.responsibility_id],
                      })
                    }
                  >
                    S
                  </button>
                  <span className="voice-meter" style={{ backgroundColor: colors[i] }} />
                </div>
              </>
            )}
          </div>
        ))}
        <div className="track pulse" style={{ height: rowHeight }}>
          <strong>Pulse</strong>
          {!compact && (
            <>
              <small>拍のガイド · コード根拠なし</small>
              <button
                aria-label="Pulseをミュート"
                aria-pressed={workspace.pulseMuted}
                onClick={() => workspace.set({ pulseMuted: !workspace.pulseMuted })}
              >
                M
              </button>
            </>
          )}
        </div>
      </div>
      <div className="piano-roll">
        <svg
          viewBox={`0 0 ${w} ${height}`}
          role="img"
          aria-label={`${plan.mode === 'repo' ? '実装の配置' : '責務ごと'}の譜面`}
        >
          <defs>
            <pattern id="unknown-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 8L8 0" stroke="#c9ceca" strokeWidth="1" />
            </pattern>
            <pattern
              id="finegrid"
              width={w / plan.total_bars / 16}
              height={rowHeight}
              patternUnits="userSpaceOnUse"
            >
              <path d={`M 0 0 V ${height}`} stroke="#edf0ed" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={w} height={height} fill="#fff" />
          <rect y={top} width={w} height={height - top} fill="url(#finegrid)" />
          {Array.from({ length: plan.total_bars + 1 }, (_, bar) => (
            <g key={bar}>
              <line
                x1={(bar / plan.total_bars) * w}
                x2={(bar / plan.total_bars) * w}
                y1={0}
                y2={height}
                stroke="#d4dcd7"
              />
              {bar < plan.total_bars && (
                <text x={(bar / plan.total_bars) * w + 12} y={compact ? 15 : 22} className="bar-number">
                  {String(bar + 1).padStart(2, '0')}
                </text>
              )}
            </g>
          ))}
          {plan.phrases.map((phrase) => (
            <g
              key={phrase.phrase_id}
              role="button"
              tabIndex={0}
              aria-label={`小節 ${phrase.start_bar + 1} ${phrase.label}`}
              onClick={() => select(phrase.unit_id)}
              onDoubleClick={inspect}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  select(phrase.unit_id);
                  inspect();
                }
              }}
            >
              <rect
                x={(phrase.start_bar / plan.total_bars) * w}
                y={compact ? 22 : 40}
                width={(phrase.bar_count / plan.total_bars) * w}
                height={height - (compact ? 22 : 40)}
                fill={
                  unresolved(phrase.unit_id)
                    ? 'url(#unknown-hatch)'
                    : workspace.unitId && workspace.unitId === phrase.unit_id
                      ? '#e8e0f2'
                      : 'transparent'
                }
                fillOpacity={0.6}
              />
              <rect
                x={(phrase.start_bar / plan.total_bars) * w + 3}
                y={compact ? 22 : 40}
                width={(phrase.bar_count / plan.total_bars) * w - 6}
                height={compact ? 12 : 26}
                fill="#eef1ed"
                rx={3}
              />
              <text
                x={(phrase.start_bar / plan.total_bars) * w + 11}
                y={compact ? 31 : 57}
                className="phrase-label"
              >
                {phrase.label.length > 24 ? phrase.label.slice(0, 22) + '…' : phrase.label}
              </text>
            </g>
          ))}
          {map.responsibilities.map((r, i) => (
            <line
              key={r.responsibility_id}
              x1={0}
              x2={w}
              y1={top + (i + 1) * rowHeight}
              y2={top + (i + 1) * rowHeight}
              stroke="#e3e8e3"
            />
          ))}
          {plan.notes.map((note) => {
            const i =
              note.kind === 'pulse'
                ? map.responsibilities.length
                : map.responsibilities.findIndex((r) => r.responsibility_id === note.responsibility_id);
            const x = (note.tick / total) * w,
              y = top + i * rowHeight + rowHeight * 0.5;
            const event = map.events.find((e) => e.event_id === note.event_id);
            const noteWidth = Math.max(8, (note.duration_ms / 1000 / (plan.total_bars * 2.5)) * w);
            if (!event) return <circle key={note.note_id} cx={x + 3} cy={y} r={2} fill="#b3bdb3" />;
            return (
              <g
                key={note.note_id}
                role="button"
                tabIndex={0}
                aria-label={`${event.label} — ${event.span.path}:${event.span.start_line}`}
                data-testid="data-note"
                onClick={(e) => {
                  e.stopPropagation();
                  select(note.unit_id, note.event_id!);
                }}
                onDoubleClick={inspect}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    select(note.unit_id, note.event_id!);
                    inspect();
                  }
                }}
                className="note-group"
              >
                <title>
                  {event.label} · {event.span.path}:{event.span.start_line}
                </title>
                <rect
                  x={x - 3}
                  y={y - 16}
                  width={Math.max(24, noteWidth + 6)}
                  height={32}
                  fill="transparent"
                />
                <rect
                  x={x + 2}
                  y={y - (compact ? 5 : 9)}
                  width={noteWidth}
                  height={compact ? 10 : 18}
                  fill={colors[i]}
                  stroke={workspace.eventId === note.event_id ? '#53436e' : '#ffffff'}
                  strokeWidth={workspace.eventId === note.event_id ? 2 : 1}
                  rx={3}
                />
                {!compact && (
                  <line
                    x1={x + 4}
                    x2={x + noteWidth}
                    y1={y + 17}
                    y2={y + 17}
                    stroke={colors[i]}
                    strokeWidth={2}
                    opacity={0.55}
                  />
                )}
              </g>
            );
          })}
          <line
            ref={playhead}
            y1={0}
            y2={height}
            x1={0}
            x2={0}
            stroke="#c56559"
            strokeWidth={2}
            className="playhead"
          />
        </svg>
      </div>
    </div>
  );
}
