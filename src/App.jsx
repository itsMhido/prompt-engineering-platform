import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Database, TerminalSquare, FlaskConical, Target, 
  Play, Plus, Settings2, GitCommit, Copy, CheckCircle2,
  AlertTriangle, Clock, Activity, HardDrive, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const PROMPT_VERSIONS = [
  { id: 'v3', diff: '+ Added context variable' },
  { id: 'v2', diff: '~ Tweaked temperature instruction' },
  { id: 'v1', diff: 'Initial version' },
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
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.05)]" 
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 border-teal-500/30">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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
  const [systemPrompt, setSystemPrompt] = useState("You are an expert medical assistant. Reply in structured json.");
  const [userPrompt, setUserPrompt] = useState("Patient shows symptoms of {symptom_1} and {symptom_2}. Patient age is {age}. Provide a diagnosis.");
  const [variables, setVariables] = useState({});
  const [isHoveringRun, setIsHoveringRun] = useState(false);
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeVersion, setActiveVersion] = useState('v3');

  // Regex to extract variables formatted as {variable_name}
  const variableRegex = /\{([\w_]+)\}/g;
  
  // Extract variables on user prompt change
  useEffect(() => {
    const matches = Array.from(userPrompt.matchAll(variableRegex));
    const newVars = {};
    matches.forEach(match => {
      newVars[match[1]] = variables[match[1]] || "";
    });
    setVariables(newVars);
  }, [userPrompt]);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setOutput({
        text: '{\n  "diagnosis": "Common Cold",\n  "confidence": 0.85,\n  "recommended_action": "Rest and hydration"\n}',
        latency: '420ms',
        tokens: 156,
        cost: '$0.0014'
      });
      setIsRunning(false);
    }, 1200);
  };

  // Helper to render prompt with highlighted variables
  const renderHighlightedText = (text) => {
    const parts = text.split(/(\{[\w_]+\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{[\w_]+\}$/)) {
        return <span key={i} className="text-primary bg-primary/10 px-1 rounded font-mono">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex h-full animate-in fade-in duration-300">
      {/* Version Sidebar */}
      <div className="w-48 border-r border-border bg-panel/30 flex flex-col pt-4">
        <div className="px-4 mb-4 text-xs font-mono text-text-muted uppercase tracking-wider">History</div>
        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {PROMPT_VERSIONS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveVersion(v.id)}
              className={cn(
                "w-full text-left p-3 rounded-md transition-all border",
                activeVersion === v.id 
                  ? "bg-primary/5 border-primary/30" 
                  : "bg-transparent border-transparent hover:bg-white/5"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "font-mono text-xs px-2 py-0.5 rounded-full border",
                  activeVersion === v.id 
                    ? "bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(0,240,255,0.2)]" 
                    : "bg-panel text-text-muted border-border"
                )}>{v.id}</span>
                {activeVersion === v.id && <GitCommit size={14} className="text-primary" />}
              </div>
              <div className="text-xs text-text-muted truncate mt-1">{v.diff}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Pane */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="p-4 border-b border-border flex justify-between items-center bg-panel/50">
          <div className="flex items-center gap-2">
            <TerminalSquare size={18} className="text-primary" />
            <span className="font-medium">Editor</span>
          </div>
          <button className="text-xs flex items-center gap-1 text-text-muted hover:text-text-main transition-colors">
            <Copy size={14} /> Copy JSON
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* System Prompt container */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Settings2 size={12}/> System Prompt
            </label>
            <textarea
              className="w-full bg-panel border border-border rounded-md p-3 text-text-main font-sans resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px]"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* User Prompt container */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
              <AlertTriangle size={12}/> User Template
            </label>
            <div className="relative group">
               {/* Syntax highlighted background layer (mocked by overlapping div) for real editor feel */}
               <div className="absolute inset-0 p-3 pointer-events-none text-transparent whitespace-pre-wrap font-sans break-words border border-transparent">
                  {renderHighlightedText(userPrompt)}
               </div>
              <textarea
                className="w-full bg-panel border border-border rounded-md p-3 text-text-main/80 font-sans resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[150px] relative z-10 bg-transparent caret-primary"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
              />
              <div className="absolute inset-0 bg-panel -z-10 rounded-md"></div>
            </div>
            <div className="text-xs text-text-muted">Use <span className="font-mono text-primary bg-primary/10 px-1 rounded">{'{variable}'}</span> syntax to interpolate values.</div>
          </div>

          {/* Variables Injection Panel */}
          {Object.keys(variables).length > 0 && (
            <div className="space-y-3 bg-panel/30 border border-border rounded-md p-4">
              <label className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
                <Database size={12}/> Variables
              </label>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(variables).map(varName => (
                  <div key={varName}>
                    <label className="block text-xs font-mono mb-1 text-primary">{varName}</label>
                    <input 
                      type="text"
                      value={variables[varName]}
                      onChange={(e) => setVariables({...variables, [varName]: e.target.value})}
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
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-teal-400" />
            <span className="font-medium">Output Preview</span>
          </div>
          <button 
            onMouseEnter={() => setIsHoveringRun(true)}
            onMouseLeave={() => setIsHoveringRun(false)}
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded bg-primary text-background font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
              isHoveringRun && !isRunning ? "shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-105" : ""
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
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                  <Clock size={12} className="text-amber-400" /> Latency: {output.latency}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                  <Activity size={12} className="text-primary" /> Tokens: {output.tokens}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-text-muted">
                  Cost: <span className="text-green-400">{output.cost}</span>
                </div>
              </div>
              <div className="bg-panel border border-border rounded-md p-4 group relative">
                <pre className="font-mono text-sm inline-block text-text-main whitespace-pre-wrap">{output.text}</pre>
                <button className="absolute top-2 right-2 p-1.5 bg-background border border-border rounded text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-main hover:border-primary/50">
                  <Copy size={14} />
                </button>
              </div>
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
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30 group-hover:shadow-[0_0_8px_rgba(0,240,255,0.2)] transition-shadow">
                      {exp.promptVersion}
                    </span>
                  </td>
                  <td className="px-6 py-4">{exp.model}</td>
                  <td className="px-6 py-4">{exp.dataset}</td>
                  <td className="px-6 py-4 font-mono text-xs">{exp.latency}</td>
                  <td className="px-6 py-4 font-mono text-xs text-green-400/80">{exp.cost}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
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

function ModelRegistry() {
  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Model Registry</h2>
          <p className="text-text-muted">Manage available LLMs and provider configurations.</p>
        </div>
        <button className="flex items-center gap-2 bg-text-main text-background px-4 py-2 rounded-md font-medium hover:bg-white transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <Plus size={16} /> Add Model
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_MODELS.map(model => (
          <div key={model.id} className="glass-panel rounded-lg p-5 hover:border-primary/50 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center">
                  <HardDrive size={20} className="text-text-muted group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{model.name}</h3>
                  <p className="text-text-muted text-xs">{model.provider}</p>
                </div>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border bg-panel border-border text-text-muted">
                {model.version}
              </span>
            </div>
            
            <div className="flex gap-2">
              <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted flex items-center gap-1.5">
                <Settings2 size={12}/> T: {model.temp}
              </div>
              <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted flex items-center gap-1.5">
                MAX: {model.tokens}
              </div>
            </div>
          </div>
        ))}
      </div>
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
      isWinner ? "border-primary/40 shadow-[0_0_30px_rgba(0,240,255,0.05)]" : ""
    )}>
      <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className={cn(
            "font-mono text-xs px-2 py-0.5 rounded-full border",
            isWinner 
              ? "bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(0,240,255,0.2)]" 
              : "bg-panel text-text-muted border-border"
          )}>{version}</span>
          <span className="text-sm font-medium">{model}</span>
        </div>
        {isWinner && <div className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle2 size={14}/> WINNER</div>}
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
