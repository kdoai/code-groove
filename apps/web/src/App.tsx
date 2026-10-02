import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import { FolderGit2, ArrowRight, HelpCircle, LogOut, ScanLine } from 'lucide-react';
import { api, currentUser, logout, setupAuth, type Bundle, type PublicConfig } from './api';
import { useWorkspace } from './state';
import { Transport } from './components/Transport';
import { AgentPanel } from './components/AgentPanel';
import { useRunEvents } from './hooks/useRunEvents';
import { AuthDialog, OpenDialog, Onboarding } from './components/Dialogs';
import type { InvestigationResult } from '../../../packages/contracts';
import { ReviewWorkspace, SampleSwitch } from './components/ReviewWorkspace';
import { playbackPlan } from './audio/playback';
import { SpotlightTour } from './components/SpotlightTour';

type Run = {
  run_id: string;
  status: string;
  result_id?: string;
  error?: { code: string; message: string };
  input_tokens?: number;
  output_tokens?: number;
};
const active = ['enqueue_pending', 'queued', 'fetching', 'indexing', 'investigating', 'compiling'];
export default function App() {
  const ws = useWorkspace(),
    cache = useQueryClient();
  const [modal, setModal] = useState<'open' | 'auth' | 'guide' | ''>(() =>
    localStorage.getItem('code-groove-hide-guide') === 'true' ? '' : 'guide',
  );
  const [user, setUser] = useState<User | null>(null),
    [error, setError] = useState('');
  const [runId, setRunId] = useState(''),
    [investigationRunId, setInvestigationRunId] = useState(''),
    [result, setResult] = useState<InvestigationResult>();
  const [starting, setStarting] = useState(false),
    [investigationError, setInvestigationError] = useState('');
  const [tour, setTour] = useState(false);
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<PublicConfig>('/config'),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (config.data) void setupAuth(config.data, setUser);
  }, [config.data]);
  useEffect(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)\/(arrange|inspect)/);
    if (match)
      ws.set({
        projectId: match[1],
        sampleId: match[1].startsWith('sample-') ? match[1].slice(7) : '',
        screen: match[2] as 'arrange' | 'inspect',
        analysisId: new URLSearchParams(location.search).get('analysis') ?? '',
        unitId: new URLSearchParams(location.search).get('unit') ?? '',
        eventId: new URLSearchParams(location.search).get('event') ?? '',
        scene: Math.max(0, Math.min(7, Number(new URLSearchParams(location.search).get('scene') ?? 1) - 1)),
        codeSpan: null,
      });
  }, []);
  useEffect(() => {
    if (ws.projectId)
      history.replaceState(
        null,
        '',
        `/projects/${ws.projectId}/${ws.screen}?scene=${ws.scene + 1}${ws.analysisId ? `&analysis=${ws.analysisId}` : ''}${ws.unitId ? `&unit=${ws.unitId}` : ''}${ws.eventId ? `&event=${ws.eventId}` : ''}`,
      );
  }, [ws.projectId, ws.screen, ws.scene, ws.analysisId, ws.unitId, ws.eventId]);
  const project = useQuery({
    queryKey: ['project', ws.projectId],
    queryFn: () => api<{ run_id: string; latest_analysis_id?: string }>(`/projects/${ws.projectId}`),
    enabled: !!ws.projectId && !ws.sampleId && !!user,
    retry: false,
  });
  useEffect(() => {
    if (!project.data || ws.analysisId || runId) return;
    if (project.data.latest_analysis_id) ws.set({ analysisId: project.data.latest_analysis_id });
    else setRunId(project.data.run_id);
  }, [project.data]);
  const bundle = useQuery({
    queryKey: ['bundle', ws.projectId, ws.analysisId, 'groove-arrangement-v4'],
    queryFn: () =>
      api<Bundle>(
        ws.sampleId
          ? `/samples/${ws.sampleId}/bundle`
          : `/projects/${ws.projectId}/bundle${ws.analysisId ? `?analysis=${ws.analysisId}` : ''}`,
      ),
    enabled: !!ws.projectId && (ws.sampleId !== '' || !!user) && !runId,
    retry: false,
    staleTime: Infinity,
  });
  const run = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api<Run>(`/runs/${runId}`),
    enabled: !!runId && !!user,
    refetchInterval: (query) =>
      active.includes(query.state.data?.status ?? 'queued') ? (document.hidden ? 5000 : 1000) : false,
  });
  const runEvents = useRunEvents(runId, !!user, active.includes(run.data?.status ?? 'queued'));
  useEffect(() => {
    if (!run.data || active.includes(run.data.status)) return;
    if (['completed', 'partial'].includes(run.data.status)) {
      ws.set({ analysisId: run.data.result_id ?? '' });
      setRunId('');
    } else {
      setError(run.data.error?.message ?? '処理を終了しました。');
    }
  }, [run.data]);
  const investigationRun = useQuery({
    queryKey: ['run', investigationRunId],
    queryFn: () => api<Run>(`/runs/${investigationRunId}`),
    enabled: !!investigationRunId && !!user,
    refetchInterval: (query) => (active.includes(query.state.data?.status ?? 'queued') ? 1000 : false),
  });
  const investigationEvents = useRunEvents(
    investigationRunId,
    !!user,
    active.includes(investigationRun.data?.status ?? 'queued'),
  );
  useEffect(() => {
    const run = investigationRun.data;
    if (!run || active.includes(run.status)) return;
    if (run.result_id)
      void api<InvestigationResult>(`/investigations/${run.result_id}`)
        .then(setResult)
        .catch((e) => setInvestigationError(e.message));
    else setInvestigationError(run.error?.message ?? '調査を終了しました。');
  }, [investigationRun.data]);
  const pending = starting || (!!runId && active.includes(run.data?.status ?? 'queued'));
  const investigating = !!investigationRunId && active.includes(investigationRun.data?.status ?? 'queued');
  function openSample(id: string) {
    ws.set({
      sampleId: id,
      projectId: `sample-${id}`,
      analysisId: '',
      scene: 0,
      unitId: '',
      eventId: '',
      codeSpan: null,
      screen: 'inspect',
      muted: [],
      solo: [],
      mode: 'repo',
      wholeWork: true,
      loop: false,
      pulseMuted: true,
      instrumentMutes: [],
      focusEvidence: false,
    });
    setModal('');
    setRunId('');
    setResult(undefined);
    setError('');
  }
  async function openSaved(id: string) {
    setStarting(true);
    setModal('');
    setError('');
    setResult(undefined);
    setInvestigationRunId('');
    try {
      const saved = await api<{ latest_analysis_id?: string; run_id: string }>(`/projects/${id}`);
      ws.set({
        projectId: id,
        sampleId: '',
        analysisId: saved.latest_analysis_id ?? '',
        unitId: '',
        eventId: '',
        codeSpan: null,
        scene: 0,
        screen: 'inspect',
        muted: [],
        solo: [],
      });
      setRunId(saved.latest_analysis_id ? '' : saved.run_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function openRepo(url?: string) {
    if (!currentUser) {
      setModal('auth');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const project = await api<{ project_id: string; run_id: string }>('/projects', {
        source: url
          ? { kind: 'github_public', url }
          : { kind: 'sample', sample_id: ws.sampleId.replace(/^recorded-/, '') || 'mixed' },
      });
      ws.set({
        projectId: project.project_id,
        sampleId: '',
        analysisId: '',
        unitId: '',
        eventId: '',
        codeSpan: null,
        scene: 0,
        screen: 'inspect',
      });
      setRunId(project.run_id);
      setModal('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function investigate(question: string) {
    if (!bundle.data || ws.sampleId || bundle.data.map.origin === 'fixture') return;
    setInvestigationError('');
    setResult(undefined);
    try {
      const run = await api<{ run_id: string }>(`/analyses/${bundle.data.map.analysis_id}/investigations`, {
        scene_id: bundle.data.score.scenes[ws.scene].scene_id,
        unit_ids: ws.unitId
          ? bundle.data.map.units
              .filter(
                (u) =>
                  u.review_state === 'inspected' &&
                  bundle.data!.score.scenes[ws.scene].unit_ids.includes(u.unit_id) &&
                  u.primary_span.path ===
                    (ws.codeSpan?.path ??
                      bundle.data!.map.units.find((selected) => selected.unit_id === ws.unitId)?.primary_span
                        .path),
              )
              .slice(0, 12)
              .map((u) => u.unit_id)
          : [
              bundle.data.map.review_signals?.[0]?.unit_ids[0] ??
                bundle.data.map.units.find((u) => u.review_state === 'inspected')!.unit_id,
            ],
        event_ids: ws.eventId ? [ws.eventId] : [],
        question,
      });
      setInvestigationRunId(run.run_id);
    } catch (e) {
      setInvestigationError((e as Error).message);
    }
  }
  async function refreshRepository() {
    if (!ws.projectId || ws.sampleId || !currentUser) return;
    setStarting(true);
    setError('');
    try {
      const run = await api<{ run_id: string }>(`/projects/${ws.projectId}/analyses`, {});
      setRunId(run.run_id);
      ws.set({ analysisId: '', eventId: '', unitId: '', codeSpan: null });
      cache.invalidateQueries({ queryKey: ['project', ws.projectId] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,button,.monaco-editor,[role="dialog"]')) return;
      const events = bundle.data?.map.events ?? [];
      if (e.key === 'Escape') ws.set({ unitId: '', eventId: '', codeSpan: null });
      if (e.key === 'Enter' && (ws.unitId || ws.eventId)) ws.set({ screen: 'inspect' });
      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && events.length) {
        e.preventDefault();
        const index = events.findIndex((event) => event.event_id === ws.eventId);
        const event =
          events[(index + (e.key === 'ArrowRight' ? 1 : events.length - 1) + events.length) % events.length];
        ws.set({ unitId: event.unit_id, eventId: event.event_id, codeSpan: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bundle.data, ws.unitId, ws.eventId]);
  const data = bundle.data;
  const playbackScene = ws.wholeWork ? 0 : ws.scene;
  const plan = useMemo(
    () => playbackPlan(data?.score, ws.mode, playbackScene, ws.wholeWork),
    [data?.score, ws.mode, playbackScene, ws.wholeWork],
  );
  useEffect(() => {
    if (!data || ws.unitId || ws.codeSpan) return;
    const signal = data.map.review_signals?.find((s) => s.verdict === 'concern');
    const target = data.map.units.find((u) => u.unit_id === signal?.unit_ids[0]) ?? data.map.units[0];
    const event = data.map.events.find((e) => e.unit_id === target.unit_id);
    ws.set({ unitId: target.unit_id, eventId: event?.event_id ?? '', codeSpan: null });
  }, [data, ws.unitId]);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          Code Groove
        </a>
        <span className="product-purpose">コードの設計を、リズムで確認</span>
        <SampleSwitch openSample={openSample} />
        <button onClick={() => setModal('open')}>
          <FolderGit2 size={14} />
          Repositoryを開く
        </button>
        <button className="icon-button" aria-label="使い方" onClick={() => setModal('guide')}>
          <HelpCircle size={16} />
        </button>
        {user ? (
          <button
            className="account"
            title="ログアウト"
            onClick={async () => {
              await logout();
              cache.clear();
              ws.set({
                projectId: '',
                sampleId: '',
                analysisId: '',
                unitId: '',
                eventId: '',
                codeSpan: null,
              });
              history.replaceState(null, '', '/');
              setRunId('');
            }}
          >
            <LogOut size={15} />
          </button>
        ) : (
          <button onClick={() => setModal('auth')}>ログイン</button>
        )}
      </header>
      <Transport score={data?.score} onError={setError} />
      {user && ws.projectId && !ws.sampleId && (
        <div className="refresh-bar">
          <span>保存済み結果を再生中 · Git更新時は変更と影響先だけ調査</span>
          <button disabled={pending} onClick={() => void refreshRepository()}>
            Gitの差分を調べる
          </button>
        </div>
      )}
      {(error || bundle.error) && (
        <div className="inline-error" role="alert">
          {error || bundle.error?.message}
          <button onClick={() => setModal('open')}>別のRepositoryを開く</button>
        </div>
      )}
      {pending ? (
        <main className="analysis-progress">
          <ScanLine size={27} />
          <h2>Agentがコードの関係を調べています</h2>
          <p>
            {runEvents.data?.at(-1)?.payload.message ??
              runEvents.data?.at(-1)?.payload.purpose ??
              '固定スナップショットを準備しています。'}
          </p>
          <div className="agent-steps">
            {(runEvents.data ?? [])
              .filter((e) => e.type === 'tool_completed' || e.type === 'incremental_scope')
              .slice(-5)
              .map((e) => (
                <div key={e.seq}>
                  <span>✓</span>
                  {e.payload.purpose ??
                    e.payload.tool ??
                    `変更範囲を確認 · ${e.payload.reused_units} 関数を再利用`}
                </div>
              ))}
          </div>
          <button
            onClick={() => runId && void api(`/runs/${runId}/cancel`, {}).catch((e) => setError(e.message))}
          >
            調査を停止
          </button>
        </main>
      ) : data && plan ? (
        <ReviewWorkspace bundle={data} plan={plan}>
          <AgentPanel
            key={data.map.analysis_id}
            bundle={data}
            result={result}
            events={investigationEvents.data ?? []}
            pending={investigating}
            investigate={(q) => void investigate(q)}
            activateLive={() => void openRepo()}
            error={investigationError}
            publish={() => {
              if (result)
                void api<{ analysis_id: string }>(
                  `/investigations/${result.investigation_id}/publish-interpretation`,
                  {},
                )
                  .then((next) => {
                    ws.set({ analysisId: next.analysis_id });
                    setResult(undefined);
                  })
                  .catch((e) => setInvestigationError(e.message));
            }}
          />
        </ReviewWorkspace>
      ) : (
        <main className="start-review">
          <span className="eyebrow">LISTEN. LOCATE. ASK.</span>
          <h1>コードの違和感を、聴いて見つける。</h1>
          <p>
            ファイルのリズムを聴き、気になる箇所をコードで確認。
            <br />
            Agentに、その判断の理由を聞けます。
          </p>
          <button className="primary" onClick={() => openSample('recorded-returns-before')}>
            比較サンプルを開く
            <ArrowRight size={15} />
          </button>
          <small>保存した実際のGemini調査 · ログイン・新しいAI費用なし</small>
        </main>
      )}
      <footer className="statusbar">
        <span className="status-dot" />
        {data
          ? data.map.origin === 'fixture'
            ? '模擬サンプル'
            : data.map.origin === 'recorded_live'
              ? '保存済み実解析'
              : '実解析'
          : 'Ready'}
        <span className="status-right">
          {data
            ? `${data.map.coverage.inspected_units}/${data.map.coverage.indexed_units} 関数を確認`
            : 'TypeScript / Python'}{' '}
          · 読み取り専用
        </span>
      </footer>
      {modal === 'open' && (
        <OpenDialog
          close={() => setModal('')}
          openSample={openSample}
          openRepo={(url) => void openRepo(url)}
          openProject={(id) => void openSaved(id)}
          pending={starting}
        />
      )}
      {modal === 'auth' && (
        <AuthDialog close={() => setModal('')} done={() => setModal(ws.sampleId ? '' : 'open')} />
      )}
      {modal === 'guide' && (
        <Onboarding
          close={() => setModal('')}
          loadSample={() => {
            ws.set({ mode: 'repo', wholeWork: true, loop: false, pulseMuted: true });
            openSample('recorded-returns-before');
            setTour(true);
          }}
        />
      )}
      {tour && <SpotlightTour ready={!!data && !!plan} close={() => setTour(false)} />}
    </div>
  );
}
