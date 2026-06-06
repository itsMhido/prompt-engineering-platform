import { useEffect, useMemo, useState, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import { bulkDeleteExperiments, listExperiments, removeExperiment, updateExperiment, scoreEvaluation, listModels } from '../utils/api';

export default function ExperimentsView() {
  const [experiments, setExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterVersion, setFilterVersion] = useState('');
  const [filterPrompt, setFilterPrompt] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [detailedExperiment, setDetailedExperiment] = useState(null);
  const [notesInput, setNotesInput] = useState('');
  const [error, setError] = useState('');
  const mouseDownTarget = useRef(null);

  const [isRescoring, setIsRescoring] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [scorerModelId, setScorerModelId] = useState('');
  const [models, setModels] = useState([]);

  useEffect(() => {
    listModels().then(result => {
      const active = result.filter(m => m.status === 'active');
      setModels(active);
      if (active.length > 0) setScorerModelId(active[0].id);
    }).catch(console.error);
  }, []);

  const handleRescore = async (experimentId, metric = null) => {
    if (!scorerModelId || isRescoring) return;
    setIsRescoring(true);

    try {
      const result = await scoreEvaluation({
        experimentId,
        metrics: metric ? [metric] : ['Relevance', 'Correctness', 'Fluency', 'Toxicity'],
        scorerModelId
      });

      setExperiments((prev) => prev.map((e) => e.id === experimentId ? result.updatedExperiment : e));

      if (detailedExperiment?.id === experimentId) {
        setDetailedExperiment(result.updatedExperiment);
      }
    } catch (err) {
      console.error('Rescore failed:', err);
    } finally {
      setIsRescoring(false);
    }
  };

  const getScoreColor = (score) => {
    if (score == null) return 'var(--muted)';
    if (score >= 80) return '#88d273';
    if (score >= 50) return '#e8a847';
    return '#ff6b6b';
  };

  const renderScore = (score) => {
    if (score === null || score === undefined) return '--';
    if (score < 0) return '--';   // legacy -1 values
    return score;
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await listExperiments();
        setExperiments(data);
      } catch (err) {
        setError(err.message || 'Failed to load experiments.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    document.body.style.overflow = detailedExperiment ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [detailedExperiment]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && detailedExperiment) {
        setDetailedExperiment(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailedExperiment]);

  const isFiltered = searchText || filterModel || filterVersion || filterPrompt || filterStatus !== '' || filterDateRange !== 'all';

  const filteredExperiments = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    return experiments
      .filter((experiment) => {
        if (filterDateRange === 'today') {
          return new Date(experiment.timestamp) >= startOfToday;
        }
        if (filterDateRange === 'week') {
          return new Date(experiment.timestamp) >= sevenDaysAgo;
        }
        if (filterDateRange === 'month') {
          return new Date(experiment.timestamp) >= thirtyDaysAgo;
        }
        return true;
      })
      .filter((experiment) => !filterStatus || experiment.status === filterStatus)
      .filter((experiment) => !filterModel || experiment.provider === filterModel)
      .filter((experiment) => !filterPrompt || experiment.promptName === filterPrompt)
      .filter((experiment) => !filterVersion || experiment.promptVersion === filterVersion)
      .filter((experiment) => {
        if (!searchText) {
          return true;
        }

        const lowerText = searchText.toLowerCase();
        return (
          experiment.promptName?.toLowerCase().includes(lowerText)
          || experiment.output?.toLowerCase().includes(lowerText)
          || JSON.stringify(experiment.variableValues || {}).toLowerCase().includes(lowerText)
        );
      })
      .sort((left, right) => {
        let leftValue = left[sortField];
        let rightValue = right[sortField];

        if (sortField === 'timestamp') {
          leftValue = new Date(leftValue).getTime();
          rightValue = new Date(rightValue).getTime();
        } else if (typeof leftValue === 'string') {
          leftValue = leftValue.toLowerCase();
          rightValue = rightValue.toLowerCase();
        }

        if (leftValue < rightValue) {
          return sortDir === 'asc' ? -1 : 1;
        }
        if (leftValue > rightValue) {
          return sortDir === 'asc' ? 1 : -1;
        }
        return 0;
      });
  }, [experiments, filterDateRange, filterStatus, filterModel, filterPrompt, filterVersion, searchText, sortField, sortDir]);

  const uniqueModels = Array.from(new Set(experiments.map((experiment) => experiment.provider).filter(Boolean)));
  const uniqueVersions = Array.from(new Set(experiments.map((experiment) => experiment.promptVersion).filter(Boolean)));
  const uniquePrompts = Array.from(new Set(experiments.map((experiment) => experiment.promptName).filter(Boolean)));

  const stats = useMemo(() => {
    const successfulExperiments = filteredExperiments.filter((experiment) => experiment.status === 'success');
    const scoredExperiments = filteredExperiments.filter((experiment) => experiment.score !== null && experiment.score !== undefined);

    return {
      totalRuns: filteredExperiments.length,
      avgLatency: successfulExperiments.length > 0
        ? Math.round(successfulExperiments.reduce((sum, experiment) => sum + (experiment.latencyMs || 0), 0) / successfulExperiments.length)
        : 0,
      avgScore: scoredExperiments.length > 0
        ? Math.round(scoredExperiments.reduce((sum, experiment) => sum + experiment.score, 0) / scoredExperiments.length)
        : null,
      totalCost: filteredExperiments.reduce((sum, experiment) => sum + Number(experiment.costEstimate || 0), 0).toFixed(4)
    };
  }, [filteredExperiments]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortField(field);
    setSortDir(field === 'timestamp' ? 'desc' : 'asc');
  };

  const handleRowSelect = (id) => {
    const next = new Set(selectedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRows(next);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredExperiments.length) {
      setSelectedRows(new Set());
      return;
    }

    setSelectedRows(new Set(filteredExperiments.map((experiment) => experiment.id)));
  };

  const handleDeleteExperiment = async (id) => {
    try {
      await removeExperiment(id);
      setExperiments((prev) => prev.filter((experiment) => experiment.id !== id));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to delete experiment.');
    }
  };

  const handleUpdateScore = async (id, score) => {
    try {
      const updated = await updateExperiment(id, { score });
      setExperiments((prev) => prev.map((experiment) => experiment.id === id ? updated : experiment));
      if (detailedExperiment?.id === id) {
        setDetailedExperiment(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update score.');
    }
  };

  const handleUpdateNotes = async (id, notes) => {
    try {
      const updated = await updateExperiment(id, { notes });
      setExperiments((prev) => prev.map((experiment) => experiment.id === id ? updated : experiment));
      if (detailedExperiment?.id === id) {
        setDetailedExperiment(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update notes.');
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await bulkDeleteExperiments(Array.from(selectedRows));
      setExperiments((prev) => prev.filter((experiment) => !selectedRows.has(experiment.id)));
      setSelectedRows(new Set());
    } catch (err) {
      setError(err.message || 'Failed to delete selected experiments.');
    }
  };

  const handleExportSelected = () => {
    const toExport = filteredExperiments.filter((experiment) => selectedRows.has(experiment.id));
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `experiments-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getLatencyColor = (ms = 0) => {
    if (ms < 500) return 'text-green-500/80';
    if (ms < 1500) return 'text-yellow-500/80';
    return 'text-red-500/80';
  };

  const timeAgoShort = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y ago`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo ago`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}d ago`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m ago`;
    return 'just now';
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) {
      return null;
    }
    return <span className="ml-1 text-xs text-primary">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (isLoading) {
    return <div className="p-8 text-text-muted">Loading experiments...</div>;
  }

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Experiments</h2>
        <p className="text-text-muted">Track and compare prompt performance over time.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Total Runs</p>
          <p className="text-2xl font-bold text-primary">{stats.totalRuns}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Avg Latency</p>
          <p className="text-2xl font-bold text-yellow-500/80">{stats.avgLatency}ms</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Avg Score</p>
          <p className="text-2xl font-bold text-primary">{stats.avgScore ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Total Cost</p>
          <p className="text-2xl font-bold text-green-500/80">${stats.totalCost}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-panel p-4">
        <div className="grid grid-cols-6 gap-3">
          <input type="text" placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none" />
          <select value={filterPrompt} onChange={(e) => setFilterPrompt(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            <option value="">All Prompts</option>
            {uniquePrompts.map((prompt) => <option key={prompt} value={prompt}>{prompt}</option>)}
          </select>
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            <option value="">All Models</option>
            {uniqueModels.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
          <select value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            <option value="">All Versions</option>
            {uniqueVersions.map((version) => <option key={version} value={version}>{version}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
        {isFiltered && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Showing {filteredExperiments.length} of {experiments.length} experiments</span>
            <button onClick={() => { setSearchText(''); setFilterPrompt(''); setFilterModel(''); setFilterVersion(''); setFilterStatus(''); setFilterDateRange('all'); }} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-4">
          <span className="font-medium text-primary">{selectedRows.size} selected</span>
          <div className="flex gap-3">
            <button onClick={handleExportSelected} className="text-sm text-primary hover:underline">Export JSON</button>
            <button onClick={handleDeleteSelected} className="text-sm text-red-400 hover:underline">Delete</button>
            <button onClick={() => setSelectedRows(new Set())} className="text-sm text-text-muted hover:underline">Clear</button>
          </div>
        </div>
      )}

      {filteredExperiments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <FlaskConical size={48} className="mb-4 text-text-muted/50" />
          <p className="mb-4 text-text-muted">No experiments yet — run a prompt in Prompt Studio to start tracking</p>
          <button className="text-primary hover:underline">Go to Prompt Studio</button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-background/50">
                  <th className="px-4 py-3"><input type="checkbox" checked={selectedRows.size === filteredExperiments.length} onChange={handleSelectAll} /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('promptVersion')}>Version <SortIndicator field="promptVersion" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('promptName')}>Prompt <SortIndicator field="promptName" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('provider')}>Model <SortIndicator field="provider" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('latencyMs')}>Latency <SortIndicator field="latencyMs" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('totalTokens')}>Tokens <SortIndicator field="totalTokens" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('costEstimate')}>Cost <SortIndicator field="costEstimate" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('score')}>Score <SortIndicator field="score" /></th>
                  <th className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-main" onClick={() => handleSort('timestamp')}>Timestamp <SortIndicator field="timestamp" /></th>
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExperiments.map((experiment) => (
                  <tr key={experiment.id} className="group cursor-pointer transition-colors hover:bg-white/[0.02]" onClick={() => { setDetailedExperiment(experiment); setNotesInput(experiment.notes || ''); }}>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(experiment.id)} onChange={() => handleRowSelect(experiment.id)} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-border bg-white/5 px-2 py-0.5 text-xs text-text-main">{experiment.promptName || 'Unknown Prompt'}</span>
                        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{experiment.promptVersion}</span>
                      </div>
                    </td>
                    <td className="truncate px-4 py-4 text-sm">{experiment.promptName}</td>
                    <td className="px-4 py-4 text-sm">{experiment.provider}</td>
                    <td className={`px-4 py-4 font-mono text-xs ${getLatencyColor(experiment.latencyMs)}`}>{experiment.latencyMs}ms</td>
                    <td className="px-4 py-4 font-mono text-xs text-primary">{experiment.totalTokens}</td>
                    <td className="px-4 py-4 font-mono text-xs text-green-500/80">{experiment.costEstimate}</td>
                    <td className="px-4 py-4">
                      {experiment.score !== null && experiment.score !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full border border-border bg-background"><div className="h-full bg-primary" style={{ width: `${experiment.score}%` }} /></div>
                          <span className="font-mono text-xs">{experiment.score}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-text-muted">{timeAgoShort(experiment.timestamp)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const blob = new Blob([JSON.stringify(experiment, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const anchor = document.createElement('a');
                            anchor.href = url;
                            anchor.download = `experiment-${experiment.id}.json`;
                            anchor.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="min-h-[32px] whitespace-nowrap rounded border border-[#2a2a35] bg-transparent px-3 text-xs text-slate-400"
                        >
                          Export JSON
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExperiment(experiment.id);
                          }}
                          className="min-h-[32px] whitespace-nowrap rounded border border-red-500/35 bg-transparent px-3 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailedExperiment && (
        <>
          <div 
            className="fixed inset-0 bg-black/40" 
            style={{ zIndex: 40 }} 
            onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
            onMouseUp={(e) => {
              if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
                setDetailedExperiment(null);
              }
              mouseDownTarget.current = null;
            }}
          />
          <div 
            className="fixed right-0 top-0 flex h-screen w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-panel animate-in slide-in-from-right duration-300" 
            style={{ zIndex: 50 }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid #252320',
              position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel)',
              width: '100%', boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{detailedExperiment.promptVersion}</span>
                <span className="rounded border border-border bg-white/5 px-2 py-0.5 text-xs text-text-main">{detailedExperiment.promptName || 'Unknown Prompt'}</span>
                <span className="text-sm text-text-muted">{detailedExperiment.model || detailedExperiment.modelName} · {detailedExperiment.provider}</span>
              </div>
              <button onClick={() => setDetailedExperiment(null)} className="text-lg leading-none text-text-muted hover:text-text-main" style={{ paddingLeft: 12 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
              {detailedExperiment.variableValues && Object.keys(detailedExperiment.variableValues).length > 0 && (
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #252320', width: '100%', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
                    Variable Values
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(detailedExperiment.variableValues).map(([key, value]) => (
                      <span key={key} className="rounded border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-mono text-primary">
                        {key} = {String(value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ padding: '20px 24px', borderBottom: '1px solid #252320', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Output
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(detailedExperiment.output || '')}
                    title="Copy output"
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
                {detailedExperiment.status === 'error' ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, padding: '14px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#fca5a5' }}>
                    {detailedExperiment.errorMessage}
                  </div>
                ) : (
                  <div style={{
                    background: '#0f0f0d',
                    border: '1px solid #252320',
                    borderRadius: 6,
                    padding: '14px 16px',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: '#f0ece4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflowY: 'auto'
                  }}>
                    {detailedExperiment.output || 'No output'}
                  </div>
                )}
              </div>

              <div style={{ padding: '20px 24px', borderBottom: '1px solid #252320', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Latency', value: `${detailedExperiment.latencyMs || 0}ms`, color: detailedExperiment.latencyMs > 3000 ? '#e8a847' : '#6b6860' },
                    { label: 'Tokens', value: detailedExperiment.totalTokens || 0, color: '#6b6860' },
                    { label: 'Cost', value: detailedExperiment.costEstimate > 0 ? `$${detailedExperiment.costEstimate}` : 'Free', color: '#6b6860' },
                    { label: 'Status', value: detailedExperiment.status, color: detailedExperiment.status === 'success' ? '#88d273' : '#ff6b6b' }
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      padding: '6px 12px', background: '#0f0f0d', border: '1px solid #252320',
                      borderRadius: 20, display: 'flex', gap: 6, alignItems: 'center'
                    }}>
                      <span style={{ fontSize: 11, color: '#6b6860' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '20px 24px', borderBottom: '1px solid #252320', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    SCORES
                  </span>
                </div>

                <div style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                  marginBottom: 20, padding: '10px 12px',
                  background: '#0f0f0d', border: '1px solid #252320',
                  borderRadius: 6
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    Scorer model:
                  </span>
                  <select
                    value={scorerModelId}
                    onChange={e => setScorerModelId(e.target.value)}
                    style={{
                      flex: 1, fontSize: 12, background: '#161613',
                      border: '1px solid #252320', borderRadius: 4,
                      color: '#f0ece4', padding: '4px 8px'
                    }}
                  >
                    <option value="">Select a model...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.provider}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRescore(detailedExperiment.id, null)}
                    disabled={!scorerModelId || isRescoring}
                    style={{
                      padding: '4px 12px', fontSize: 12,
                      border: '1px solid #88d273', borderRadius: 4,
                      background: 'transparent', color: '#88d273',
                      cursor: scorerModelId && !isRescoring ? 'pointer' : 'not-allowed',
                      opacity: scorerModelId && !isRescoring ? 1 : 0.4,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isRescoring ? 'Scoring...' : '⚡ Score'}
                  </button>
                </div>

                {detailedExperiment?.expectedOutputUsed && (
                  <div style={{
                    fontSize: 11, color: '#88d273',
                    marginBottom: 12, display: 'flex',
                    alignItems: 'center', gap: 4
                  }}>
                    <span>✓</span>
                    <span>Scored against expected output from dataset</span>
                  </div>
                )}
                {!detailedExperiment?.expectedOutputUsed && detailedExperiment?.datasetId && (
                  <div style={{
                    fontSize: 11, color: 'var(--muted)',
                    marginBottom: 12
                  }}>
                    ⚠ No expected output column found in dataset — Correctness scored without reference
                  </div>
                )}

                {detailedExperiment.score != null && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)' }}>
                        OVERALL SCORE
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: getScoreColor(detailedExperiment.score) }}>
                        {Math.round(detailedExperiment.score)}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#252320', borderRadius: 4 }}>
                      <div style={{
                        height: '100%', width: `${detailedExperiment.score}%`,
                        background: getScoreColor(detailedExperiment.score),
                        borderRadius: 4, transition: 'width 400ms ease'
                      }} />
                    </div>
                  </div>
                )}

                {detailedExperiment.scores && Object.keys(detailedExperiment.scores).length > 0
                  ? Object.entries(detailedExperiment.scores).map(([metric, score]) => (
                    <div key={metric} style={{ marginBottom: 20 }}
                      onMouseEnter={() => setHoveredMetric(metric)}
                      onMouseLeave={() => setHoveredMetric(null)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{metric}</span>
                          {hoveredMetric === metric && scorerModelId && (
                            <button
                              onClick={() => handleRescore(detailedExperiment.id, metric)}
                              disabled={isRescoring}
                              style={{
                                fontSize: 10, padding: '1px 6px',
                                border: '1px solid #252320', borderRadius: 3,
                                background: 'transparent', color: 'var(--muted)',
                                cursor: 'pointer', lineHeight: 1.6
                              }}
                            >
                              ↺
                            </button>
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: getScoreColor(score) }}>
                          {renderScore(score)}
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#252320', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${Math.max(0, score ?? 0)}%`,
                          background: getScoreColor(score), borderRadius: 2,
                          transition: 'width 400ms ease'
                        }} />
                      </div>
                      {detailedExperiment.reasoning?.[metric] && (
                        <div style={{
                          marginTop: 8, padding: '8px 12px', background: '#0f0f0d',
                          borderLeft: '2px solid #252320', borderRadius: '0 4px 4px 0',
                          fontSize: 12, color: '#6b6860', lineHeight: 1.6, fontStyle: 'normal'
                        }}>
                          {detailedExperiment.reasoning[metric]}
                        </div>
                      )}
                    </div>
                  ))
                  : (
                    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      Select a scorer model above and click ⚡ Score to evaluate this experiment.
                    </div>
                  )
                }
              </div>

              <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em',
                    color: 'var(--muted)', textTransform: 'uppercase'
                  }}>
                    Notes
                  </span>
                </div>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  onBlur={() => handleUpdateNotes(detailedExperiment.id, notesInput)}
                  placeholder="Add notes..."
                  style={{
                    width: '100%', minHeight: 80, background: '#0f0f0d',
                    border: '1px solid #252320', borderRadius: 6, padding: '10px 12px',
                    color: '#f0ece4', fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                    fontFamily: 'IBM Plex Sans, sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h3>
      {children}
    </div>
  );
}

function Panel({ children }) {
  return (
    <div className="rounded border border-border bg-background p-4 font-mono text-sm text-text-main whitespace-pre-wrap break-words">
      {children}
    </div>
  );
}

function Metric({ label, value, className }) {
  return (
    <div>
      <p className="mb-2 text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold ${className}`}>{value}</p>
    </div>
  );
}
