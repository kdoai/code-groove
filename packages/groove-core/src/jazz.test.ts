import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileGroove } from './compiler';
import { playbackPlan } from '../../../apps/web/src/audio/playback';
import type { SemanticMap } from '../../contracts';

const load = (name: string) =>
  JSON.parse(readFileSync(`fixtures/recorded-live/returns-${name}.json`, 'utf8')).map as SemanticMap;
describe('meaningful jazz arrangements', () => {
  it('renders grounded concerns but not justified boundaries as audible cues', async () => {
    const before = await compileGroove(load('before'), 'kit');
    const after = await compileGroove(load('after'), 'kit');
    const a = playbackPlan(before, 'repo', 0, true)!;
    const b = playbackPlan(after, 'repo', 0, true)!;
    expect(a.bpm).toBe(96);
    expect(b.bpm).toBe(96);
    expect(new Set(a.notes.filter((n) => n.kind === 'cue').map((n) => n.unit_id)).size).toBe(2);
    expect(b.notes.filter((n) => n.kind === 'cue')).toEqual([]);
    const cueBar = a.notes.filter(
      (n) =>
        n.kind === 'cue' &&
        n.unit_id === a.notes.find((n) => n.kind === 'cue')!.unit_id &&
        Math.floor(n.tick / 1920) === Math.floor(a.notes.find((n) => n.kind === 'cue')!.tick / 1920),
    );
    expect(cueBar.map((n) => n.tick % 1920)).toEqual([0, 160, 480, 640, 960, 1120, 1440, 1600]);
    expect(new Set(cueBar.map((n) => n.voice))).toEqual(new Set(['piano', 'vibes']));
    const diagnosticBar = Math.floor(a.notes.find((n) => n.kind === 'cue')!.tick / 1920);
    const chord = (bar: number) => a.notes.find((n) => n.note_id.includes(`chord_${bar}_0_0`))!;
    expect(chord(diagnosticBar).velocity).toBeCloseTo(chord(diagnosticBar - 1).velocity * 0.8);
    expect(
      a.notes.some((n) => ['kick', 'snare', 'hat', 'wood'].includes(n.voice) || n.kind === 'pulse'),
    ).toBe(false);

    expect(new Set(a.notes.filter((n) => n.voice === 'piano').map((n) => n.midi)).size).toBeGreaterThan(5);
    expect(a.notes.filter((n) => n.kind === 'data')).toHaveLength(load('before').events.length);
    expect(a.notes.filter((n) => n.kind === 'cue').every((n) => n.evidence_ids.length > 0)).toBe(true);
    expect(new Set(a.notes.filter((n) => n.kind === 'cue').map((n) => n.event_id)).size).toBeGreaterThan(2);
    expect((await compileGroove(load('before'), 'kit')).score_hash).toBe(before.score_hash);
  });
  it('keeps alternative-read UUIDs out of musical identity', async () => {
    const original = load('before'),
      revised = structuredClone(original);
    const replacements = new Map(revised.evidence.map((e, i) => [e.evidence_id, `replacement_${i}`]));
    revised.evidence.forEach((e) => (e.evidence_id = replacements.get(e.evidence_id)!));
    for (const entity of [
      ...revised.units,
      ...revised.events,
      ...revised.responsibilities,
      ...(revised.review_signals ?? []),
    ])
      entity.evidence_ids = entity.evidence_ids.map((id) => replacements.get(id)!);
    revised.review_signals?.forEach(
      (s) => (s.alternative_evidence_ids = s.alternative_evidence_ids?.map((id) => replacements.get(id)!)),
    );
    expect((await compileGroove(revised, 'kit')).score_hash).toBe(
      (await compileGroove(original, 'kit')).score_hash,
    );
  });
  it('concatenates complete sections without dropping or colliding event IDs', async () => {
    const map = load('after');
    const source = await compileGroove(map, 'kit');
    const scene = structuredClone(source.scenes[0]);
    scene.scene_id = 'scene_2';
    scene.repo.scene_id = 'scene_2';
    const merged = playbackPlan({ ...source, scenes: [...source.scenes, scene] }, 'repo', 0, true)!;
    expect(merged.total_bars).toBe(source.scenes[0].repo.total_bars * 2);
    expect(new Set(merged.notes.map((n) => n.note_id)).size).toBe(merged.notes.length);
    expect(merged.phrases.at(-1)!.start_bar).toBe(
      scene.repo.phrases.at(-1)!.start_bar + scene.repo.total_bars,
    );
  });
  it('grounds a fragmented reading response in the same exact code event', async () => {
    const map = load('before');
    map.review_signals![0]!.category = 'data_flow_opacity';
    const plan = (await compileGroove(map, 'kit')).scenes[0].repo;
    const notes = plan.notes.filter((n) => n.kind === 'cue');
    expect(notes.some((n) => n.midi === 71)).toBe(true);
    expect(
      notes.every((n) => map.events.some((e) => e.event_id === n.event_id && e.unit_id === n.unit_id)),
    ).toBe(true);
    expect(plan.notes.filter((n) => n.kind === 'data').map((n) => n.event_id)).toEqual(
      expect.arrayContaining(map.events.map((e) => e.event_id)),
    );
  });
  it('does not stack candidate signals into louder or longer warning passages', async () => {
    const map = load('before');
    const original = (await compileGroove(map, 'kit')).scenes[0].repo;
    map.review_signals = [
      ...(map.review_signals ?? []),
      { ...structuredClone(map.review_signals![0]!), signal_id: 'zz_duplicate' },
    ] as SemanticMap['review_signals'];
    const repeated = (await compileGroove(map, 'kit')).scenes[0].repo;
    expect(repeated.notes).toEqual(original.notes);
    expect(repeated.total_bars).toBe(original.total_bars);
    for (const phrase of repeated.phrases) {
      const response = repeated.notes.filter(
        (n) =>
          n.kind === 'cue' &&
          n.tick >= phrase.start_bar * 1920 &&
          n.tick < (phrase.start_bar + phrase.bar_count) * 1920,
      );
      expect(new Set(response.map((n) => Math.floor(n.tick / 1920))).size).toBeLessThanOrEqual(1);
      expect(response.every((n) => n.velocity <= 0.44)).toBe(true);
    }
  });
});
