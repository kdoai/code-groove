import { useEffect, useState } from 'react';
import { Play, Pause, Square, Repeat2, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import type { ScoreBundle } from '../../../../packages/contracts';
import { useWorkspace } from '../state';
import { engine } from '../audio/engine';

export function Transport({ score, onError }: { score?: ScoreBundle; onError: (message: string) => void }) {
  const ws = useWorkspace();
  const [playing, setPlaying] = useState(false),
    [seconds, setSeconds] = useState(0),
    [loading, setLoading] = useState(false);
  const plan = score?.scenes[ws.scene]?.[ws.mode];
  useEffect(() => {
    if (plan) engine.configure(plan);
  }, [plan]);
  useEffect(() => {
    engine.setVolume(ws.volume);
    engine.setLoop(ws.loop);
    engine.setFilters(ws.muted, ws.solo, ws.pulseMuted);
  }, [ws.volume, ws.loop, ws.muted, ws.solo, ws.pulseMuted]);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const animate = (now: number) => {
      if (now - last > 100) {
        setPlaying(engine.playing);
        setSeconds(engine.tick / 768);
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  async function toggle() {
    if (!plan) return;
    if (engine.playing) engine.pause();
    else {
      setLoading(true);
      try {
        await engine.play();
      } catch {
        onError('音源を読み込めませんでした。Playで再試行できます。');
      } finally {
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const element = e.target as HTMLElement;
      if (element.closest('input,textarea,.monaco-editor,[role="dialog"]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        void toggle();
      } else if (e.code === 'Home') engine.stop();
      else if (e.key.toLowerCase() === 'l') ws.set({ loop: !ws.loop });
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return (
    <div className="transport">
      <div className="mode-switch" aria-label="演奏の配置">
        {(['theme', 'repo'] as const).map((mode) => (
          <button key={mode} aria-pressed={ws.mode === mode} onClick={() => ws.set({ mode })}>
            {mode === 'theme' ? 'Theme' : 'Repo'}
            <small>{mode === 'theme' ? '責務ごと' : '実装の配置'}</small>
          </button>
        ))}
      </div>
      <div className="transport-controls">
        <button
          aria-label="前のシーン"
          disabled={!score || ws.scene === 0}
          onClick={() => ws.set({ scene: ws.scene - 1 })}
        >
          <SkipBack size={15} />
        </button>
        <button aria-label="Stop" title="Stop · Home" onClick={() => engine.stop()}>
          <Square size={16} />
        </button>
        <button
          className="play-button"
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={!plan || loading}
          title="Play / Pause · Space"
          onClick={() => void toggle()}
        >
          {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
        </button>
        <button
          aria-label="次のシーン"
          disabled={!score || ws.scene >= score.scenes.length - 1}
          onClick={() => ws.set({ scene: ws.scene + 1 })}
        >
          <SkipForward size={15} />
        </button>
      </div>
      <div className="time-display">
        <b>{`${Math.floor(seconds / 60)
          .toString()
          .padStart(2, '0')}:${Math.floor(seconds % 60)
          .toString()
          .padStart(2, '0')}`}</b>
        <small>{score ? `SCENE ${ws.scene + 1} / ${score.scenes.length}` : 'NO REPOSITORY'}</small>
      </div>
      <span className="tempo">
        96 <small>BPM</small>
        <i />
        4/4
      </span>
      <button
        className="loop-button"
        aria-label="Loop"
        title="Loop · L"
        aria-pressed={ws.loop}
        onClick={() => ws.set({ loop: !ws.loop })}
      >
        <Repeat2 size={18} />
        <span>Loop</span>
      </button>
      <div className="volume">
        <Volume2 size={16} />
        <input
          aria-label="音量"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={ws.volume}
          onChange={(e) => ws.set({ volume: Number(e.target.value) })}
        />
      </div>
      <span className="kit-label">
        PAPER STUDIO <span>01</span>
      </span>
    </div>
  );
}
