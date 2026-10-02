import { useEffect, useState } from 'react';
import { X, ArrowRight, Music2 } from 'lucide-react';
import { api, currentUser, login } from '../api';
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
            e.currentTarget.querySelectorAll<HTMLElement>('button,input,textarea,[tabindex="0"]'),
          ).filter((el) => !(el as HTMLButtonElement).disabled);
          if (e.shiftKey && document.activeElement === nodes[0]) {
            e.preventDefault();
            nodes.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
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
    id: 'recorded-returns-before',
    label: 'A · 改善前 / TypeScript',
    detail: '長い実例 · Agentが共有ポリシーの散在を調査',
  },
  {
    id: 'recorded-returns-after',
    label: 'B · 改善後 / TypeScript',
    detail: '動作を保ち、重複していた判断を一つに',
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
  openProject,
  pending,
}: {
  close: () => void;
  openSample: (id: string) => void;
  openRepo: (url: string) => void;
  openProject: (id: string) => void;
  pending: boolean;
}) {
  const projects = useQuery({
    queryKey: ['saved-projects'],
    queryFn: () =>
      api<
        {
          project_id: string;
          latest_analysis_id?: string;
          source: { url?: string; sample_id?: string };
          status: string;
        }[]
      >('/projects'),
    enabled: !!currentUser,
    staleTime: 10000,
  });
  return (
    <Dialog title="Repositoryを開く" close={close}>
      <p className="dialog-intro">公開コードを読み込み、設計をGrooveにします。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          openRepo(String(new FormData(e.currentTarget).get('url')));
        }}
      >
        <label>
          公開GitHubリポジトリ
          <input name="url" type="url" placeholder="https://github.com/owner/repository" required autoFocus />
        </label>
        <small className="dialog-footnote">
          TypeScript / TSX · 最大40ファイル / 6,000行。認証情報を含めないでください。
        </small>
        <button className="primary wide" disabled={pending}>
          Agentで調査する
          <ArrowRight size={16} />
        </button>
      </form>
      {!!projects.data?.length && (
        <>
          <div className="section-label">YOUR SAVED WORK</div>
          <div className="sample-list">
            {projects.data.slice(0, 8).map((project) => (
              <button key={project.project_id} onClick={() => openProject(project.project_id)}>
                <span>
                  <strong>
                    {project.source.sample_id ?? project.source.url?.split('/').at(-1) ?? 'Repository'}
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
        <h2>設計の違いを、聴いてみよう。</h2>
        <p>実際の画面を動かす短いデモです。改善前を聴き、気になる音の根拠を開き、改善後と比べます。</p>
        <small>保存したGemini調査を使用 · 新しいAI費用なし</small>
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
