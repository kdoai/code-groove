import { useEffect, useState } from 'react';
import { X, ArrowRight, Check, FolderGit2, Music2, MousePointer2 } from 'lucide-react';
import { login } from '../api';

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
  pending,
}: {
  close: () => void;
  openSample: (id: string) => void;
  openRepo: (url: string) => void;
  pending: boolean;
}) {
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
      <div className="section-label">
        BUILT-IN SAMPLES <span>模擬データ · AI費用なし</span>
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
  const [step, setStep] = useState(0),
    [hide, setHide] = useState(false);
  const icons = [FolderGit2, Music2, MousePointer2];
  const Icon = icons[step];
  const headings = ['コードの設計を、聴いてみる。', '同じ意味。二つの配置。', '気になる音から、根拠へ。'];
  const copy = [
    'まずは内蔵サンプル。公開リポジトリはログイン後にAgentが調べます。',
    'Playを押してRepoを聴く。Themeに切り替えると、同じ意味を責務ごとに聴けます。',
    '打点や小節を選び「調べる」。コードを開き、なぜその判断があるのかを確かめます。',
  ];
  const finish = () => {
    if (hide) localStorage.setItem('code-groove-hide-guide', 'true');
    close();
  };
  return (
    <Dialog title="Code Grooveの使い方" close={finish}>
      <div className="guide-visual">
        <span className="guide-count">0{step + 1} / 03</span>
        <Icon size={36} strokeWidth={1.3} />
        <div className={`guide-notes step-${step}`}>
          {[0, 1, 2].map((row) => (
            <div key={row}>
              {[0, 1, 2, 3].map((col) => (
                <i
                  key={col}
                  style={{
                    marginLeft: `${((row + col) % 3) * 8}px`,
                    background: ['#b6a2d5', '#91bea9', '#cdae7a'][row],
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <h3>{headings[step]}</h3>
      <p className="guide-copy">{copy[step]}</p>
      <div className="guide-dots">
        {[0, 1, 2].map((i) => (
          <button key={i} aria-label={`説明 ${i + 1}`} aria-pressed={i === step} onClick={() => setStep(i)} />
        ))}
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
            if (step === 0) loadSample();
            if (step < 2) setStep(step + 1);
            else finish();
          }}
        >
          {step === 0 ? 'サンプルを開く' : step === 2 ? 'はじめる' : '次へ'}
          {step === 2 ? <Check size={16} /> : <ArrowRight size={16} />}
        </button>
      </div>
    </Dialog>
  );
}
