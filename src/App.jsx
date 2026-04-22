import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Database, TerminalSquare, FlaskConical, Target,
  Play, Plus, Settings2, GitCommit, Copy, CheckCircle2,
  AlertTriangle, Clock, Activity, HardDrive, ChevronRight,
  Trash2, Edit2, Eye, EyeOff
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { savePromptVersion, loadVersionHistory, callModel, loadModels, saveModel, validateModel, deleteModel } from './mockApi';

// Util for tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ---- MOCK DATA ----

const MOCK_MODELS = [
  { id: 'm1', name: 'gpt-4-turbo', provider: 'OpenAI', version: 'v1.0.2', temp: 0.7, tokens: 4096 },
  { id: 'm2', name: 'claude-3-opus', provider: 'Anthropic', version: 'v1.2.0', temp: 0.5, tokens: 8192 },
  { id: 'm3', name: 'gemini-1.5-pro', provider: 'Google', version: 'v1.5.0', temp: 0.2, tokens: 1000000 },
];

const MOCK_EXPERIMENTS = [
  { id: 'e1', promptVersion: 'v3', model: 'gpt-4-turbo', dataset: 'Medical Q&A', latency: '420ms', cost: '$0.002', score: 92, date: '2 mins ago' },
  { id: 'e2', promptVersion: 'v2', model: 'claude-3-opus', dataset: 'Medical Q&A', latency: '850ms', cost: '$0.005', score: 88, date: '1 hour ago' },
  { id: 'e3', promptVersion: 'v1', model: 'gpt-4-turbo', dataset: 'Finance Eval', latency: '380ms', cost: '$0.001', score: 75, date: '2 days ago' },
];

// ---- COMPONENTS ----

