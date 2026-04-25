import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Database, TerminalSquare, FlaskConical, Target,
  Play, Plus, Settings2, Copy, CheckCircle2,
  AlertTriangle, Clock, Activity, HardDrive, ChevronRight,
  Trash2, Edit2, Eye, EyeOff
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { savePromptVersion, loadVersionHistory, callModel, loadModels, saveModel, validateModel, deleteModel, saveExperiment, loadExperiments, deleteExperiment, updateExperimentScore, updateExperimentNotes, updateExperimentTags } from './mockApi';

const PROMPT_DRAFT_KEY = 'pe_draft';

function readLocalStorageJSON(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadPromptDraft() {
  const draft = readLocalStorageJSON(PROMPT_DRAFT_KEY, null);
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null;
  }

  return {
    systemPrompt: typeof draft.systemPrompt === 'string' ? draft.systemPrompt : '',
    userPrompt: typeof draft.userPrompt === 'string' ? draft.userPrompt : '',
    variables: draft.variables && typeof draft.variables === 'object' && !Array.isArray(draft.variables) ? draft.variables : {},
    selectedModelId: typeof draft.selectedModelId === 'string' ? draft.selectedModelId : '',
    activeVersion: typeof draft.activeVersion === 'string' ? draft.activeVersion : '',
    savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : null
  };
}

function getVariableNames(prompt) {
  if (!prompt) return [];
  return Array.from(new Set(
    Array.from(prompt.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)).map(match => match[1])
  ));
}

