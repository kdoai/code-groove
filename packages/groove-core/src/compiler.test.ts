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
        expect(scene.repo.total_bars).toBeLessThanOrEqual(32);
        expect(scene.theme.total_bars).toBeLessThanOrEqual(32);
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
  it('keeps read event UUIDs out of the deterministic content hash', async () => {
    const map = load('mixed');
    const changed = structuredClone(map);
    const aliases = new Map(changed.evidence.map((proof, i) => [proof.evidence_id, `new_read_${i}`]));
    changed.evidence.forEach((proof) => {
      proof.evidence_id = aliases.get(proof.evidence_id)!;
      proof.created_by_tool_event_id = 'new_tool';
    });
    [...changed.units, ...changed.responsibilities, ...changed.events].forEach((value) => {
      value.evidence_ids = value.evidence_ids.map((id) => aliases.get(id)!);
    });
    expect((await compileGroove(map, 'kit')).score_hash).toBe(
      (await compileGroove(changed, 'kit')).score_hash,
    );
  });
  it('shows an unresolved unit as silent space without making a data note', async () => {
    const map = load('mixed');
    map.units.push({
      ...map.units[0],
      unit_id: 'unresolved_unit',
      review_state: 'unresolved',
      evidence_ids: [],
    });
    const score = await compileGroove(map, 'kit');
    expect(score.scenes.some((scene) => scene.unit_ids.includes('unresolved_unit'))).toBe(true);
    expect(
      score.scenes.flatMap((scene) => scene.repo.notes).some((note) => note.unit_id === 'unresolved_unit'),
    ).toBe(false);
  });
});
