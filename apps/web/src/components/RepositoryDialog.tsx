import type { RepositoryStatus } from '../api';
import { Dialog } from './Dialogs';

export function RepositoryDialog({
  repository,
  close,
  analyze,
  open,
  pending,
}: {
  repository: RepositoryStatus;
  close: () => void;
  analyze: (chunkId: string, retryPartial?: boolean) => void;
  open: (analysisId: string) => void;
  pending: boolean;
}) {
  return (
    <Dialog title="リポジトリ全体の検査範囲" close={close}>
      <p className="dialog-intro">
        {repository.eligible_source_files}ファイル / {repository.source_lines.toLocaleString()}行を索引化。
        {repository.analyzed_chunks}/{repository.chunks.length}範囲に保存結果があります。
      </p>
      <p>
        {repository.inspected_units}実装を検査済み · {repository.pending_units}実装は未検査 ·{' '}
        {repository.unresolved_units}実装は未解決
      </p>
      <small>
        範囲ごとの責務分類は独立です。範囲間の整合性と全体の健全性は未判定。検査には日次上限を適用します。保存結果の再生はAI費用なし。
      </small>
      <div className="repository-chunks">
        {repository.chunks.map((chunk, i) => (
          <div className="repository-chunk" key={chunk.chunk_id}>
            <span>
              <strong>
                {i + 1}. {chunk.label}
              </strong>
              <small>
                {chunk.paths.join(', ')}
                <br />
                {chunk.units}実装 / {chunk.symbol_count}シンボル ·{' '}
                {chunk.status === 'pending'
                  ? '未検査'
                  : chunk.status === 'partial'
                    ? `一部未解決 (${chunk.unresolved_units})`
                    : '検査済み'}
              </small>
            </span>
            {chunk.analysis_id ? (
              <span className="repository-actions">
                <button onClick={() => open(chunk.analysis_id!)}>保存結果を開く</button>
                {chunk.status === 'partial' && (
                  <button disabled={pending} onClick={() => analyze(chunk.chunk_id, true)}>
                    未解決を再検査
                  </button>
                )}
              </span>
            ) : (
              <button disabled={pending} onClick={() => analyze(chunk.chunk_id)}>
                この範囲を検査
              </button>
            )}
          </div>
        ))}
      </div>
      {!!repository.files_without_units.length && (
        <details>
          <summary>関数を持たない{repository.files_without_units.length}ファイル</summary>
          <p>{repository.files_without_units.join(', ')}</p>
          <small>型・契約・定数など。関連調査で参照できます。個別の意味判定はありません。</small>
        </details>
      )}
    </Dialog>
  );
}
