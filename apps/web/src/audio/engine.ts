import * as Tone from 'tone';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import { tickSeconds } from '../../../../packages/groove-core/src/compiler';

class GrooveEngine {
  private buffers = new Map<string, Tone.ToneAudioBuffer>();
  private active = new Set<Tone.Player>();
  private scheduleIds: number[] = [];
  private master?: Tone.Gain;
  private limiter?: Tone.Limiter;
  private plan?: ScorePlan;
  private muted = new Set<string>();
  private solo = new Set<string>();
  private pulseMuted = false;
  private loop = true;
  private volume = 0.45;
  loading?: Promise<void>;

  async load() {
    if (this.buffers.size === 30) return;
    this.loading ??= (async () => {
      const response = await fetch('/audio/paper-studio-v1/manifest.json');
      if (!response.ok) throw new Error('AUDIO_LOAD_FAILED');
      const manifest = await response.json();
      await Promise.all(
        manifest.samples.map(async (sample: { voice: string; variant: number; file: string }) => {
          const buffer = new Tone.ToneAudioBuffer();
          await buffer.load(`/audio/paper-studio-v1/${sample.file}`);
          this.buffers.set(`${sample.voice}-${sample.variant}`, buffer);
        }),
      );
      this.master = new Tone.Gain(this.volume * 0.3);
      this.limiter = new Tone.Limiter(-3).toDestination();
      this.master.connect(this.limiter);
    })().catch((error) => {
      this.loading = undefined;
      throw error;
    });
    return this.loading;
  }
  configure(plan: ScorePlan) {
    this.stop();
    const transport = Tone.getTransport();
    this.scheduleIds.forEach((id) => transport.clear(id));
    this.scheduleIds = [];
    this.plan = plan;
    transport.bpm.value = 96;
    transport.loopStart = 0;
    transport.loopEnd = tickSeconds(plan.total_bars * 1920);
    transport.loop = this.loop;
    for (const note of plan.notes) {
      this.scheduleIds.push(
        transport.schedule((time) => {
          const responsibility = note.responsibility_id ?? '';
          if (
            note.kind === 'pulse'
              ? this.pulseMuted
              : this.muted.has(responsibility) || (this.solo.size > 0 && !this.solo.has(responsibility))
          )
            return;
          const buffer = this.buffers.get(`${note.voice}-${note.variant}`);
          if (!buffer || !this.master) return;
          const panner = new Tone.Panner(note.pan).connect(this.master);
          const player = new Tone.Player(buffer).connect(panner);
          player.volume.value = Tone.gainToDb(note.velocity);
          this.active.add(player);
          player.onstop = () => {
            this.active.delete(player);
            player.dispose();
            panner.dispose();
          };
          player.start(time, 0, Math.min(buffer.duration, note.duration_ms / 1000));
        }, tickSeconds(note.tick)),
      );
    }
    this.scheduleIds.push(
      transport.schedule(
        (time) => {
          if (!this.loop) Tone.getDraw().schedule(() => this.stop(), time);
        },
        tickSeconds(plan.total_bars * 1920),
      ),
    );
  }
  async play() {
    await Tone.start();
    await this.load();
    if (this.plan) Tone.getTransport().start('+0.03');
  }
  pause() {
    Tone.getTransport().pause();
    this.release();
  }
  stop() {
    Tone.getTransport().stop();
    Tone.getTransport().seconds = 0;
    this.release();
  }
  private release() {
    for (const player of this.active) player.stop(Tone.now() + 0.01);
  }
  get tick() {
    return Math.max(0, (Tone.getTransport().seconds * 480 * 96) / 60);
  }
  get playing() {
    return Tone.getTransport().state === 'started';
  }
  setVolume(value: number) {
    this.volume = value;
    this.master?.gain.rampTo(value * 0.3, 0.05);
  }
  setLoop(value: boolean) {
    this.loop = value;
    Tone.getTransport().loop = value;
  }
  setFilters(muted: string[], solo: string[], pulseMuted: boolean) {
    this.muted = new Set(muted);
    this.solo = new Set(solo);
    this.pulseMuted = pulseMuted;
  }
  get contextState() {
    return Tone.getContext().state;
  }
}
export const engine = new GrooveEngine();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.pause();
});
