import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Bundle } from '../apps/web/src/api';
import { playbackPlan } from '../apps/web/src/audio/playback';
import { ruleIdentifier, sharedRuleGroups } from '../apps/web/src/audio/sharedRules';

const bundle = JSON.parse(readFileSync('fixtures/recorded-live/returns-before.json', 'utf8')) as Bundle;
const plan = playbackPlan(bundle.score, 'repo', 0, true)!;
const audible = (value: ReturnType<typeof ruleIdentifier>) =>
  value?.notes.map((n) => ({
    tick: n.tick,
    midi: n.midi,
    voice: n.voice,
    velocity: n.velocity,
    pan: n.pan,
    duration: n.duration_ms,
  }));

describe('pre-verdict shared-rule comparison', () => {
  it('finds grounded peers before any concern exists, retaining distinct keys', () => {
    const map: Bundle['map'] = { ...bundle.map, review_signals: [] };
    const groups = sharedRuleGroups(map);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(new Set(group.events.map((e) => e.unit_id)).size).toBeGreaterThan(1);
      expect(
        new Set(group.events.map((e) => JSON.stringify([e.responsibility_id, e.concept_key]))).size,
      ).toBe(1);
    }
  });
  it('does not invent sharing for unresolved, uninspected or differently classified events', () => {
    const checkout = JSON.parse(readFileSync('fixtures/recorded-live/checkout-flow.json', 'utf8')) as Bundle;
    expect(sharedRuleGroups(checkout.map)).toEqual([]);
    const map = structuredClone(bundle.map);
    map.events = map.events.map((e) => ({ ...e, state: 'unresolved' }));
    expect(sharedRuleGroups(map)).toEqual([]);
    expect(ruleIdentifier(plan, map, map.events[0].event_id)).toBeUndefined();
  });
  it('uses the same fixed identifier under unrelated score, position and event changes', () => {
    const group = sharedRuleGroups(bundle.map)[0];
    const before = structuredClone(bundle);
    const a = ruleIdentifier(plan, bundle.map, group.events[0].event_id)!;
    const b = ruleIdentifier({ ...plan, total_bars: 31, notes: [] }, bundle.map, group.events[1].event_id)!;
    expect(audible(a)).toEqual(audible(b));
    expect(a.notes).toHaveLength(8);
    expect(a.total_bars).toBe(1);
    expect(a.bpm).toBe(96);
    expect(a.notes.every((n) => n.event_id === group.events[0].event_id && n.evidence_ids.length)).toBe(true);
    expect(a.notes.every((n) => n.kind === 'accompaniment' && n.tick < 1920)).toBe(true);
    expect(bundle).toEqual(before);
  });
  it('keeps multiple occurrences visible instead of claiming a unique correspondence', () => {
    const map = structuredClone(bundle.map);
    const event = sharedRuleGroups(map)[0].events[0];
    map.events.push({ ...event, event_id: 'second_occurrence' });
    expect(
      sharedRuleGroups(map).find((g) => g.events.some((e) => e.event_id === event.event_id))?.ambiguous,
    ).toBe(true);
  });
});
