import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';
import type { ReviewSignal, SemanticMap } from '../../../../packages/contracts/SemanticMap';

// Code-linked accompaniment contains the responsibility melody; only unlinked backing is removed.
export function focusedExcerpt(plan: ScorePlan, eventIds: string[], maxBars = 4, allowedEventIds?: string[]) {
  const selected = new Set(eventIds);
  const allowed = allowedEventIds && new Set(allowedEventIds);
  const data = plan.notes.filter((note) => note.kind === 'data' && (!allowed || allowed.has(note.event_id!)));
  const targets = data.filter((note) => selected.has(note.event_id ?? ''));
  const unitIds = new Set(targets.map((note) => note.unit_id));
  const grounded = new Set(data.filter((note) => unitIds.has(note.unit_id)).map((note) => note.event_id));
  const notes = plan.notes.filter(
    (note) =>
      (note.kind === 'data' || note.kind === 'accompaniment') &&
      !!note.event_id &&
      grounded.has(note.event_id) &&
      unitIds.has(note.unit_id),
  );
  const bars = [...new Set(notes.map((note) => Math.floor(note.tick / 1920)))].sort((a, b) => a - b);
  const anchor = targets.length ? Math.floor(Math.min(...targets.map((note) => note.tick)) / 1920) : 0;
  const start = Math.max(0, bars.indexOf(anchor) - 1);
  const kept = bars.slice(start, start + maxBars);
  const positions = new Map(kept.map((bar, i) => [bar, i]));
  const excerpt: ScorePlan = {
    ...plan,
    scene_id: 'focused_excerpt',
    total_bars: kept.length,
    phrases: [],
    notes: notes.flatMap((note) => {
      const bar = positions.get(Math.floor(note.tick / 1920));
      if (bar === undefined) return [];
      const tick = bar * 1920 + (note.tick % 1920);
      return [
        {
          ...note,
          tick,
          duration_ms: Math.min(note.duration_ms, Math.floor(((kept.length * 1920 - tick) * 1000) / 768)),
        },
      ];
    }),
  };
  return {
    plan: excerpt,
    omittedBars: bars.length - kept.length,
    omittedEventIds: eventIds.filter(
      (id) => !excerpt.notes.some((note) => note.kind === 'data' && note.event_id === id),
    ),
  };
}

export function responsibilityComparison(
  plan: ScorePlan,
  map: SemanticMap,
  unitA: string,
  unitB: string,
  anchorEventIds: string[] = [],
) {
  const side = (unitId: string) => {
    const events = map.events.filter((event) => event.unit_id === unitId && event.state === 'grounded');
    const notes = plan.notes.filter(
      (note) =>
        (note.kind === 'data' || note.kind === 'accompaniment') &&
        note.unit_id === unitId &&
        events.some((event) => event.event_id === note.event_id),
    );
    const phrase = plan.phrases.find((item) => item.unit_id === unitId);
    const originalStart = phrase?.start_bar ?? Math.floor(Math.min(...notes.map((note) => note.tick)) / 1920);
    const originalBars =
      phrase?.bar_count ?? Math.ceil(Math.max(...notes.map((note) => note.tick + 1)) / 1920) - originalStart;
    const anchors = notes.filter((note) => note.kind === 'data' && anchorEventIds.includes(note.event_id!));
    const anchor = anchors.length
      ? Math.floor(Math.min(...anchors.map((note) => note.tick)) / 1920)
      : originalStart;
    const start = Math.max(originalStart, anchor - 1);
    const bars = originalStart + originalBars - start;
    return { events, notes, start, bars, originalBars };
  };
  const a = side(unitA),
    b = side(unitB);
  if (!a.notes.length || !b.notes.length) return undefined;
  const bars = Math.min(4, Math.max(a.bars, b.bars));
  const build = (selection: typeof a): ScorePlan => ({
    ...plan,
    scene_id: 'responsibility_comparison',
    total_bars: bars,
    phrases: [],
    notes: selection.notes
      .filter((note) => note.tick >= selection.start * 1920 && note.tick < (selection.start + bars) * 1920)
      .map((note) => ({
        ...note,
        tick: note.tick - selection.start * 1920,
        duration_ms: Math.min(
          note.duration_ms,
          Math.floor((((selection.start + bars) * 1920 - note.tick) * 1000) / 768),
        ),
      })),
  });
  const key = (event: (typeof a.events)[number]) => `${event.responsibility_id}:${event.concept_key}`;
  const keys = [...new Set([...a.events, ...b.events].map(key))];
  const uncertainKeys = keys.filter(
    (value) =>
      a.events.filter((event) => key(event) === value).length !== 1 ||
      b.events.filter((event) => key(event) === value).length !== 1,
  );
  return {
    a: build(a),
    b: build(b),
    omittedBars: [a.originalBars - Math.min(a.bars, bars), b.originalBars - Math.min(b.bars, bars)],
    paddingBars: [Math.max(0, bars - a.bars), Math.max(0, bars - b.bars)],
    uncertainKeys,
  };
}

export function reviewListening(
  plan: ScorePlan,
  map: SemanticMap,
  signal: ReviewSignal,
  selectedA?: string,
  selectedB?: string,
) {
  const unitIds = [
    ...new Set([
      ...signal.unit_ids,
      ...map.events
        .filter((event) => signal.event_ids.includes(event.event_id))
        .map((event) => event.unit_id),
    ]),
  ];
  const unitA = selectedA ?? unitIds[0];
  const unitB = selectedB ?? unitIds[1];
  const comparison =
    unitA && unitB && unitA !== unitB
      ? responsibilityComparison(plan, map, unitA, unitB, signal.event_ids)
      : undefined;
  const single = (unitId?: string) => {
    const grounded = map.events.filter((event) => event.unit_id === unitId && event.state === 'grounded');
    const ids = grounded
      .filter((event) => signal.event_ids.includes(event.event_id))
      .map((event) => event.event_id);
    return focusedExcerpt(
      plan,
      ids.length ? ids : grounded.map((event) => event.event_id),
      4,
      grounded.map((event) => event.event_id),
    );
  };
  const a = single(unitA),
    b = single(unitB);
  const plans = comparison ? [comparison.a, comparison.b] : [a.plan, b.plan];
  const sequence = comparison
    ? sequenceExcerpts(comparison.a, comparison.b)
    : unitIds.length === 1
      ? a.plan
      : undefined;
  const tag = (part: ScorePlan) => ({ ...part, scene_id: `review_${signal.signal_id}` });
  return {
    unitIds,
    unitA,
    unitB,
    a: tag(plans[0]),
    b: tag(plans[1]),
    sequence: sequence && tag(sequence),
    omittedBars: comparison?.omittedBars ?? [a.omittedBars, b.omittedBars],
    paddingBars: comparison?.paddingBars ?? [0, 0],
    uncertainKeys: comparison?.uncertainKeys,
    omittedEventIds: signal.event_ids.filter(
      (id) => !plans.some((part) => part.notes.some((note) => note.kind === 'data' && note.event_id === id)),
    ),
  };
}

export function sequenceExcerpts(a: ScorePlan, b: ScorePlan): ScorePlan {
  return {
    ...a,
    total_bars: a.total_bars + b.total_bars,
    notes: [
      ...a.notes.map((note) => ({ ...note, note_id: `a_${note.note_id}` })),
      ...b.notes.map((note) => ({
        ...note,
        note_id: `b_${note.note_id}`,
        tick: note.tick + a.total_bars * 1920,
      })),
    ],
  };
}
