import type { SemanticMap } from '../../contracts';
import type { ScorePlan, ScheduledNote } from '../../contracts/ScoreBundle';

export const melody = [
  [72, 76, 79, 81, 79, 76, 74, 72],
  [67, 69, 72, 76, 74, 72, 69, 67],
  [76, 79, 81, 84, 81, 79, 76, 74],
  [69, 72, 74, 79, 76, 74, 72, 69],
  [74, 76, 79, 81, 84, 81, 79, 76],
  [79, 76, 74, 72, 69, 72, 74, 76],
];
const chords = [
  [52, 59, 62, 67],
  [55, 60, 64, 69],
  [53, 60, 64, 69],
  [53, 59, 64, 69],
];
const bassLines = [
  [36, 40, 43, 44],
  [33, 36, 40, 37],
  [38, 41, 45, 42],
  [31, 35, 38, 35],
];

export function arrangeJazz(plan: ScorePlan, map: SemanticMap) {
  const add = (
    id: string,
    tick: number,
    voice: ScheduledNote['voice'],
    midi: number | null,
    velocity: number,
    duration: number,
    extras: Partial<ScheduledNote> = {},
  ) => {
    plan.notes.push({
      note_id: id,
      kind: 'accompaniment',
      tick,
      voice,
      midi,
      variant: 0,
      velocity,
      duration_ms: duration,
      pan: voice === 'bass' ? -0.12 : 0.12,
      evidence_ids: [],
      ...extras,
    });
  };
  for (let bar = 0; bar < plan.total_bars; bar++) {
    const start = bar * 1920;
    const harmony = bar % 4;
    for (let beat = 0; beat < 4; beat++) {
      add(
        `bass_${bar}_${beat}`,
        start + beat * 480,
        'bass',
        (bar === plan.total_bars - 1 ? [36, 43, 40, 36] : bassLines[harmony])[beat],
        0.42,
        510,
      );
      add(
        `brush_${bar}_${beat}`,
        start + beat * 480 + (beat % 2 ? 40 : 0),
        'snare',
        null,
        beat % 2 ? 0.19 : 0.045,
        220,
      );
      add(`ride_${bar}_${beat}`, start + beat * 480, 'hat', null, beat % 2 ? 0.085 : 0.1, 140);
      if (beat === 1 || beat === 3)
        add(`swing_${bar}_${beat}`, start + beat * 480 + 320, 'hat', null, 0.06, 110);
    }
    for (const step of [0, 10])
      chords[bar === plan.total_bars - 1 ? 0 : harmony].forEach((pitch, i) =>
        add(`chord_${bar}_${step}_${i}`, start + step * 120 + i * 7, 'piano', pitch, 0.19, 1500),
      );
    const phrase = plan.phrases.find((p) => p.start_bar <= bar && bar < p.start_bar + p.bar_count);
    const owners = plan.notes.filter(
      (n) =>
        n.kind === 'data' &&
        (phrase?.unit_id ? n.unit_id === phrase.unit_id : n.responsibility_id === phrase?.responsibility_id),
    );
    const rids = [...new Set(owners.map((n) => n.responsibility_id!))];
    rids.forEach((rid, index) => {
      const responsibility = map.responsibilities.find((r) => r.responsibility_id === rid)!;
      const motif = Number(responsibility.motif_id.slice(1));
      const anchor = owners.find((n) => n.responsibility_id === rid)!;
      const localBar = bar - (phrase?.start_bar ?? 0);
      const rhythms = [
        [0, 320, 720, 960, 1440],
        [0, 480, 800, 1280],
        [0, 320, 720, 1120, 1600],
        [0, 640, 960],
      ];
      rhythms[localBar % 4].forEach((offset, beat) => {
        const anchors = owners.filter((n) => n.responsibility_id === rid);
        const linked = anchors[(localBar * 4 + beat) % anchors.length] ?? anchor;
        const position = localBar * 4 + beat;
        add(
          `melody_${bar}_${rid}_${beat}`,
          start + offset + index * 40,
          motif % 2 ? 'vibes' : 'piano',
          bar === plan.total_bars - 1 && beat === rhythms[localBar % 4].length - 1
            ? 72
            : melody[motif][position % 8],
          (beat === 0 ? 0.28 : 0.2) / Math.sqrt(rids.length),
          localBar % 4 === 3 && beat === 2 ? 1000 : 620,
          {
            responsibility_id: rid,
            event_id: linked.event_id,
            unit_id: linked.unit_id,
            variant: motif,
            evidence_ids: linked.evidence_ids,
          },
        );
      });
    });
  }
  for (const signal of map.review_signals ?? []) {
    if (signal.verdict !== 'concern') continue;
    for (const target of plan.mode === 'repo' ? signal.unit_ids : [undefined]) {
      const event = plan.notes.find(
        (n) =>
          n.kind === 'data' && signal.event_ids.includes(n.event_id!) && (!target || n.unit_id === target),
      );
      if (!event) continue;
      const phrase = plan.phrases.find(
        (p) => p.unit_id === event.unit_id || p.responsibility_id === event.responsibility_id,
      );
      const start = (phrase?.start_bar ?? Math.floor(event.tick / 1920)) * 1920;
      const pattern =
        signal.category === 'policy_scattering'
          ? [0, 160, 480, 640, 960, 1120, 1440, 1600]
          : signal.category === 'responsibility_mixing'
            ? [0, 320, 720, 1040, 1440, 1680]
            : [0, 480, 720, 960, 1440];
      for (const bar of [1, 2]) {
        const tick = start + bar * 1920;
        if (tick + 1920 > plan.total_bars * 1920) continue;
        pattern.forEach((offset, i) =>
          add(
            `cue_${signal.signal_id}_${target ?? 'theme'}_${bar}_${i}`,
            tick + offset,
            i % 2 ? 'vibes' : 'piano',
            melody[
              Number(
                map.responsibilities
                  .find((r) => r.responsibility_id === event.responsibility_id)!
                  .motif_id.slice(1),
              )
            ][Math.floor(i / 2) % 4],
            i % 2 ? 0.4 : 0.58,
            320,
            {
              kind: 'cue',
              signal_id: signal.signal_id,
              event_id: event.event_id,
              unit_id: event.unit_id,
              responsibility_id: event.responsibility_id,
              evidence_ids: signal.evidence_ids,
            },
          ),
        );
        for (const note of plan.notes)
          if (
            note.kind === 'accompaniment' &&
            note.tick >= tick &&
            note.tick < tick + 1920 &&
            (note.voice === 'piano' || note.voice === 'vibes')
          )
            note.velocity *= 0.4;
      }
    }
  }
}
