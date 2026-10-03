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
import type { ImprovementProposal, InvestigationResult } from '../../../packages/contracts';
import { ImprovementDialog } from './components/ImprovementDialog';
import { ReviewWorkspace, SampleSwitch } from './components/ReviewWorkspace';
import { playbackPlan } from './audio/playback';
import { engine } from './audio/engine';
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
  const [proposalRunId, setProposalRunId] = useState(''),
    [proposalId, setProposalId] = useState('');
  const [showProposal, setShowProposal] = useState(false),
    [proposalBusy, setProposalBusy] = useState(false);
  const [acceptingImprovement, setAcceptingImprovement] = useState(false);
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
    if (match?.[1] === 'sample-recorded-returns-after') match[1] = 'sample-recorded-returns-before';
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
    queryFn: () =>
      api<{
        run_id: string;
        latest_analysis_id?: string;
        previous_analysis_id?: string;
        latest_proposal_id?: string;
        proposal_run_id?: string;
        working_copy?: boolean;
      }>(`/projects/${ws.projectId}`),
    enabled: !!ws.projectId && !ws.sampleId && !!user,
    retry: false,
  });
  useEffect(() => {
    if (!project.data || runId) return;
    if (!ws.analysisId && project.data.latest_analysis_id)
      ws.set({ analysisId: project.data.latest_analysis_id });
    let cancelled = false;
    if (project.data.run_id)
      void api<Run>(`/runs/${project.data.run_id}`)
        .then((current) => {
          if (!cancelled && active.includes(current.status)) {
            setRunId(current.run_id);
            setAcceptingImprovement(
              !!project.data?.previous_analysis_id || !!project.data?.latest_proposal_id,
            );
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [project.data]);
  useEffect(() => {
    if (project.data?.latest_proposal_id) setProposalId(project.data.latest_proposal_id);
    if (project.data?.proposal_run_id) setProposalRunId(project.data.proposal_run_id);
  }, [project.data]);
  const proposalRun = useQuery({
    queryKey: ['run', proposalRunId],
    queryFn: () => api<Run>(`/runs/${proposalRunId}`),
    enabled: !!proposalRunId && !!user,
    refetchInterval: (q) => (active.includes(q.state.data?.status ?? 'queued') ? 1000 : false),
  });
  const proposing =
    proposalBusy || (!!proposalRunId && active.includes(proposalRun.data?.status ?? 'queued'));
  const proposalEvents = useRunEvents(proposalRunId, !!user, proposing);
  const proposal = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => api<ImprovementProposal>(`/proposals/${proposalId}`),
    enabled: !!proposalId && !!user,
    retry: false,
  });
  useEffect(() => {
    if (!proposalRun.data || active.includes(proposalRun.data.status)) return;
    if (proposalRun.data.result_id) {
      setProposalId(proposalRun.data.result_id);
      setShowProposal(true);
    } else setInvestigationError(proposalRun.data.error?.message ?? '改善案の作成を終了しました。');
    setProposalRunId('');
    cache.invalidateQueries({ queryKey: ['project', ws.projectId] });
  }, [proposalRun.data]);
  const bundle = useQuery({
    queryKey: ['bundle', ws.projectId, ws.analysisId, 'groove-chamber-v5'],
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
      setAcceptingImprovement(false);
      cache.invalidateQueries({ queryKey: ['project', ws.projectId] });
    } else {
      setError(run.data.error?.message ?? '処理を終了しました。');
      setRunId('');
      setAcceptingImprovement(false);
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
    setProposalId('');
    setProposalRunId('');
    setShowProposal(false);
    setAcceptingImprovement(false);
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
    setProposalId('');
    setProposalRunId('');
    setShowProposal(false);
    setAcceptingImprovement(false);
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
    setProposalId('');
    setProposalRunId('');
    setShowProposal(false);
    setAcceptingImprovement(false);
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
  async function activateSample() {
    if (!currentUser) {
      setModal('auth');
      return;
    }
    if (ws.sampleId === 'recorded-checkout-flow') {
      try {
        const saved = await api<{ project_id: string; analysis_id: string }>(
          `/samples/${ws.sampleId}/projects`,
          {},
        );
        ws.set({ projectId: saved.project_id, sampleId: '', analysisId: saved.analysis_id });
      } catch (e) {
        setInvestigationError((e as Error).message);
      }
    } else await openRepo();
  }
  async function investigate(question: string) {
    if (!bundle.data || ws.sampleId || bundle.data.map.origin === 'fixture') return;
    setInvestigationError('');
    setResult(undefined);
    try {
      const run = await api<{ run_id: string }>(`/analyses/${bundle.data.map.analysis_id}/investigations`, {
        scene_id: bundle.data.score.scenes[ws.scene].scene_id,
        unit_ids: [ws.unitId || bundle.data.map.units.find((u) => u.review_state === 'inspected')!.unit_id],
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
  async function proposeImprovement(signalId: string) {
    if (!currentUser) {
      setModal('auth');
      return;
    }
    if (!bundle.data || tour) return;
    setInvestigationError('');
    setProposalBusy(true);
    setProposalId('');
    try {
      let analysisId = bundle.data.map.analysis_id;
      if (ws.sampleId) {
        if (!['recorded-returns-before', 'recorded-checkout-flow'].includes(ws.sampleId))
          throw new Error('改善案はRepositoryの実解析、または返品サンプルから始めてください。');
        const saved = await api<{ project_id: string; analysis_id: string }>(
          `/samples/${ws.sampleId}/projects`,
          {},
        );
        ws.set({ projectId: saved.project_id, sampleId: '', analysisId: saved.analysis_id });
        analysisId = saved.analysis_id;
      }
      const next = await api<{ run_id: string }>(`/analyses/${analysisId}/proposals`, {
        signal_id: signalId,
      });
      setProposalRunId(next.run_id);
    } catch (e) {
      setInvestigationError((e as Error).message);
    } finally {
      setProposalBusy(false);
    }
  }
  async function decideImprovement(accept: boolean) {
    if (!proposal.data || tour) return;
    setProposalBusy(true);
    setInvestigationError('');
    try {
      if (accept) {
        const next = await api<{ run_id: string }>(`/proposals/${proposalId}/accept`, {});
        setAcceptingImprovement(true);
        setRunId(next.run_id);
        setShowProposal(false);
        ws.set({ unitId: '', eventId: '', codeSpan: null });
      } else {
        await api(`/proposals/${proposalId}/reject`, {});
        setShowProposal(false);
      }
      cache.invalidateQueries({ queryKey: ['proposal', proposalId] });
    } catch (e) {
      setInvestigationError((e as Error).message);
    } finally {
      setProposalBusy(false);
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
    const signal =
      data.map.analysis_depth === 'overview'
        ? undefined
        : data.map.review_signals?.find((s) => s.verdict === 'concern');
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
        <span className="product-purpose">コードの健康状態を、聴く</span>
        <SampleSwitch openSample={openSample} />
        {project.data?.previous_analysis_id && (
          <div className="sample-switch" aria-label="採用した変更の比較">
            <button
              aria-pressed={ws.analysisId === project.data.previous_analysis_id}
              onClick={() => {
                engine.pause();
                ws.set({
                  analysisId: project.data!.previous_analysis_id!,
                  unitId: '',
                  eventId: '',
                  codeSpan: null,
                });
              }}
            >
              変更前
            </button>
            <button
              aria-pressed={ws.analysisId === project.data.latest_analysis_id}
              onClick={() => {
                engine.pause();
                ws.set({
                  analysisId: project.data!.latest_analysis_id!,
                  unitId: '',
                  eventId: '',
                  codeSpan: null,
                });
              }}
            >
              採用後
            </button>
          </div>
        )}
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
              setProposalId('');
              setProposalRunId('');
              setShowProposal(false);
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
          <span>
            {project.data?.working_copy
              ? 'アプリ内のスナップショット · 元のRepositoryは保持'
              : '保存済み結果を再生中 · Git更新時は変更と影響先だけ調査'}
          </span>
          <button disabled={pending} onClick={() => void refreshRepository()}>
            {project.data?.working_copy ? '保存したコードを再確認' : 'Gitの差分を調べる'}
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
          <h2>
            {acceptingImprovement
              ? '採用した変更を、Geminiが再確認しています'
              : 'Agentがコードの関係を調べています'}
          </h2>
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
            events={proposing ? (proposalEvents.data ?? []) : (investigationEvents.data ?? [])}
            pending={investigating}
            proposing={proposing}
            propose={(id) => void proposeImprovement(id)}
            proposalTitle={
              proposal.data?.status === 'draft' && proposal.data.base_analysis_id === data.map.analysis_id
                ? proposal.data.title
                : undefined
            }
            openProposal={() => setShowProposal(true)}
            cancelProposal={() =>
              proposalRunId &&
              void api(`/runs/${proposalRunId}/cancel`, {}).catch((e) => setInvestigationError(e.message))
            }
            investigate={(q) => void investigate(q)}
            activateLive={() => void activateSample()}
            error={investigationError}
            publish={() => {
              if (result)
                void api<{ analysis_id: string }>(
                  `/investigations/${result.investigation_id}/publish-interpretation`,
                  {},
                )
                  .then((next) => {
                    ws.set({ analysisId: next.analysis_id });
                    void cache.invalidateQueries({ queryKey: ['project', ws.projectId] });
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
          <button className="primary" onClick={() => openSample('checkout-flow')}>
            比較サンプルを開く
            <ArrowRight size={15} />
          </button>
          <small>保存したGemini調査を聴く · 改善案の作成はログイン後にあなたが依頼</small>
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
          · {project.data?.working_copy ? 'アプリ内の作業コピー' : '元コードを保持'}
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
            openSample('checkout-flow');
            setTour(true);
          }}
        />
      )}
      {tour && <SpotlightTour ready={!!data && !!plan} close={() => setTour(false)} />}
      {showProposal && proposal.data && (
        <ImprovementDialog
          proposal={proposal.data}
          close={() => setShowProposal(false)}
          accept={() => void decideImprovement(true)}
          reject={() => void decideImprovement(false)}
          pending={proposalBusy}
          error={investigationError}
        />
      )}
    </div>
  );
}
