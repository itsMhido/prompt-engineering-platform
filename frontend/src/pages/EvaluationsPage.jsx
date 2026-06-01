import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import {
  CheckCircle2, FlaskConical, AlertCircle, TrendingUp, Zap,
  Coins, ChevronRight, BarChart2, Table, ChevronDown,
  ChevronUp, MessageSquare, Play, X, Info, Settings
} from 'lucide-react';
import { cn, timeAgo } from '../utils/helpers';
import {
  getDataset,
  listBatches,
  listDatasets,
  listExperiments,
  listModels,
  listPrompts,
  listPromptVersions,
  runBatchEvaluation,
  runPrompt,
  scoreEvaluation,
  updateExperiment,
  renameBatch
} from '../utils/api';

const METRICS = ['Relevance', 'Correctness', 'Toxicity', 'Fluency'];

function buildGroupedScores(experiments, key) {
  const groups = {};
  experiments.forEach((experiment) => {
    const value = experiment[key] || 'Unknown';
    if (!groups[value]) {
      groups[value] = {
        name: value,
        runs: 0,
        prompt: experiment.promptName || 'Unknown Prompt',
        Relevance: 0,
        Correctness: 0,
        Toxicity: 0,
        Overall: 0,
        counts: { Relevance: 0, Correctness: 0, Toxicity: 0 }
      };
    }

    groups[value].runs += 1;
    let rowTotal = 0;
    let count = 0;
    METRICS.forEach((metric) => {
      if (experiment.scores[metric] !== undefined) {
        groups[value][metric] += experiment.scores[metric];
        groups[value].counts[metric] += 1;
        rowTotal += experiment.scores[metric];
        count += 1;
      }
    });
    if (count > 0) {
      groups[value].Overall += rowTotal / count;
    }
  });

  return Object.values(groups).map((group) => ({
    ...group,
    Relevance: group.counts.Relevance > 0 ? (group.Relevance / group.counts.Relevance).toFixed(1) : '0.0',
    Correctness: group.counts.Correctness > 0 ? (group.Correctness / group.counts.Correctness).toFixed(1) : '0.0',
    Toxicity: group.counts.Toxicity > 0 ? (group.Toxicity / group.counts.Toxicity).toFixed(1) : '0.0',
    Overall: group.runs > 0 && group.Overall != null ? (group.Overall / group.runs).toFixed(1) : '0.0'
  })).sort((left, right) => parseFloat(right.Overall) - parseFloat(left.Overall));
}

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [experiments, setExperiments] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [datasetDetails, setDatasetDetails] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [loadedExperiments, loadedDatasets, loadedModels, loadedPrompts] = await Promise.all([
          listExperiments(),
          listDatasets(),
          listModels(),
          listPrompts()
        ]);

        setExperiments(loadedExperiments);
        setDatasets(loadedDatasets);
        setModels(loadedModels);
        setPrompts(loadedPrompts);
      } catch (err) {
        setError(err.message || 'Failed to load evaluations data.');
      }
    })();
  }, []);

  const fetchDatasetDetail = async (datasetId) => {
    if (!datasetId) {
      return null;
    }

    if (datasetDetails[datasetId]) {
      return datasetDetails[datasetId];
    }

    const detail = await getDataset(datasetId);
    setDatasetDetails((prev) => ({ ...prev, [datasetId]: detail }));
    return detail;
  };

  const handleUpdateExperiment = async (updatedExp) => {
    try {
      const saved = await updateExperiment(updatedExp.id, {
        score: updatedExp.score,
        notes: updatedExp.notes,
        tags: updatedExp.tags,
        scores: updatedExp.scores,
        reasoning: updatedExp.reasoning
      });
      setExperiments((prev) => prev.map((experiment) => experiment.id === saved.id ? saved : experiment));
    } catch (err) {
      setError(err.message || 'Failed to update evaluation.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 bg-background px-8 pt-8">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold tracking-tight text-text-main">Evaluations</h2>
            <p className="text-text-muted">Compare outputs and metrics side-by-side.</p>
          </div>
          <div className="flex rounded-lg border border-border bg-panel p-1">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<TrendingUp size={16} />}>Overview</TabButton>
            <TabButton active={activeTab === 'comparison'} onClick={() => setActiveTab('comparison')} icon={<BarChart2 size={16} />}>Comparison</TabButton>
            <TabButton active={activeTab === 'batch' || activeTab === 'run-new-batch'} onClick={() => setActiveTab('batch')} icon={<Table size={16} />}>Batch Eval</TabButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-8 mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' ? (
          <OverviewView experiments={experiments} prompts={prompts} setActiveTab={setActiveTab} />
        ) : activeTab === 'comparison' ? (
          <ComparisonView experiments={experiments} datasets={datasets} onUpdateExperiment={handleUpdateExperiment} setActiveTab={setActiveTab} />
        ) : (
          <BatchEvalView
            initialViewMode={activeTab === 'run-new-batch' ? 'new' : 'existing'}
            experiments={experiments}
            setExperiments={setExperiments}
            datasets={datasets}
            models={models}
            prompts={prompts}
            fetchDatasetDetail={fetchDatasetDetail}
            onExperimentsAdded={(newExperiments) => setExperiments((prev) => [...newExperiments, ...prev])}
            onUpdateExperiment={handleUpdateExperiment}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
        active ? 'bg-background text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
      )}
    >
      {icon} {children}
    </button>
  );
}