function syncVariablesWithPrompt(prompt, previousVariables = {}) {
  return getVariableNames(prompt).reduce((acc, variableName) => {
    acc[variableName] = previousVariables[variableName] || "";
    return acc;
  }, {});
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} min ago`;
  return 'just now';
}

function getComparableVersionState(source, fallbackSelectedModelId = '') {
  const hasSelectedModelId = source && Object.prototype.hasOwnProperty.call(source, 'selectedModelId');
  return JSON.stringify({
    systemPrompt: source?.systemPrompt || '',
    userPrompt: source?.userPrompt || '',
    selectedModelId: hasSelectedModelId ? (source.selectedModelId || '') : fallbackSelectedModelId
  });
}

// Util for tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ---- MOCK DATA ----

const MOCK_MODELS = [
  { id: 'm1', name: 'gpt-4-turbo', provider: 'OpenAI', version: 'v1.0.2', temp: 0.7, tokens: 4096 },
  { id: 'm2', name: 'claude-3-opus', provider: 'Anthropic', version: 'v1.2.0', temp: 0.5, tokens: 8192 },
  { id: 'm3', name: 'gemini-2.5-flash', provider: 'Google', version: 'v2.5.0', temp: 0.2, tokens: 1048576 },
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
  const initialDraftRef = useRef(loadPromptDraft());
  const autosaveTimerRef = useRef(null);
  const latestDraftRef = useRef('');
  const latestEditorStateRef = useRef(initialDraftRef.current || null);
  const saveInputRef = useRef(null);

  const [systemPrompt, setSystemPrompt] = useState(initialDraftRef.current?.systemPrompt || "");
  const [userPrompt, setUserPrompt] = useState(initialDraftRef.current?.userPrompt || "");
  const [variables, setVariables] = useState(() => syncVariablesWithPrompt(
    initialDraftRef.current?.userPrompt || "",
    initialDraftRef.current?.variables || {}
  ));
  const [isHoveringRun, setIsHoveringRun] = useState(false);
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeVersion, setActiveVersion] = useState(initialDraftRef.current?.activeVersion || '');

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaveComposerOpen, setIsSaveComposerOpen] = useState(false);
  const [pendingLoadVersion, setPendingLoadVersion] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraftRef.current?.savedAt || null);
  const [isAutosavePending, setIsAutosavePending] = useState(false);
  const [draftStatusLabel, setDraftStatusLabel] = useState('');
  const [statusTick, setStatusTick] = useState(Date.now());
  const [versionNotice, setVersionNotice] = useState('');
  const [variableResetNotice, setVariableResetNotice] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(initialDraftRef.current?.selectedModelId || '');

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

      if (initialDraftRef.current) {
        setActiveVersion(initialDraftRef.current.activeVersion || data[0]?.version || '');
        setIsHydrated(true);
        return;
      }

      if (data.length > 0) {
        const latest = data[0];
        setActiveVersion(latest.version || '');
        setSystemPrompt(latest.systemPrompt || "");
        setUserPrompt(latest.userPrompt || "");
        setVariables(syncVariablesWithPrompt(latest.userPrompt || "", {}));
      }

      setIsHydrated(true);
    });

    loadModels().then(data => {
      setModels(data);
      setSelectedModelId(currentSelectedModelId => currentSelectedModelId || data[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    setVariables(prev => syncVariablesWithPrompt(userPrompt, prev));
  }, [userPrompt]);

  useEffect(() => {
    latestEditorStateRef.current = {
      systemPrompt,
      userPrompt,
      variables,
      selectedModelId,
      activeVersion
    };
  }, [systemPrompt, userPrompt, variables, selectedModelId, activeVersion]);

  useEffect(() => {
    if (!isHydrated) return;

    const draftPayload = {
      systemPrompt,
      userPrompt,
      variables,
      selectedModelId,
      activeVersion
    };
    const serializedDraft = JSON.stringify(draftPayload);

    if (serializedDraft === latestDraftRef.current) {
      setIsAutosavePending(false);
      return;
    }

    setIsAutosavePending(true);
    setDraftStatusLabel('');
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const savedAt = new Date().toISOString();
      const didWrite = writeLocalStorageJSON(PROMPT_DRAFT_KEY, { ...draftPayload, savedAt });
      if (didWrite) {
        latestDraftRef.current = serializedDraft;
        setDraftSavedAt(savedAt);
        setStatusTick(Date.now());
      }
      setIsAutosavePending(false);
    }, 800);

    return () => clearTimeout(autosaveTimerRef.current);
  }, [systemPrompt, userPrompt, variables, selectedModelId, activeVersion, isHydrated]);

  useEffect(() => {
    if (!draftSavedAt) return undefined;
    const interval = setInterval(() => setStatusTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [draftSavedAt]);

  useEffect(() => {
    if (!variableResetNotice) return undefined;
    const timeout = setTimeout(() => setVariableResetNotice(''), 3000);
    return () => clearTimeout(timeout);
  }, [variableResetNotice]);

  useEffect(() => {
    if (isSaveComposerOpen && saveInputRef.current) {
      saveInputRef.current.focus();
      saveInputRef.current.select();
    }
  }, [isSaveComposerOpen]);

  useEffect(() => () => {
    clearTimeout(autosaveTimerRef.current);
    if (!latestEditorStateRef.current) return;
    const serializedDraft = JSON.stringify(latestEditorStateRef.current);
    if (serializedDraft === latestDraftRef.current) return;
    const savedAt = new Date().toISOString();
    if (writeLocalStorageJSON(PROMPT_DRAFT_KEY, { ...latestEditorStateRef.current, savedAt })) {
      latestDraftRef.current = serializedDraft;
    }
  }, []);

  const latestVersion = history[0] || null;
  const latestComparableState = latestVersion
    ? getComparableVersionState(latestVersion, selectedModelId)
    : null;
  const currentDraftComparableState = getComparableVersionState({ systemPrompt, userPrompt, selectedModelId });
  const hasVersionChanges = latestVersion
    ? currentDraftComparableState !== latestComparableState
    : Boolean(systemPrompt || userPrompt || selectedModelId);
  const autosaveText = isAutosavePending
    ? 'Saving...'
    : draftStatusLabel
      ? draftStatusLabel
      : draftSavedAt
        ? `Draft saved ${timeAgo(draftSavedAt)}`
        : '';
  const showSavedBadge = false;
  void statusTick;

  const persistDraftImmediately = (nextDraft, statusLabel = '') => {
    clearTimeout(autosaveTimerRef.current);
    const serializedDraft = JSON.stringify(nextDraft);
    const savedAt = new Date().toISOString();
    const didWrite = writeLocalStorageJSON(PROMPT_DRAFT_KEY, { ...nextDraft, savedAt });
    if (didWrite) {
      latestDraftRef.current = serializedDraft;
      setDraftSavedAt(savedAt);
      setStatusTick(Date.now());
      setDraftStatusLabel(statusLabel);
    }
    setIsAutosavePending(false);
  };

  const markUserEdit = () => {
    setPendingLoadVersion(null);
    setDraftStatusLabel('');
    if (versionNotice) {
      setVersionNotice('');
    }
  };

  const applyVersion = (versionToLoad) => {
    const nextSelectedModelId = Object.prototype.hasOwnProperty.call(versionToLoad, 'selectedModelId')
      ? (versionToLoad.selectedModelId || '')
      : selectedModelId;
    const nextVariables = syncVariablesWithPrompt(versionToLoad.userPrompt || "", {});

    setSystemPrompt(versionToLoad.systemPrompt || "");
    setUserPrompt(versionToLoad.userPrompt || "");
    setVariables(nextVariables);
    setSelectedModelId(nextSelectedModelId);
    setActiveVersion(versionToLoad.version);
    setPendingLoadVersion(null);
    setVersionNotice(`Viewing ${versionToLoad.version} — editing creates a new draft`);
    setVariableResetNotice(`Variable values cleared — loading version ${versionToLoad.version}`);

    persistDraftImmediately({
      systemPrompt: versionToLoad.systemPrompt || "",
      userPrompt: versionToLoad.userPrompt || "",
      variables: nextVariables,
      selectedModelId: nextSelectedModelId,
      activeVersion: versionToLoad.version
    });
  };

  const handleRequestLoadVersion = (versionId) => {
    const versionToLoad = history.find(version => version.version === versionId);
    if (!versionToLoad) return;

    if (!hasVersionChanges) {
      applyVersion(versionToLoad);
      return;
    }

    setPendingLoadVersion(versionId);
  };

  const handleRun = async () => {
    if (!selectedModelId) return;
    setIsRunning(true);
    setOutput(null);
    try {
      const modelObj = models.find(m => m.id === selectedModelId);
      if (!modelObj || !modelObj.apiKey) {
        const errorMsg = "Add an API key in Model Management";
        setOutput({ error: errorMsg });
        // Log failed run
        await saveExperiment({
          promptVersion: activeVersion,
          promptName: 'Untitled',
          model: modelObj?.name || 'Unknown',
          modelId: modelObj?.modelId || '',
          provider: modelObj?.provider || 'Unknown',
          systemPrompt: systemPrompt,
          userTemplate: userPrompt,
          variableValues: variables,
          interpolatedPrompt: '',
          output: '',
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costEstimate: '$0.00',
          status: 'error',
          errorMessage: errorMsg,
          tags: [],
          score: null,
          notes: ''
        });
        setIsRunning(false);
        return;
      }
      let interpolatedUserMessage = userPrompt;
      Object.keys(variables).forEach(key => {
        const value = variables[key] || `{${key}}`;
        interpolatedUserMessage = interpolatedUserMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
      const result = await callModel(modelObj, systemPrompt, interpolatedUserMessage);
      setOutput({
        text: result.text,
        latency: result.latency,
        tokens: result.tokens.total,
        cost: result.cost
      });
      // Log successful run
      await saveExperiment({
        promptVersion: activeVersion,
        promptName: 'Untitled',
        model: modelObj.name,
        modelId: modelObj.modelId,
        provider: modelObj.provider,
        systemPrompt: systemPrompt,
        userTemplate: userPrompt,
        variableValues: variables,
        interpolatedPrompt: interpolatedUserMessage,
        output: result.text,
        latencyMs: result.latencyMs,
        inputTokens: result.tokens.input,
        outputTokens: result.tokens.output,
        totalTokens: result.tokens.total,
        costEstimate: result.cost,
        status: 'success',
        errorMessage: null,
        tags: [],
        score: null,
        notes: ''
      });
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      setOutput({ error: errorMsg });
      // Log failed run
      const modelObj = models.find(m => m.id === selectedModelId);
      await saveExperiment({
        promptVersion: activeVersion,
        promptName: 'Untitled',
        model: modelObj?.name || 'Unknown',
        modelId: modelObj?.modelId || '',
        provider: modelObj?.provider || 'Unknown',
        systemPrompt: systemPrompt,
        userTemplate: userPrompt,
        variableValues: variables,
        interpolatedPrompt: '',
        output: '',
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costEstimate: '$0.00',
        status: 'error',
        errorMessage: errorMsg,
        tags: [],
        score: null,
        notes: ''
      });
    }
    setIsRunning(false);
  };

  const handleSave = async () => {
    if (!hasVersionChanges || isSaving) return;
    setIsSaving(true);
    const newVersion = await savePromptVersion({
      id: 'p1',
      systemPrompt,
      userPrompt,
      selectedModelId,
      commitMessage: commitMessage.trim() || 'No description'
    });
    const updatedHistory = await loadVersionHistory('p1');
    setHistory(updatedHistory);
    setActiveVersion(newVersion.version);
    persistDraftImmediately({
      systemPrompt,
      userPrompt,
      variables,
      selectedModelId,
      activeVersion: newVersion.version
    }, `Saved as ${newVersion.version}`);
    setIsSaving(false);
    setCommitMessage('');
    setIsSaveComposerOpen(false);
    setPendingLoadVersion(null);
    setVersionNotice('');
  };

  const handleCopyJSON = () => {
    const payload = JSON.stringify({ systemPrompt, userPrompt, variables, selectedModelId }, null, 2);
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

  const handleSystemPromptChange = (event) => {
    markUserEdit();
    setSystemPrompt(event.target.value);
  };

  const handleUserPromptChange = (event) => {
    markUserEdit();
    setUserPrompt(event.target.value);
  };

  const handleVariableChange = (variableName, value) => {
    markUserEdit();
    setVariables(prev => ({ ...prev, [variableName]: value }));
  };

  const handleModelChange = (event) => {
    markUserEdit();
    setSelectedModelId(event.target.value);
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
        <span key={`var-${match.index}`} className="var-highlight text-primary bg-primary/20">
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
      <div className="w-56 border-r border-border bg-panel/30 flex flex-col pt-4">
        <div className="px-4 mb-4 text-xs font-mono text-text-muted uppercase tracking-wider">History</div>
        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {isLoadingHistory ? (
            <div className="px-2 space-y-2 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-panel rounded-md" />
              ))}
            </div>
          ) : history.map((version, index) => (
            <div key={version.version} className="group">
              <div
                className={cn(
                  "rounded-md border border-transparent border-l-2 p-3 transition-all",
                  activeVersion === version.version
                    ? "bg-primary/10 border-primary/30 border-l-primary"
                    : "hover:bg-white/5 border-l-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn(
                    "font-mono text-xs px-2 py-0.5 rounded border",
                    activeVersion === version.version
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-panel text-text-muted border-border"
                  )}>{version.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRequestLoadVersion(version.version)}
                    className="text-[10px] uppercase tracking-wider text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-main"
                  >
                    Load
                  </button>
                </div>
                <div className="text-xs text-text-muted truncate">{version.description || 'No description'}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-text-muted/60">{version.createdAtDisplay}</div>
                  {index === 0 && hasVersionChanges && (
                    <div className="text-[10px] text-primary flex items-center gap-1">
                      <span>●</span>
                      <span>Unsaved changes</span>
                    </div>
                  )}
                </div>
              </div>
              {pendingLoadVersion === version.version && (
                <div className="mx-1 mt-2 rounded-md border border-primary/20 bg-primary/10 p-3 text-xs text-text-muted">
                  <div className="mb-2">Load {version.version}? Your unsaved draft will be replaced.</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyVersion(version)}
                      className="px-2.5 py-1 rounded bg-primary text-panel font-medium hover:bg-primary/90 transition-colors"
                    >
                      Load version
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingLoadVersion(null)}
                      className="px-2.5 py-1 rounded border border-border text-text-muted hover:text-text-main hover:border-primary/40 transition-colors"
                    >
                      Keep editing
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Pane */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="p-4 border-b border-border bg-panel/50 space-y-3">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <TerminalSquare size={18} className="text-primary" />
                <span className="font-medium">Editor</span>
              </div>
              {autosaveText && <span className="text-xs text-text-muted">{autosaveText}</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleCopyJSON} className="text-xs flex items-center gap-1 text-text-muted hover:text-text-main transition-colors">
                {copiedJSON ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
                {copiedJSON ? 'Copied!' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={() => setIsSaveComposerOpen(true)}
                disabled={!hasVersionChanges || isSaving}
                title={!hasVersionChanges ? 'No changes since last version' : 'Save as new version'}
                className="text-xs flex items-center gap-1 text-text-muted hover:text-text-main transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Database size={14} />
                {isSaving ? 'Saving...' : 'Save as new version'}
              </button>
            </div>
          </div>
          {(versionNotice || variableResetNotice || isSaveComposerOpen) && (
            <div className="flex flex-col gap-2">
              {versionNotice && <div className="text-xs text-primary">{versionNotice}</div>}
              {variableResetNotice && <div className="text-xs text-text-muted animate-in fade-in duration-200">{variableResetNotice}</div>}
              {isSaveComposerOpen && (
                <div className="flex items-center gap-2">
                  <input
                    ref={saveInputRef}
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Describe what changed..."
                    className="flex-1 max-w-sm bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-text-main placeholder-text-muted"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSaving) {
                        handleSave();
                      }
                      if (e.key === 'Escape') {
                        setIsSaveComposerOpen(false);
                        setCommitMessage('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded bg-primary text-panel text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveComposerOpen(false);
                      setCommitMessage('');
                    }}
                    className="text-xs text-text-muted hover:text-text-main transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="hidden">
            <TerminalSquare size={18} className="text-primary" />
            <span className="font-medium">Editor</span>
          </div>
          <div className="hidden">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (optional)"
              className="flex-1 max-w-xs bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-text-main placeholder-text-muted"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSaving) handleSave(); }}
            />
          </div>
          <div className="hidden">
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
              onChange={handleSystemPromptChange}
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
                onChange={handleUserPromptChange}
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
                      onChange={(e) => handleVariableChange(varName, e.target.value)}
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
              onChange={handleModelChange}
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
    return <span className="text-primary text-xs ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (isLoading) return <div className="p-8 text-text-muted">Loading experiments...</div>;

  const renderDetailDrawer = () => {
    if (!detailedExperiment) return null;
    const exp = detailedExperiment;

    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/50" onClick={() => setDetailedExperiment(null)} />
        <div className="ml-auto w-full max-w-2xl bg-panel border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-border flex justify-between items-start">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">{exp.promptVersion}</span>
              <span className="text-sm font-medium text-text-muted">{exp.model} · {exp.provider}</span>
            </div>
            <button onClick={() => setDetailedExperiment(null)} className="text-text-muted hover:text-text-main">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                <span className="font-mono font-bold text-lg text-primary">{exp.score ?? '—'}</span>
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
                <div className="bg-background p-4 rounded border border-border text-text-main text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{exp.output}</div>
              )}
            </div>
          </div>
        </div>
      </div>
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
          <p className="text-2xl font-bold text-primary">{stats.avgScore ?? '—'}</p>
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
          <p className="text-text-muted mb-4">No experiments yet — run a prompt in Prompt Studio to start tracking</p>
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
                  <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                    <td className="px-4 py-4" onClick={() => handleRowSelect(exp.id)}><input type="checkbox" checked={selectedRows.has(exp.id)} onChange={() => handleRowSelect(exp.id)} /></td>
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
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-text-muted">{timeAgoShort(exp.timestamp)}</td>
                    <td className="px-4 py-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setDetailedExperiment(exp)} className="text-primary hover:text-primary/80 text-xs">👁</button>
                      <button onClick={() => navigator.clipboard.writeText(JSON.stringify({systemPrompt: exp.systemPrompt, userTemplate: exp.userTemplate}, null, 2))} className="text-primary hover:text-primary/80 text-xs">📋</button>
                      <button onClick={() => handleDeleteExperiment(exp.id)} className="text-red-400 hover:text-red-300 text-xs">🗑</button>
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
    modelId: 'gemini-2.5-flash'
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