export default function App() {
  const [activeTab, setActiveTab] = useState('prompt-studio');

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-sm">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'prompt-studio' && <PromptStudio />}
          {activeTab === 'experiments' && <ExperimentsView />}
          {activeTab === 'models' && <ModelRegistry />}
          {activeTab === 'evaluations' && <EvaluationsView />}
          {activeTab === 'datasets' && (
            <div className="p-8 flex items-center justify-center h-full text-text-muted">
              Datasets module coming soon...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ---- NAVIGATION & LAYOUT ----

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'models', label: 'Models', icon: Box },
    { id: 'datasets', label: 'Datasets', icon: Database },
    { id: 'prompt-studio', label: 'Prompt Studio', icon: TerminalSquare },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'evaluations', label: 'Evaluations', icon: Target },
  ];

  return (
    <div className="w-64 glass-panel border-y-0 border-l-0 flex flex-col z-10">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-bold">
          PE
        </div>
        <span className="font-mono text-text-main font-bold tracking-tight">Prompt_Env</span>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group text-left",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-muted hover:bg-white/5 hover:text-text-main"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-text-main")} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 text-text-muted hover:text-text-main cursor-pointer transition-colors">
          <Settings2 size={18} />
          <span>Workspace Settings</span>
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="bg-panel border border-border px-3 py-1.5 rounded-md flex items-center gap-2">
          <span className="text-text-muted">Workspace:</span>
          <span className="font-medium">Acme Corp</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-mono text-xs text-primary">Active: gpt-4-turbo</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="font-medium text-sm">Alex Developer</span>
          <span className="text-xs text-text-muted">Admin</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-panel border-2 border-border overflow-hidden">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}

// ---- PROMPT STUDIO ----

function PromptStudio() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [variables, setVariables] = useState({});
  const [isHoveringRun, setIsHoveringRun] = useState(false);
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeVersion, setActiveVersion] = useState('');

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  // Sync scroll between textarea and highlight layer
  const textAreaRef = useRef(null);
  const highlightRef = useRef(null);

  const handleScroll = () => {
    if (textAreaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textAreaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textAreaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    loadVersionHistory('p1').then(data => {
      setHistory(data);
      setIsLoadingHistory(false);
      if (data.length > 0) {
        const latest = data[0];
        setActiveVersion(latest.version);
        setSystemPrompt(latest.systemPrompt);
        setUserPrompt(latest.userPrompt);
      }
    });

    loadModels().then(data => {
      setModels(data);
      if (data.length > 0) setSelectedModelId(data[0].id);
    });
  }, []);

  const handleSelectVersion = (versionId) => {
    const v = history.find(h => h.version === versionId);
    if (v) {
      setActiveVersion(v.version);
      setSystemPrompt(v.systemPrompt);
      setUserPrompt(v.userPrompt);
    }
  };

  const variableRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  useEffect(() => {
    const matches = Array.from(userPrompt.matchAll(variableRegex));
    setVariables(prev => {
      const newVars = {};
      matches.forEach(match => {
        newVars[match[1]] = prev[match[1]] || "";
      });
      return newVars;
    });
  }, [userPrompt]);

  const handleRun = async () => {
    if (!selectedModelId) return;
    setIsRunning(true);
    setOutput(null);
    try {
      const modelObj = models.find(m => m.id === selectedModelId);
      if (!modelObj || !modelObj.apiKey) {
        setOutput({ error: "Add an API key in Model Management" });
        setIsRunning(false);
        return;
      }
      // Interpolate variables
      let interpolatedUserMessage = userPrompt;
      Object.keys(variables).forEach(key => {
        const value = variables[key] || `{${key}}`; // leave as-is if empty
        interpolatedUserMessage = interpolatedUserMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
      const result = await callModel(modelObj, systemPrompt, interpolatedUserMessage);
      setOutput({
        text: result.text,
        latency: result.latency,
        tokens: result.tokens.total,
        cost: result.cost
      });
    } catch (error) {
      setOutput({ error: error.message });
    }
    setIsRunning(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await savePromptVersion({ 
      id: 'p1', 
      systemPrompt, 
      userPrompt,
      commitMessage: commitMessage || 'Saved draft version'
    });
    const updatedHistory = await loadVersionHistory('p1');
    setHistory(updatedHistory);
    if (updatedHistory.length > 0) setActiveVersion(updatedHistory[0].version);
    setIsSaving(false);
    setShowSavedBadge(true);
    setCommitMessage('');
    setTimeout(() => setShowSavedBadge(false), 2000);
  };

  const handleCopyJSON = () => {
    const payload = JSON.stringify({ systemPrompt, userPrompt, variables }, null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handleCopyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output.text);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  // Helper to render prompt with highlighted variables
  const renderHighlightedText = (text) => {
    if (!text) return null;
    let lastIndex = 0;
    const nodes = [];
    let match;
    const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(<span key={`text-${lastIndex}`} className="text-text-main">{text.substring(lastIndex, match.index)}</span>);
      }
      nodes.push(
        <span key={`var-${match.index}`} className="font-mono text-primary bg-primary/20 px-0.5 rounded">
          {match[0]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      nodes.push(<span key={`text-${lastIndex}`} className="text-text-main">{text.substring(lastIndex)}</span>);
    }
    return <>{nodes}{text.endsWith('\n') ? <br /> : null}</>;
  };

  return (
    <div className="flex h-full animate-in fade-in duration-300">
      {/* Version Sidebar */}
      <div className="w-48 border-r border-border bg-panel/30 flex flex-col pt-4">
        <div className="px-4 mb-4 text-xs font-mono text-text-muted uppercase tracking-wider">History</div>
        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {isLoadingHistory ? (
            <div className="px-2 space-y-2 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-panel rounded-md" />
              ))}
            </div>
          ) : history.map(v => (
            <button
              key={v.version}
              onClick={() => handleSelectVersion(v.version)}
              className={cn(
                "w-full text-left p-3 rounded-md transition-all border",
                activeVersion === v.version
                  ? "bg-primary/5 border-primary/30"
                  : "bg-transparent border-transparent hover:bg-white/5"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "font-mono text-xs px-2 py-0.5 rounded border",
                  activeVersion === v.version
                    ? "bg-primary/20 text-primary border-primary/50"
                    : "bg-panel text-text-muted border-border"
                )}>{v.label}</span>
                {activeVersion === v.version && <GitCommit size={14} className="text-primary" />}
              </div>
              <div className="text-xs text-text-muted truncate mt-1">{v.description}</div>
              <div className="text-[10px] text-text-muted/60 mt-1">{v.createdAtDisplay}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Pane */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="p-4 border-b border-border flex justify-between items-center gap-4 bg-panel/50">
          <div className="flex items-center gap-2">
            <TerminalSquare size={18} className="text-primary" />
            <span className="font-medium">Editor</span>
          </div>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (optional)"
              className="flex-1 max-w-xs bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-text-main placeholder-text-muted"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSaving) handleSave(); }}
            />
          </div>
          <div className="flex items-center gap-3">
            {showSavedBadge && (
              <span className="text-xs text-primary font-medium animate-in fade-in zoom-in duration-200">
                Saved ✓
              </span>
            )}
            <button onClick={handleSave} disabled={isSaving} className="text-xs flex items-center gap-1 text-text-muted hover:text-text-main transition-colors">
              <Database size={14} /> {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCopyJSON} className="text-xs flex items-center gap-1 text-text-muted hover:text-text-main transition-colors">
              {copiedJSON ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />} 
              {copiedJSON ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* System Prompt container */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Settings2 size={12} /> System Prompt
            </label>
            <textarea
              className="w-full bg-panel border border-border rounded-md p-3 text-text-main font-sans resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px]"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
              <AlertTriangle size={12} /> User Template
            </label>
            <div className="relative group min-h-[150px] bg-panel border border-border rounded-md focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all overflow-hidden flex flex-col">
              {/* Syntax highlighted background layer */}
              <div
                ref={highlightRef}
                className="absolute inset-0 p-3 pointer-events-none whitespace-pre-wrap font-sans break-words bg-transparent overflow-y-auto scrollbar-hide text-transparent"
              >
                {renderHighlightedText(userPrompt)}
              </div>
              <textarea
                ref={textAreaRef}
                onScroll={handleScroll}
                className="absolute inset-0 w-full h-full p-3 font-sans resize-none focus:outline-none bg-transparent caret-primary scrollbar-hide text-transparent"
                style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
              />
            </div>
            <div className="text-xs text-text-muted">Use <span className="font-mono text-primary bg-primary/10 px-1 rounded">{'{variable}'}</span> syntax to interpolate values.</div>
          </div>

          {/* Variables Injection Panel */}
          {Object.keys(variables).length > 0 && (
            <div className="space-y-3 bg-panel/30 border border-border rounded-md p-4">
              <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
                <Database size={12} /> Variables
              </label>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(variables).map(varName => (
                  <div key={varName}>
                    <label className="block text-xs font-mono mb-1 text-primary">{varName}</label>
                    <input
                      type="text"
                      value={variables[varName]}
                      onChange={(e) => setVariables({ ...variables, [varName]: e.target.value })}
                      className="w-full bg-background border border-border rounded px-3 py-1.5 focus:outline-none focus:border-primary/50 text-sm"
                      placeholder={`Value for ${varName}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Output / Preview Pane */}
      <div className="w-[45%] flex flex-col bg-background min-w-0">
        <div className="p-4 border-b border-border flex justify-between items-center bg-panel/50">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-primary hidden sm:block" />
            <span className="font-medium hidden sm:block">Output Preview</span>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="bg-background border border-border rounded px-3 py-1 text-xs font-medium focus:outline-none focus:border-primary/50 text-text-main max-w-[200px] truncate"
            >
              {models.filter(m => m.status === 'active').map(m => (
                <option key={m.id} value={m.id} disabled={!m.apiKey}>
                  {m.provider} - {m.name} {!m.apiKey ? '(No Key)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onMouseEnter={() => setIsHoveringRun(true)}
            onMouseLeave={() => setIsHoveringRun(false)}
            onClick={handleRun}
            disabled={isRunning || !selectedModelId || !models.find(m => m.id === selectedModelId)?.apiKey}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded bg-primary text-panel font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
              isHoveringRun && !isRunning ? "scale-105" : ""
            )}
          >
            {isRunning ? (
              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {isRunning ? 'Running...' : 'Run Prompt'}
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {output ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {output.error ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                    <AlertTriangle size={16} />
                    API Error
                  </div>
                  <p className="text-red-300 text-sm">{output.error}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                      <Clock size={12} className="text-amber-400" /> Latency: {output.latency}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                      <Activity size={12} className="text-primary" /> Tokens: {output.tokens}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                      💰 {output.cost}
                    </div>
                  </div>
                  <div className="bg-panel border border-border rounded-md p-4 group relative">
                    <pre className="font-mono text-sm inline-block text-text-main whitespace-pre-wrap">{output.text}</pre>
                    <button onClick={handleCopyOutput} className="absolute top-2 right-2 p-1.5 bg-background border border-border rounded text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-main hover:border-primary/50">
                      {copiedOutput ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50">
              <FlaskConical size={48} className="mb-4" />
              <p>Hit "Run Prompt" to see the output.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- EXPERIMENTS DASHBOARD ----

function ExperimentsView() {
  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            Experiments
          </h2>
          <p className="text-text-muted">Track and compare prompt performance over time.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Filter by model..."
            className="bg-panel border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 bg-panel border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Version</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Model</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Dataset</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Latency</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Cost</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Score</th>
                <th className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-text-muted">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MOCK_EXPERIMENTS.map(exp => (
                <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30 transition-shadow">
                      {exp.promptVersion}
                    </span>
                  </td>
                  <td className="px-6 py-4">{exp.model}</td>
                  <td className="px-6 py-4">{exp.dataset}</td>
                  <td className="px-6 py-4 font-mono text-xs">{exp.latency}</td>
                  <td className="px-6 py-4 font-mono text-xs text-green-500/80">{exp.cost}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden border border-border">
                        <div className="h-full bg-primary" style={{ width: `${exp.score}%` }} />
                      </div>
                      <span className="font-mono text-xs">{exp.score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-xs">{exp.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- MODEL REGISTRY ----

const PROVIDER_DEFAULTS = {
  OpenAI: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelId: 'gpt-4-turbo'
  },
  Anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelId: 'claude-3-5-sonnet-20241022'
  },
  Google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    modelId: 'gemini-1.5-pro'
  },
  Mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    modelId: 'mistral-large-latest'
  },
  Groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelId: 'llama-3.1-8b-instant'
  },
  Custom: {
    endpoint: '',
    modelId: ''
  }
};

function ModelRegistry() {
  const [models, setModels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'OpenAI',
    modelId: '',
    endpoint: '',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    stopSequences: [],
    status: 'active'
  });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadModels().then(setModels);
  }, []);

  const handleProviderChange = (provider) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setFormData(prev => ({
      ...prev,
      provider,
      modelId: defaults.modelId,
      endpoint: defaults.endpoint
    }));
  };

  const handleSave = async () => {
    const modelToSave = editingModel ? { ...editingModel, ...formData } : { ...formData, id: `m${Date.now()}` };
    const saved = await saveModel(modelToSave);
    setModels(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setIsModalOpen(false);
    setEditingModel(null);
    setFormData({
      name: '',
      provider: 'OpenAI',
      modelId: '',
      endpoint: '',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      stopSequences: [],
      status: 'active'
    });
    setShowApiKey(false);
  };

  const handleEdit = (model) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      apiKey: model.apiKey,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      topP: model.topP,
      stopSequences: model.stopSequences || [],
      status: model.status
    });
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleDuplicate = (model) => {
    setEditingModel(null);
    setFormData({
      name: `${model.name} Copy`,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      apiKey: '', // Don't copy API key
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      topP: model.topP,
      stopSequences: model.stopSequences || [],
      status: model.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to remove this model?")) {
      await deleteModel(id);
      setModels(prev => prev.filter(m => m.id !== id));
    }
  };

  const getProviderColor = (provider) => {
    const colors = {
      OpenAI: 'bg-blue-500',
      Anthropic: 'bg-orange-500',
      Google: 'bg-green-500',
      Mistral: 'bg-purple-500',
      Groq: 'bg-yellow-600',
      Custom: 'bg-gray-500'
    };
    return colors[provider] || 'bg-gray-500';
  };

  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Model Management</h2>
          <p className="text-text-muted">Configure and manage AI models for prompt execution.</p>
        </div>
        <button onClick={() => { setIsModalOpen(true); setEditingModel(null); handleProviderChange('OpenAI'); }} className="flex items-center gap-2 bg-primary text-panel px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Add Model
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map(model => (
          <div key={model.id} className="glass-panel rounded-lg p-5 hover:border-primary/50 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded ${getProviderColor(model.provider)} flex items-center justify-center text-white text-xs font-bold`}>
                  {model.provider[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{model.name}</h3>
                  <p className="text-text-muted text-sm">{model.provider}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={cn(
                  "font-mono text-xs px-2 py-0.5 rounded-full border",
                  model.status === 'active' ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-red-500/20 text-red-400 border-red-500/50"
                )}>
                  {model.status}
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(model)} className="p-1.5 rounded text-text-muted hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDuplicate(model)} className="p-1.5 rounded text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => handleDelete(model.id)} className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-text-muted">
                <strong>Model:</strong> {model.modelId}
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">
                  T: {model.temperature}
                </div>
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">
                  Max: {model.maxTokens}
                </div>
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">
                  P: {model.topP}
                </div>
              </div>
              {model.apiKey && (
                <div className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Key configured
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-panel border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{editingModel ? 'Edit Model' : 'Add New Model'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Model Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                    placeholder="e.g. GPT-4 Turbo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <select
                    value={formData.provider}
                    onChange={e => handleProviderChange(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                  >
                    <option>OpenAI</option>
                    <option>Anthropic</option>
                    <option>Google</option>
                    <option>Mistral</option>
                    <option>Groq</option>
                    <option>Custom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Model ID / Version</label>
                  <input
                    type="text"
                    value={formData.modelId}
                    onChange={e => setFormData({...formData, modelId: e.target.value})}
                    className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                    placeholder="e.g. gpt-4-turbo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base URL / Endpoint</label>
                  <input
                    type="text"
                    value={formData.endpoint}
                    onChange={e => setFormData({...formData, endpoint: e.target.value})}
                    className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <div className="relative">
                  {editingModel && !showApiKey ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value="••••••••••••"
                        readOnly
                        className="flex-1 bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(true)}
                        className="px-3 py-2 bg-primary text-panel rounded text-sm hover:bg-primary/90"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={formData.apiKey}
                        onChange={e => setFormData({...formData, apiKey: e.target.value})}
                        className="w-full bg-background border border-border rounded px-3 py-2 pr-10 focus:border-primary/50 outline-none"
                        placeholder="Enter API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </>
                  )}
                </div>
                {editingModel && formData.apiKey && showApiKey && (
                  <p className="text-xs text-text-muted mt-1">Editing will replace the saved key</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature}</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={formData.maxTokens}
                    onChange={e => setFormData({...formData, maxTokens: parseInt(e.target.value)})}
                    className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                  />
                  <div className="flex gap-1 mt-1">
                    {[256, 512, 1024, 4096].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData({...formData, maxTokens: preset})}
                        className="text-xs bg-background border border-border rounded px-2 py-1 hover:border-primary/50"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Top P: {formData.topP}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.topP}
                    onChange={e => setFormData({...formData, topP: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stop Sequences</label>
                <input
                  type="text"
                  value={formData.stopSequences.join(', ')}
                  onChange={e => setFormData({...formData, stopSequences: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                  className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none"
                  placeholder="Comma-separated stop sequences"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formData.status === 'inactive'}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    />
                    Inactive
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-text-muted hover:text-text-main transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-panel rounded hover:bg-primary/90 transition-colors">
                Save Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- EVALUATIONS VIEW ----

function EvaluationsView() {
  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300 flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0 bg-background pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Evaluations</h2>
          <p className="text-text-muted">Compare outputs and metrics side-by-side.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-panel border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary">
            <option>Dataset: Medical Q&A</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        <EvalPanel version="v2" score={88} model="claude-3-opus" />
        <EvalPanel version="v3" score={92} model="gpt-4-turbo" isWinner />
      </div>
    </div>
  );
}

function EvalPanel({ version, score, model, isWinner }) {
  return (
    <div className={cn(
      "glass-panel rounded-lg flex flex-col overflow-hidden",
      isWinner ? "border-primary/40 ring-1 ring-primary/20" : ""
    )}>
      <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className={cn(
            "font-mono text-xs px-2 py-0.5 rounded border",
            isWinner
              ? "bg-primary/20 text-primary border-primary/50"
              : "bg-panel text-text-muted border-border"
          )}>{version}</span>
          <span className="text-sm font-medium">{model}</span>
        </div>
        {isWinner && <div className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle2 size={14} /> WINNER</div>}
      </div>

      <div className="p-4 space-y-4">
        {/* Output */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase text-text-muted">Output</label>
          <div className="bg-background border border-border rounded p-3 text-sm font-sans whitespace-pre-wrap text-text-main h-40 overflow-y-auto">
            {"{\n  \"diagnosis\": \"Common Cold\",\n  \"confidence\": 0.85,\n  \"recommended_action\": \"Rest and hydration\"\n}"}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3 pt-2">
          <ScoreBar label="Relevance" score={score + 3} />
          <ScoreBar label="Correctness" score={score} />
          <ScoreBar label="Toxicity" score={3} isReversed bg="bg-amber-500" />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, bg = "bg-primary", isReversed = false }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono">{score}%</span>
      </div>
      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
        <div className={cn("h-full transition-all duration-1000", bg)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
