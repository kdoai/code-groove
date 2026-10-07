import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Bundle } from '../apps/web/src/api';
import {
  focusedExcerpt,
  responsibilityComparison,
  reviewListening,
  sequenceExcerpts,
} from '../apps/web/src/audio/excerpts';
import { playbackPlan } from '../apps/web/src/audio/playback';

const bundle = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8')) as Bundle;
const original = playbackPlan(bundle.score, 'repo', 0, true)!;

describe('focused listening keeps the source melody and bounds the excerpt', () => {
  it('keeps code-linked responsibility phrases and nearby processing, removing unrelated units and common backing', () => {
    const eventIds = bundle.map.review_signals![0]!.event_ids;
    const before = structuredClone(original);
    const result = focusedExcerpt(original, eventIds);
    expect(result.plan.total_bars).toBeLessThanOrEqual(4);
    expect(result.plan.notes.length).toBeGreaterThan(0);
    for (const note of result.plan.notes) {
      const source = original.notes.find((item) => item.note_id === note.note_id)!;
      expect(['data', 'accompaniment']).toContain(note.kind);
      expect(note.event_id).toBeTruthy();
      expect(bundle.map.review_signals![0]!.unit_ids).toContain(note.unit_id);
      expect(note.midi).toBe(source.midi);
      expect(note.velocity).toBe(source.velocity);
      expect(note.voice).toBe(source.voice);
      expect(note.tick % 1920).toBe(source.tick % 1920);
      expect(note.tick + note.duration_ms * 0.768).toBeLessThanOrEqual(result.plan.total_bars * 1920 + 1);
    }
    expect(result.plan.notes.some((note) => note.kind === 'accompaniment')).toBe(true);
    expect(original).toEqual(before);
  });
  it('restores the phrase that was lost from the real two-point Tsugiai candidate, without synthesizing new notes', () => {
    const real = JSON.parse(readFileSync('fixtures/recorded-live/tsugiai-agents.json', 'utf8')) as Bundle;
    const plan = playbackPlan(real.score, 'repo', 0, true)!;
    const result = reviewListening(plan, real.map, real.map.review_signals![0]!);
    expect(result.sequence!.notes.filter((note) => note.kind === 'data')).toHaveLength(3);
    expect(result.sequence!.notes.filter((note) => note.kind === 'accompaniment')).toHaveLength(12);
    expect(result.sequence!.notes.some((note) => !note.event_id || note.kind === 'cue')).toBe(false);
    expect(result.unitIds).toHaveLength(1);
  });
  it('shows omitted participants and uses equal windows for an explicitly selected pair, leaving uninvestigated data silent', () => {
    const real = JSON.parse(readFileSync('fixtures/recorded-live/tsugiai-agents.json', 'utf8')) as Bundle;
    const plan = playbackPlan(real.score, 'repo', 0, true)!;
    const signal = real.map.review_signals![1]!;
    const first = reviewListening(plan, real.map, signal);
    expect(first.a.total_bars).toBe(first.b.total_bars);
    expect(first.omittedEventIds).toHaveLength(1);
    const next = reviewListening(plan, real.map, signal, signal.unit_ids[0], signal.unit_ids[2]);
    expect(next.b.notes.every((note) => note.unit_id === signal.unit_ids[2])).toBe(true);
    const unknown = {
      ...real.map,
      events: real.map.events.map((event) => ({ ...event, state: 'unresolved' as const })),
    };
    expect(reviewListening(plan, unknown, signal).sequence).toBeUndefined();
    expect(reviewListening(plan, unknown, real.map.review_signals![0]!).a.notes).toEqual([]);
  });
  it('anchors a late point in its original surrounding bars rather than silently playing the beginning', () => {
    const source = original.notes.find((note) => note.kind === 'data')!;
    const late = { ...source, event_id: 'late', note_id: 'late_note', tick: 6 * 1920 + 480 };
    const plan = {
      ...original,
      total_bars: 8,
      phrases: [],
      notes: [
        late,
        ...Array.from({ length: 8 }, (_, bar) => ({
          ...source,
          kind: 'accompaniment' as const,
          event_id: 'late',
          note_id: `context_${bar}`,
          tick: bar * 1920,
        })),
      ],
    };
    const result = focusedExcerpt(plan, ['late']);
    expect(result.plan.notes.some((note) => note.note_id === 'late_note')).toBe(true);
    expect(result.plan.notes.find((note) => note.note_id === 'late_note')!.tick).toBe(1920 + 480);
    expect(result.plan.total_bars).toBe(3);
    expect(result.omittedBars).toBe(5);
  });
  it('does not invent sound for an uninvestigated event', () => {
    expect(focusedExcerpt(original, ['unknown']).plan.notes).toEqual([]);
  });
  it('uses equal bars and the original responsibility melody for both sides of a small comparison', () => {
    const units = bundle.map.units.filter((unit) => unit.label.startsWith('quote'));
    const result = responsibilityComparison(original, bundle.map, units[0].unit_id, units[1].unit_id)!;
    expect(result.a.total_bars).toBe(result.b.total_bars);
    expect(result.a.bpm).toBe(result.b.bpm);
    for (const plan of [result.a, result.b])
      for (const note of plan.notes) {
        const source = original.notes.find((item) => item.note_id === note.note_id)!;
        expect([note.midi, note.voice, note.velocity, note.pan]).toEqual([
          source.midi,
          source.voice,
          source.velocity,
          source.pan,
        ]);
      }
    const sequence = sequenceExcerpts(result.a, result.b);
    expect(sequence.total_bars).toBe(result.a.total_bars * 2);
    expect(sequence.notes.slice(result.a.notes.length).map((note) => note.tick)).toEqual(
      result.b.notes.map((note) => note.tick + result.a.total_bars * 1920),
    );
    const unresolved = {
      ...bundle.map,
      events: bundle.map.events.map((event) => ({ ...event, state: 'unresolved' as const })),
    };
    expect(
      responsibilityComparison(original, unresolved, units[0].unit_id, units[1].unit_id),
    ).toBeUndefined();
  });
});
