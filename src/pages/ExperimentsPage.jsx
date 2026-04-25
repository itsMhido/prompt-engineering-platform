import React, { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { cn } from '../utils/helpers';
import { loadExperiments, deleteExperiment, updateExperimentScore, updateExperimentNotes } from '../utils/mockApi';

export default
function ExperimentsView() {
  const timeAgoShort = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
  };
  const [experiments, setExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterVersion, setFilterVersion] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedExperimentId, setSelectedExperimentId] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [detailedExperiment, setDetailedExperiment] = useState(null);
  const [scoreInput, setScoreInput] = useState(null);
  const [notesInput, setNotesInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    loadExperiments().then(data => {
      setExperiments(data);
      setIsLoading(false);
    });
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (detailedExperiment) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [detailedExperiment]);

  // ESC key closes drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && detailedExperiment) {
        setDetailedExperiment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailedExperiment]);

  const isFiltered = searchText || filterModel || filterVersion || filterStatus !== '' || filterDateRange !== 'all';

  const getDateRangeFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week7DaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month30DaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return exp => {
      if (filterDateRange === 'today') return new Date(exp.timestamp) >= today;
      if (filterDateRange === 'week') return new Date(exp.timestamp) >= week7DaysAgo;
      if (filterDateRange === 'month') return new Date(exp.timestamp) >= month30DaysAgo;
      return true;
    };
  };

  const filteredExperiments = experiments
    .filter(getDateRangeFilter())
    .filter(exp => !filterStatus || exp.status === filterStatus)
    .filter(exp => !filterModel || exp.provider === filterModel)
    .filter(exp => !filterVersion || exp.promptVersion === filterVersion)
    .filter(exp => {
      if (!searchText) return true;
      const lowerText = searchText.toLowerCase();
      return (
        exp.promptName?.toLowerCase().includes(lowerText) ||
        exp.output?.toLowerCase().includes(lowerText) ||
        JSON.stringify(exp.variableValues)?.toLowerCase().includes(lowerText)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const uniqueModels = Array.from(new Set(experiments.map(e => e.provider)));
  const uniqueVersions = Array.from(new Set(experiments.map(e => e.promptVersion)));

  const stats = {
    totalRuns: filteredExperiments.length,
    avgLatency: filteredExperiments.filter(e => e.status === 'success').length > 0
      ? Math.round(filteredExperiments.filter(e => e.status === 'success').reduce((sum, e) => sum + (e.latencyMs || 0), 0) / filteredExperiments.filter(e => e.status === 'success').length)
      : 0,
    avgScore: filteredExperiments.filter(e => e.score !== null).length > 0
      ? Math.round(filteredExperiments.filter(e => e.score !== null).reduce((sum, e) => sum + e.score, 0) / filteredExperiments.filter(e => e.score !== null).length)
      : null,
    totalCost: filteredExperiments.reduce((sum, e) => {
      const cost = parseFloat(e.costEstimate?.replace(/[^0-9.]/g, '') || 0);
      return sum + cost;
    }, 0).toFixed(4)
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleRowSelect = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
    if (newSelected.size === 2) {
      setCompareIds(Array.from(newSelected));
      setCompareMode(true);
    } else if (newSelected.size !== 2) {
      setCompareMode(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredExperiments.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredExperiments.map(e => e.id)));
    }
  };

  const handleDeleteExperiment = async (id) => {
    await deleteExperiment(id);
    setExperiments(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateScore = async (id, score) => {
    await updateExperimentScore(id, score);
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, score } : e));
  };

  const handleUpdateNotes = async (id, notes) => {
    await updateExperimentNotes(id, notes);
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, notes } : e));
  };

  const getLatencyColor = (ms) => {
    if (ms < 500) return 'text-green-500/80';
    if (ms < 1500) return 'text-yellow-500/80';
    return 'text-red-500/80';
  };

  const handleDeleteSelected = () => {
    selectedRows.forEach(id => deleteExperiment(id));
    setExperiments(prev => prev.filter(e => !selectedRows.has(e.id)));
    setSelectedRows(new Set());
  };

  const handleExportSelected = () => {
    const toExport = filteredExperiments.filter(e => selectedRows.has(e.id));
    const json = JSON.stringify(toExport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiments-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) return null;
    return <span className="text-primary text-xs ml-1">{sortDir === 'asc' ? 'â†‘' : 'â†“'}</span>;
  };

  if (isLoading) return <div className="p-8 text-text-muted">Loading experiments...</div>;

  const renderDetailDrawer = () => {
    if (!detailedExperiment) return null;
    const exp = detailedExperiment;

    return (
      <>
        {/* Backdrop â€” sibling of drawer, NEVER a parent wrapper */}
        <div
          className="fixed inset-0 bg-black/40"
          style={{ zIndex: 40 }}
          onClick={() => setDetailedExperiment(null)}
        />
        {/* Drawer â€” sits on top with its own fixed position */}
        <div
          className="fixed top-0 right-0 h-screen w-full max-w-2xl bg-panel border-l border-border flex flex-col animate-in slide-in-from-right duration-300"
          style={{ zIndex: 50, overflowY: 'auto', overflowX: 'hidden' }}
        >
          <div className="p-6 border-b border-border flex justify-between items-start sticky top-0 bg-panel z-10">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">{exp.promptVersion}</span>
              <span className="text-sm font-medium text-text-muted">{exp.model} Â· {exp.provider}</span>
            </div>
            <button onClick={() => setDetailedExperiment(null)} className="text-text-muted hover:text-text-main text-lg leading-none">âœ•</button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">System Prompt</h3>
              <div className="bg-background p-4 rounded border border-border text-text-main text-sm font-mono whitespace-pre-wrap break-words">{exp.systemPrompt}</div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">User Template</h3>
              <div className="bg-background p-4 rounded border border-border text-text-main text-sm font-mono whitespace-pre-wrap break-words">{exp.userTemplate}</div>
            </div>

            {exp.variableValues && Object.keys(exp.variableValues).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Variable Values</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(exp.variableValues).map(([key, val]) => (
                    <span key={key} className="px-3 py-1 rounded bg-primary/10 border border-primary/30 text-sm text-primary font-mono">{key} = {val}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-2">Latency</p>
                <p className={`text-lg font-mono font-bold ${getLatencyColor(exp.latencyMs)}`}>{exp.latencyMs}ms</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-2">Tokens</p>
                <p className="text-lg font-mono font-bold text-primary">{exp.totalTokens}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-2">Cost</p>
                <p className="text-lg font-mono font-bold text-green-500/80">{exp.costEstimate}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-2">Status</p>
                <span className={`text-sm font-bold px-2 py-1 rounded ${exp.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{exp.status}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Score</h3>
              <div className="flex items-center gap-4">
                <input type="range" min="0" max="100" step="1" value={exp.score || 0} onChange={(e) => handleUpdateScore(exp.id, parseInt(e.target.value))} className="flex-1" />
                <span className="font-mono font-bold text-lg text-primary">{exp.score ?? 'â€”'}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Notes</h3>
              <textarea value={exp.notes || ''} onChange={(e) => setNotesInput(e.target.value)} onBlur={() => handleUpdateNotes(exp.id, notesInput)} className="w-full bg-background border border-border rounded p-3 text-text-main focus:outline-none focus:border-primary/50 resize-none" rows="4" placeholder="Add notes..." />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Output</h3>
              {exp.status === 'error' ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                  <p className="text-red-300 text-sm font-mono">{exp.errorMessage}</p>
                </div>
              ) : (
                <div className="bg-background p-4 rounded border border-border text-text-main text-sm font-mono whitespace-pre-wrap break-words">{exp.output}</div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300 gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-1">Experiments</h2>
        <p className="text-text-muted">Track and compare prompt performance over time.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Total Runs</p>
          <p className="text-2xl font-bold text-primary">{stats.totalRuns}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Avg Latency</p>
          <p className="text-2xl font-bold text-yellow-500/80">{stats.avgLatency}ms</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Avg Score</p>
          <p className="text-2xl font-bold text-primary">{stats.avgScore ?? 'â€”'}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Total Cost</p>
          <p className="text-2xl font-bold text-green-500/80">${stats.totalCost}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-5 gap-3">
          <input type="text" placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main" />
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main">
            <option value="">All Models</option>
            {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main">
            <option value="">All Versions</option>
            {uniqueVersions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)} className="bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
        {isFiltered && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Showing {filteredExperiments.length} of {experiments.length} experiments</span>
            <button onClick={() => { setSearchText(''); setFilterModel(''); setFilterVersion(''); setFilterStatus(''); setFilterDateRange('all'); }} className="text-primary hover:underline text-xs">Clear filters</button>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 flex items-center justify-between">
          <span className="text-primary font-medium">{selectedRows.size} selected</span>
          <div className="flex gap-3">
            <button onClick={handleExportSelected} className="text-primary hover:underline text-sm">Export JSON</button>
            <button onClick={handleDeleteSelected} className="text-red-400 hover:underline text-sm">Delete</button>
            <button onClick={() => setSelectedRows(new Set())} className="text-text-muted hover:underline text-sm">Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredExperiments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <FlaskConical size={48} className="text-text-muted/50 mb-4" />
          <p className="text-text-muted mb-4">No experiments yet â€” run a prompt in Prompt Studio to start tracking</p>
          <button className="text-primary hover:underline">Go to Prompt Studio</button>
        </div>
      ) : (
        <div className="flex-1 bg-panel border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-background/50 sticky top-0">
                  <th className="px-4 py-3"><input type="checkbox" checked={selectedRows.size === filteredExperiments.length} onChange={handleSelectAll} /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('promptVersion')}>Version <SortIndicator field="promptVersion" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('promptName')}>Prompt <SortIndicator field="promptName" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('provider')}>Model <SortIndicator field="provider" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('latencyMs')}>Latency <SortIndicator field="latencyMs" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('totalTokens')}>Tokens <SortIndicator field="totalTokens" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('costEstimate')}>Cost <SortIndicator field="costEstimate" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('score')}>Score <SortIndicator field="score" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-main" onClick={() => handleSort('timestamp')}>Timestamp <SortIndicator field="timestamp" /></th>
                  <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExperiments.map(exp => (
                  <tr
                    key={exp.id}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => setDetailedExperiment(exp)}
                  >
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRows.has(exp.id)}
                        onChange={() => handleRowSelect(exp.id)}
                      />
                    </td>
                    <td className="px-4 py-4"><span className="font-mono text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">{exp.promptVersion}</span></td>
                    <td className="px-4 py-4 text-sm truncate">{exp.promptName}</td>
                    <td className="px-4 py-4 text-sm">{exp.provider}</td>
                    <td className={`px-4 py-4 font-mono text-xs ${getLatencyColor(exp.latencyMs)}`}>{exp.latencyMs}ms</td>
                    <td className="px-4 py-4 font-mono text-xs text-primary">{exp.totalTokens}</td>
                    <td className="px-4 py-4 font-mono text-xs text-green-500/80">{exp.costEstimate}</td>
                    <td className="px-4 py-4">
                      {exp.score !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-background rounded-full overflow-hidden border border-border"><div className="h-full bg-primary" style={{ width: `${exp.score}%` }} /></div>
                          <span className="font-mono text-xs">{exp.score}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-text-muted">{timeAgoShort(exp.timestamp)}</td>
                    <td className="px-4 py-4">
                      <div
                        className="flex items-center gap-2 opacity-0 group-hover:opacity-100"
                        style={{ transition: 'opacity 150ms' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const json = JSON.stringify(exp, null, 2);
                            const blob = new Blob([json], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `experiment-${exp.id}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          style={{
                            minHeight: '32px',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            fontSize: '12px',
                            border: '1px solid #2a2a35',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Export JSON
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExperiment(exp.id);
                          }}
                          style={{
                            minHeight: '32px',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            fontSize: '12px',
                            border: '1px solid rgba(239,68,68,0.35)',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: 'rgb(248,113,113)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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

      {renderDetailDrawer()}
    </div>
  );
}

