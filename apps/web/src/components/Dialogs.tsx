import { useEffect, useState } from 'react';
import { X, ArrowRight, Music2 } from 'lucide-react';
import { api, currentUser, login, type ImportSnapshot, type PublicConfig } from '../api';
import { useQuery } from '@tanstack/react-query';

export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    const prior = document.activeElement as HTMLElement;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog?.focus();
    return () => {
      window.removeEventListener('keydown', handler);
      prior?.focus();
    };
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const nodes = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button,input,textarea,select,a[href],[tabindex="0"]',
            ),
          ).filter((el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0);
          if (!nodes.length) {
            e.preventDefault();
            return;
          }
          if (
            e.shiftKey &&
            (document.activeElement === nodes[0] || document.activeElement === e.currentTarget)
          ) {
            e.preventDefault();
            nodes.at(-1)?.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === nodes.at(-1) || document.activeElement === e.currentTarget)
          ) {
            e.preventDefault();
            nodes[0]?.focus();
          }
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button aria-label="閉じる" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function AuthDialog({ close, done }: { close: () => void; done: () => void }) {
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <Dialog title="実解析にログイン" close={close}>
      <p className="dialog-intro">審査・招待アカウントで、Agentによる調査を始められます。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          try {
            await login(String(form.get('email')), String(form.get('password')));
            done();
          } catch {
            setError('ログインできませんでした。アカウントとパスワードを確認してください。');
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          メールアドレス
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          パスワード
          <input name="password" type="password" autoComplete="current-password" required minLength={8} />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={pending}>
          {pending ? '確認しています…' : 'ログイン'}
          <ArrowRight size={16} />
        </button>
      </form>
      <small className="dialog-footnote">
        メール受信・ソーシャルログインは不要です。サンプルはログインせずに聴けます。
      </small>
    </Dialog>
  );
}
export const sampleLabels = [
  {
    id: 'recorded-tsugiai-agents',
    label: 'Tsugiai / 実在するAgentの引き継ぎ',
    detail: 'Python・TypeScript · Checkout Agentの9実装 · 保存済みGemini実解析',
  },
  {
    id: 'recorded-checkout-flow',
    label: 'Checkout Lab / 小さな教材',
    detail: 'TypeScript · 購入ロジックの保存済み実解析',
  },
  {
    id: 'recorded-scattered',
    label: '実解析を再生 · 分散',
    detail: 'Geminiの解釈と実ツール記録 · AI費用なし',
  },
  {
    id: 'recorded-justified',
    label: '実解析を再生 · 例外',
    detail: '関連テストを読んだ保存結果 · AI費用なし',
  },
  { id: 'cohesive', label: 'まとまり', detail: '責務ごとに独立した実装' },
  { id: 'scattered', label: '分散', detail: '同じ判断が別の場所にある' },
  { id: 'mixed', label: '混在', detail: '一つの実装に複数の判断' },
  { id: 'justified', label: '理由のある違い', detail: '法人契約の例外をたどる' },
  { id: 'orchestrator', label: '委譲', detail: '専門処理をつなぐ調整役' },
];
export function OpenDialog({
  close,
  openSample,
  openRepo,
  openSnapshot,
  openProject,
  pending,
}: {
  close: () => void;
  openSample: (id: string) => void;
  openRepo: (url: string, scope?: string) => void;
  openSnapshot: (snapshot: ImportSnapshot) => void;
  openProject: (id: string) => void;
  pending: boolean;
}) {
  const [importError, setImportError] = useState('');
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<PublicConfig>('/config'),
    staleTime: Infinity,
  });
  const projects = useQuery({
    queryKey: ['saved-projects'],
    queryFn: () =>
      api<
        {
          project_id: string;
          latest_analysis_id?: string;
          source: { url?: string; sample_id?: string; label?: string };
          status: string;
        }[]
      >('/projects'),
    enabled: !!currentUser,
    staleTime: 10000,
  });
  return (
    <Dialog title="Repositoryを開く" close={close}>
      <p className="dialog-intro">公開コードを読み込み、設計をGrooveにします。</p>
      {config.data?.daily_analysis_limit && (
        <p className="analysis-budget" data-testid="analysis-budget">
          AI解析は1ユーザー1日{config.data.daily_analysis_limit}回 · 日本時間09:00に切替
          <small>新規解析・未検査範囲・変更後の再解析が対象。保存済みの再生は回数を使いません。</small>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          openRepo(String(form.get('url')), String(form.get('scope') ?? '').trim());
        }}
      >
        <label>
          公開GitHubリポジトリ
          <input name="url" type="url" placeholder="https://github.com/owner/repository" required autoFocus />
        </label>
        <details className="scope-options">
          <summary>大きなリポジトリの検査範囲</summary>
          <label>
            対象フォルダー
            <input name="scope" placeholder="例: packages/billing/src" maxLength={200} />
          </label>
          <small>指定フォルダーとルートの説明・設定を読みます。範囲外のコードは未検査です。</small>
        </details>
        <small className="dialog-footnote">
          TypeScript / Python · 索引は400ファイル / 60,000行 / 4 MiB。大きい場合は分割し、未検査の範囲を保持。
        </small>
        <button className="primary wide" disabled={pending}>
          Agentで調査する
          <ArrowRight size={16} />
        </button>
      </form>
      <details className="scope-options">
        <summary>固定したローカルスナップショットを取り込む</summary>
        <p>
          準備ツールで作ったimport.jsonを選択します。公開してよいコードのみ。認証情報や業務データを含めないでください。
        </p>
        <label>
          スナップショットJSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={pending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 8 * 1024 * 1024) throw new Error('JSONは8 MiB以内です。');
                const snapshot = JSON.parse(await file.text()) as ImportSnapshot;
                if (!snapshot.revision || !snapshot.sources)
                  throw new Error('準備ツールのimport.jsonを選択してください。');
                setImportError('');
                openSnapshot(snapshot);
              } catch (error) {
                setImportError((error as Error).message);
              }
            }}
          />
        </label>
        {importError && (
          <p role="alert" className="error">
            {importError}
          </p>
        )}
      </details>
      {!!projects.data?.length && (
        <>
          <div className="section-label">YOUR SAVED WORK</div>
          <div className="sample-list">
            {projects.data.slice(0, 8).map((project) => (
              <button key={project.project_id} onClick={() => openProject(project.project_id)}>
                <span>
                  <strong>
                    {project.source.label ??
                      project.source.sample_id ??
                      project.source.url?.split('/').at(-1) ??
                      'Local snapshot'}
                  </strong>
                  <small>
                    {project.latest_analysis_id ? '保存済み実解析 · 再生はAI費用なし' : '処理の状態を確認'}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="section-label">
        BUILT-IN SAMPLES <span>保存済み実解析 / 模擬サンプル · AI費用なし</span>
      </div>
      <div className="sample-list">
        {sampleLabels.map((sample, i) => (
          <button key={sample.id} onClick={() => openSample(sample.id)}>
            <span className="sample-index">0{i + 1}</span>
            <span>
              <strong>{sample.label}</strong>
              <small>{sample.detail}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
export function Onboarding({ close, loadSample }: { close: () => void; loadSample: () => void }) {
  const [hide, setHide] = useState(false);
  const finish = () => {
    if (hide) localStorage.setItem('code-groove-hide-guide', 'true');
    close();
  };
  return (
    <Dialog title="Code Groove の使い方" close={finish}>
      <div className="guide-invitation">
        <Music2 size={32} />
        <span className="eyebrow">LISTEN. LOCATE. ASK.</span>
        <h2>引き継いだコードの、設計を聴こう。</h2>
        <p>
          実在するTsugiaiのAgent実装を使います。役割の配置を聴き、音を選んで、判断を支えるコードへ戻る短い案内です。
        </p>
        <small>保存済みの譜面を使用 · 案内で新しいAI費用は発生しません</small>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
        今後このメッセージを表示しない
      </label>
      <div className="dialog-actions">
        <button onClick={finish}>あとで見る</button>
        <button
          className="primary"
          onClick={() => {
            finish();
            loadSample();
          }}
        >
          実画面のデモを見る
          <ArrowRight size={16} />
        </button>
      </div>
    </Dialog>
  );
}
