import React, { useState, useEffect, useRef } from 'react';
import {
  Database, TerminalSquare, FlaskConical,
  Play, Settings2, Copy, CheckCircle2,
  AlertTriangle, Clock, Activity
} from 'lucide-react';
import { cn, loadPromptDraft, syncVariablesWithPrompt, timeAgo, getComparableVersionState, writeLocalStorageJSON } from '../utils/helpers';
import { PROMPT_DRAFT_KEY } from '../utils/constants';
import { savePromptVersion, loadVersionHistory, callModel, loadModels, saveExperiment } from '../utils/mockApi';

export default
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
    setVersionNotice(`Viewing ${versionToLoad.version} â€” editing creates a new draft`);
    setVariableResetNotice(`Variable values cleared â€” loading version ${versionToLoad.version}`);

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
                      <span>â—</span>
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
                Saved âœ“
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
                      ðŸ’° {output.cost}
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
