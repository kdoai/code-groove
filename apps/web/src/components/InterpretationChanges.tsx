import type { InvestigationResult, SemanticMap } from '../../../../packages/contracts';
import type { Span } from '../../../../packages/contracts/SemanticMap';
import { useWorkspace } from '../state';

export function InterpretationChanges({ result, map }: { result?: InvestigationResult; map: SemanticMap }) {
  const ws = useWorkspace();
  if (!result) return null;
  const added = result.new_events ?? [];
  const replaced = result.replaced_event_ids ?? [];
  const reclassified = result.suggested_reclassification ?? [];
  const roles = [...map.responsibilities, ...(result.new_responsibilities ?? [])];
  function evidence(span: Span) {
    ws.set({ codeSpan: span, following: false });
  }
  return (
    <section className="interpretation-changes" data-testid="interpretation-changes">
      <b>今回の調査で更新する解釈</b>
      <p>
        意味イベントの追加 {added.length} · 置換元 {replaced.length} · 再分類 {reclassified.length}·
        候補の更新 {result.review_signals?.length ?? 0} · 撤回・置換 {result.replaced_signal_ids?.length ?? 0}
      </p>
      {(result.new_responsibilities ?? []).map((role) => (
        <p key={role.responsibility_id}>
          追加する責務: {role.label} · {role.definition}
          <br />
          変更理由: {role.change_reason}
        </p>
      ))}
      {added.map((event) => (
        <div key={event.event_id}>
          <p>
            追加: {event.label} · {roles.find((r) => r.responsibility_id === event.responsibility_id)?.label}
            <br />
            {event.meaning}
          </p>
          <button className="evidence-link" onClick={() => evidence(event.span)}>
            追加候補の根拠 · {event.span.path}:{event.span.start_line}–{event.span.end_line}
          </button>
        </div>
      ))}
      {replaced.map((id) => {
        const previous = map.events.find((e) => e.event_id === id);
        return (
          <p key={id}>
            置換元: {previous?.label ?? id}
            {previous && (
              <button className="evidence-link" onClick={() => evidence(previous.span)}>
                置換前の根拠 · {previous.span.path}:{previous.span.start_line}–{previous.span.end_line}
              </button>
            )}
          </p>
        );
      })}
      {reclassified.map((change) => {
        const previous = map.events.find((e) => e.event_id === change.event_id);
        return (
          <p key={change.event_id}>
            再分類: {previous?.label ?? change.event_id} ·
            {roles.find((r) => r.responsibility_id === change.from_responsibility_id)?.label} →
            {roles.find((r) => r.responsibility_id === change.to_responsibility_id)?.label}
            <br />
            {change.reason}
          </p>
        );
      })}
      <p>
        未確定の仮説:{' '}
        {(result.hypotheses ?? []).filter((h) => h.status === 'open' || h.status === 'undetermined').length}。
        各結論の未確認事項も確認してください。反映前の提案で、ソースの変更ではありません。
      </p>
    </section>
  );
}
