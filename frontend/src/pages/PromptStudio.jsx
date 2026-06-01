import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Copy, FlaskConical, Play, Settings2, TerminalSquare
} from 'lucide-react';
import {
  createPromptVersion,
  listModels,
  listPromptVersions,
  listPrompts,
  runPrompt as runPromptRequest,
  updatePrompt,
  updatePromptVersion
} from '../utils/api';
import { cn, getVariableNames, timeAgo } from '../utils/helpers';

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
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(null);
  
  const [lastSavedContent, setLastSavedContent] = useState({
    systemPrompt: '',
    userTemplate: ''
  });

  const hasUnsavedChanges = 
    systemPrompt !== lastSavedContent.systemPrompt || 
    userTemplate !== lastSavedContent.userTemplate;

  const textAreaRef = useRef(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [prompts, promptVersions, modelsList] = await Promise.all([
          listPrompts(),
          listPromptVersions(promptId),
          listModels()
        ]);

        if (!isMounted) {
          return;
        }

        const currentPrompt = prompts.find((item) => item.id === promptId);
        if (!currentPrompt) {
          onGoPrompts();
          return;
        }

        const initialVersion = promptVersions[0] || null;

        setPrompt(currentPrompt);
        setPromptNameInput(currentPrompt.name || '');
        setVersions(promptVersions);
        setActiveVersion(initialVersion);
        setModels(modelsList);
        setSystemPrompt(initialVersion?.systemPrompt || '');
        setUserTemplate(initialVersion?.userTemplate || '');
        setVariableValues({});
        setSelectedModelId(modelsList.find((model) => model.status === 'active')?.id || '');
        setLastSavedContent({
          systemPrompt: initialVersion?.systemPrompt || '',
          userTemplate: initialVersion?.userTemplate || ''
        });
        setError('');
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err.message || 'Failed to load prompt studio.');
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [promptId, onGoPrompts]);

  const variableNames = useMemo(() => getVariableNames(userTemplate), [userTemplate]);

  useEffect(() => {
    setVariableValues((prev) => {
      const next = {};
      variableNames.forEach((name) => {
        next[name] = prev[name] || '';
      });
      return next;
    });
  }, [variableNames]);

  const handleScrollSync = () => {
    if (!textAreaRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = textAreaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textAreaRef.current.scrollLeft;
  };

  const renderHighlightedTemplate = (text) => {
    if (!text) {
      return null;
    }

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
            color: '#88d273'
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

  const persistPromptName = async (name) => {
    if (!prompt) {
      return;
    }

    const trimmed = name.trim();
    if (!trimmed || trimmed === prompt.name) {
      return;
    }

    try {
      const updated = await updatePrompt(prompt.id, { name: trimmed });
      setPrompt(updated);
      setPromptNameInput(trimmed);
    } catch (err) {
      setError(err.message || 'Failed to rename prompt.');
      setPromptNameInput(prompt.name || '');
    }
  };

  const handleLoadVersion = (version) => {
    setActiveVersion(version);
    setSystemPrompt(version.systemPrompt || '');
    setUserTemplate(version.userTemplate || '');
    setVariableValues({});
    setCommitMessage('');
    setShowCommitInput(false);
    setLastSavedContent({
      systemPrompt: version.systemPrompt || '',
      userTemplate: version.userTemplate || ''
    });
  };

  const showSaveIndicator = (message) => {
    setSaveIndicator(message);
    setTimeout(() => setSaveIndicator(null), 3000);
  };

  const handleSave = async () => {
    if (!prompt || !activeVersion) return;
    if (!hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    try {
      await updatePromptVersion(prompt.id, activeVersion.id, {
        systemPrompt,
        userTemplate
      });

      setLastSavedContent({ systemPrompt, userTemplate });
      
      setVersions(prev => prev.map(v => 
        v.id === activeVersion.id 
          ? { ...v, systemPrompt, userTemplate } 
          : v
      ));

      showSaveIndicator('Saved ✓');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to save prompt version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommit = async () => {
    if (!prompt) return;
    if (!hasUnsavedChanges || isCommitting) return;

    setIsCommitting(true);
    try {
      const nextVersion = await createPromptVersion(prompt.id, {
        systemPrompt,
        userTemplate,
        commitMessage: commitMessage.trim() || 'Saved version'
      });

      setVersions(prev => [nextVersion, ...prev]);
      setActiveVersion(nextVersion);
      setLastSavedContent({ systemPrompt, userTemplate });
      setCommitMessage('');
      setShowCommitInput(false);
      showSaveIndicator(`Committed as ${nextVersion.versionDisplay} ✓`);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to create prompt version.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRunPrompt = async () => {
    if (!prompt || !selectedModelId) {
      return;
    }

    setIsRunning(true);
    setOutput(null);
    setError('');

    const interpolatedPrompt = userTemplate.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key) => {
      return variableValues[key] || `{${key}}`;
    });

    try {
      const result = await runPromptRequest({
        modelId: selectedModelId,
        systemPrompt,
        userMessage: interpolatedPrompt,
        promptId: prompt.id,
        promptVersionId: activeVersion?.id || null,
        userTemplate,
        variableValues
      });

      setOutput({
        status: result.status,
        text: result.output,
        error: result.errorMessage,
        latencyMs: result.latency,
        totalTokens: result.totalTokens,
        costEstimate: result.costEstimate
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
    if (!output?.text) {
      return;
    }

    navigator.clipboard.writeText(output.text);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const formattedCost = typeof output?.costEstimate === 'number'
    ? `~$${output.costEstimate.toFixed(4)}`
    : (output?.costEstimate || '~$0.0000');

  return (
    <div className="flex h-full w-full flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onGoPrompts} className="text-xs text-text-muted transition-colors hover:text-text-main">
            Prompts
          </button>
          <span className="text-xs text-text-muted">/</span>
          {isEditingPromptName ? (
            <input
              autoFocus
              value={promptNameInput}
              onChange={(e) => setPromptNameInput(e.target.value)}
              onBlur={async () => {
                await persistPromptName(promptNameInput);
                setIsEditingPromptName(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  await persistPromptName(promptNameInput);
                  setIsEditingPromptName(false);
                }
                if (e.key === 'Escape') {
                  setPromptNameInput(prompt?.name || '');
                  setIsEditingPromptName(false);
                }
              }}
              className="border-b border-primary/40 bg-transparent text-sm text-text-main outline-none"
            />
          ) : (
            <button onClick={() => setIsEditingPromptName(true)} className="truncate text-sm text-text-main transition-colors hover:text-white">
              {prompt?.name || 'Untitled Prompt'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleCopyJSON} className="text-xs text-text-muted transition-colors hover:text-text-main">
            {copiedJSON ? 'Copied!' : 'Copy JSON'}
          </button>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="h-8 min-w-[180px] rounded border border-border bg-panel px-2 text-xs text-text-main focus:border-primary/50 focus:outline-none"
          >
            <option value="">Select model...</option>
            {models.filter((model) => model.status === 'active').map((model) => (
              <option key={model.id} value={model.id}>
                {model.provider} - {model.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleRunPrompt}
            disabled={isRunning || !selectedModelId}
            className="flex h-8 items-center gap-2 rounded bg-primary px-3 text-xs font-bold text-panel transition-colors hover:bg-primary/90 disabled:opacity-50"
            style={{ opacity: isRunning ? 0.6 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}
          >
            {!isRunning && <Play size={13} fill="currentColor" />}
            {isRunning ? "Running..." : "Run Prompt"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 w-[220px] flex-col border-r border-border bg-panel/30">
          <div className="px-4 pb-3 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">History</div>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => handleLoadVersion(version)}
                className={cn(
                  'w-full rounded-r-md border-l-2 p-3 text-left transition-all duration-150',
                  activeVersion?.id === version.id
                    ? 'border-l-primary bg-white/[0.04]'
                    : 'border-l-transparent hover:bg-white/[0.03]'
                )}
              >
                <div className="mb-1.5 inline-flex rounded border border-primary px-1.5 py-0.5 font-mono text-[11px] text-primary">
                  v{version.version}
                </div>
                <div className="truncate text-xs text-text-muted">{version.commitMessage || 'No message'}</div>
                <div className="mt-1 text-[10px] text-text-muted/70">{timeAgo(version.createdAt)}</div>
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t border-border p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] text-text-muted">
              <span>{hasUnsavedChanges ? 'Unsaved local edits' : activeVersion ? `Last saved · ${timeAgo(activeVersion.createdAt)}` : ''}</span>
              <span className="font-medium text-primary">{saveIndicator}</span>
            </div>
            
            {showCommitInput && (
              <input
                autoFocus
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCommit();
                  if (e.key === 'Escape') {
                    setShowCommitInput(false);
                    setCommitMessage('');
                  }
                }}
                placeholder="Describe what changed..."
                className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs text-text-main focus:border-primary/50 focus:outline-none"
              />
            )}

            <div className="flex gap-2">
              <button 
                onClick={handleSave} 
                disabled={!hasUnsavedChanges || isSaving || isCommitting}
                className="flex-1 h-8 rounded border border-border bg-transparent text-xs font-bold text-text-main transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ cursor: (!hasUnsavedChanges || isSaving || isCommitting) ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
              </button>
              
              <button 
                onClick={showCommitInput ? handleCommit : () => setShowCommitInput(true)}
                disabled={!hasUnsavedChanges || isSaving || isCommitting}
                className="flex-1 h-8 rounded bg-primary text-xs font-bold text-panel transition-colors hover:bg-primary/90 disabled:opacity-50"
                style={{ cursor: (!hasUnsavedChanges || isSaving || isCommitting) ? 'not-allowed' : 'pointer' }}
              >
                {isCommitting ? "Committing..." : showCommitInput ? "Confirm Commit" : "Commit"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto border-r border-border px-4 py-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <Settings2 size={12} /> System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[120px] w-full resize-y rounded-md border border-border bg-panel px-3 py-3 text-sm leading-relaxed transition-colors duration-150 focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <AlertTriangle size={12} /> User Template
            </label>
            <div className="relative min-h-[170px] overflow-hidden rounded-md border border-border bg-panel transition-colors duration-150 focus-within:border-primary/50">
              <div
                ref={highlightRef}
                className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-3 text-transparent"
                aria-hidden
              >
                {renderHighlightedTemplate(userTemplate)}
              </div>
              <textarea
                ref={textAreaRef}
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                onScroll={handleScrollSync}
                className="absolute inset-0 h-full w-full resize-y bg-transparent p-3 caret-primary text-transparent focus:outline-none"
                style={{ color: 'transparent', WebkitTextFillColor: 'transparent', lineHeight: 1.6, fontSize: 14 }}
              />
            </div>
            <div className="text-xs text-text-muted">
              Use <span className="font-mono text-primary">{'{variable}'}</span> syntax to interpolate values.
            </div>
          </div>

          {variableNames.length > 0 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                <TerminalSquare size={12} /> Variables
              </label>
              <div className="grid grid-cols-2 gap-3">
                {variableNames.map((name) => (
                  <div key={name}>
                    <label className="mb-1 block text-xs font-mono text-primary">{name}</label>
                    <input
                      value={variableValues[name] || ''}
                      onChange={(e) => setVariableValues((prev) => ({ ...prev, [name]: e.target.value }))}
                      className="h-9 w-full rounded border border-border bg-panel px-2 text-sm text-text-main transition-colors duration-150 focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 w-[480px] overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
            <Activity size={13} /> Output Preview
          </div>

          {!output && (
            <div className="flex h-[70%] flex-col items-center justify-center text-center text-text-muted">
              <FlaskConical size={44} className="mb-3 opacity-40" />
              <p className="text-sm">Hit Run Prompt to see the output.</p>
            </div>
          )}

          {output?.status === 'error' && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-red-300">error</div>
              <p className="text-sm text-red-300">{output.error}</p>
            </div>
          )}

          {output?.status === 'success' && (
            <div className="relative rounded-md border border-border bg-panel p-4">
              <button
                onClick={handleCopyOutput}
                className="absolute right-2 top-2 p-1.5 text-text-muted transition-colors hover:text-text-main"
                title="Copy output"
              >
                {copiedOutput ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
              </button>
              <div className="select-text whitespace-pre-wrap pr-8 text-sm leading-[1.7] text-text-main">
                {output.text}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 font-mono text-xs text-text-muted">
                <span>{output.latencyMs}ms</span>
                <span>·</span>
                <span>{output.totalTokens} tokens</span>
                <span>·</span>
                <span>{formattedCost}</span>
                <span className="ml-auto rounded border border-primary/40 px-2 py-0.5 text-primary">success</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
