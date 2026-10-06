import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Bundle } from '../apps/web/src/api';
import { focusedExcerpt } from '../apps/web/src/audio/excerpts';
import { playbackPlan } from '../apps/web/src/audio/playback';

const bundle = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8')) as Bundle;
const original = playbackPlan(bundle.score, 'repo', 0, true)!;

describe('focused listening keeps the source melody and bounds the excerpt', () => {
  it('removes unrelated events and backing without changing pitch, level or within-bar intervals', () => {
    const eventIds = bundle.map.review_signals![0]!.event_ids;
    const result = focusedExcerpt(original, eventIds);
    expect(result.plan.total_bars).toBeLessThanOrEqual(4);
    expect(result.plan.notes.length).toBeGreaterThan(0);
    for (const note of result.plan.notes) {
      const source = original.notes.find((item) => item.note_id === note.note_id)!;
      expect(note.kind).toBe('data');
      expect(eventIds).toContain(note.event_id);
      expect(note.midi).toBe(source.midi);
      expect(note.velocity).toBe(source.velocity);
      expect(note.voice).toBe(source.voice);
      expect(note.tick % 1920).toBe(source.tick % 1920);
      expect(note.tick + note.duration_ms * 0.768).toBeLessThanOrEqual(result.plan.total_bars * 1920 + 1);
    }
    expect(JSON.parse(JSON.stringify(original))).toEqual(original);
  });
  it('does not invent sound for an uninvestigated event', () => {
    expect(focusedExcerpt(original, ['unknown']).plan.notes).toEqual([]);
  });
});
