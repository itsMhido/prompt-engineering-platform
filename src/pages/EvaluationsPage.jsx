import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, FlaskConical, AlertCircle, TrendingUp, Zap, 
  Coins, ChevronRight, BarChart2, Table, ChevronDown, 
  ChevronUp, MessageSquare, Play, X, Info, Settings
} from 'lucide-react';
import { cn, readLocalStorageJSON, writeLocalStorageJSON, timeAgo } from '../utils/helpers';
import { loadModels } from '../utils/mockApi';
import { callModel } from '../utils/callModel';

const EXPERIMENTS_KEY = 'pe_experiments';
const DATASETS_KEY = 'pe_datasets';
const METRICS = ['Relevance', 'Correctness', 'Toxicity', 'Fluency'];

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'comparison' | 'batch'
  const [experiments, setExperiments] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const loadedExps = readLocalStorageJSON(EXPERIMENTS_KEY, []);
    const loadedDatasets = readLocalStorageJSON(DATASETS_KEY, []);
    setExperiments(loadedExps);
    setDatasets(loadedDatasets);
    loadModels().then(setModels);
  }, []);

  const handleUpdateExperiment = (updatedExp) => {
    const next = experiments.map(e => e.id === updatedExp.id ? updatedExp : e);
    setExperiments(next);
    writeLocalStorageJSON(EXPERIMENTS_KEY, next);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Top Navigation & Tabs */}
      <div className="px-8 pt-8 shrink-0 bg-background">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-1 text-text-main">Evaluations</h2>
            <p className="text-text-muted">Compare outputs and metrics side-by-side.</p>
          </div>
          <div className="flex bg-panel border border-border p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === 'overview' ? "bg-background text-primary shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <TrendingUp size={16} /> Overview
            </button>
            <button 
              onClick={() => setActiveTab('comparison')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === 'comparison' ? "bg-background text-primary shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <BarChart2 size={16} /> Comparison
            </button>
            <button 
              onClick={() => setActiveTab('batch')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === 'batch' ? "bg-background text-primary shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <Table size={16} /> Batch Eval
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' ? (
          <OverviewView experiments={experiments} setActiveTab={setActiveTab} />
        ) : activeTab === 'comparison' ? (
          <ComparisonView experiments={experiments} datasets={datasets} onUpdateExps={setExperiments} />
        ) : (
          <BatchEvalView 
            experiments={experiments} 
            datasets={datasets} 
            models={models}
            onUpdateExperiment={handleUpdateExperiment} 
            onUpdateExps={setExperiments}
          />
        )}
      </div>
    </div>
  );
}

