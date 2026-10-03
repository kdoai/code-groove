import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, X } from 'lucide-react';
import { engine } from '../audio/engine';

const steps = [
  {
    target: 'album',
    title: '01 / ファイルから始める',
    copy: 'これは実際にGeminiが読んだ改善前のコード。現在は正しく動きますが、同じポリシーの判断が二つの入口にあります。',
  },
  {
    target: 'play',
    title: '02 / 設計を聴く',
    copy: '実際のPlayボタンで演奏します。メロディーは責務、ベースと和音は共通の伴奏。同じ旋律が重なる応答とオレンジの区間に注目してください。',
    action: '[data-tour="play"]',
  },
  {
    target: 'audition',
    title: '03 / 気になる音から根拠へ',
    copy: '実際の「懸念の前後を聴く」ボタンを押します。実装のどの判断が同じ変更に影響されるのか、コードと別の説明を確認できます。',
    action: '[data-tour="audition"]',
  },
  {
    target: 'improve',
    title: '04 / Agentに改善案を頼む',
    copy: 'このボタンからGeminiが関連コードを読み、改善案を作ります。ログインとあなたの依頼が必要です。案内中に有料の調査は始めません。',
  },
  {
    target: 'play',
    title: '05 / あなたが採用し、聴き比べる',
    copy: '生成した差分を確認して採用・却下を選びます。採用後にAgentが再解析し、初めて「採用後」が現れます。同じ責務の旋律を保ち、変わった関係を聴き比べます。改善済みの答えは先に選びません。',
  },
  {
    target: 'chat',
    title: '06 / そのまま質問する',
    copy: '右の欄はいつでも使えます。保存済みの解釈を確認するか、ログインしてAgentに関連コードを追加調査させられます。',
  },
];

export function SpotlightTour({ close, ready = true }: { close: () => void; ready?: boolean }) {
  const [step, setStep] = useState(0),
    [automatic, setAutomatic] = useState(false);
  const [rect, setRect] = useState<DOMRect>(),
    [hide, setHide] = useState(false);
  const performed = useRef(new Set<number>());
  const current = steps[step];
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const update = () => {
      const target = document.querySelector(`[data-tour="${current.target}"]`);
      if (target) {
        target.scrollIntoView({ block: 'nearest' });
        setRect(target.getBoundingClientRect());
      }
    };
    frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, [step, ready, current.target]);
  useEffect(() => {
    if (!ready || performed.current.has(step)) return;
    performed.current.add(step);
    const action = current.action ? document.querySelector<HTMLButtonElement>(current.action) : null;
    if (action && !(current.target === 'play' && engine.playing)) action.click();
  }, [step, ready, current]);
  useEffect(() => {
    if (!automatic || !ready) return;
    const timer = setTimeout(
      () => {
        if (step < steps.length - 1) setStep(step + 1);
        else setAutomatic(false);
      },
      step === 1 || step === 4 ? 9000 : 7000,
    );
    return () => clearTimeout(timer);
  }, [automatic, step, ready]);
  function finish() {
    engine.pause();
    if (hide) localStorage.setItem('code-groove-hide-guide', 'true');
    close();
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  });
  return (
    <div className="spotlight-tour" role="region" aria-label="実画面の使い方デモ">
      {rect && (
        <div
          className="spotlight-window"
          style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }}
        />
      )}
      <div
        className={`tour-card ${step === 5 ? 'tour-left' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label={current.title}
      >
        <button className="tour-close" aria-label="デモを閉じる" onClick={finish}>
          <X size={17} />
        </button>
        <span className="eyebrow">
          LIVE PRODUCT WALKTHROUGH · {step + 1} / {steps.length}
        </span>
        <h3>{current.title}</h3>
        <p>{current.copy}</p>
        <div className="tour-progress">
          {steps.map((_, i) => (
            <button
              key={i}
              aria-label={`デモの段階 ${i + 1}`}
              aria-pressed={i === step}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          今後このメッセージを表示しない
        </label>
        <div className="dialog-actions">
          <button onClick={() => setAutomatic(!automatic)}>
            {automatic ? <Pause size={14} /> : <Play size={14} />}
            {automatic ? '自動案内を停止' : '自動で見る'}
          </button>
          <button
            className="primary"
            disabled={!ready}
            onClick={() => (step < steps.length - 1 ? setStep(step + 1) : finish())}
          >
            {step === steps.length - 1 ? '自分で使ってみる' : '次へ'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
