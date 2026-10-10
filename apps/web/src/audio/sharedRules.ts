import type { MeaningEvent, SemanticMap } from '../../../../packages/contracts/SemanticMap';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import { melody } from '../../../../packages/groove-core/src/arrangement';

export function sharedRuleGroups(map: SemanticMap) {
  const groups = new Map<string, MeaningEvent[]>();
  for (const event of map.events) {
    if (
      event.state !== 'grounded' ||
      !map.units.some((u) => u.unit_id === event.unit_id && u.review_state === 'inspected')
    )
      continue;
    const key = JSON.stringify([event.responsibility_id, event.concept_key]);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups]
    .filter(([, events]) => new Set(events.map((e) => e.unit_id)).size > 1)
    .map(([key, events]) => ({
      key,
      events: [...events].sort(
        (a, b) => a.span.path.localeCompare(b.span.path, 'en') || a.span.start_line - b.span.start_line,
      ),
      responsibility: map.responsibilities.find((r) => r.responsibility_id === events[0].responsibility_id)!,
      ambiguous: new Set(events.map((e) => e.unit_id)).size !== events.length,
    }));
}

// This is a normalized semantic identifier, not an excerpt of execution or source rhythm.
export function ruleIdentifier(plan: ScorePlan, map: SemanticMap, eventId: string): ScorePlan | undefined {
  const event = map.events.find((e) => e.event_id === eventId && e.state === 'grounded');
  if (!event || !map.units.some((u) => u.unit_id === event.unit_id && u.review_state === 'inspected')) return;
  const responsibility = map.responsibilities.find((r) => r.responsibility_id === event.responsibility_id);
  if (!responsibility) return;
  const variant = Number(responsibility.motif_id.slice(1));
  if (!melody[variant]) return;
  return {
    ...plan,
    scene_id: 'shared_rule_identifier_v1',
    total_bars: 1,
    phrases: [],
    notes: melody[variant].map((midi, index) => ({
      note_id: 'identifier_' + eventId + '_' + index,
      kind: 'accompaniment',
      event_id: event.event_id,
      responsibility_id: event.responsibility_id,
      unit_id: event.unit_id,
      tick: index * 240,
      duration_ms: 250,
      voice: variant % 2 ? 'vibes' : 'piano',
      midi,
      variant,
      velocity: 0.24,
      pan: 0,
      evidence_ids: [...event.evidence_ids],
    })),
  };
}
