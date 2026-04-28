import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Copy, FlaskConical, Play, Settings2, TerminalSquare
} from 'lucide-react';
import { callModel } from '../utils/callModel';
import { loadModels, saveExperiment } from '../utils/mockApi';
import { cn, getVariableNames, readLocalStorageJSON, timeAgo } from '../utils/helpers';
import {
  getDrafts,
  getNextVersionNumber,
  getPrompts,
  getVersionsForPrompt,
  saveDrafts,
  savePrompts,
  saveVersions
} from '../utils/promptStore';

export default function PromptStudio({ promptId, onGoPrompts }) {
  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(null);
  const [models, setModels] = useState([]);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [userTemplate, setUserTemplate] = useState('');
  const [variableValues, setVariableValues] = useState({});
  const [selectedModelId, setSelectedModelId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isEditingPromptName, setIsEditingPromptName] = useState(false);
  const [promptNameInput, setPromptNameInput] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const draftTimerRef = useRef(null);
  const textAreaRef = useRef(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!promptId) return;
    setIsDraftHydrated(false);
    const prompts = getPrompts();
    const currentPrompt = prompts.find(p => p.id === promptId);
    if (!currentPrompt) {
      onGoPrompts();
      return;
    }
    setPrompt(currentPrompt);
    setPromptNameInput(currentPrompt.name || '');

    const scopedVersions = getVersionsForPrompt(promptId);
    setVersions(scopedVersions);
    setActiveVersion(scopedVersions[0] || null);

    const drafts = getDrafts();
    const draft = drafts[promptId];
    console.log('Draft loaded on mount:', draft);
    console.log('Variable values restored:', draft?.variableValues);
    if (draft) {
      const varsInTemplate = getVariableNames(draft.userTemplate || '');
      const cleanedValues = varsInTemplate.reduce((acc, key) => {
        acc[key] = draft.variableValues?.[key] || '';
        return acc;
      }, {});

      setSystemPrompt(draft.systemPrompt || '');
      setUserTemplate(draft.userTemplate || '');
      setVariableValues(cleanedValues);
      setSelectedModelId(draft.selectedModelId || '');
      setDraftSavedAt(draft.savedAt || null);
    } else if (scopedVersions[0]) {
      setSystemPrompt(scopedVersions[0].systemPrompt || '');
      setUserTemplate(scopedVersions[0].userTemplate || '');
      setVariableValues({});
      setSelectedModelId('');
      setDraftSavedAt(null);
    }
    setIsDraftHydrated(true);

    loadModels().then(setModels);
  }, [promptId, onGoPrompts]);

  const variableNames = useMemo(() => getVariableNames(userTemplate), [userTemplate]);

  useEffect(() => {
    if (!isDraftHydrated) return;
    setVariableValues(prev => {
      const next = {};
      variableNames.forEach(name => {
        next[name] = prev[name] || '';
      });
      return next;
    });
  }, [variableNames, isDraftHydrated]);

  useEffect(() => {
    if (!promptId || !isDraftHydrated) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const drafts = getDrafts();
      const cleanedValues = variableNames.reduce((acc, key) => {
        acc[key] = variableValues[key] || '';
        return acc;
      }, {});

      const savedAt = new Date().toISOString();
      drafts[promptId] = {
        systemPrompt,
        userTemplate,
        variableValues: cleanedValues,
        selectedModelId,
        savedAt
      };
      saveDrafts(drafts);
      console.log('Draft written to localStorage:', JSON.stringify(drafts[promptId]));
      setDraftSavedAt(savedAt);
    }, 800);

    return () => clearTimeout(draftTimerRef.current);
  }, [promptId, systemPrompt, userTemplate, selectedModelId, variableValues, variableNames, isDraftHydrated]);

  const handleScrollSync = () => {
    if (!textAreaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textAreaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textAreaRef.current.scrollLeft;
  };

  const renderHighlightedTemplate = (text) => {
    if (!text) return null;
    const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const nodes = [];
    let cursor = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        nodes.push(
          <span key={`txt-${cursor}`} className="text-text-main">
            {text.substring(cursor, match.index)}
          </span>
        );
      }
      nodes.push(
        <span
          key={`var-${match.index}`}
          style={{
            backgroundColor: 'rgba(136, 210, 115, 0.15)',
            color: '#88d273',
            padding: 0,
            margin: 0,
            border: 'none',
            outline: 'none',
            borderRadius: 0,
            display: 'inline',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            fontWeight: 'inherit',
            lineHeight: 'inherit',
            letterSpacing: 'inherit'
          }}
        >
          {match[0]}
        </span>
      );
      cursor = regex.lastIndex;
    }

    if (cursor < text.length) {
      nodes.push(
        <span key={`txt-end-${cursor}`} className="text-text-main">
          {text.substring(cursor)}
        </span>
      );
    }

    return <>{nodes}{text.endsWith('\n') ? <br /> : null}</>;
  };

  const persistPromptName = (name) => {
    if (!prompt) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === prompt.name) return;
    const nextPrompts = getPrompts().map(p => (
      p.id === prompt.id ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p
    ));
    savePrompts(nextPrompts);
    setPrompt(prev => ({ ...prev, name: trimmed, updatedAt: new Date().toISOString() }));
    setPromptNameInput(trimmed);
  };

  const handleLoadVersion = (version) => {
    setActiveVersion(version);
    setSystemPrompt(version.systemPrompt || '');
    setUserTemplate(version.userTemplate || '');
    setVariableValues({});
  };

  const handleSaveVersion = () => {
    if (!prompt) return;
    const all = readLocalStorageJSON('pe_versions', []);
    const nextVersion = {
      id: crypto.randomUUID(),
      promptId: prompt.id,
      version: getNextVersionNumber(prompt.id),
      systemPrompt,
      userTemplate,
      commitMessage: commitMessage.trim() || 'Saved version',
      createdAt: new Date().toISOString()
    };
    saveVersions([...all, nextVersion]);
    setVersions(getVersionsForPrompt(prompt.id));
    setActiveVersion(nextVersion);
    setCommitMessage('');
  };

  const handleRunPrompt = async () => {
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel || !selectedModel.apiKey || !prompt) return;

    setIsRunning(true);
    setOutput(null);

    const interpolatedPrompt = userTemplate.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key) => {
      return variableValues[key] || `{${key}}`;
    });

    try {
      const result = await callModel(selectedModel, systemPrompt, interpolatedPrompt);
      setOutput({
        status: 'success',
        text: result.output,
        latencyMs: result.latency,
        totalTokens: result.totalTokens,
        costEstimate: result.costEstimate
      });

      await saveExperiment({
        promptId: prompt.id,
        promptName: prompt.name,
        promptVersion: `v${activeVersion?.version || 1}`,
        version: `v${activeVersion?.version || 1}`,
        model: selectedModel.name,
        modelId: selectedModel.modelId,
        provider: selectedModel.provider,
        systemPrompt,
        userTemplate,
        variableValues,
        interpolatedPrompt,
        output: result.output,
        latencyMs: result.latency,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        costEstimate: result.costEstimate,
        status: 'success',
        tags: [],
        score: null,
        notes: ''
      });
    } catch (err) {
      setOutput({
        status: 'error',
        error: err.message || 'Unknown API error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify({
      systemPrompt,
      userTemplate,
      variableValues,
      selectedModelId
    }, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 1500);
  };

  const handleCopyOutput = () => {
    if (!output?.text) return;
    navigator.clipboard.writeText(output.text);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const formattedCost = typeof output?.costEstimate === 'number'
    ? `~$${output.costEstimate.toFixed(4)}`
    : (output?.costEstimate || '~$0.0000');

  return (
    <div className="h-full w-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="h-12 border-b border-border bg-background px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onGoPrompts} className="text-xs text-text-muted hover:text-text-main transition-colors">
            Prompts
          </button>
          <span className="text-xs text-text-muted">/</span>
          {isEditingPromptName ? (
            <input
              autoFocus
              value={promptNameInput}
              onChange={(e) => setPromptNameInput(e.target.value)}
              onBlur={() => {
                persistPromptName(promptNameInput);
                setIsEditingPromptName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  persistPromptName(promptNameInput);
                  setIsEditingPromptName(false);
                }
                if (e.key === 'Escape') {
                  setPromptNameInput(prompt?.name || '');
                  setIsEditingPromptName(false);
                }
              }}
              className="bg-transparent text-sm text-text-main outline-none border-b border-primary/40"
            />
          ) : (
            <button onClick={() => setIsEditingPromptName(true)} className="text-sm text-text-main hover:text-white transition-colors truncate">
              {prompt?.name || 'Untitled Prompt'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleCopyJSON} className="text-xs text-text-muted hover:text-text-main transition-colors">
            {copiedJSON ? 'Copied!' : 'Copy JSON'}
          </button>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="h-8 bg-panel border border-border rounded px-2 text-xs focus:outline-none focus:border-primary/50 text-text-main min-w-[180px]"
          >
            <option value="">Select model...</option>
            {models.filter(m => m.status === 'active').map(m => (
              <option key={m.id} value={m.id}>
                {m.provider} - {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleRunPrompt}
            disabled={isRunning || !selectedModelId}
            className="h-8 px-3 rounded bg-primary text-panel text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <div className="w-3 h-3 rounded-full border-2 border-panel border-t-transparent animate-spin" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
            Run Prompt
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-[220px] border-r border-border bg-panel/30 flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-3 text-[11px] font-mono tracking-[0.08em] uppercase text-text-muted">History</div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1.5">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => handleLoadVersion(v)}
                className={cn(
                  'w-full text-left p-3 border-l-2 rounded-r-md transition-all duration-150',
                  activeVersion?.id === v.id
                    ? 'border-l-primary bg-white/[0.04]'
                    : 'border-l-transparent hover:bg-white/[0.03]'
                )}
              >
                <div className="inline-flex font-mono text-[11px] border border-primary text-primary rounded px-1.5 py-0.5 mb-1.5">
                  v{v.version}
                </div>
                <div className="text-xs text-text-muted truncate">{v.commitMessage || 'No message'}</div>
                <div className="text-[10px] text-text-muted/70 mt-1">{timeAgo(v.createdAt)}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-3 shrink-0">
            <div className="text-[10px] text-text-muted mb-2">
              {draftSavedAt ? `Draft saved · ${timeAgo(draftSavedAt)}` : ''}
            </div>
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (optional)"
              className="w-full h-8 px-2 bg-background border border-border rounded text-xs text-text-main focus:outline-none focus:border-primary/50 mb-2"
            />
            <button
              onClick={handleSaveVersion}
              className="w-full h-8 bg-primary text-panel rounded text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              Save as new version
            </button>
          </div>
        </div>

        <div className="flex-1 border-r border-border min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-mono tracking-[0.08em] uppercase text-text-muted flex items-center gap-2">
              <Settings2 size={12} /> System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full min-h-[120px] bg-panel border border-border rounded-md px-3 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:border-primary/50 transition-colors duration-150"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-mono tracking-[0.08em] uppercase text-text-muted flex items-center gap-2">
              <AlertTriangle size={12} /> User Template
            </label>
            <div className="relative min-h-[170px] bg-panel border border-border rounded-md overflow-hidden focus-within:border-primary/50 transition-colors duration-150">
              <div
                ref={highlightRef}
                className="absolute inset-0 p-3 pointer-events-none whitespace-pre-wrap break-words overflow-auto text-transparent"
                aria-hidden
              >
                {renderHighlightedTemplate(userTemplate)}
              </div>
              <textarea
                ref={textAreaRef}
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                onScroll={handleScrollSync}
                className="absolute inset-0 w-full h-full p-3 bg-transparent resize-y focus:outline-none caret-primary text-transparent"
                style={{ color: 'transparent', WebkitTextFillColor: 'transparent', lineHeight: 1.6, fontSize: 14 }}
              />
            </div>
            <div className="text-xs text-text-muted">
              Use <span className="font-mono text-primary">{'{variable}'}</span> syntax to interpolate values.
            </div>
          </div>

          {variableNames.length > 0 && (
            <div className="space-y-3">
              <label className="text-[11px] font-mono tracking-[0.08em] uppercase text-text-muted flex items-center gap-2">
                <TerminalSquare size={12} /> Variables
              </label>
              <div className="grid grid-cols-2 gap-3">
                {variableNames.map(name => (
                  <div key={name}>
                    <label className="block text-xs mb-1 text-primary font-mono">{name}</label>
                    <input
                      value={variableValues[name] || ''}
                      onChange={(e) => setVariableValues(prev => {
                        const next = { ...prev, [name]: e.target.value };
                        console.log('Variable changed — saving to draft:', next);
                        return next;
                      })}
                      className="w-full h-9 px-2 bg-panel border border-border rounded text-sm text-text-main focus:outline-none focus:border-primary/50 transition-colors duration-150"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-[480px] min-h-0 overflow-y-auto p-4">
          <div className="text-[11px] font-mono tracking-[0.08em] uppercase text-text-muted flex items-center gap-2 mb-4">
            <Activity size={13} /> Output Preview
          </div>

          {!output && (
            <div className="h-[70%] flex flex-col items-center justify-center text-center text-text-muted">
              <FlaskConical size={44} className="opacity-40 mb-3" />
              <p className="text-sm">Hit Run Prompt to see the output.</p>
            </div>
          )}

          {output?.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
              <div className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">error</div>
              <p className="text-sm text-red-300">{output.error}</p>
            </div>
          )}

          {output?.status === 'success' && (
            <div className="relative bg-panel border border-border rounded-md p-4">
              <button
                onClick={handleCopyOutput}
                className="absolute top-2 right-2 p-1.5 text-text-muted hover:text-text-main transition-colors"
                title="Copy output"
              >
                {copiedOutput ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
              </button>
              <div className="whitespace-pre-wrap text-sm leading-[1.7] text-text-main pr-8 select-text">
                {output.text}
              </div>
              <div className="mt-4 pt-3 border-t border-border text-xs font-mono text-text-muted flex items-center gap-2 flex-wrap">
                <span>⏱ {output.latencyMs}ms</span>
                <span>·</span>
                <span>🔤 {output.totalTokens} tokens</span>
                <span>·</span>
                <span>💰 {formattedCost}</span>
                <span className="ml-auto px-2 py-0.5 rounded border border-primary/40 text-primary">success</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