function OverviewView({ experiments, prompts, setActiveTab }) {
  const [selectedPromptId, setSelectedPromptId] = useState('all');

  const scoredExperiments = useMemo(() => experiments.filter((experiment) => experiment.scores && Object.keys(experiment.scores).length > 0), [experiments]);

  const stats = useMemo(() => {
    if (scoredExperiments.length === 0) {
      return null;
    }

    const averages = { Relevance: 0, Correctness: 0, Toxicity: 0, Overall: 0 };
    scoredExperiments.forEach((experiment) => {
      let rowTotal = 0;
      let count = 0;
      METRICS.forEach((metric) => {
        if (experiment.scores[metric] !== undefined) {
          averages[metric] = (averages[metric] || 0) + experiment.scores[metric];
          rowTotal += experiment.scores[metric];
          count += 1;
        }
      });
      if (count > 0) {
        averages.Overall += rowTotal / count;
      }
    });

    return {
      totalEvaluated: scoredExperiments.length,
      avgRelevance: averages.Relevance != null ? (averages.Relevance / (scoredExperiments.filter((experiment) => experiment.scores.Relevance !== undefined).length || 1)).toFixed(1) : '0.0',
      avgCorrectness: averages.Correctness != null ? (averages.Correctness / (scoredExperiments.filter((experiment) => experiment.scores.Correctness !== undefined).length || 1)).toFixed(1) : '0.0',
      avgToxicity: averages.Toxicity != null ? (averages.Toxicity / (scoredExperiments.filter((experiment) => experiment.scores.Toxicity !== undefined).length || 1)).toFixed(1) : '0.0',
      avgOverall: averages.Overall != null && scoredExperiments.length > 0 ? (averages.Overall / scoredExperiments.length).toFixed(1) : '0.0'
    };
  }, [scoredExperiments]);

  const modelComparison = useMemo(() => {
    const filtered = selectedPromptId === 'all' 
      ? scoredExperiments 
      : scoredExperiments.filter(e => e.promptId === selectedPromptId);
    return buildGroupedScores(filtered, 'modelName');
  }, [scoredExperiments, selectedPromptId]);

  const versionComparison = useMemo(() => {
    const filtered = selectedPromptId === 'all' 
      ? scoredExperiments 
      : scoredExperiments.filter(e => e.promptId === selectedPromptId);
    return buildGroupedScores(filtered, 'promptVersion');
  }, [scoredExperiments, selectedPromptId]);

  if (scoredExperiments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TrendingUp size={40} />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-text-main">No evaluated data yet</h2>
        <p className="mb-8 max-w-md text-center text-text-muted">
          Run your first batch from the "Run New Batch" tab to see results here.
        </p>
        <button onClick={() => setActiveTab('run-new-batch')} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-panel transition-all hover:bg-primary/90">
          Run New Batch <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  const findMax = (rows, key) => Math.max(...rows.map((row) => parseFloat(row[key])));

  const promptSelector = (
    <select
      value={selectedPromptId}
      onChange={e => setSelectedPromptId(e.target.value)}
      style={{
        fontSize: 12, background: '#161613',
        border: '1px solid #252320', borderRadius: 4,
        color: '#f0ece4', padding: '4px 10px'
      }}
    >
      <option value="all">All prompts</option>
      {prompts.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );

  return (
    <div className="h-full space-y-10 overflow-y-auto p-8 pb-20 animate-in fade-in duration-300">
      <div className="grid grid-cols-5 gap-6">
        <StatCard label="Scored Experiments" value={stats.totalEvaluated} icon={<FlaskConical size={18} />} />
        <StatCard label="Avg Relevance" value={`${stats.avgRelevance}%`} icon={<TrendingUp size={18} />} color="text-primary" />
        <StatCard label="Avg Correctness" value={`${stats.avgCorrectness}%`} icon={<CheckCircle2 size={18} />} color="text-primary" />
        <StatCard label="Avg Toxicity" value={`${stats.avgToxicity}%`} icon={<AlertCircle size={18} />} color="text-primary" />
        <StatCard label="Avg Overall" value={`${stats.avgOverall}%`} icon={<Zap size={18} />} color="text-primary" highlight />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <ComparisonTable title="Performance by Model" titleRight={promptSelector} rows={modelComparison} primaryColumn="name" secondaryColumn="prompt" highlightKey="Relevance" overallKey="Overall" findMax={findMax} />
        <ComparisonTable title="Performance by Version" titleRight={promptSelector} rows={versionComparison} primaryColumn="name" secondaryColumn="prompt" highlightKey="Correctness" overallKey="Overall" findMax={findMax} />
      </div>
    </div>
  );
}

function ComparisonTable({ title, titleRight, rows, primaryColumn, secondaryColumn, highlightKey, overallKey, findMax }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between ml-1">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">{title}</h3>
        {titleRight}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-panel/30">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">Name</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">Prompt</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">Runs</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">{highlightKey}</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">Overall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs text-text-main">{row[primaryColumn]}</td>
                <td className="px-4 py-3 text-xs text-text-muted">{row[secondaryColumn]}</td>
                <td className="px-4 py-3 text-center text-text-muted">{row.runs}</td>
                <td className={cn('px-4 py-3 text-center font-mono', parseFloat(row[highlightKey]) === findMax(rows, highlightKey) && 'bg-primary/5 text-primary')}>{row[highlightKey]}%</td>
                <td className={cn('px-4 py-3 text-center font-mono font-bold', parseFloat(row[overallKey]) === findMax(rows, overallKey) ? 'bg-primary/10 text-primary' : 'text-text-main')}>{row[overallKey]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-text-main', highlight = false }) {
  return (
    <div className={cn('glass-panel relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 transition-all hover:scale-[1.02]', highlight ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border')}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        <div className="text-text-muted opacity-30">{icon}</div>
      </div>
      <div className={cn('text-3xl font-black tracking-tight', color)}>{value}</div>
      {highlight && <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />}
    </div>
  );
}

const buildComparisonRows = (experimentsA, experimentsB) => {
  const maxRows = Math.max(experimentsA.length, experimentsB.length);
  return Array.from({ length: maxRows }, (_, i) => ({
    index: i,
    expA: experimentsA[i] || null,
    expB: experimentsB[i] || null
  }));
};

function ComparisonView({ setActiveTab }) {
  const [batchA, setBatchA] = useState(null);
  const [batchB, setBatchB] = useState(null);
  const [batches, setBatches] = useState([]);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [experimentsA, setExperimentsA] = useState([]);
  const [experimentsB, setExperimentsB] = useState([]);

  useEffect(() => {
    listBatches().then(setBatches).catch(console.error);
  }, []);

  useEffect(() => {
    if (!batchA || !batchB) return;
    Promise.all([
      listExperiments({ batchId: batchA.batchId }),
      listExperiments({ batchId: batchB.batchId })
    ]).then(([resA, resB]) => {
      setExperimentsA(resA);
      setExperimentsB(resB);
      setComparisonRows(buildComparisonRows(resA, resB));
    });
  }, [batchA, batchB]);

  const getScoreColor = (score) => {
    if (score == null) return 'var(--text-muted)';
    if (score > 70) return '#88d273';
    if (score > 40) return '#e8a847';
    return '#ff6b6b';
  };

  const formatRelativeTime = (isoString) => timeAgo(isoString);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8 animate-in fade-in duration-300">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <label style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            BATCH A
          </label>
          <select
            value={batchA?.batchId || ''}
            onChange={e => setBatchA(batches.find(b => b.batchId === e.target.value) || null)}
            style={{ wIdth: '100%', background: '#161613', border: '1px solid #252320', borderRadius: 6, padding: '8px 12px', color: '#f0ece4', fontSize: 13 }}
          >
            <option value="">Select a batch run...</option>
            {batches.map(b => (
              <option key={b.batchId} value={b.batchId} disabled={b.batchId === batchB?.batchId}>
                {b.batchName} · {b.successCount}/{b.rowCount} rows · {formatRelativeTime(b.createdAt)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', paddingTop: 20 }}>
          vs
        </div>

        <div>
          <label style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            BATCH B
          </label>
          <select
            value={batchB?.batchId || ''}
            onChange={e => setBatchB(batches.find(b => b.batchId === e.target.value) || null)}
            style={{ width: '100%', background: '#161613', border: '1px solid #252320', borderRadius: 6, padding: '8px 12px', color: '#f0ece4', fontSize: 13 }}
          >
            <option value="">Select a batch run...</option>
            {batches.map(b => (
              <option key={b.batchId} value={b.batchId} disabled={b.batchId === batchA?.batchId}>
                {b.batchName} · {b.successCount}/{b.rowCount} rows · {formatRelativeTime(b.createdAt)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!batchA && !batchB && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚖</div>
          <div style={{ fontSize: 15, marginBottom: 8, color: 'var(--text-main)' }}>Select two batch runs to compare</div>
          <div style={{ fontSize: 13 }}>
            Run batches with different models or prompt versions, then compare them here side by side.
          </div>
        </div>
      )}

      {batchA && batchB && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, flexShrink: 0 }}>
          {[batchA, batchB].map((batch, idx) => {
            const exps = idx === 0 ? experimentsA : experimentsB;
            const avgOverall = exps
              .filter(e => e.score != null)
              .reduce((sum, e) => sum + e.score, 0) /
              (exps.filter(e => e.score != null).length || 1);

            return (
              <div key={batch.batchId} style={{
                padding: 16, background: '#161613',
                border: '1px solid #252320', borderRadius: 8
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-main)' }}>{batch.batchName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {batch.successCount} successful · {batch.rowCount} total · {formatRelativeTime(batch.createdAt)}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AVG OVERALL</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: getScoreColor(avgOverall) }}>
                      {avgOverall > 0 ? `${Math.round(avgOverall)}%` : '--'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {comparisonRows.map(({ index, expA, expB }) => (
          <div key={index} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 16, marginBottom: 16,
            padding: 16, background: '#161613',
            border: '1px solid #252320', borderRadius: 8
          }}>
            <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'monospace' }}>
              ROW {index + 1}
              {expA?.variableValues && (
                <span style={{ marginLeft: 8 }}>
                  {Object.entries(expA.variableValues).map(([k, v]) => `${k}=${v}`).join(' · ')}
                </span>
              )}
            </div>

            {[expA, expB].map((exp, side) => (
              <div key={side}>
                {exp ? (
                  <>
                    <div style={{
                      background: '#0f0f0d', border: '1px solid #252320',
                      borderRadius: 6, padding: '10px 12px',
                      fontSize: 12, lineHeight: 1.6, marginBottom: 10,
                      maxHeight: 120, overflowY: 'auto',
                      fontFamily: 'IBM Plex Mono, monospace',
                      color: 'var(--text-main)'
                    }}>
                      {exp.output || 'No output'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {exp.scores && Object.entries(exp.scores).map(([metric, score]) => (
                        <div key={metric}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{metric} </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: getScoreColor(score) }}>
                            {score != null && score >= 0 ? score : '--'}
                          </span>
                        </div>
                      ))}
                      {exp.score != null && (
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Overall </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(exp.score) }}>
                            {Math.round(exp.score)}%
                          </span>
                        </div>
                      )}
                    </div>
                    {expA?.score != null && expB?.score != null && (
                      <div style={{ marginTop: 6, fontSize: 11 }}>
                        {side === 0 && expA.score > expB.score && (
                          <span style={{ color: '#88d273' }}>▲ Better by {Math.round(expA.score - expB.score)}%</span>
                        )}
                        {side === 1 && expB.score > expA.score && (
                          <span style={{ color: '#88d273' }}>▲ Better by {Math.round(expB.score - expA.score)}%</span>
                        )}
                        {expA.score === expB.score && (
                          <span style={{ color: 'var(--text-muted)' }}>= Tied</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 12 }}>
                    No matching row in this batch
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchEvalView({ initialViewMode = 'existing', experiments, setExperiments, datasets, models, prompts, fetchDatasetDetail, onExperimentsAdded, onUpdateExperiment }) {
  const [viewMode, setViewMode] = useState(initialViewMode);
  
  useEffect(() => {
    if (initialViewMode === 'new') setViewMode('new');
  }, [initialViewMode]);
  
  // Batch selector state
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchExperiments, setBatchExperiments] = useState([]);
  const [isBatchesLoading, setIsBatchesLoading] = useState(true);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  
  // Other state
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isAIScoringOpen, setIsAIScoringOpen] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(null);
  const [scoringStatus, setScoringStatus] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [newBatchDatasetId, setNewBatchDatasetId] = useState('');
  const [newBatchPromptId, setNewBatchPromptId] = useState('');
  const [newBatchVersionId, setNewBatchVersionId] = useState('');
  const [newBatchModelId, setNewBatchModelId] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [hoveredBatch, setHoveredBatch] = useState(null);
  const [renamingBatch, setRenamingBatch] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [varMappings, setVarMappings] = useState({});
  const [rowLimit, setRowLimit] = useState('all');
  const [batchResult, setBatchResult] = useState(null);
  const [promptVersions, setPromptVersions] = useState([]);

  const cancelRef = useRef(false);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => { cancelRef.current = cancelled; }, [cancelled]);

  const [batchProgress, setBatchProgress] = useState({
    isRunning: false,
    current: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    currentStatus: '',
    errors: []
  });

  // Load batches on mount
  useEffect(() => {
    listBatches()
      .then((result) => {
        setBatches(result);
        if (result.length > 0 && !selectedBatchId) {
          setSelectedBatchId(result[0].batchId);
        }
      })
      .catch(() => setBatches([]))
      .finally(() => setIsBatchesLoading(false));
  }, []);

  // Load experiments for selected batch
  useEffect(() => {
    if (!selectedBatchId) return;
    setIsBatchLoading(true);
    listExperiments({ batchId: selectedBatchId })
      .then((result) => setBatchExperiments(result))
      .catch(() => setBatchExperiments([]))
      .finally(() => setIsBatchLoading(false));
  }, [selectedBatchId]);

  useEffect(() => {
    if (!newBatchPromptId) {
      setPromptVersions([]);
      return;
    }

    listPromptVersions(newBatchPromptId).then(setPromptVersions).catch(() => setPromptVersions([]));
  }, [newBatchPromptId]);

  useEffect(() => {
    if (!newBatchDatasetId || !newBatchVersionId) {
      return;
    }

    const dataset = datasets.find((item) => item.id === newBatchDatasetId);
    const version = promptVersions.find((item) => item.id === newBatchVersionId);
    if (!dataset || !version) {
      return;
    }

    const mappings = {};
    const variableNames = Array.from(new Set(Array.from((version.userTemplate || '').matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map((match) => match[1])));
    variableNames.forEach((name) => {
      mappings[name] = dataset.columns.includes(name) ? name : '';
    });
    setVarMappings(mappings);
  }, [newBatchDatasetId, newBatchVersionId, datasets, promptVersions]);

  useEffect(() => {
    if (!successBanner) {
      return;
    }
    const timer = setTimeout(() => setSuccessBanner(''), 5000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  const datasetExps = useMemo(() => {
    return selectedBatchId ? batchExperiments : experiments;
  }, [batchExperiments, experiments, selectedBatchId]);

  // Compute per-row overall from actual scores (excluding Toxicity)
  const INVERSE_METRICS = ['Toxicity'];

  const getOverall = (experiment) => {
    if (!experiment.scores || Object.keys(experiment.scores).length === 0) return null;
    const scoreable = Object.entries(experiment.scores)
      .filter(([metric]) => !INVERSE_METRICS.includes(metric))
      .map(([, score]) => score)
      .filter(s => s != null && typeof s === 'number' && s >= 0);
    if (scoreable.length === 0) return null;
    return Math.round(scoreable.reduce((a, b) => a + b, 0) / scoreable.length);
  };

  const summary = useMemo(() => {
    const scoredExperiments = datasetExps.filter((experiment) => experiment.scores && Object.keys(experiment.scores).length > 0);
    if (scoredExperiments.length === 0) {
      return null;
    }

    const totals = { Relevance: 0, Correctness: 0, Toxicity: 0, Fluency: 0, Overall: 0 };
    scoredExperiments.forEach((experiment) => {
      let rowTotal = 0;
      let count = 0;
      METRICS.forEach((metric) => {
        if (experiment.scores[metric] !== undefined) {
          totals[metric] += experiment.scores[metric];
          if (metric !== 'Toxicity') {
            rowTotal += experiment.scores[metric];
            count += 1;
          }
        }
      });
      if (count > 0) {
        totals.Overall += rowTotal / count;
      }
    });

    return {
      Relevance: totals.Relevance != null ? (totals.Relevance / (scoredExperiments.filter((experiment) => experiment.scores.Relevance !== undefined).length || 1)).toFixed(1) : '0.0',
      Correctness: totals.Correctness != null ? (totals.Correctness / (scoredExperiments.filter((experiment) => experiment.scores.Correctness !== undefined).length || 1)).toFixed(1) : '0.0',
      Toxicity: totals.Toxicity != null ? (totals.Toxicity / (scoredExperiments.filter((experiment) => experiment.scores.Toxicity !== undefined).length || 1)).toFixed(1) : '0.0',
      Fluency: totals.Fluency != null ? (totals.Fluency / (scoredExperiments.filter((experiment) => experiment.scores.Fluency !== undefined).length || 1)).toFixed(1) : '0.0',
      Overall: totals.Overall != null && scoredExperiments.length > 0 ? (totals.Overall / scoredExperiments.length).toFixed(1) : '0.0',
      scoredCount: scoredExperiments.length,
      totalCount: datasetExps.length
    };
  }, [datasetExps]);

  const toggleRow = (id) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const handleRunNewBatch = async () => {
    try {
      setBatchResult(null);
      setCancelled(false);
      setBatchProgress({
        isRunning: true,
        current: 0,
        total: 0,
        succeeded: 0,
        failed: 0,
        currentStatus: 'Preparing batch run...',
        errors: []
      });

      const dataset = await fetchDatasetDetail(newBatchDatasetId);
      const version = promptVersions.find(v => v.id === newBatchVersionId);
      const selectedModel = models.find(m => m.id === newBatchModelId);

      const allRows = dataset.rows || [];
      const limit = rowLimit === 'all' ? allRows.length : parseInt(rowLimit, 10);
      const rowsToProcess = allRows.slice(0, limit);

      setBatchProgress(prev => ({ ...prev, total: rowsToProcess.length }));
      const newExperiments = [];

      const batchId = crypto.randomUUID();
      const finalBatchName = newBatchName || `${promptVersions.find(v => v.id === newBatchVersionId)?.promptName || 'Prompt'} / ${dataset?.name || 'Dataset'} / ${selectedModel?.name || 'Model'}`;

      for (let i = 0; i < rowsToProcess.length; i++) {
        if (cancelRef.current) break;

        setBatchProgress(prev => ({
          ...prev,
          current: i + 1,
          currentStatus: `Calling ${selectedModel.provider} API...`
        }));

        try {
          const rowData = rowsToProcess[i];
          let interpolated = version.userTemplate || '';
          const variableValues = {};
          
          for (const [varName, colName] of Object.entries(varMappings)) {
            if (!colName) continue;
            const value = rowData[colName];
            if (value === undefined || value === null) continue;
            interpolated = interpolated.replace(new RegExp(`\\{${varName}\\}`, 'g'), String(value));
            variableValues[varName] = value;
          }

          const result = await runPrompt({
            modelId: newBatchModelId,
            systemPrompt: version.systemPrompt,
            userMessage: interpolated,
            promptId: newBatchPromptId,
            promptVersionId: newBatchVersionId,
            userTemplate: version.userTemplate,
            variableValues,
            datasetId: newBatchDatasetId,
            datasetRowIndex: i,
            batchId,
            batchName: finalBatchName
          });

          if (result.experiment) {
            newExperiments.push(result.experiment);
          }

          setBatchProgress(prev => ({
            ...prev,
            succeeded: prev.succeeded + 1,
            currentStatus: `Row ${i + 1} completed successfully`
          }));
        } catch (err) {
          const errorMsg = err.message || 'Unknown error';
          const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('retry');
          
          setBatchProgress(prev => ({
            ...prev,
            failed: prev.failed + 1,
            currentStatus: isRateLimit
              ? `Rate limited on row ${i + 1} — backend retrying automatically...`
              : `Row ${i + 1} failed: ${errorMsg}`,
            errors: [...prev.errors, { rowIndex: i, message: errorMsg }]
          }));
        }

        await new Promise(r => setTimeout(r, 500));
      }

      onExperimentsAdded(newExperiments);
      setBatchProgress(prev => {
        setBatchResult({ successCount: prev.succeeded, failCount: prev.failed });
        return { ...prev, isRunning: false, currentStatus: '' };
      });
      
      const freshBatches = await listBatches();
      setBatches(freshBatches);
      
      // Auto-select the ungrouped or latest batch
      setSelectedBatchId('ungrouped');
      
    } catch (err) {
      console.error(err);
      setBatchProgress(prev => ({ ...prev, isRunning: false, currentStatus: 'Failed to start batch.' }));
    }
  };

  const handleRunAIScoring = async ({ metrics, expectedOutputCol, scorerModelId }) => {
    setIsAIScoringOpen(false);
    localStorage.setItem('lastScorerModelId', scorerModelId);

    const unscored = datasetExps.filter((experiment) => experiment.status === 'success' && !metrics.every((metric) => experiment.scores?.[metric] !== undefined));
    const skippedErrors = datasetExps.filter(e => e.status === 'error').length;

    if (skippedErrors > 0 || unscored.length > 0) {
      setScoringProgress({ current: 0, total: unscored.length });
    }

    if (skippedErrors > 0) {
      setScoringStatus(`Skipping ${skippedErrors} failed experiment${skippedErrors > 1 ? 's' : ''}`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (unscored.length === 0) {
      setScoringProgress(null);
      setScoringStatus('');
      return;
    }

    for (let index = 0; index < unscored.length; index += 1) {
      const experiment = unscored[index];
      setScoringProgress({ current: index + 1, total: unscored.length });

      let expectedOutput = undefined;
      if (expectedOutputCol && experiment.datasetId) {
        const dataset = await fetchDatasetDetail(experiment.datasetId);
        const row = dataset?.rows?.[experiment.datasetRowIndex];
        expectedOutput = row?.[expectedOutputCol];
      }

      try {
        setScoringStatus('Calling scorer model...');
        const result = await scoreEvaluation({
          experimentId: experiment.id,
          metrics,
          expectedOutput,
          scorerModelId
        });
        setScoringStatus('');

        if (result.updatedExperiment) {
          // Update both the global experiments store and the local batchExperiments view
          setExperiments((prev) => prev.map((e) => e.id === experiment.id ? result.updatedExperiment : e));
          setBatchExperiments((prev) => prev.map((e) => e.id === experiment.id ? result.updatedExperiment : e));
          console.log(`Row scored by ${result.scorerModelName}`);
        }
      } catch (err) {
        if (err.message?.includes('rate limit')) {
          setScoringStatus('Rate limited — backend retrying automatically...');
        } else {
          setScoringStatus(`Error: ${err.message}`);
        }
        console.error(`Failed to score experiment ${experiment.id}:`, err);
        // Keep the run moving if one item fails to score.
      }

      // The only delay needed is a small UI breathing room between experiments:
      await new Promise(r => setTimeout(r, 500));
    }

    setScoringProgress(null);
    setScoringStatus('');
  };



  return (
    <div className="flex h-full flex-col overflow-hidden p-8 animate-in fade-in duration-300">
      <div className="mb-6 flex w-fit gap-1 rounded-lg border border-border bg-panel p-1 shrink-0">
        <MiniTab active={viewMode === 'existing'} onClick={() => setViewMode('existing')}>Existing Runs</MiniTab>
        <MiniTab active={viewMode === 'new'} onClick={() => setViewMode('new')}>Run New Batch</MiniTab>
      </div>

      {successBanner && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3 shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <CheckCircle2 size={16} /> {successBanner}
          </div>
          <button onClick={() => setSuccessBanner('')}><X size={16} className="text-primary opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {viewMode === 'new' ? (
        <div className="flex-1 space-y-8 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <SelectField label="Select Dataset" value={newBatchDatasetId} onChange={setNewBatchDatasetId} options={datasets.map((dataset) => ({ value: dataset.id, label: dataset.name }))} placeholder="Select a dataset..." />
              <SelectField label="Prompt" value={newBatchPromptId} onChange={(value) => { setNewBatchPromptId(value); setNewBatchVersionId(''); }} options={prompts.map((prompt) => ({ value: prompt.id, label: prompt.name }))} placeholder="Select a prompt..." />
              <SelectField label="Prompt Version" value={newBatchVersionId} onChange={setNewBatchVersionId} options={promptVersions.map((version) => ({ value: version.id, label: `${version.versionDisplay} — ${version.commitMessage || 'Saved version'}` }))} placeholder="Select a version..." />
              <SelectField label="Model" value={newBatchModelId} onChange={setNewBatchModelId} options={models.filter((model) => model.status === 'active').map((model) => ({ value: model.id, label: `${model.provider} — ${model.name}` }))} placeholder="Select a model..." />
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Variable Mapping</label>
                {Object.keys(varMappings).length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-border bg-panel/30 p-4">
                    {Object.keys(varMappings).map((variableName) => (
                      <div key={variableName} className="flex items-center justify-between gap-4">
                        <span className="text-xs font-mono text-primary">{'{' + variableName + '}'}</span>
                        <select value={varMappings[variableName]} onChange={(e) => setVarMappings({ ...varMappings, [variableName]: e.target.value })} className="max-w-[200px] flex-1 rounded border border-border bg-background px-3 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none">
                          <option value="">Unmapped</option>
                          {datasets.find((dataset) => dataset.id === newBatchDatasetId)?.columns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-panel/30 p-4 text-xs italic text-text-muted">
                    Select a version to map variables
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Row Limit</label>
                <div className="flex gap-2">
                  {['all', '5', '10'].map((limit) => (
                    <button key={limit} onClick={() => setRowLimit(limit)} className={cn('flex-1 rounded-lg border py-2 text-xs font-bold transition-all', rowLimit === limit ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-panel text-text-muted hover:border-primary/30')}>
                      {limit === 'all' ? 'All Rows' : `First ${limit}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <div style={{ marginBottom: 12 }}>
                  <label style={{
                    fontSize: 11, fontFamily: 'monospace',
                    letterSpacing: '0.08em', color: 'var(--text-muted)',
                    display: 'block', marginBottom: 6
                  }}>
                    BATCH NAME (optional)
                  </label>
                  <input
                    type="text"
                    value={newBatchName}
                    onChange={e => setNewBatchName(e.target.value)}
                    placeholder="e.g. Groq baseline, Gemini test run..."
                    style={{
                      width: '100%', background: '#0f0f0d',
                      border: '1px solid #252320', borderRadius: 6,
                      padding: '8px 12px', color: '#f0ece4', fontSize: 13
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Leave blank to auto-generate from prompt · model · date
                  </span>
                </div>

                <button
                  onClick={handleRunNewBatch}
                  disabled={!newBatchDatasetId || !newBatchPromptId || !newBatchVersionId || !newBatchModelId || batchProgress.isRunning}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-black uppercase tracking-[0.2em] text-panel shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                  style={{ opacity: batchProgress.isRunning ? 0.6 : (!newBatchDatasetId || !newBatchPromptId || !newBatchVersionId || !newBatchModelId ? 0.3 : 1), cursor: batchProgress.isRunning ? 'not-allowed' : (!newBatchDatasetId || !newBatchPromptId || !newBatchVersionId || !newBatchModelId ? 'not-allowed' : 'pointer') }}
                >
                  {!batchProgress.isRunning && <Play size={18} fill="currentColor" />}
                  {batchProgress.isRunning ? 'Running...' : 'Run Batch'}
                </button>
                
                {batchProgress.isRunning && (
                  <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: '#161613',
                    border: '1px solid #252320',
                    borderRadius: 8
                  }}>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13 }}>
                        Running row {batchProgress.current} of {batchProgress.total}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {batchProgress.succeeded} succeeded · {batchProgress.failed} failed
                      </span>
                    </div>
                    <div style={{ height: 4, background: '#252320', borderRadius: 2, marginBottom: 12 }}>
                      <div style={{
                        height: '100%',
                        width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                        background: '#88d273',
                        borderRadius: 2,
                        transition: 'width 300ms ease'
                      }} />
                    </div>
                    {/* Current status */}
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                      {batchProgress.currentStatus}
                    </div>
                    {/* Recent errors */}
                    {batchProgress.errors.length > 0 && (
                      <div style={{ fontSize: 11, color: '#ff6b6b' }}>
                        {batchProgress.errors.slice(-2).map((e, i) => (
                          <div key={i}>Row {e.rowIndex + 1} failed: {e.message}</div>
                        ))}
                      </div>
                    )}
                    {/* Cancel button */}
                    <button
                      onClick={() => setCancelled(true)}
                      style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textDecoration: 'underline' }}>
                      Cancel after current row
                    </button>
                  </div>
                )}
                
                {batchResult && !batchProgress.isRunning && (
                  <div style={{
                    marginTop: 16, padding: 12,
                    background: 'rgba(136, 210, 115, 0.08)',
                    border: '1px solid rgba(136, 210, 115, 0.3)',
                    borderRadius: 8, fontSize: 13
                  }}>
                    ✓ Batch complete —
                    {batchResult.successCount} succeeded,
                    {batchResult.failCount} failed
                    <button onClick={() => setViewMode('existing')}
                      style={{ marginLeft: 12, color: '#88d273', background: 'transparent',
                        border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      View results →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 space-y-6 shrink-0">
            <div className="flex items-end justify-between">
              <div style={{ marginBottom: 16, flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                  BATCH RUN
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {batches.map(batch => {
                    const isSelected = selectedBatchId === batch.batchId;
                    const isHovered = hoveredBatch === batch.batchId;
                    const isRenaming = renamingBatch?.batchId === batch.batchId;
                    
                    if (isRenaming) {
                      return (
                        <input
                          key={`rename-${batch.batchId}`}
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              try {
                                await renameBatch(batch.batchId, renameValue);
                                setBatches(prev => prev.map(b =>
                                  b.batchId === batch.batchId
                                    ? { ...b, batchName: renameValue }
                                    : b
                                ));
                              } catch (err) {
                                console.error('Failed to rename batch', err);
                              }
                              setRenamingBatch(null);
                            }
                            if (e.key === 'Escape') setRenamingBatch(null);
                          }}
                          onBlur={() => setRenamingBatch(null)}
                          style={{
                            fontSize: 12, background: '#0f0f0d',
                            border: '1px solid #88d273', borderRadius: 4,
                            padding: '3px 8px', color: '#f0ece4'
                          }}
                        />
                      );
                    }

                    return (
                      <div
                        key={batch.batchId}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        onMouseEnter={() => setHoveredBatch(batch.batchId)}
                        onMouseLeave={() => setHoveredBatch(null)}
                      >
                        <button
                          onClick={() => setSelectedBatchId(batch.batchId)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: isSelected ? '1px solid #88d273' : '1px solid var(--border)',
                            background: isSelected ? 'rgba(136, 210, 115, 0.1)' : 'transparent',
                            color: isSelected ? '#88d273' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: 12,
                            borderStyle: batch.batchId === 'ungrouped' ? 'dashed' : 'solid',
                            opacity: batch.batchId === 'ungrouped' ? 0.7 : 1
                          }}
                        >
                          <span>{batch.batchName}</span>
                          <span style={{ marginLeft: 8, opacity: 0.6 }}>
                            {batch.successCount}/{batch.rowCount} runs
                          </span>
                          <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
                            {timeAgo(batch.createdAt)}
                          </span>
                        </button>
                        {isHovered && batch.batchId !== 'ungrouped' && (
                          <button
                            onClick={() => {
                              setRenamingBatch(batch);
                              setRenameValue(batch.batchName);
                            }}
                            style={{
                              fontSize: 10, padding: '2px 6px',
                              border: '1px solid #252320', borderRadius: 3,
                              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
                            }}
                          >
                            ✏
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {batches.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 15, marginBottom: 8 }}>No batch runs yet</div>
                    <div style={{ fontSize: 13, marginBottom: 20 }}>
                      Run your first batch from the "Run New Batch" tab to see results here.
                    </div>
                    <button onClick={() => setViewMode('new')}
                      style={{ padding: '8px 16px', border: '1px solid #88d273',
                        borderRadius: 6, color: '#88d273', background: 'transparent', cursor: 'pointer' }}>
                      Run New Batch →
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsAIScoringOpen(true)} 
                disabled={!selectedBatchId || batches.length === 0}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-panel shadow-lg shadow-primary/10 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                <Zap size={16} fill="currentColor" /> Score All with AI
              </button>
            </div>

            {summary && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-panel/50 p-4 shadow-sm">
                <div className="flex gap-8">
                  {METRICS.map((metric) => (
                    <div key={metric} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-text-muted">{metric}</span>
                      <span className={cn('font-mono text-lg font-bold', parseFloat(summary[metric]) > 80 ? 'text-primary' : 'text-text-main')}>
                        {isNaN(summary[metric]) ? '--' : `${summary[metric]}%`}
                      </span>
                    </div>
                  ))}
                  <div className="mx-2 w-[1px] bg-border" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">Overall</span>
                    <span className="font-mono text-lg font-bold text-primary">{summary.Overall}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-xs font-medium text-text-muted">{summary.scoredCount} of {summary.totalCount} rows scored</div>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full border border-border/50 bg-background">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(summary.scoredCount / summary.totalCount) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {scoringProgress && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(136, 210, 115, 0.1)',
              border: '1px solid rgba(136, 210, 115, 0.3)',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13
            }}>
              <div>⚡ Scoring {scoringProgress.current} of {scoringProgress.total} with AI...</div>
              {scoringStatus && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {scoringStatus}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-xl border border-border bg-panel/30">
            <table className="w-full table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-background/50">
                  <th className="w-12 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">#</th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Input Variables</th>
                  <th className="w-1/4 px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Output</th>
                  {METRICS.slice(0, 2).map((metric) => (
                    <th key={metric} className="w-24 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">{metric}</th>
                  ))}
                  <th className="w-32 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">Overall</th>
                  <th className="w-24 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">Status</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {!selectedBatchId && batches.length > 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted italic">
                      Select a batch run above to view its results
                    </td>
                  </tr>
                )}
                {selectedBatchId && !isBatchLoading && datasetExps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted italic">
                      No experiments found for this run.
                    </td>
                  </tr>
                )}
                {selectedBatchId && datasetExps.map((experiment, index) => {
                  const isExpanded = expandedRows.has(experiment.id);
                  const rowOverall = getOverall(experiment);
                  const hasScores = experiment.scores && Object.keys(experiment.scores).length > 0;

                  const renderScore = (score) => {
                    if (score === null || score === undefined) return (
                      <span style={{ color: 'var(--text-muted)' }}>--</span>
                    );
                    if (score === -1) return (  // use -1 as sentinel for "failed"
                      <span style={{ color: '#ff6b6b', fontSize: 11 }}>failed</span>
                    );
                    return (
                      <span style={{ color: score > 70 ? '#88d273' : score > 40 ? '#e8a847' : '#ff6b6b' }}>
                        {score}
                      </span>
                    );
                  };

                  return (
                    <Fragment key={experiment.id}>
                      <tr onClick={() => toggleRow(experiment.id)} className={cn('group cursor-pointer border-b border-border transition-colors hover:bg-white/[0.02]', isExpanded && 'bg-white/[0.03]')}>
                        <td className="px-4 py-4 text-center font-mono text-xs text-text-muted">{index + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(experiment.variableValues || {}).map(([key, value]) => (
                              <span key={key} className="rounded border border-border bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                                <span className="text-primary/70">{key}=</span>{String(value)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="line-clamp-2 text-xs leading-relaxed text-text-main opacity-80">
                            {experiment.output || <span className="italic text-text-muted">No output</span>}
                          </p>
                          {experiment.status === 'error' && (
                            <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>
                              {experiment.errorMessage || 'Unknown error'}
                            </div>
                          )}
                        </td>
                        {METRICS.slice(0, 2).map((metric) => (
                          <td key={metric} className="px-4 py-4 text-center font-mono text-xs font-bold">
                            {renderScore(experiment.scores?.[metric])}
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          {hasScores && rowOverall != null ? (
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border/50 bg-background">
                                <div className="h-full bg-primary transition-all" style={{ width: `${rowOverall}%` }} />
                              </div>
                              <span className="w-8 text-right font-mono text-[10px] font-bold text-text-main">
                                {rowOverall.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <div className="text-center font-mono text-[10px] text-text-muted opacity-30">--</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter', experiment.status === 'success' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-500/30 bg-red-500/10 text-red-400')}>
                            {experiment.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-text-muted">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border bg-white/[0.03]">
                          <td colSpan={8} className="p-0">
                            <div className="space-y-6 p-6 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    <MessageSquare size={12} /> Full Output
                                  </label>
                                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background/50 p-4 text-sm leading-relaxed text-text-main whitespace-pre-wrap font-sans">
                                    {experiment.output}
                                  </div>
                                </div>
                                <div className="space-y-6">
                                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    <Settings size={12} /> Detailed Scoring
                                  </label>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {METRICS.map((metric) => (
                                      <ScoreBar key={metric} label={metric} score={experiment.scores?.[metric]} />
                                    ))}
                                  </div>
                                  <div className="space-y-2 pt-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Notes</label>
                                    <textarea defaultValue={experiment.notes} onBlur={(e) => onUpdateExperiment({ ...experiment, notes: e.target.value })} placeholder="Add evaluation notes..." className="h-20 w-full resize-none rounded-lg border border-border bg-background p-3 text-xs text-text-main transition-all focus:border-primary/50 focus:outline-none" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isAIScoringOpen && (
        <AIScoringModal
          dataset={datasets.find((dataset) => dataset.id === (datasetExps.length > 0 ? datasetExps[0].datasetId : null))}
          activeModels={models.filter(m => m.status === 'active')}
          onCancel={() => setIsAIScoringOpen(false)}
          onConfirm={handleRunAIScoring}
        />
      )}
    </div>
  );
}

function MiniTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={cn('rounded-md px-4 py-1.5 text-xs font-bold transition-all', active ? 'bg-background text-primary shadow-sm' : 'text-text-muted hover:text-text-main')}>
      {children}
    </button>
  );
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-panel px-4 py-3 text-sm text-text-main focus:border-primary focus:outline-none">
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterField({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-[200px] rounded-md border border-border bg-panel px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function AIScoringModal({ dataset, activeModels, onCancel, onConfirm }) {
  const [selectedMetrics, setSelectedMetrics] = useState(['Relevance', 'Correctness']);
  const [expectedOutputCol, setExpectedOutputCol] = useState('');
  const [scorerModelId, setScorerModelId] = useState(() => activeModels.length > 0 ? activeModels[0].id : '');

  const toggleMetric = (metric) => {
    setSelectedMetrics((prev) => prev.includes(metric) ? prev.filter((value) => value !== metric) : [...prev, metric]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Zap className="text-primary" size={20} fill="currentColor" /> AI Scoring Config
          </h3>
          <button onClick={onCancel} className="text-text-muted transition-colors hover:text-text-main"><X size={20} /></button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">SCORER MODEL *</label>
            <select
              value={scorerModelId}
              onChange={e => setScorerModelId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-main focus:border-primary focus:outline-none"
            >
              <option value="">Select a model to use for scoring...</option>
              {activeModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} · {model.provider}
                </option>
              ))}
            </select>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] text-text-muted">
              <Info size={12} className="shrink-0" />
              This model will evaluate each output. Any model with a valid API key works.
            </p>
          </div>

          <div>
            <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-text-muted">Select Metrics to Score</label>
            <div className="grid grid-cols-2 gap-3">
              {METRICS.map((metric) => (
                <button key={metric} onClick={() => toggleMetric(metric)} className={cn('flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition-all', selectedMetrics.includes(metric) ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background text-text-muted hover:border-primary/30')}>
                  {metric}
                  {selectedMetrics.includes(metric) && <CheckCircle2 size={14} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">Expected Output Reference</label>
            <select value={expectedOutputCol} onChange={(e) => setExpectedOutputCol(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-main focus:border-primary focus:outline-none">
              <option value="">None (General Evaluation)</option>
              {dataset?.columns?.map((column) => (
                <option key={column} value={column}>Column: {column}</option>
              ))}
            </select>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] text-text-muted">
              <Info size={12} className="shrink-0" />
              Providing an expected output helps the AI score Correctness accurately.
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-text-muted transition-colors hover:text-text-main">Cancel</button>
          <button onClick={() => onConfirm({ metrics: selectedMetrics, expectedOutputCol, scorerModelId })} disabled={selectedMetrics.length === 0 || !scorerModelId} className="flex-1 rounded-lg bg-primary py-2.5 font-bold text-panel transition-all hover:bg-primary/90 disabled:opacity-50">
            Run AI Scoring
          </button>
        </div>
      </div>
    </div>
  );
}

function EvalEmptyState({ setActiveTab }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FlaskConical size={40} />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-text-main">No evaluation data yet</h2>
      <p className="mb-8 max-w-md text-center text-text-muted">
        Run your first batch from the "Run New Batch" tab to see results here.
      </p>
      <button onClick={() => setActiveTab('run-new-batch')} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-panel transition-all hover:bg-primary/90">
        Run New Batch <ChevronRight size={18} />
      </button>
    </div>
  );
}

function EvalPanel({ exp, isWinner, isTie, onUpdateScore }) {
  if (!exp) {
    return (
      <div className="glass-panel flex items-center justify-center rounded-xl border-2 border-dashed border-border/50">
        <div className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-text-muted opacity-30" size={40} />
          <p className="font-medium text-text-muted">Select an experiment to compare</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-panel flex flex-col overflow-y-auto rounded-xl transition-all duration-500', isWinner ? 'border-primary/50 ring-1 ring-primary/20 shadow-lg shadow-primary/5' : 'border-border', isTie ? 'border-amber-500/50 ring-1 ring-amber-500/20' : '')}>
      <div className="flex items-center justify-between border-b border-border bg-background/50 p-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className={cn('rounded border px-2 py-0.5 font-mono text-xs transition-colors', isWinner ? 'border-primary/50 bg-primary/20 text-primary' : 'border-border bg-panel text-text-muted')}>{exp.promptVersion}</span>
          <span className="text-sm font-bold tracking-tight text-text-main">{exp.modelName || exp.model}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-text-muted">{exp.provider}</span>
        </div>
        {isWinner && <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-primary"><CheckCircle2 size={12} /> WINNER</div>}
        {isTie && <div className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-amber-500">TIE</div>}
      </div>

      <div className="flex-1 space-y-6 p-5 text-text-main">
        <div className="flex flex-col gap-2">
          <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Output
            <span className="font-mono text-[9px] lowercase opacity-50">{exp.output?.length || 0} chars</span>
          </label>
          <div className="min-h-[200px] rounded-lg border border-border bg-background/50 p-4 text-sm leading-relaxed text-text-main whitespace-pre-wrap break-words">
            {exp.output || <span className="italic text-text-muted">No output recorded</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/50 bg-panel/50 p-3">
          <InfoMetric icon={<Zap size={10} />} label="Latency" value={`${exp.latencyMs || 0}ms`} />
          <InfoMetric icon={<TrendingUp size={10} />} label="Tokens" value={exp.totalTokens || 0} />
          <InfoMetric icon={<Coins size={10} />} label="Cost" value={`$${typeof exp.costEstimate === 'number' ? exp.costEstimate.toFixed(4) : (exp.costEstimate || 0)}`} />
        </div>

        <div className="space-y-4 pb-4 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Metrics & Scoring</label>
          </div>
          {METRICS.map((metric) => (
            <ScoreBar key={metric} label={metric} score={(exp.scores || {})[metric]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoMetric({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter text-text-muted">{icon} {label}</span>
      <span className="font-mono text-xs text-text-main">{value}</span>
    </div>
  );
}

function ScoreBar({ label, score }) {
  const hasScore = typeof score === 'number';
  const displayScore = hasScore ? score : 0;

  return (
    <div className="group space-y-1.5">
      <div className="flex items-end justify-between text-[10px]">
        <span className="font-medium text-text-muted">{label}</span>
        <span className={cn('font-mono font-bold', hasScore ? 'text-text-main' : 'italic text-text-muted')}>
          {hasScore ? `${score}%` : '--'}
        </span>
      </div>
      <div className="relative flex h-2 items-center">
        <div className="h-1.5 w-full overflow-hidden rounded-full border border-border/50 bg-background">
          <div className={cn('h-full transition-all duration-300 bg-primary', !hasScore && 'opacity-0')} style={{ width: `${displayScore}%` }} />
        </div>
      </div>
    </div>
  );
}
