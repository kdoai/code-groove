import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, X } from 'lucide-react';
import { engine } from '../audio/engine';

const steps = [
  {
    target: 'album',
    title: '01 / 動くコードの健康診断',
    copy: 'プレビュー、請求、ポイント、注文にまたがる機能。今は正常に動きます。全体を聴き、将来の変更や理解の負担を確かめる入口です。',
  },
  {
    target: 'play',
    title: '02 / 責務の配置を聴く',
    copy: '実際のPlayで演奏します。同じ役割は同じ旋律・リズム。複数の旋律が重なる箇所、別のファイルで戻る旋律を探します。繰り返しだけで悪いコードとは判定しません。',
    action: '[data-tour="play"]',
  },
  {
    target: 'audition',
    title: '03 / 気になった区間をもう一度',
    copy: '実際のボタンで選択した関数を聴き直します。ノートを押すと発音の根拠行へ。ベースと和音は共通伴奏です。',
    action: '[data-tour="audition"]',
  },
  {
    target: 'mark',
    title: '04 / ここを精密検査したい',
    copy: 'この区間を選ぶと演奏を止め、その音の位置を保持します。右側で同じ旋律が現れるファイルも辿れます。',
    action: '[data-tour="mark"]',
  },
  {
    target: 'chat',
    title: '05 / Agentに関係と将来の負担を聞く',
    copy: '選択から実コードを読み直し、将来の変更負担と正当な境界を検討します。初回に見つけた懸念も隠しません。案内中は有料調査を始めません。',
  },
  {
    target: 'chat',
    title: '06 / 経過観察か、改善かを決める',
    copy: '調査結果を確認して演奏へ反映。改善が妥当ならGeminiへ差分を依頼し、あなたが採用・却下を決めます。採用後の独立した再健診で初めて聴き比べが現れます。',
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
