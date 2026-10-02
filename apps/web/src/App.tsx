import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import {
  FolderGit2,
  Folder,
  FileCode2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  Music2,
  ShieldCheck,
  GitCommitHorizontal,
  ScanLine,
} from 'lucide-react';
import { api, currentUser, logout, setupAuth, type Bundle, type PublicConfig } from './api';
import { useWorkspace } from './state';
import { Transport } from './components/Transport';
import { Sequencer } from './components/Sequencer';
import { AgentPanel } from './components/AgentPanel';
import { useRunEvents } from './hooks/useRunEvents';
import { AuthDialog, OpenDialog, Onboarding } from './components/Dialogs';
import type { InvestigationResult } from '../../../packages/contracts';

type Run = {
  run_id: string;
  status: string;
  result_id?: string;
  error?: { code: string; message: string };
  input_tokens?: number;
  output_tokens?: number;
};
const CodePanel = lazy(() =>
  import('./components/CodePanel').then((module) => ({ default: module.CodePanel })),
);
const active = ['enqueue_pending', 'queued', 'fetching', 'indexing', 'investigating', 'compiling'];
export default function App() {
  const ws = useWorkspace(),
    cache = useQueryClient();
  const [modal, setModal] = useState<'open' | 'auth' | 'guide' | ''>(() =>
    localStorage.getItem('code-groove-hide-guide') === 'true' ? '' : 'guide',
  );
  const [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(''),
    [collapsed, setCollapsed] = useState(false);
  const [runId, setRunId] = useState(''),
    [investigationRunId, setInvestigationRunId] = useState(''),
    [result, setResult] = useState<InvestigationResult>();
  const [starting, setStarting] = useState(false),
    [investigationError, setInvestigationError] = useState('');
  const investigated = useRef('');
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
    queryKey: ['bundle', ws.projectId, ws.analysisId],
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
      screen: 'arrange',
      muted: [],
      solo: [],
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
        screen: 'arrange',
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
        screen: 'arrange',
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
        unit_ids: ws.unitId ? [ws.unitId] : [],
        event_ids: ws.eventId ? [ws.eventId] : [],
        question,
      });
      setInvestigationRunId(run.run_id);
    } catch (e) {
      setInvestigationError((e as Error).message);
    }
  }
  useEffect(() => {
    const key = `${ws.analysisId}:${ws.unitId}:${ws.eventId}`;
    if (
      ws.screen === 'inspect' &&
      !ws.sampleId &&
      bundle.data?.map.origin !== 'fixture' &&
      bundle.data &&
      (ws.unitId || ws.eventId) &&
      investigated.current !== key
    ) {
      investigated.current = key;
      void investigate('このフレーズがこの実装にある理由と、例外を調べてください。');
    }
  }, [ws.screen, ws.unitId, ws.eventId, bundle.data]);
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
  const data = bundle.data,
    plan = data?.score.scenes[ws.scene]?.[ws.mode];
  const selected = data?.map.events.find((e) => e.event_id === ws.eventId),
    unit = data?.map.units.find((u) => u.unit_id === ws.unitId);
  const paths = data
    ? Object.keys(data.sources)
        .filter((p) => /\.tsx?$/.test(p))
        .sort()
    : [];
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            ws.set({ screen: 'arrange' });
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          Code Groove<span className="beta">BETA</span>
        </a>
        <nav aria-label="作業画面">
          {(['arrange', 'inspect'] as const).map((screen) => (
            <button
              key={screen}
              className={ws.screen === screen ? 'active' : ''}
              disabled={screen === 'inspect' && !data}
              onClick={() => {
                if (screen === 'inspect' && !ws.unitId && data) ws.set({ unitId: data.map.units[0].unit_id });
                ws.set({ screen });
              }}
            >
              {screen === 'arrange' ? <Music2 size={14} /> : <ScanLine size={14} />}{' '}
              {screen === 'arrange' ? 'Arrange' : 'Inspect'}
            </button>
          ))}
        </nav>
        <div className="topbar-repo">
          <FolderGit2 size={14} />
          <span>{data?.map.profile.title ?? 'No repository'}</span>
          {data && (
            <span className="snapshot">
              <GitCommitHorizontal size={13} />
              {data.map.snapshot_id.slice(-7)}
            </span>
          )}
        </div>
        <button className="open-button" onClick={() => setModal('open')}>
          <Folder size={14} />
          Open
        </button>
        <button className="icon-button" aria-label="使い方" title="使い方" onClick={() => setModal('guide')}>
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
            <span>{user.email?.slice(0, 1).toUpperCase()}</span>
            <LogOut size={13} />
          </button>
        ) : (
          <button className="login-link" onClick={() => setModal('auth')}>
            ログイン
          </button>
        )}
      </header>
      <Transport score={data?.score} onError={setError} />
      <div className="workspace">
        <aside className={`explorer ${collapsed ? 'collapsed' : ''}`}>
          <div className="explorer-heading">
            <span>EXPLORER</span>
            <button aria-label="Explorerの表示切替" onClick={() => setCollapsed(!collapsed)}>
              <PanelLeftClose size={14} />
            </button>
          </div>
          {!collapsed && (
            <>
              <div className="tree-root">
                <ChevronDown size={13} />
                <FolderGit2 size={14} />
                <strong>
                  {ws.sampleId ? `refund-${ws.sampleId}` : ws.projectId ? 'repository' : 'Workspace'}
                </strong>
              </div>
              <div className="tree-folder">
                <ChevronDown size={13} />
                <Folder size={14} />
                src
              </div>
              {paths.map((path) => (
                <button
                  key={path}
                  className={`tree-file ${unit?.primary_span.path === path ? 'selected' : ''}`}
                  title={path}
                  onClick={() => {
                    const target = data?.map.units.find((u) => u.primary_span.path === path);
                    if (target)
                      ws.set({ unitId: target.unit_id, eventId: '', codeSpan: null, screen: 'inspect' });
                  }}
                >
                  <FileCode2 size={13} />
                  {path.split('/').at(-1)}
                </button>
              ))}
              {!data && (
                <p className="empty-tree">
                  公開リポジトリか
                  <br />
                  サンプルを開いてください。
                </p>
              )}
              <div className="scope">
                <div className="section-label">ANALYSIS SCOPE</div>
                {data ? (
                  <>
                    <p>
                      <b>{data.map.coverage.inspected_units}</b> / {data.map.coverage.indexed_units} units
                      <span>意味を確認</span>
                    </p>
                    <p>
                      <b>{data.map.coverage.indexed_source_files}</b> files<span>静的索引</span>
                    </p>
                    {data.map.coverage.unresolved_unit_ids.length > 0 && (
                      <small>未確認：{data.map.coverage.unresolved_unit_ids.length} units</small>
                    )}
                    <span className="scope-language">TypeScript / TSX</span>
                  </>
                ) : (
                  <small>
                    索引と意味の確認範囲を
                    <br />
                    分けて表示します。
                  </small>
                )}
              </div>
              <div className="explorer-footer">
                <ShieldCheck size={14} />
                Read-only workspace
              </div>
            </>
          )}
        </aside>
        <main className="main-workspace">
          {(error || bundle.error) && (
            <div className="inline-error" role="alert">
              {error || bundle.error?.message}
              <button
                onClick={() => {
                  setError('');
                  setModal('open');
                }}
              >
                Repositoryを開く
              </button>
            </div>
          )}
          {pending ? (
            <div className="empty-state">
              <span className="spinner large" />
              <h2>Agentが設計を調べています</h2>
              <p>
                {runEvents.data?.at(-1)?.payload.message ??
                  runEvents.data?.at(-1)?.payload.purpose ??
                  '固定スナップショットを準備しています。'}
              </p>
              <small>ブラウザを閉じても処理は続きます。</small>
              <button
                onClick={() =>
                  runId && void api(`/runs/${runId}/cancel`, {}).catch((e) => setError(e.message))
                }
              >
                処理を停止
              </button>
              {run.data?.status === 'enqueue_pending' && (
                <button
                  onClick={() =>
                    void api(`/projects/${ws.projectId}/retry-enqueue`, {}).catch((e) => setError(e.message))
                  }
                >
                  キューへ再投入
                </button>
              )}
            </div>
          ) : data && plan ? (
            <>
              <div className="arrangement-heading">
                {ws.screen === 'inspect' ? (
                  <button className="back-button" onClick={() => ws.set({ screen: 'arrange' })}>
                    <ArrowLeft size={14} />
                    Arrangeへ
                  </button>
                ) : (
                  <span className="section-label">
                    ARRANGEMENT{' '}
                    <span>{ws.mode === 'repo' ? '実装の場所を聴く' : '責務のまとまりを聴く'}</span>
                  </span>
                )}
                <span>
                  {data.map.events.filter((e) => e.state === 'grounded').length} meaning events <i />{' '}
                  {plan.total_bars} bars
                </span>
              </div>
              <Sequencer map={data.map} plan={plan} compact={ws.screen === 'inspect'} />
              {ws.screen === 'inspect' ? (
                <div className="inspect-columns">
                  <Suspense fallback={<div className="code-panel">コードを読み込んでいます…</div>}>
                    <CodePanel bundle={data} />
                  </Suspense>
                  <AgentPanel
                    bundle={data}
                    result={result}
                    events={investigationEvents.data ?? []}
                    pending={investigating}
                    investigate={(q) => void investigate(q)}
                    error={investigationError}
                    publish={() => {
                      if (result)
                        void api<{ analysis_id: string }>(
                          `/investigations/${result.investigation_id}/publish-interpretation`,
                          {},
                        )
                          .then((next) => {
                            ws.set({ analysisId: next.analysis_id, screen: 'arrange' });
                            setResult(undefined);
                          })
                          .catch((e) => setInvestigationError(e.message));
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className={`selection-dock ${selected || unit ? 'has-selection' : ''}`}>
                    {selected || unit ? (
                      <>
                        <span className="selection-badge">SELECTED</span>
                        <div>
                          <strong>{selected?.label ?? unit?.label}</strong>
                          <small>
                            {selected?.span.path ?? unit?.primary_span.path} ·{' '}
                            {selected ? `L${selected.span.start_line}` : 'implementation unit'}
                          </small>
                        </div>
                        <button className="primary" onClick={() => ws.set({ screen: 'inspect' })}>
                          調べる
                          <ArrowRight size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="selection-hint">打点や小節を選ぶと、その意味をたどれます。</span>
                        <kbd>Enter</kbd>
                        <span>でInspect</span>
                      </>
                    )}
                  </div>
                  <div className="arrangement-notes">
                    <div>
                      <span className="section-label">ONE MATERIAL, TWO ARRANGEMENTS</span>
                      <p>Themeは責務ごとに。Repoは実装の配置どおりに。</p>
                      <small>音の素材はそのまま。フレーズの分かれ方を聴き比べてください。</small>
                    </div>
                    {ws.sampleId && (
                      <button className="subtle-button" onClick={() => void openRepo()}>
                        このサンプルを実解析
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Music2 size={32} strokeWidth={1.2} />
              </div>
              <span className="section-label">A WORKSPACE FOR LISTENING TO CODE</span>
              <h2>Repository</h2>
              <p>公開リポジトリを読み込み、設計をGrooveにします。</p>
              <div className="empty-actions">
                <button className="primary" onClick={() => setModal('open')}>
                  <FolderGit2 size={16} />
                  Repositoryを開く
                </button>
                <button onClick={() => openSample('mixed')}>
                  サンプルを聴く
                  <ArrowRight size={15} />
                </button>
              </div>
              <small>TypeScript / TSX · 公開コードのみ · コードは実行しません</small>
            </div>
          )}
        </main>
      </div>
      <footer className="statusbar">
        <span className="status-dot" />
        <span>
          {data
            ? data.map.origin === 'fixture'
              ? '模擬サンプル'
              : data.map.origin === 'recorded_live'
                ? '保存済み実解析'
                : '実解析'
            : 'Ready'}
        </span>
        <i />
        <span>
          {data
            ? `${data.map.coverage.inspected_units}/${data.map.coverage.indexed_units} units確認`
            : '公開サンプルをログインせずに再生できます'}
        </span>
        <span className="status-right" title={data?.map.model_id ?? config.data?.model_id}>
          <ShieldCheck size={12} />
          Read only
          <i />
          {investigating || pending
            ? 'Agent investigating'
            : data?.map.origin === 'fixture'
              ? 'Fixture · model calls 0'
              : 'Agent idle'}
          <i />
          groove-v1
        </span>
      </footer>
      <div className="mobile-message">
        Code GrooveはPC向けの作業画面です。
        <br />
        幅1280px以上のChrome / Edgeで開いてください。
      </div>
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
        <AuthDialog
          close={() => setModal('')}
          done={() => {
            setModal(ws.sampleId ? '' : 'open');
          }}
        />
      )}{' '}
      {modal === 'guide' && (
        <Onboarding
          close={() => setModal('')}
          loadSample={() => {
            openSample('mixed');
            setModal('guide');
          }}
        />
      )}
    </div>
  );
}