function OverviewView({ experiments, setActiveTab }) {
  const scoredExperiments = useMemo(() => experiments.filter(e => e.scores && Object.keys(e.scores).length > 0), [experiments]);

  const stats = useMemo(() => {
    if (scoredExperiments.length === 0) return null;
    
    const averages = { Relevance: 0, Correctness: 0, Toxicity: 0, Overall: 0 };
    scoredExperiments.forEach(e => {
      let rowTotal = 0;
      let count = 0;
      METRICS.forEach(m => {
        if (e.scores[m] !== undefined) {
          averages[m] = (averages[m] || 0) + e.scores[m];
          rowTotal += e.scores[m];
          count++;
        }
      });
      if (count > 0) averages.Overall += (rowTotal / count);
    });

    return {
      totalEvaluated: scoredExperiments.length,
      avgRelevance: (averages.Relevance / (scoredExperiments.filter(e => e.scores.Relevance !== undefined).length || 1)).toFixed(1),
      avgCorrectness: (averages.Correctness / (scoredExperiments.filter(e => e.scores.Correctness !== undefined).length || 1)).toFixed(1),
      avgToxicity: (averages.Toxicity / (scoredExperiments.filter(e => e.scores.Toxicity !== undefined).length || 1)).toFixed(1),
      avgOverall: (averages.Overall / scoredExperiments.length).toFixed(1)
    };
  }, [scoredExperiments]);

  const groupBy = (key) => {
    const groups = {};
    scoredExperiments.forEach(e => {
      const val = e[key] || 'Unknown';
      if (!groups[val]) groups[val] = { name: val, runs: 0, prompt: e.promptName || 'Unknown Prompt', Relevance: 0, Correctness: 0, Toxicity: 0, Overall: 0, counts: { Relevance: 0, Correctness: 0, Toxicity: 0 } };
      groups[val].runs++;
      let rowTotal = 0;
      let count = 0;
      METRICS.forEach(m => {
        if (e.scores[m] !== undefined) {
          groups[val][m] += e.scores[m];
          groups[val].counts[m]++;
          rowTotal += e.scores[m];
          count++;
        }
      });
      if (count > 0) groups[val].Overall += (rowTotal / count);
    });

    return Object.values(groups).map(g => ({
      ...g,
      Relevance: g.counts.Relevance > 0 ? (g.Relevance / g.counts.Relevance).toFixed(1) : '0.0',
      Correctness: g.counts.Correctness > 0 ? (g.Correctness / g.counts.Correctness).toFixed(1) : '0.0',
      Toxicity: g.counts.Toxicity > 0 ? (g.Toxicity / g.counts.Toxicity).toFixed(1) : '0.0',
      Overall: (g.Overall / g.runs).toFixed(1)
    })).sort((a, b) => parseFloat(b.Overall) - parseFloat(a.Overall));
  };

  const modelComparison = useMemo(() => groupBy('modelId'), [scoredExperiments]);
  const versionComparison = useMemo(() => groupBy('version'), [scoredExperiments]);

  const distributions = useMemo(() => {
    const dist = {};
    METRICS.forEach(m => {
      dist[m] = [0, 0, 0, 0]; // 0-25, 26-50, 51-75, 76-100
      scoredExperiments.forEach(e => {
        const s = e.scores[m];
        if (s !== undefined) {
          if (s <= 25) dist[m][0]++;
          else if (s <= 50) dist[m][1]++;
          else if (s <= 75) dist[m][2]++;
          else dist[m][3]++;
        }
      });
    });
    return dist;
  }, [scoredExperiments]);

  if (scoredExperiments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
          <TrendingUp size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-text-main">No evaluated data yet</h2>
        <p className="text-text-muted text-center max-w-md mb-8">
          You need to score some experiments in the Batch Eval tab to see aggregate metrics here.
        </p>
        <button 
          onClick={() => setActiveTab('batch')}
          className="px-6 py-3 bg-primary text-panel font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          Go to Batch Eval <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  const findMax = (arr, key) => Math.max(...arr.map(x => parseFloat(x[key])));

  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300 space-y-10 pb-20">
      {/* Top Stats */}
      <div className="grid grid-cols-5 gap-6">
        <StatCard label="Scored Experiments" value={stats.totalEvaluated} icon={<FlaskConical size={18} />} />
        <StatCard label="Avg Relevance" value={`${stats.avgRelevance}%`} icon={<TrendingUp size={18} />} color="text-primary" />
        <StatCard label="Avg Correctness" value={`${stats.avgCorrectness}%`} icon={<CheckCircle2 size={18} />} color="text-primary" />
        <StatCard label="Avg Toxicity" value={`${stats.avgToxicity}%`} icon={<AlertCircle size={18} />} color="text-amber-500" />
        <StatCard label="Avg Overall" value={`${stats.avgOverall}%`} icon={<Zap size={18} />} color="text-primary" highlight />
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Model Comparison */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted ml-1">Performance by Model</h3>
          <div className="border border-border rounded-xl overflow-hidden bg-panel/30">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-background/50 border-b border-border">
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Model</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Prompt</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Runs</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Relevance</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Overall</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.map(m => (
                  <tr key={m.name} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-text-main">{m.name}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{m.prompt}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{m.runs}</td>
                    <td className={cn("px-4 py-3 text-center font-mono", parseFloat(m.Relevance) === findMax(modelComparison, 'Relevance') && "text-primary bg-primary/5")}>{m.Relevance}%</td>
                    <td className={cn("px-4 py-3 text-center font-mono font-bold", parseFloat(m.Overall) === findMax(modelComparison, 'Overall') ? "text-primary bg-primary/10" : "text-text-main")}>{m.Overall}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Version Comparison */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted ml-1">Performance by Version</h3>
          <div className="border border-border rounded-xl overflow-hidden bg-panel/30">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-background/50 border-b border-border">
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Version</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Prompt</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Runs</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Correctness</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Overall</th>
                </tr>
              </thead>
              <tbody>
                {versionComparison.map(v => (
                  <tr key={v.name} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-text-main">{v.name}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{v.prompt}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{v.runs}</td>
                    <td className={cn("px-4 py-3 text-center font-mono", parseFloat(v.Correctness) === findMax(versionComparison, 'Correctness') && "text-primary bg-primary/5")}>{v.Correctness}%</td>
                    <td className={cn("px-4 py-3 text-center font-mono font-bold", parseFloat(v.Overall) === findMax(versionComparison, 'Overall') ? "text-primary bg-primary/10" : "text-text-main")}>{v.Overall}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Distribution Bars */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted ml-1">Score Distributions</h3>
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 bg-panel/30 border border-border p-8 rounded-2xl">
          {METRICS.map(m => (
            <div key={m} className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-xs font-bold text-text-main">{m}</label>
                <span className="text-[10px] text-text-muted">
                  {Math.round((distributions[m][3] / scoredExperiments.length) * 100)}% scored above 75%
                </span>
              </div>
              <div className="flex h-3 w-full rounded-full overflow-hidden border border-border/50">
                <div className="bg-red-500/80 transition-all" style={{ width: `${(distributions[m][0] / scoredExperiments.length) * 100}%` }} title="0-25%" />
                <div className="bg-orange-500/80 transition-all" style={{ width: `${(distributions[m][1] / scoredExperiments.length) * 100}%` }} title="26-50%" />
                <div className="bg-yellow-500/80 transition-all" style={{ width: `${(distributions[m][2] / scoredExperiments.length) * 100}%` }} title="51-75%" />
                <div className="bg-primary transition-all" style={{ width: `${(distributions[m][3] / scoredExperiments.length) * 100}%` }} title="76-100%" />
              </div>
              <div className="flex justify-between text-[8px] text-text-muted font-mono px-1">
                <span>0%</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-text-main", highlight = false }) {
  return (
    <div className={cn(
      "glass-panel rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:scale-[1.02]",
      highlight ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border"
    )}>
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        <div className="text-text-muted opacity-30">{icon}</div>
      </div>
      <div className={cn("text-3xl font-black tracking-tight", color)}>{value}</div>
      {highlight && <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-primary/10 rounded-full blur-2xl" />}
    </div>
  );
}

function ComparisonView({ experiments, datasets, onUpdateExps }) {
  const [selectedDatasetId, setSelectedDatasetId] = useState('all');
  const [expAId, setExpAId] = useState('');
  const [expBId, setExpBId] = useState('');

  useEffect(() => {
    if (experiments.length > 0 && !expAId) {
      setExpAId(experiments[0].id);
      if (experiments.length > 1) setExpBId(experiments[1].id);
      else setExpBId(experiments[0].id);
    }
  }, [experiments, expAId]);

  const uniqueDatasetIds = useMemo(() => {
    return Array.from(new Set(experiments.map(e => e.datasetId).filter(Boolean)));
  }, [experiments]);

  const filteredExperiments = useMemo(() => {
    if (selectedDatasetId === 'all') return experiments;
    return experiments.filter(e => e.datasetId === selectedDatasetId);
  }, [experiments, selectedDatasetId]);

  const handleUpdateScore = (expId, metric, value) => {
    const updated = experiments.map(e => {
      if (e.id === expId) {
        return {
          ...e,
          scores: { ...(e.scores || {}), [metric]: value }
        };
      }
      return e;
    });
    onUpdateExps(updated);
    writeLocalStorageJSON(EXPERIMENTS_KEY, updated);
  };

  const expA = useMemo(() => experiments.find(e => e.id === expAId), [experiments, expAId]);
  const expB = useMemo(() => experiments.find(e => e.id === expBId), [experiments, expBId]);

  const winnerInfo = useMemo(() => {
    if (!expA || !expB || expA.id === expB.id) return null;
    const scoresA = Object.values(expA.scores || {});
    const scoresB = Object.values(expB.scores || {});
    
    if (scoresA.length === 0 || scoresB.length === 0) return null;
    
    const avgA = scoresA.reduce((a, b) => a + b, 0) / scoresA.length;
    const avgB = scoresB.reduce((a, b) => a + b, 0) / scoresB.length;
    
    if (avgA === avgB) return 'tie';
    return avgA > avgB ? 'a' : 'b';
  }, [expA, expB]);

  if (experiments.length === 0) {
    return <EvalEmptyState />;
  }

  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300 flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Filter by Dataset:</span>
          <select 
            value={selectedDatasetId}
            onChange={e => setSelectedDatasetId(e.target.value)}
            className="bg-panel border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer text-text-main"
          >
            <option value="all">All Experiments</option>
            {uniqueDatasetIds.map(id => {
              const ds = datasets.find(d => d.id === id);
              return <option key={id} value={id}>{ds ? ds.name : `Dataset ${id}`}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8 shrink-0">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Experiment A</label>
          <select 
            value={expAId}
            onChange={e => setExpAId(e.target.value)}
            className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer text-text-main"
          >
            {filteredExperiments.map(e => (
              <option key={e.id} value={e.id}>
                {e.promptName || 'Unknown Prompt'} · {e.version} · {e.provider} · {e.modelId} · {timeAgo(e.timestamp)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Experiment B</label>
          <select 
            value={expBId}
            onChange={e => setExpBId(e.target.value)}
            className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer text-text-main"
          >
            {filteredExperiments.map(e => (
              <option key={e.id} value={e.id}>
                {e.promptName || 'Unknown Prompt'} · {e.version} · {e.provider} · {e.modelId} · {timeAgo(e.timestamp)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 items-stretch">
        <EvalPanel 
          exp={expA} 
          isWinner={winnerInfo === 'a'} 
          isTie={winnerInfo === 'tie'}
          onUpdateScore={(metric, val) => handleUpdateScore(expAId, metric, val)}
        />
        <EvalPanel 
          exp={expB} 
          isWinner={winnerInfo === 'b'} 
          isTie={winnerInfo === 'tie'}
          onUpdateScore={(metric, val) => handleUpdateScore(expBId, metric, val)}
        />
      </div>
    </div>
  );
}

function BatchEvalView({ experiments, datasets, models, onUpdateExperiment, onUpdateExps }) {
  const [viewMode, setViewMode] = useState('existing'); // 'existing' | 'new'
  const [selectedDatasetId, setSelectedDatasetId] = useState('all');
  const [selectedVersion, setSelectedVersion] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isAIScoringOpen, setIsAIScoringOpen] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(null); // { current, total }
  const [successBanner, setSuccessBanner] = useState('');

  // New Batch State
  const [newBatchDatasetId, setNewBatchDatasetId] = useState('');
  const [newBatchPromptId, setNewBatchPromptId] = useState('');
  const [newBatchVersionId, setNewBatchVersionId] = useState('');
  const [newBatchModelId, setNewBatchModelId] = useState('');
  const [varMappings, setVarMappings] = useState({});
  const [rowLimit, setRowLimit] = useState('all');
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total }
  const [batchResult, setBatchResult] = useState(null); // { successCount, failCount }
  const [progressMessage, setProgressMessage] = useState(null);
  const cancelledRef = useRef(false);

  const [promptVersions, setPromptVersions] = useState([]);
  const [prompts, setPrompts] = useState([]);

  useEffect(() => {
    const promptsData = readLocalStorageJSON('pe_prompts', []);
    const versionsData = readLocalStorageJSON('pe_versions', []);
    setPrompts(Array.isArray(promptsData) ? promptsData : []);
    setPromptVersions(Array.isArray(versionsData) ? versionsData : []);
  }, []);

  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Auto-map variables when dataset or version changes
  useEffect(() => {
    if (!newBatchDatasetId || !newBatchVersionId) return;
    const dataset = datasets.find(d => d.id === newBatchDatasetId);
    const version = promptVersions.find(v => String(v.version) === String(newBatchVersionId) && v.promptId === newBatchPromptId);
    if (!dataset || !version) return;

    const varNames = Array.from(new Set(
      Array.from((version.userTemplate || version.userPrompt || '').matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || []).map(match => match[1])
    ));

    const newMappings = {};
    varNames.forEach(v => {
      if (dataset.columns.includes(v)) newMappings[v] = v;
      else newMappings[v] = '';
    });
    setVarMappings(newMappings);
  }, [newBatchDatasetId, newBatchVersionId, newBatchPromptId, datasets, promptVersions]);

  const datasetExps = useMemo(() => {
    let filtered = experiments;
    if (selectedDatasetId !== 'all') filtered = filtered.filter(e => e.datasetId === selectedDatasetId);
    if (selectedVersion !== 'all') filtered = filtered.filter(e => e.version === selectedVersion);
    return filtered;
  }, [experiments, selectedDatasetId, selectedVersion]);

  const uniqueVersions = useMemo(() => {
    const exps = selectedDatasetId === 'all' ? experiments : experiments.filter(e => e.datasetId === selectedDatasetId);
    return Array.from(new Set(exps.map(e => e.version).filter(Boolean)));
  }, [experiments, selectedDatasetId]);

  const summary = useMemo(() => {
    const scoredExps = datasetExps.filter(e => e.scores && Object.keys(e.scores).length > 0);
    if (scoredExps.length === 0) return null;

    const totals = { Relevance: 0, Correctness: 0, Toxicity: 0, Fluency: 0, Overall: 0 };
    scoredExps.forEach(e => {
      let rowTotal = 0;
      let count = 0;
      METRICS.forEach(m => {
        if (e.scores[m] !== undefined) {
          totals[m] += e.scores[m];
          rowTotal += e.scores[m];
          count++;
        }
      });
      if (count > 0) totals.Overall += (rowTotal / count);
    });

    return {
      Relevance: (totals.Relevance / (scoredExps.filter(e => e.scores.Relevance !== undefined).length || 1)).toFixed(1),
      Correctness: (totals.Correctness / (scoredExps.filter(e => e.scores.Correctness !== undefined).length || 1)).toFixed(1),
      Toxicity: (totals.Toxicity / (scoredExps.filter(e => e.scores.Toxicity !== undefined).length || 1)).toFixed(1),
      Fluency: (totals.Fluency / (scoredExps.filter(e => e.scores.Fluency !== undefined).length || 1)).toFixed(1),
      Overall: (totals.Overall / scoredExps.length).toFixed(1),
      scoredCount: scoredExps.length,
      totalCount: datasetExps.length
    };
  }, [datasetExps]);

  const toggleRow = (id) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  const handleRunNewBatch = async () => {
    const selectedPromptVersion = promptVersions.find(v => String(v.version) === String(newBatchVersionId) && v.promptId === newBatchPromptId);
    const selectedModel = models.find(m => m.id === newBatchModelId);
    const variableMapping = varMappings;

    const datasetsFromStorage = (() => {
      try {
        const raw = localStorage.getItem('pe_datasets');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    const selectedDataset = datasetsFromStorage.find(d => d.id === newBatchDatasetId);

    if (!selectedPromptVersion || !selectedModel) return;
    if (!selectedDataset) {
      console.error('Dataset not found for id:', newBatchDatasetId);
      return;
    }

    const rows = Array.isArray(selectedDataset.rows) ? selectedDataset.rows : [];
    if (rows.length === 0) {
      console.error('Dataset has no rows:', selectedDataset);
      return;
    }

    const limit = (rowLimit === 'all' || !rowLimit)
      ? rows.length
      : parseInt(rowLimit, 10) || rows.length;
    const rowsToProcess = rows.slice(0, limit);

    console.log('Selected dataset:', selectedDataset);
    console.log('Rows to process:', rowsToProcess);
    console.log('Selected prompt version:', selectedPromptVersion);
    console.log('Selected model:', selectedModel);
    console.log('Variable mapping:', variableMapping);

    const interpolateTemplate = (userTemplate, row, mapping) => {
      return userTemplate.replace(
        /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
        (match, varName) => {
          const colName = mapping[varName];
          return colName ? (row[colName] ?? match) : match;
        }
      );
    };

    setIsRunningBatch(true);
    setBatchResult(null);
    cancelledRef.current = false;
    setBatchProgress({ current: 0, total: rowsToProcess.length });

    let successCount = 0;
    let failCount = 0;
    const newExperiments = [];

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      setProgressMessage(`Running row ${i + 1} of ${rowsToProcess.length}...`);
      setBatchProgress({ current: i + 1, total: rowsToProcess.length });

      try {
        const interpolated = interpolateTemplate(selectedPromptVersion.userTemplate || selectedPromptVersion.userPrompt || '', row, variableMapping);
        const result = await callModel(selectedModel, selectedPromptVersion.systemPrompt || '', interpolated);

        const selectedPrompt = prompts.find(p => p.id === newBatchPromptId);
        const versionLabel = `v${selectedPromptVersion.version}`;
        const experiment = {
          id: crypto.randomUUID(),
          promptId: newBatchPromptId,
          promptName: selectedPrompt?.name || 'Unknown Prompt',
          promptVersion: versionLabel,
          version: versionLabel,
          model: selectedModel.name || selectedModel.modelId,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider,
          systemPrompt: selectedPromptVersion.systemPrompt || '',
          userTemplate: selectedPromptVersion.userTemplate || selectedPromptVersion.userPrompt || '',
          variableValues: row,
          interpolatedPrompt: interpolated,
          output: result.output,
          latencyMs: result.latency,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          costEstimate: result.costEstimate,
          status: 'success',
          datasetId: selectedDataset.id,
          datasetRowIndex: i,
          timestamp: new Date().toISOString(),
          tags: [],
          score: null,
          notes: '',
          scores: {},
          reasoning: {}
        };

        const existing = (() => {
          try {
            return JSON.parse(localStorage.getItem('pe_experiments') || '[]');
          } catch {
            return [];
          }
        })();
        localStorage.setItem('pe_experiments', JSON.stringify([...existing, experiment]));

        newExperiments.push(experiment);
        successCount++;
      } catch (err) {
        console.error(`Row ${i + 1} failed:`, err);
        failCount++;
      }

      await new Promise(r => setTimeout(r, 300));
      if (cancelledRef.current) break;
    }

    const allExps = readLocalStorageJSON(EXPERIMENTS_KEY, []);
    onUpdateExps(allExps);

    setProgressMessage(null);
    setBatchResult({ successCount, failCount });
    setSuccessBanner(`Batch complete — ${successCount} experiments logged (${failCount} failed)`);
    setIsRunningBatch(false);
    setBatchProgress(null);
    setSelectedDatasetId(newBatchDatasetId);
    setSelectedVersion(`v${newBatchVersionId}`);
    setViewMode('existing');
  };

  const handleRunAIScoring = async (config) => {
    setIsAIScoringOpen(false);
    const unscored = datasetExps.filter(e => {
      const hasScores = e.scores && config.metrics.every(m => e.scores[m] !== undefined);
      return !hasScores;
    });

    if (unscored.length === 0) return;
    
    setScoringProgress({ current: 0, total: unscored.length });
    
    const scoringModel = models.find(m => m.provider === 'Anthropic' && m.apiKey) || models.find(m => m.apiKey);
    if (!scoringModel) {
      alert("No model with API key found for scoring.");
      setScoringProgress(null);
      return;
    }

    for (let i = 0; i < unscored.length; i++) {
      const exp = unscored[i];
      setScoringProgress({ current: i + 1, total: unscored.length });

      const dataset = datasets.find(d => d.id === exp.datasetId);
      let expectedOutput = "";
      if (config.expectedOutputCol && dataset) {
        const dsRow = dataset.rows.find(r => 
          Object.keys(exp.variableValues || {}).every(key => String(r[key]) === String(exp.variableValues[key]))
        );
        if (dsRow) expectedOutput = dsRow[config.expectedOutputCol];
      }

      for (const metric of config.metrics) {
        const prompt = `You are an evaluation assistant. Score the following AI output on a scale of 0-100.

Metric: ${metric}
User input: ${exp.interpolatedPrompt || exp.userTemplate}
AI output: ${exp.output}
${expectedOutput ? `Expected output: ${expectedOutput}` : ''}

Respond with only a JSON object: { "score": <number>, "reasoning": "<one sentence>" }`;

        try {
          const result = await callModel(scoringModel, "You are a helpful evaluation assistant.", prompt);
          const parsed = JSON.parse((result.output || '').match(/\{.*\}/s)?.[0] || '{}');
          if (typeof parsed.score === 'number') {
            const updated = {
              ...exp,
              scores: { ...(exp.scores || {}), [metric]: parsed.score },
              reasoning: { ...(exp.reasoning || {}), [metric]: parsed.reasoning || '' }
            };
            onUpdateExperiment(updated);
          }
        } catch (err) {
          console.error("AI Scoring failed for row", i, err);
        }
      }
    }
    setScoringProgress(null);
  };

  if (experiments.length === 0 && viewMode === 'existing') return <EvalEmptyState />;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden animate-in fade-in duration-300">
      <div className="flex gap-1 bg-panel border border-border p-1 rounded-lg w-fit mb-6 shrink-0">
        <button 
          onClick={() => setViewMode('existing')}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
            viewMode === 'existing' ? "bg-background text-primary shadow-sm" : "text-text-muted hover:text-text-main"
          )}
        >
          Existing Runs
        </button>
        <button 
          onClick={() => setViewMode('new')}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
            viewMode === 'new' ? "bg-background text-primary shadow-sm" : "text-text-muted hover:text-text-main"
          )}
        >
          Run New Batch
        </button>
      </div>

      {successBanner && (
        <div className="shrink-0 mb-6 bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <CheckCircle2 size={16} /> {successBanner}
          </div>
          <button onClick={() => setSuccessBanner('')}><X size={16} className="text-primary opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {viewMode === 'new' ? (
        <div className="flex-1 overflow-y-auto space-y-8 pr-2 scrollbar-thin">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Select Dataset</label>
                <select 
                  value={newBatchDatasetId}
                  onChange={e => setNewBatchDatasetId(e.target.value)}
                  className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text-main"
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {newBatchDatasetId && (
                  <div className="text-[10px] text-text-muted mt-2 font-mono">
                    {datasets.find(d => d.id === newBatchDatasetId)?.name} — {datasets.find(d => d.id === newBatchDatasetId)?.rows.length} rows · columns: {datasets.find(d => d.id === newBatchDatasetId)?.columns.join(', ')}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Prompt</label>
                <select
                  value={newBatchPromptId}
                  onChange={e => {
                    setNewBatchPromptId(e.target.value);
                    setNewBatchVersionId('');
                  }}
                  className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text-main"
                >
                  <option value="">Select a prompt...</option>
                  {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Prompt Version</label>
                <select 
                  value={newBatchVersionId}
                  onChange={e => setNewBatchVersionId(e.target.value)}
                  className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text-main"
                >
                  <option value="">Select a version...</option>
                  {promptVersions
                    .filter(v => v.promptId === newBatchPromptId)
                    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
                    .map(v => <option key={`${v.promptId}-${v.version}`} value={v.version}>v{v.version} — {v.commitMessage || 'Saved version'}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Model</label>
                <select 
                  value={newBatchModelId}
                  onChange={e => setNewBatchModelId(e.target.value)}
                  className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text-main"
                >
                  <option value="">Select a model...</option>
                  {models.filter(m => m.apiKey).map(m => <option key={m.id} value={m.id}>{m.provider} — {m.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Variable Mapping</label>
                {Object.keys(varMappings).length > 0 ? (
                  <div className="space-y-3 bg-panel/30 border border-border rounded-xl p-4">
                    {Object.keys(varMappings).map(vName => (
                      <div key={vName} className="flex items-center justify-between gap-4">
                        <span className="text-xs font-mono text-primary">{"{"}{vName}{"}"}</span>
                        <select 
                          value={varMappings[vName]}
                          onChange={e => setVarMappings({...varMappings, [vName]: e.target.value})}
                          className="flex-1 max-w-[200px] bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-primary text-text-main"
                        >
                          <option value="">Unmapped</option>
                          {datasets.find(d => d.id === newBatchDatasetId)?.columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted italic p-4 bg-panel/30 border border-dashed border-border rounded-xl">
                    Select a version to map variables
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Row Limit</label>
                <div className="flex gap-2">
                  {['all', '5', '10'].map(limit => (
                    <button 
                      key={limit}
                      onClick={() => setRowLimit(limit)}
                      className={cn(
                        "flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                        rowLimit === limit ? "bg-primary/10 border-primary text-primary" : "bg-panel border-border text-text-muted hover:border-primary/30"
                      )}
                    >
                      {limit === 'all' ? 'All Rows' : `First ${limit}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleRunNewBatch}
                  disabled={!newBatchDatasetId || !newBatchPromptId || !newBatchVersionId || !newBatchModelId || isRunningBatch}
                  className="w-full py-4 bg-primary text-panel font-black uppercase tracking-[0.2em] rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isRunningBatch ? <div className="w-4 h-4 border-2 border-panel border-t-transparent rounded-full animate-spin" /> : <Play size={18} fill="currentColor" />}
                  {isRunningBatch ? `Running Row ${batchProgress?.current} of ${batchProgress?.total}...` : 'Run Batch'}
                </button>
                {isRunningBatch && (
                  <button
                    onClick={() => {
                      cancelledRef.current = true;
                      setIsRunningBatch(false);
                    }}
                    className="w-full mt-2 text-xs font-bold text-red-400 hover:underline"
                  >
                    Cancel Execution
                  </button>
                )}
                {progressMessage && (
                  <div className="mt-2 text-xs text-text-muted">{progressMessage}</div>
                )}
                {batchResult && (
                  <div className="mt-2 text-xs text-text-muted">
                    Completed: {batchResult.successCount} success, {batchResult.failCount} failed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 space-y-6 mb-6">
            <div className="flex justify-between items-end">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Dataset</label>
                  <select 
                    value={selectedDatasetId}
                    onChange={e => setSelectedDatasetId(e.target.value)}
                    className="bg-panel border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-main min-w-[200px]"
                  >
                    <option value="all">All Datasets</option>
                    {datasets.filter(d => experiments.some(e => e.datasetId === d.id)).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Version</label>
                  <select 
                    value={selectedVersion}
                    onChange={e => setSelectedVersion(e.target.value)}
                    className="bg-panel border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-main min-w-[120px]"
                  >
                    <option value="all">All Versions</option>
                    {uniqueVersions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <button 
                onClick={() => setIsAIScoringOpen(true)}
                className="px-4 py-2 bg-primary text-panel font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 text-sm shadow-lg shadow-primary/10"
              >
                <Zap size={16} fill="currentColor" /> Score All with AI
              </button>
            </div>

            {summary && (
              <div className="bg-panel/50 border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex gap-8">
                  {METRICS.map(m => (
                    <div key={m} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{m}</span>
                      <span className={cn("text-lg font-bold font-mono", parseFloat(summary[m]) > 80 ? "text-primary" : "text-text-main")}>
                        {isNaN(summary[m]) ? '--' : `${summary[m]}%`}
                      </span>
                    </div>
                  ))}
                  <div className="w-[1px] bg-border mx-2"></div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Overall</span>
                    <span className="text-lg font-bold font-mono text-primary">{summary.Overall}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-text-muted mb-1">{summary.scoredCount} of {summary.totalCount} rows scored</div>
                  <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(summary.scoredCount / summary.totalCount) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {scoringProgress && (
            <div className="shrink-0 mb-6 bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-primary">AI Scoring in progress: {scoringProgress.current} of {scoringProgress.total}...</span>
              </div>
              <button onClick={() => setScoringProgress(null)} className="text-xs font-bold text-primary hover:underline">Cancel</button>
            </div>
          )}

          <div className="flex-1 overflow-auto border border-border rounded-xl bg-panel/30 scrollbar-thin">
            <table className="w-full text-left text-sm border-collapse table-auto">
              <thead>
                <tr className="bg-background/50 border-b border-border sticky top-0 z-10">
                  <th className="w-12 px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">#</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Input Variables</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest w-1/4">Output</th>
                  {METRICS.slice(0, 2).map(m => (
                    <th key={m} className="px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center w-24">{m}</th>
                  ))}
                  <th className="px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center w-32">Overall</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center w-24">Status</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {datasetExps.map((exp, idx) => {
                  const isExpanded = expandedRows.has(exp.id);
                  const rowOverall = METRICS.reduce((acc, m) => acc + (exp.scores?.[m] || 0), 0) / METRICS.length;
                  const hasScores = exp.scores && Object.keys(exp.scores).length > 0;

                  return (
                    <React.Fragment key={exp.id}>
                      <tr 
                        onClick={() => toggleRow(exp.id)}
                        className={cn(
                          "border-b border-border hover:bg-white/[0.02] transition-colors cursor-pointer group",
                          isExpanded && "bg-white/[0.03]"
                        )}
                      >
                        <td className="px-4 py-4 text-xs font-mono text-text-muted text-center">{idx + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(exp.variableValues || {}).map(([k, v]) => (
                              <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-border text-text-muted">
                                <span className="text-primary/70">{k}=</span>{String(v)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-text-main line-clamp-2 leading-relaxed opacity-80">
                            {exp.output || <span className="text-text-muted italic">No output</span>}
                          </p>
                        </td>
                        {METRICS.slice(0, 2).map(m => (
                          <td key={m} className="px-4 py-4 text-center">
                            <span className={cn(
                              "text-xs font-bold font-mono",
                              exp.scores?.[m] ? (exp.scores[m] > 80 ? "text-primary" : "text-text-main") : "text-text-muted opacity-30"
                            )}>
                              {exp.scores?.[m] ?? '--'}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
                              <div 
                                className={cn("h-full transition-all", hasScores ? "bg-primary" : "opacity-0")} 
                                style={{ width: `${rowOverall}%` }} 
                              />
                            </div>
                            <span className={cn("text-[10px] font-bold font-mono w-8 text-right", hasScores ? "text-text-main" : "text-text-muted opacity-30")}>
                              {hasScores ? `${rowOverall.toFixed(0)}%` : '--'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border",
                            exp.status === 'success' ? "bg-primary/10 text-primary border-primary/30" : "bg-red-500/10 text-red-400 border-red-500/30"
                          )}>
                            {exp.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-text-muted">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-white/[0.03] border-b border-border">
                          <td colSpan={8} className="p-0">
                            <div className="p-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                  <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest flex items-center gap-2">
                                    <MessageSquare size={12} /> Full Output
                                  </label>
                                  <div className="bg-background/50 border border-border rounded-lg p-4 text-sm leading-relaxed text-text-main whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-thin font-sans">
                                    {exp.output}
                                  </div>
                                </div>
                                <div className="space-y-6">
                                  <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest flex items-center gap-2">
                                    <Settings size={12} /> Detailed Scoring
                                  </label>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {METRICS.map(m => (
                                      <ScoreBar 
                                        key={m}
                                        label={m}
                                        score={exp.scores?.[m]}
                                        onChange={(val) => onUpdateExperiment({ ...exp, scores: { ...(exp.scores || {}), [m]: val } })}
                                        bg={m === 'Toxicity' ? "bg-amber-500" : "bg-primary"}
                                      />
                                    ))}
                                  </div>
                                  <div className="pt-4 space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest">Notes</label>
                                    <textarea 
                                      defaultValue={exp.notes}
                                      onBlur={(e) => onUpdateExperiment({ ...exp, notes: e.target.value })}
                                      placeholder="Add evaluation notes..."
                                      className="w-full bg-background border border-border rounded-lg p-3 text-xs text-text-main focus:outline-none focus:border-primary/50 transition-all h-20 resize-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isAIScoringOpen && (
        <AIScoringModal 
          dataset={datasets.find(d => d.id === selectedDatasetId)}
          onCancel={() => setIsAIScoringOpen(false)}
          onConfirm={handleRunAIScoring}
        />
      )}
    </div>
  );
}

function AIScoringModal({ dataset, onCancel, onConfirm }) {
  const [selectedMetrics, setSelectedMetrics] = useState(['Relevance', 'Correctness']);
  const [expectedOutputCol, setExpectedOutputCol] = useState('');

  const toggleMetric = (m) => {
    setSelectedMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] px-4 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap className="text-primary" size={20} fill="currentColor" /> AI Scoring Config
          </h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest block mb-3">Select Metrics to Score</label>
            <div className="grid grid-cols-2 gap-3">
              {METRICS.map(m => (
                <button 
                  key={m}
                  onClick={() => toggleMetric(m)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all text-xs font-medium",
                    selectedMetrics.includes(m) 
                      ? "bg-primary/10 border-primary/50 text-primary" 
                      : "bg-background border-border text-text-muted hover:border-primary/30"
                  )}
                >
                  {m}
                  {selectedMetrics.includes(m) && <CheckCircle2 size={14} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest block mb-2">Expected Output Reference</label>
            <select 
              value={expectedOutputCol}
              onChange={e => setExpectedOutputCol(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary text-text-main"
            >
              <option value="">None (General Evaluation)</option>
              {dataset?.columns?.map(col => (
                <option key={col} value={col}>Column: {col}</option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-2 flex items-start gap-1.5">
              <Info size={12} className="shrink-0" />
              Providing an expected output helps the AI score Correctness accurately.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-bold text-text-muted hover:text-text-main transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm({ metrics: selectedMetrics, expectedOutputCol })}
            disabled={selectedMetrics.length === 0}
            className="flex-1 py-2.5 bg-primary text-panel font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            Run AI Scoring
          </button>
        </div>
      </div>
    </div>
  );
}

function EvalEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
        <FlaskConical size={40} />
      </div>
      <h2 className="text-2xl font-bold mb-2 text-text-main">No evaluation data yet</h2>
      <p className="text-text-muted text-center max-w-md mb-8">
        Run some prompts in Prompt Studio or use the "Run New Batch" mode to generate outputs.
      </p>
      <button 
        onClick={() => window.location.hash = '#/prompt-studio'}
        className="px-6 py-3 bg-primary text-panel font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2"
      >
        Go to Prompt Studio <ChevronRight size={18} />
      </button>
    </div>
  );
}

function EvalPanel({ exp, isWinner, isTie, onUpdateScore }) {
  if (!exp) {
    return (
      <div className="glass-panel rounded-xl flex items-center justify-center border-dashed border-2 border-border/50">
        <div className="text-center p-8">
          <AlertCircle className="mx-auto text-text-muted opacity-30 mb-4" size={40} />
          <p className="text-text-muted font-medium">Select an experiment to compare</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "glass-panel rounded-xl flex flex-col overflow-y-auto transition-all duration-500",
      isWinner ? "border-primary/50 ring-1 ring-primary/20 shadow-lg shadow-primary/5" : "border-border",
      isTie ? "border-amber-500/50 ring-1 ring-amber-500/20" : ""
    )}>
      <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <span className={cn(
            "font-mono text-xs px-2 py-0.5 rounded border transition-colors",
            isWinner ? "bg-primary/20 text-primary border-primary/50" : "bg-panel text-text-muted border-border"
          )}>{exp.version}</span>
          <span className="text-sm font-bold tracking-tight text-text-main">{exp.modelId}</span>
          <span className="text-[10px] text-text-muted uppercase font-mono bg-white/5 px-1.5 py-0.5 rounded">{exp.provider}</span>
        </div>
        {isWinner && <div className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-tighter bg-primary/10 px-2 py-1 rounded-full"><CheckCircle2 size={12} /> WINNER</div>}
        {isTie && <div className="text-[10px] font-black text-amber-500 flex items-center gap-1 uppercase tracking-tighter bg-amber-500/10 px-2 py-1 rounded-full">TIE</div>}
      </div>

      <div className="p-5 space-y-6 flex-1 text-text-main">
        {/* Output */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest flex justify-between">
            Output
            <span className="font-mono text-[9px] lowercase opacity-50">{exp.output?.length || 0} chars</span>
          </label>
          <div className="min-h-[200px] bg-background/50 border border-border rounded-lg p-4 text-sm font-sans whitespace-pre-wrap break-words text-text-main leading-relaxed">
            {exp.output || <span className="text-text-muted italic">No output recorded</span>}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-panel/50 rounded-lg border border-border/50">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase font-bold text-text-muted tracking-tighter flex items-center gap-1"><Zap size={10} /> Latency</span>
            <span className="text-xs font-mono text-text-main">{exp.latencyMs || exp.latency || 0}ms</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase font-bold text-text-muted tracking-tighter flex items-center gap-1"><TrendingUp size={10} /> Tokens</span>
            <span className="text-xs font-mono text-text-main">{exp.totalTokens || exp.tokens || 0}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase font-bold text-text-muted tracking-tighter flex items-center gap-1"><Coins size={10} /> Cost</span>
            <span className="text-xs font-mono text-text-main">${typeof exp.costEstimate === 'number' ? exp.costEstimate.toFixed(4) : (exp.cost || 0)}</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-4 pt-2 pb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-widest">Metrics & Scoring</label>
          </div>
          {METRICS.map(metric => (
            <ScoreBar 
              key={metric}
              label={metric} 
              score={(exp.scores || {})[metric]} 
              onChange={(val) => onUpdateScore(metric, val)}
              bg={metric === 'Toxicity' ? "bg-amber-500" : "bg-primary"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, onChange, bg = "bg-primary" }) {
  const hasScore = typeof score === 'number';
  const displayScore = hasScore ? score : 0;

  return (
    <div className="group space-y-1.5">
      <div className="flex justify-between items-end text-[10px]">
        <span className="text-text-muted font-medium">{label}</span>
        <span className={cn("font-mono font-bold", hasScore ? "text-text-main" : "text-text-muted italic")}>
          {hasScore ? `${score}%` : 'Click to score'}
        </span>
      </div>
      <div className="relative h-2 flex items-center group/slider">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={displayScore}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
          <div 
            className={cn("h-full transition-all duration-300", bg, !hasScore && "opacity-0")} 
            style={{ width: `${displayScore}%` }} 
          />
        </div>
        <div 
          className="absolute h-3 w-3 bg-white rounded-full border-2 border-primary shadow-sm pointer-events-none opacity-0 group-hover/slider:opacity-100 transition-opacity"
          style={{ left: `calc(${displayScore}% - 6px)` }}
        />
      </div>
    </div>
  );
}
