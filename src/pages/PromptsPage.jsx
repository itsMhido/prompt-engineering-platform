import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import { cn, timeAgo } from '../utils/helpers';
import {
  getPrompts,
  getVersions,
  getExperiments,
  createPrompt,
  duplicatePrompt,
  deletePrompt,
  seedPromptsIfEmpty
} from '../utils/promptStore';

export default function PromptsPage({ onOpenPrompt }) {
  const [prompts, setPrompts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = () => {
    seedPromptsIfEmpty();
    setPrompts(getPrompts());
    setVersions(getVersions());
    setExperiments(getExperiments());
  };

  useEffect(() => {
    refresh();
  }, []);

  const tags = useMemo(() => {
    return Array.from(new Set(prompts.flatMap(p => Array.isArray(p.tags) ? p.tags : [])));
  }, [prompts]);

  const latestVersionByPrompt = useMemo(() => {
    const map = {};
    versions.forEach(v => {
      if (!map[v.promptId] || Number(v.version || 0) > Number(map[v.promptId].version || 0)) {
        map[v.promptId] = v;
      }
    });
    return map;
  }, [versions]);

  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt => {
      const haystack = `${prompt.name || ''} ${prompt.description || ''} ${(prompt.tags || []).join(' ')}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesTag = activeTag === 'all' || (prompt.tags || []).includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [prompts, search, activeTag]);

  const promptStats = useMemo(() => {
    return prompts.reduce((acc, prompt) => {
      const promptVersions = versions.filter(v => v.promptId === prompt.id);
      const promptExperiments = experiments.filter(e => e.promptId === prompt.id);
      const latestExperiment = promptExperiments[0] || null;
      acc[prompt.id] = {
        versions: promptVersions.length,
        runs: promptExperiments.length,
        model: latestExperiment?.modelId || latestExperiment?.model || 'No runs'
      };
      return acc;
    }, {});
  }, [prompts, versions, experiments]);

  if (prompts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <FileText size={28} className="text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-1">No prompts yet</h2>
        <p className="text-text-muted mb-6">Create your first prompt to start engineering and versioning</p>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-md bg-primary text-panel font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={15} /> New Prompt
        </button>
        {showCreate && <CreatePromptModal onClose={() => setShowCreate(false)} onCreated={(prompt) => onOpenPrompt(prompt.id)} />}
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Prompts</h2>
          <p className="text-text-muted">Your prompt library</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-md bg-primary text-panel font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={15} /> New Prompt
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-9 pr-3 py-2 bg-panel border border-border rounded-md text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag('all')}
            className={cn('px-3 py-1 rounded-full text-xs border', activeTag === 'all' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-text-muted')}
          >
            All
          </button>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={cn('px-3 py-1 rounded-full text-xs border', activeTag === tag ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-text-muted')}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPrompts.map(prompt => {
          const stats = promptStats[prompt.id] || { versions: 0, runs: 0, model: 'No runs' };
          const latestVersion = latestVersionByPrompt[prompt.id];

          return (
            <div
              key={prompt.id}
              className="glass-panel rounded-lg p-5 group hover:border-primary/40 transition-all cursor-pointer flex flex-col gap-3"
              onClick={() => onOpenPrompt(prompt.id)}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-base leading-tight">{prompt.name}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">
                  {stats.versions} versions
                </span>
              </div>

              <p className="text-sm text-text-muted line-clamp-2 min-h-[40px]">{prompt.description || 'No description'}</p>

              <div className="flex flex-wrap gap-1.5">
                {(prompt.tags || []).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-border text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{stats.runs} runs</span>
                <span>{timeAgo(prompt.updatedAt)}</span>
              </div>

              <div className="text-xs font-mono text-primary/80 truncate">
                {latestVersion ? `v${latestVersion.version}` : 'No versions'} · {stats.model}
              </div>

              <div className="flex items-center gap-3 pt-1 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => onOpenPrompt(prompt.id)} className="text-xs text-primary hover:text-primary/80 font-medium">Open</button>
                <button
                  onClick={() => {
                    duplicatePrompt(prompt.id);
                    refresh();
                  }}
                  className="text-xs text-text-muted hover:text-text-main"
                >
                  Duplicate
                </button>
                {deletingId === prompt.id ? (
                  <>
                    <button
                      onClick={() => {
                        deletePrompt(prompt.id);
                        setDeletingId(null);
                        refresh();
                      }}
                      className="text-xs text-red-400 hover:text-red-300 ml-auto"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-xs text-text-muted hover:text-text-main">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setDeletingId(prompt.id)} className="text-xs text-text-muted hover:text-red-400 ml-auto">Delete</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && <CreatePromptModal onClose={() => setShowCreate(false)} onCreated={(prompt) => onOpenPrompt(prompt.id)} />}
    </div>
  );
}

function CreatePromptModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);

  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;
    setTags(prev => [...prev, tag]);
    setTagInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-panel border border-border rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">New Prompt</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                placeholder="Type a tag and press Enter"
              />
              <button onClick={addTag} className="px-3 py-2 border border-border rounded text-sm text-text-muted hover:text-text-main">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-border text-text-muted flex items-center gap-1">
                  {tag}
                  <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-main">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => {
              const prompt = createPrompt({ name: name.trim(), description, tags });
              onCreated(prompt);
            }}
            className="px-4 py-2 text-sm bg-primary text-panel rounded hover:bg-primary/90 disabled:opacity-40"
          >
            Create Prompt
          </button>
        </div>
      </div>
    </div>
  );
}
