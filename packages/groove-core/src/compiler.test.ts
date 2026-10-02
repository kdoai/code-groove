import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileGroove } from './compiler';
import type { SemanticMap } from '../../contracts';
const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')).map as SemanticMap;
describe('groove-v1 invariants', () => {
  for (const name of ['cohesive', 'scattered', 'mixed', 'justified', 'orchestrator'])
    it(`${name} preserves every event, voice and evidence`, async () => {
      const map = load(name);
      const score = await compileGroove(map, 'kit');
      const seen: string[] = [];
      for (const scene of score.scenes) {
        const a = scene.theme.notes
          .filter((n) => n.kind === 'data')
          .sort((x, y) => x.event_id!.localeCompare(y.event_id!));
        const b = scene.repo.notes
          .filter((n) => n.kind === 'data')
          .sort((x, y) => x.event_id!.localeCompare(y.event_id!));
        expect(a.map((n) => n.event_id)).toEqual(b.map((n) => n.event_id));
        a.forEach((note, i) => {
          expect({ ...note, tick: 0 }).toEqual({ ...b[i], tick: 0 });
          expect(note.evidence_ids.length).toBeGreaterThan(0);
        });
        expect(scene.repo.total_bars).toBeLessThanOrEqual(8);
        expect(scene.theme.total_bars).toBeLessThanOrEqual(8);
        seen.push(...a.map((n) => n.event_id!));
      }
      expect(seen.length).toBe(new Set(seen).size);
      expect(seen.length).toBe(map.events.length);
    });
  it('moves dispersed material in time without losing occurrences', async () => {
    const map = load('scattered');
    const score = await compileGroove(map, 'kit');
    expect(score.scenes[0].theme.notes.filter((n) => n.kind === 'data').map((n) => n.tick)).not.toEqual(
      score.scenes[0].repo.notes.filter((n) => n.kind === 'data').map((n) => n.tick),
    );
  });
  it('reproduces score hash excluding analysis and creation metadata', async () => {
    const map = load('mixed');
    const a = await compileGroove(map, 'kit');
    const b = await compileGroove({ ...map, analysis_id: 'another', created_at: 'tomorrow' }, 'kit');
    expect(a.score_hash).toBe(b.score_hash);
  });
  it('rejects ungrounded-only material and duplicate semantic order', async () => {
    const map = load('mixed');
    await expect(
      compileGroove({ ...map, events: map.events.map((e) => ({ ...e, state: 'unresolved' })) }, 'kit'),
    ).rejects.toThrow('NO_GROUNDED_EVENTS');
    map.events[1].semantic_order = map.events[0].semantic_order;
    await expect(compileGroove(map, 'kit')).rejects.toThrow('DUPLICATE_ORDER');
  });
});
