import * as Tone from 'tone';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import { tickSeconds } from '../../../../packages/groove-core/src/compiler';
import {
  instrumentEnvelope,
  instrumentSample,
  type KitSample,
} from '../../../../packages/groove-core/src/instruments';

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
  private kit = '';
  private instruments = new Set<string>();
  private supportMuted = false;
  private samples: KitSample[] = [];
  private playbackSequence = 0;
  loading?: Promise<void>;

  async load() {
    if (!this.plan) return;
    const kit = this.plan.kit_id;
    const ready = () =>
      this.plan?.notes.every((note) => {
        const sample = instrumentSample(note, this.samples, this.kit);
        return sample && this.buffers.has(`${sample.voice}-${sample.variant}`);
      });
    if (this.kit === kit && ready()) return;
    this.loading ??= (async () => {
      if (this.kit !== kit) {
        for (const buffer of this.buffers.values()) buffer.dispose();
        this.buffers.clear();
        this.master?.dispose();
        this.limiter?.dispose();
        this.master = undefined;
      }
      const response = await fetch(`/audio/${kit}/manifest.json`);
      if (!response.ok) throw new Error('AUDIO_LOAD_FAILED');
      const manifest = await response.json();
      this.samples = manifest.samples;
      const needed = new Set(
        this.plan!.notes.map((note) => {
          const sample = instrumentSample(note, this.samples, kit);
          return sample ? `${sample.voice}-${sample.variant}` : '';
        }),
      );
      await Promise.all(
        manifest.samples
          .filter(
            (sample: { voice: string; variant: number }) =>
              needed.has(`${sample.voice}-${sample.variant}`) &&
              !this.buffers.has(`${sample.voice}-${sample.variant}`),
          )
          .map(async (sample: { voice: string; variant: number; file: string }) => {
            const buffer = new Tone.ToneAudioBuffer();
            await buffer.load(`/audio/${kit}/${sample.file}`);
            this.buffers.set(`${sample.voice}-${sample.variant}`, buffer);
          }),
      );
      if ([...needed].some((key) => !this.buffers.has(key))) throw new Error('AUDIO_LOAD_FAILED');
      if (!this.master) {
        this.master = new Tone.Gain(this.volume * 0.3);
        this.limiter = new Tone.Limiter(-3).toDestination();
        this.master.connect(this.limiter);
      }
      this.kit = kit;
      this.loading = undefined;
    })().catch((error) => {
      this.loading = undefined;
      throw error;
    });
    await this.loading;
    if (this.plan?.kit_id !== this.kit || !ready()) await this.load();
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
          if (this.supportMuted && note.kind === 'accompaniment') return;
          if (this.instruments.has(note.voice)) return;
          if (
            note.kind === 'pulse'
              ? this.pulseMuted
              : responsibility &&
                (this.muted.has(responsibility) || (this.solo.size > 0 && !this.solo.has(responsibility)))
          )
            return;
          const sample = instrumentSample(note, this.samples, this.kit);
          const buffer = sample && this.buffers.get(`${sample.voice}-${sample.variant}`);
          if (!buffer || !this.master) return;
          const panner = new Tone.Panner(note.pan).connect(this.master);
          const player = new Tone.Player(buffer).connect(panner);
          if (note.midi != null) player.playbackRate = 2 ** ((note.midi - sample!.base_midi) / 12);
          const duration = Math.min(buffer.duration / player.playbackRate, note.duration_ms / 1000);
          const envelope = instrumentEnvelope(note.voice, duration);
          player.fadeIn = envelope.attack;
          player.fadeOut = envelope.release;
          player.volume.value = Tone.gainToDb(note.velocity);
          this.active.add(player);
          player.onstop = () => {
            this.active.delete(player);
            player.dispose();
            panner.dispose();
          };
          player.start(time, 0, Math.min(buffer.duration, (note.duration_ms / 1000) * player.playbackRate));
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
  async play(shouldStart: () => boolean = () => true) {
    const sequence = ++this.playbackSequence;
    await Tone.start();
    await this.load();
    if (this.plan && sequence === this.playbackSequence && shouldStart()) Tone.getTransport().start('+0.03');
  }
  pause() {
    this.playbackSequence++;
    Tone.getTransport().pause();
    this.release();
  }
  stop() {
    this.playbackSequence++;
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
  get playbackSession() {
    return this.playbackSequence;
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
  setInstrumentMutes(values: string[]) {
    this.instruments = new Set(values);
  }
  setSupportMuted(value: boolean) {
    this.supportMuted = value;
  }
  seek(tick: number) {
    this.playbackSequence++;
    this.release();
    Tone.getTransport().seconds = tickSeconds(
      Math.max(0, Math.min(tick, (this.plan?.total_bars ?? 1) * 1920 - 1)),
    );
  }
  get contextState() {
    return Tone.getContext().state;
  }
}
export const engine = new GrooveEngine();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.pause();
});
