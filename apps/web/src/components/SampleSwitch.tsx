import { primarySample } from '../samples';

export function SampleSwitch({ openSample }: { openSample: (id: string) => void }) {
  return (
    <details className="sample-switch">
      <summary data-tour="album">サンプル</summary>
      <div className="sample-menu">
        <strong>サンプルリポジトリ / TSUGIAI</strong>
        <p>{primarySample.detail}。ログイン・新規AI費用なし。</p>
        <button
          onClick={(event) => {
            event.currentTarget.closest('.sample-switch')?.removeAttribute('open');
            openSample(primarySample.id);
          }}
        >
          TSUGIAIを開く
        </button>
        <small>
          9実装の保存記録と、全体の参考コードは別です。残りの実装は保存済み解析の対象外です。リポジトリ全体と実行動作は未検証です。
        </small>
        <a href={primarySample.repositoryUrl} target="_blank" rel="noreferrer">
          TSUGIAIの元のコードを読む ↗
        </a>
      </div>
    </details>
  );
}
