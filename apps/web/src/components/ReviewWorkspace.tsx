import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Folder, Headphones, Play, ScanLine } from 'lucide-react';
import type { ScorePlan, ScheduledNote } from '../../../../packages/contracts/ScoreBundle';
import type { Bundle } from '../api';
import { engine } from '../audio/engine';
import { useWorkspace } from '../state';

const CodePanel = lazy(() => import('./CodePanel').then((module) => ({ default: module.CodePanel })));
const motifColors = ['#c7cfff', '#a6ddce', '#aad4ef', '#e4bfde', '#b8debd', '#edc4ae'];
export function SampleSwitch({ openSample }: { openSample: (id: string) => void }) {
  return (
    <div className="sample-switch">
      <button data-tour="album" onClick={() => openSample('recorded-checkout-flow')}>
        サンプルを開く
      </button>
    </div>
  );
}

type TreeNode = { name: string; path: string; children: TreeNode[] };
function sourceTree(paths: string[]) {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const path of paths.sort()) {
    let parent = root;
    const parts = path.split('/');
    parts.forEach((name, index) => {
      const joined = parts.slice(0, index + 1).join('/');
      let node = parent.children.find((child) => child.path === joined);
      if (!node) {
        node = { name, path: joined, children: [] };
        parent.children.push(node);
      }
      parent = node;
    });
  }
  return root.children;
}
function DirectoryTree({
  nodes,
  selected,
  select,
  concernPaths,
  depth = 0,
}: {
  nodes: TreeNode[];
  selected: string;
  select: (path: string) => void;
  concernPaths: Set<string>;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  return (
    <ul className="directory-tree">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.children.length ? (
            <>
              <button
                className="directory-row"
                style={{ paddingLeft: 10 + depth * 12 }}
                aria-expanded={!collapsed.includes(node.path)}
                onClick={() =>
                  setCollapsed(
                    collapsed.includes(node.path)
                      ? collapsed.filter((path) => path !== node.path)
                      : [...collapsed, node.path],
                  )
                }
              >
                {collapsed.includes(node.path) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <Folder size={13} />
                <span>{node.name}</span>
              </button>
              {!collapsed.includes(node.path) && (
                <DirectoryTree
                  nodes={node.children}
                  selected={selected}
                  select={select}
                  concernPaths={concernPaths}
                  depth={depth + 1}
                />
              )}
            </>
          ) : (
            <button
              className={`tree-file ${node.path === selected ? 'selected' : ''}`}
              style={{ paddingLeft: 25 + depth * 12 }}
              title={node.path}
              onClick={() => select(node.path)}
            >
              <FileCode2 size={13} />
              <span>{node.name}</span>
              {concernPaths.has(node.path) && <i className="concern-dot" />}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ReviewWorkspace({
  bundle,
  plan,
  children,
}: {
  bundle: Bundle;
  plan: ScorePlan;
  children: React.ReactNode;
}) {
  const ws = useWorkspace();
  const [following, setFollowing] = useState(true);
  const unit = bundle.map.units.find((u) => u.unit_id === ws.unitId) ?? bundle.map.units[0];
  const selectedPath = ws.codeSpan?.path ?? unit.primary_span.path;
  const concernPaths = new Set(
    bundle.map.units
      .filter((u) =>
        bundle.map.review_signals?.some((s) => s.verdict === 'concern' && s.unit_ids.includes(u.unit_id)),
      )
      .map((u) => u.primary_span.path),
  );
  function select(note: ScheduledNote, seek = true) {
    if (!note.event_id) return;
    ws.set({
      eventId: note.event_id,
      unitId: note.unit_id!,
      codeSpan: null,
      scene: Math.max(
        0,
        bundle.score.scenes.findIndex((s) => s.unit_ids.includes(note.unit_id!)),
      ),
    });
    if (seek) {
      setFollowing(false);
      engine.seek(note.tick);
    }
  }
  function selectFile(path: string) {
    setFollowing(false);
    const target =
      bundle.map.units.find((u) => u.primary_span.path === path && concernPaths.has(path)) ??
      bundle.map.units.find((u) => u.primary_span.path === path);
    const event = bundle.map.events.find((e) => e.unit_id === target?.unit_id);
    ws.set({
      unitId: target?.unit_id ?? '',
      eventId: event?.event_id ?? '',
      codeSpan: event
        ? null
        : {
            file_id: bundle.map.evidence.find((e) => e.span.path === path)?.span.file_id ?? 'source_preview',
            path,
            start_line: 1,
            end_line: 1,
          },
      scene: target
        ? Math.max(
            0,
            bundle.score.scenes.findIndex((s) => s.unit_ids.includes(target.unit_id)),
          )
        : ws.scene,
    });
  }
  return (
    <div className="review-workspace">
      <aside className="file-sidebar">
        <div className="pane-heading">
          Repository<span>{Object.keys(bundle.sources).length} files</span>
        </div>
        <div className="file-list" data-testid="repository-tree">
          <DirectoryTree
            nodes={sourceTree(Object.keys(bundle.sources))}
            selected={selectedPath}
            select={selectFile}
            concernPaths={concernPaths}
          />
        </div>
        <div className="file-scope">
          <span>
            <ScanLine size={13} />
            Agentが読取を確認
          </span>
          <strong>
            {bundle.map.coverage.inspected_units}/{bundle.map.coverage.indexed_units} 関数
          </strong>
          <small>
            型・READMEも階層に表示
            <br />
            未確認範囲に音の意味を作りません
          </small>
        </div>
      </aside>
      <main className="review-center">
        <Arrangement
          bundle={bundle}
          plan={plan}
          following={following}
          select={select}
          followPlayback={() => setFollowing(true)}
        />
        <div className="code-toolbar">
          <span>
            選択した音の根拠 <b>{selectedPath}</b>
          </span>
          <button aria-pressed={following} onClick={() => setFollowing(!following)}>
            演奏に追従
          </button>
        </div>
        <div className="review-code">
          <Suspense fallback={<div className="code-loading">コードを読み込み中…</div>}>
            <CodePanel bundle={bundle} />
          </Suspense>
        </div>
      </main>
      <aside className="review-agent" data-tour="chat">
        {children}
      </aside>
    </div>
  );
}

function Arrangement({
  bundle,
  plan,
  following,
  select,
  followPlayback,
}: {
  bundle: Bundle;
  plan: ScorePlan;
  following: boolean;
  select: (note: ScheduledNote, seek?: boolean) => void;
  followPlayback: () => void;
}) {
  const ws = useWorkspace();
  const [active, setActive] = useState<ScheduledNote[]>([]),
    [audioError, setAudioError] = useState('');
  const trackHeads = useRef(new Map<string, HTMLDivElement>()),
    trackRows = useRef(new Map<string, HTMLDivElement>()),
    trackContainer = useRef<HTMLDivElement>(null),
    overviewHead = useRef<HTMLDivElement>(null),
    lastFollowed = useRef('');
  const total = plan.total_bars * 1920;
  const musical = plan.notes.filter((n) => n.kind !== 'pulse' || !ws.pulseMuted);
  function noteColor(note: ScheduledNote) {
    if (note.kind === 'cue') return '#ffbc66';
    if (!note.event_id) return '#74849c';
    const role = bundle.map.responsibilities.find((r) => r.responsibility_id === note.responsibility_id);
    return motifColors[Number(role?.motif_id.slice(1) ?? 0)];
  }
  const files = [...new Set(bundle.map.units.map((u) => u.primary_span.path))];
  const selectedPath =
    ws.codeSpan?.path ?? bundle.map.units.find((unit) => unit.unit_id === ws.unitId)?.primary_span.path;
  useEffect(() => {
    const container = trackContainer.current;
    if (!container || !selectedPath) return;
    const reveal = () => {
      const row = trackRows.current.get(selectedPath);
      if (!row) return;
      if (row.offsetTop < container.scrollTop) container.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight)
        container.scrollTop = row.offsetTop + row.offsetHeight - container.clientHeight;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedPath]);
  const signal =
    bundle.map.review_signals?.find((s) => s.verdict === 'concern' && s.unit_ids.includes(ws.unitId)) ??
    bundle.map.review_signals?.find((s) => s.verdict === 'concern');
  useEffect(() => {
    let frame = 0,
      last = 0;
    const animate = (now: number) => {
      const left = `${Math.min(100, (engine.tick / total) * 100)}%`;
      trackHeads.current.forEach((head) => (head.style.left = left));
      if (overviewHead.current) overviewHead.current.style.left = left;
      if (now - last > 90) {
        const sounding = engine.playing
          ? musical.filter(
              (n) =>
                !ws.instrumentMutes.includes(n.voice) &&
                !(ws.focusEvidence && n.kind === 'accompaniment') &&
                n.tick <= engine.tick &&
                engine.tick < n.tick + n.duration_ms * 0.768,
            )
          : [];
        setActive(sounding);
        const linked = sounding.find((n) => n.kind === 'cue') ?? sounding.find((n) => n.kind === 'data');
        if (following && linked && lastFollowed.current !== linked.event_id) {
          lastFollowed.current = linked.event_id!;
          select(linked, false);
        }
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [plan, following, ws.instrumentMutes, ws.focusEvidence, ws.pulseMuted]);
  async function audition() {
    const cue =
      musical.find((n) => n.kind === 'cue' && n.signal_id === signal?.signal_id) ??
      musical.find((n) => n.event_id && n.unit_id === ws.unitId);
    if (!cue) return;
    select(cue, false);
    followPlayback();
    engine.stop();
    engine.seek(Math.max(0, cue.tick - 1920));
    try {
      await engine.play();
      setAudioError('');
    } catch {
      setAudioError('音源の読込に失敗しました。');
    }
  }
  function markPassage() {
    const note = current?.event_id ? current : musical.find((n) => n.event_id && n.unit_id === ws.unitId);
    if (!note) return;
    engine.pause();
    setActive([]);
    select(note);
  }
  const current =
    active.find((n) => n.kind === 'cue') ??
    active.find((n) => n.kind === 'data') ??
    active.find((n) => n.event_id);
  const event = bundle.map.events.find((e) => e.event_id === current?.event_id);
  const supports = [
    { name: 'Bass', voices: ['bass'], detail: '低音の土台' },
    { name: 'Piano', voices: ['piano'], detail: '和音の伴奏' },
  ];
  const groups = [
    ...new Map(
      musical.filter((n) => n.kind === 'cue').map((n) => [`${n.unit_id}:${Math.floor(n.tick / 1920)}`, n]),
    ).values(),
  ];
  const barLabels = Array.from({ length: Math.ceil(plan.total_bars / 4) }, (_, i) => i * 4);
  return (
    <section className="arrangement" aria-label="ファイルごとのリズム">
      <div className="arrangement-title">
        <span>
          <Headphones size={16} />
          <b>Arrangement</b>
          <small>ファイルの演奏配置</small>
        </span>
        <div className="arrangement-layout" aria-label="同じ解釈の演奏配置">
          <button
            aria-pressed={ws.mode === 'repo'}
            onClick={() => {
              engine.pause();
              ws.set({ mode: 'repo' });
            }}
          >
            ファイル順
          </button>
          <button
            aria-pressed={ws.mode === 'theme'}
            onClick={() => {
              engine.pause();
              ws.set({ mode: 'theme' });
            }}
          >
            意味で揃える
          </button>
        </div>
      </div>
      <div className="score-overview" aria-label="実スコアの全発音">
        <svg viewBox="0 0 1000 30" preserveAspectRatio="none">
          {musical.map((note) => (
            <rect
              key={note.note_id}
              x={(note.tick / total) * 1000}
              y={note.kind === 'cue' ? 3 : note.event_id ? 8 : 19}
              width={Math.max(0.8, ((note.duration_ms * 0.768) / total) * 1000)}
              height={note.kind === 'cue' ? 22 : note.event_id ? 13 : 6}
              fill={noteColor(note)}
            />
          ))}
        </svg>
        <div ref={overviewHead} />
      </div>
      <div className="arrangement-ruler">
        <span>TRACK / FILE</span>
        <div>
          {barLabels.map((bar) => (
            <span key={bar} style={{ left: `${(bar / plan.total_bars) * 100}%` }}>
              {bar + 1}
            </span>
          ))}
        </div>
      </div>
      <div className="arrangement-tracks" ref={trackContainer} data-tour="signal">
        {files.map((file, index) => {
          const phrases = plan.phrases.filter((p) =>
            p.unit_id
              ? bundle.map.units.find((u) => u.unit_id === p.unit_id)?.primary_span.path === file
              : musical.some(
                  (n) =>
                    n.responsibility_id === p.responsibility_id &&
                    bundle.map.units.find((u) => u.unit_id === n.unit_id)?.primary_span.path === file,
                ),
          );
          return (
            <div
              className={`composer-track ${event?.span.path === file ? 'sounding' : ''} ${selectedPath === file ? 'selected-track' : ''}`}
              key={file}
              ref={(element) => {
                if (element) trackRows.current.set(file, element);
                else trackRows.current.delete(file);
              }}
            >
              <div className="composer-track-label">
                <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{file.split('/').at(-1)}</strong>
                  <small>{file.split('/').slice(0, -1).join('/')}</small>
                </span>
                <i
                  className={`activity-led ${active.some((n) => bundle.map.units.find((u) => u.unit_id === n.unit_id)?.primary_span.path === file) ? 'on' : ''}`}
                />
              </div>
              <div
                className="composer-track-lane"
                style={{ backgroundSize: `${100 / plan.total_bars}% 100%` }}
              >
                <div
                  className="tracks-head"
                  ref={(element) => {
                    if (element) trackHeads.current.set(file, element);
                    else trackHeads.current.delete(file);
                  }}
                />
                {phrases.map((phrase) => {
                  const start = phrase.start_bar * 1920,
                    length = phrase.bar_count * 1920;
                  const notes = musical.filter(
                    (n) =>
                      n.event_id &&
                      n.tick >= start &&
                      n.tick < start + length &&
                      bundle.map.units.find((u) => u.unit_id === n.unit_id)?.primary_span.path === file,
                  );
                  const anchor =
                    notes.find((n) => n.kind === 'cue') ?? notes.find((n) => n.kind === 'data') ?? notes[0];
                  if (!anchor) return null;
                  const unit = bundle.map.units.find((u) => u.unit_id === anchor.unit_id)!;
                  return (
                    <button
                      key={phrase.phrase_id}
                      className={`midi-clip ${ws.unitId === anchor.unit_id ? 'selected' : ''} ${notes.some((n) => n.kind === 'cue') ? 'has-concern' : ''}`}
                      style={{ left: `${(start / total) * 100}%`, width: `${(length / total) * 100}%` }}
                      title={`${file}:${unit.primary_span.start_line}–${unit.primary_span.end_line}`}
                      onClick={(e) => {
                        const bounds = e.currentTarget.getBoundingClientRect();
                        const tick = e.detail
                          ? start + ((e.clientX - bounds.left) / bounds.width) * length
                          : anchor.tick;
                        const nearest = [...notes].sort(
                          (a, b) => Math.abs(a.tick - tick) - Math.abs(b.tick - tick),
                        )[0];
                        select(nearest ?? anchor);
                      }}
                    >
                      <span className="clip-title">
                        {unit.label}
                        <small>
                          {notes.some((n) => n.kind === 'cue')
                            ? bundle.map.review_signals?.find(
                                (s) => s.signal_id === notes.find((n) => n.kind === 'cue')?.signal_id,
                              )?.category === 'data_flow_opacity'
                              ? '途切れる応答'
                              : '重なる判断'
                            : ''}
                        </small>
                      </span>
                      <svg viewBox="0 0 1000 50" preserveAspectRatio="none">
                        {notes.map((note) => (
                          <rect
                            key={note.note_id}
                            data-testid={note.kind === 'data' ? 'data-note' : undefined}
                            x={((note.tick - start) / length) * 1000}
                            y={note.midi != null ? 5 + (84 - note.midi) * 1.1 : 38}
                            width={Math.max(2, ((note.duration_ms * 0.768) / length) * 1000)}
                            height={note.kind === 'data' ? 5 : 3}
                            fill={noteColor(note)}
                            opacity={note.kind === 'accompaniment' ? 0.65 : 1}
                          >
                            <title>
                              {
                                bundle.map.responsibilities.find(
                                  (r) => r.responsibility_id === note.responsibility_id,
                                )?.motif_id
                              }{' '}
                              /{' '}
                              {
                                bundle.map.responsibilities.find(
                                  (r) => r.responsibility_id === note.responsibility_id,
                                )?.label
                              }{' '}
                              · {bundle.map.events.find((e) => e.event_id === note.event_id)?.span.path}:
                              {bundle.map.events.find((e) => e.event_id === note.event_id)?.span.start_line} ·{' '}
                              {note.kind === 'accompaniment'
                                ? '意味の旋律を反復'
                                : note.kind === 'cue'
                                  ? '懸念の応答リズム'
                                  : '意味の打点'}
                            </title>
                          </rect>
                        ))}
                      </svg>
                    </button>
                  );
                })}
                {groups
                  .filter(
                    (n) => bundle.map.units.find((u) => u.unit_id === n.unit_id)?.primary_span.path === file,
                  )
                  .map((n) => (
                    <button
                      key={`cue_${n.note_id}`}
                      className="concern-region"
                      data-testid="cue-note"
                      style={{
                        left: `${((Math.floor(n.tick / 1920) * 1920) / total) * 100}%`,
                        width: `${(1920 / total) * 100}%`,
                      }}
                      aria-label={`${file}:${bundle.map.events.find((e) => e.event_id === n.event_id)!.span.start_line} 懸念のリズム`}
                      onClick={() => select(n)}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="arrangement-backing">
        <div className="backing-heading">
          共通伴奏 <span>楽曲の土台 · コードの判断を表す音ではありません</span>
        </div>
        {supports.map((part) => {
          const notes = musical.filter((n) => !n.event_id && part.voices.includes(n.voice));
          return (
            <div
              className={`backing-track ${ws.focusEvidence || part.voices.every((v) => ws.instrumentMutes.includes(v)) ? 'muted-track' : ''}`}
              key={part.name}
            >
              <div className="composer-track-label">
                <span>
                  <strong>{part.name}</strong>
                  <small>{part.detail}</small>
                </span>
                <button
                  className="track-mute"
                  aria-label={`${part.name}をミュート`}
                  aria-pressed={part.voices.every((v) => ws.instrumentMutes.includes(v))}
                  onClick={() =>
                    ws.set({
                      instrumentMutes: part.voices.every((v) => ws.instrumentMutes.includes(v))
                        ? ws.instrumentMutes.filter((v) => !part.voices.includes(v))
                        : [...new Set([...ws.instrumentMutes, ...part.voices])],
                    })
                  }
                >
                  M
                </button>
                <i
                  className={`activity-led ${active.some((n) => !n.event_id && part.voices.includes(n.voice)) ? 'on' : ''}`}
                />
              </div>
              <div className="backing-lane">
                <svg viewBox="0 0 1000 28" preserveAspectRatio="none">
                  {notes.map((note) => (
                    <rect
                      key={note.note_id}
                      x={(note.tick / total) * 1000}
                      y={note.midi != null ? 4 + (72 - note.midi) * 0.3 : 8}
                      width={Math.max(1, ((note.duration_ms * 0.768) / total) * 1000)}
                      height={4}
                      fill="#75849c"
                    />
                  ))}
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <div className="composer-now">
        <span className={current?.kind === 'cue' ? 'warning' : ''}>
          {audioError ||
            (event
              ? `発音中 ${event.span.path}:${event.span.start_line}–${event.span.end_line} · ${current?.kind === 'cue' ? '懸念の応答リズム' : current?.kind === 'data' ? '判断の音' : '意味の旋律を反復'}`
              : active.length
                ? '発音中：共通伴奏（コード根拠なし）'
                : 'ノートを選ぶと、その音の根拠へ移動')}
        </span>
        {ws.unitId && (
          <button className="audition" data-tour="audition" onClick={() => void audition()}>
            <Play size={12} />
            この区間を聴く
          </button>
        )}
        {ws.unitId && (
          <button data-tour="mark" onClick={markPassage}>
            この区間を選ぶ
          </button>
        )}
      </div>
      <div className="arrangement-legend">
        <span>
          <i className="semantic-key" />
          判断と旋律
        </span>
        {bundle.map.analysis_depth !== 'overview' && (
          <span>
            <i className="concern-key" />
            精密検査の応答
          </span>
        )}
        <span>
          <i className="backing-key" />
          共通伴奏
        </span>
        <details className="motif-legend">
          <summary>旋律と色の凡例</summary>
          <div>
            {bundle.map.responsibilities.map((r) => {
              const note = musical.find(
                (n) => n.kind === 'data' && n.responsibility_id === r.responsibility_id,
              );
              return (
                <button key={r.responsibility_id} disabled={!note} onClick={() => note && select(note)}>
                  <i style={{ background: motifColors[Number(r.motif_id.slice(1))] }} />
                  {r.motif_id} / {r.label}
                </button>
              );
            })}
            <small>色は役割の識別です。健康の点数ではありません。</small>
          </div>
        </details>
      </div>
    </section>
  );
}
