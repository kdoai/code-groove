import type { ScoreBundle } from '../../../../packages/contracts';
import type { ScorePlan } from '../../../../packages/contracts/ScoreBundle';

export function playbackPlan(
  score: ScoreBundle | undefined,
  mode: 'repo' | 'theme',
  scene: number,
  whole: boolean,
): ScorePlan | undefined {
  if (!score?.scenes.length) return undefined;
  if (!whole) return score.scenes[scene]?.[mode];
  const plans = score.scenes.map((s) => s[mode]);
  const result: ScorePlan = { ...plans[0], scene_id: 'whole_work', total_bars: 0, notes: [], phrases: [] };
  for (const plan of plans) {
    const offset = result.total_bars;
    result.notes.push(
      ...plan.notes.map((n) => ({
        ...n,
        note_id: `${plan.scene_id}_${n.note_id}`,
        tick: n.tick + offset * 1920,
      })),
    );
    result.phrases.push(
      ...plan.phrases.map((p) => ({
        ...p,
        phrase_id: `${plan.scene_id}_${p.phrase_id}`,
        start_bar: p.start_bar + offset,
      })),
    );
    result.total_bars += plan.total_bars;
  }
  return result;
}
