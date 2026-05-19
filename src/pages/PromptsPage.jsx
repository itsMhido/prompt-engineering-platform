import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import { cn, timeAgo } from '../utils/helpers';
import {
  createPrompt,
  duplicatePrompt,
  listPrompts,
  removePrompt
} from '../utils/api';

export default function PromptsPage({ onOpenPrompt }) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [prompts, setPrompts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicatingId, setIsDuplicatingId] = useState(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    const nextPrompts = await listPrompts();
    setPrompts(nextPrompts);
  };

  useEffect(() => {
    const load = async () => {
      setIsInitialLoading(true);
      try {
        await refresh();
      } catch (err) {
        setError(err.message || 'Failed to load prompts.');
      } finally {
        setIsInitialLoading(false);
      }
    };
    load();
  }, []);

  const tags = useMemo(() => {
    return Array.from(new Set(prompts.flatMap((prompt) => Array.isArray(prompt.tags) ? prompt.tags : [])));
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const haystack = `${prompt.name || ''} ${prompt.description || ''} ${(prompt.tags || []).join(' ')}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesTag = activeTag === 'all' || (prompt.tags || []).includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [prompts, search, activeTag]);

  if (isInitialLoading) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <SkeletonLoader />
      </div>
    );
  }

  if (prompts.length === 0 && !error) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <FileText size={28} className="text-primary" />
        </div>
        <h2 className="mb-1 text-2xl font-bold">No prompts yet</h2>
        <p className="mb-6 text-text-muted">Create your first prompt to start engineering and versioning</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-panel transition-colors hover:bg-primary/90"
        >
          <Plus size={15} /> New Prompt
        </button>
        {showCreate && (
          <CreatePromptModal
            onClose={() => setShowCreate(false)}
            onCreated={(prompt) => onOpenPrompt(prompt.id)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Prompts</h2>
          <p className="text-text-muted">Your prompt library</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-panel transition-colors hover:bg-primary/90"
        >
          <Plus size={15} /> New Prompt
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3">
        <div className="relative w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full rounded-md border border-border bg-panel py-2 pl-9 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag('all')}
            className={cn('rounded-full border px-3 py-1 text-xs', activeTag === 'all' ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border text-text-muted')}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={cn('rounded-full border px-3 py-1 text-xs', activeTag === tag ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border text-text-muted')}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="glass-panel group flex cursor-pointer flex-col gap-3 rounded-lg p-5 transition-all hover:border-primary/40"
            onClick={() => onOpenPrompt(prompt.id)}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold leading-tight">{prompt.name}</h3>
              <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                {prompt.versionCount} versions
              </span>
            </div>

            <p className="min-h-[40px] line-clamp-2 text-sm text-text-muted">{prompt.description || 'No description'}</p>

            <div className="flex flex-wrap gap-1.5">
              {(prompt.tags || []).map((tag) => (
                <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{prompt.experimentCount} runs</span>
              <span>{timeAgo(prompt.updatedAt)}</span>
            </div>

            <div className="truncate text-xs font-mono text-primary/80">
              {prompt.versionCount > 0 ? `v${prompt.versionCount}` : 'No versions'} · {prompt.experimentCount} experiments
            </div>

            <div className="flex items-center gap-3 border-t border-border pt-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onOpenPrompt(prompt.id)} className="text-xs font-medium text-primary hover:text-primary/80">Open</button>
              <button
                onClick={async () => {
                  if (isDuplicatingId) return;
                  setIsDuplicatingId(prompt.id);
                  try {
                    const duplicated = await duplicatePrompt(prompt.id);
                    await refresh();
                    onOpenPrompt(duplicated.prompt.id);
                  } catch (err) {
                    setError(err.message || 'Failed to duplicate prompt.');
                  } finally {
                    setIsDuplicatingId(null);
                  }
                }}
                disabled={isDuplicatingId === prompt.id}
                className="text-xs text-text-muted hover:text-text-main"
                style={{ opacity: isDuplicatingId === prompt.id ? 0.6 : 1, cursor: isDuplicatingId === prompt.id ? 'not-allowed' : 'pointer' }}
              >
                {isDuplicatingId === prompt.id ? "Duplicating..." : "Duplicate"}
              </button>
              {deletingId === prompt.id ? (
                <>
                  <button
                    onClick={async () => {
                      if (isDeleting) return;
                      setIsDeleting(true);
                      try {
                        await removePrompt(prompt.id);
                        setDeletingId(null);
                        await refresh();
                      } catch (err) {
                        setError(err.message || 'Failed to delete prompt.');
                      } finally {
                        setIsDeleting(false);
                      }
                    }}
                    disabled={isDeleting}
                    className="ml-auto text-xs text-red-400 hover:text-red-300"
                    style={{ opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
                  >
                    {isDeleting ? "Deleting..." : "Confirm"}
                  </button>
                  <button onClick={() => setDeletingId(null)} className="text-xs text-text-muted hover:text-text-main">Cancel</button>
                </>
              ) : (
                <button onClick={() => setDeletingId(prompt.id)} className="ml-auto text-xs text-text-muted hover:text-red-400">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreatePromptModal
          onClose={() => setShowCreate(false)}
          onCreated={async (prompt) => {
            await refresh();
            onOpenPrompt(prompt.id);
          }}
        />
      )}
    </div>
  );
}

function CreatePromptModal({ onClose, onCreated }) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const onEsc = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      return;
    }

    setTags((prev) => [...prev, tag]);
    setTagInput('');
  };

  const handleCreate = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const created = await createPrompt({ name: name.trim(), description, tags });
      onCreated(created.prompt);
    } catch (err) {
      setError(err.message || 'Failed to create prompt.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold">New Prompt</h3>
        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="Type a tag and press Enter"
              />
              <button onClick={addTag} className="rounded border border-border px-3 py-2 text-sm text-text-muted hover:text-text-main">Add</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                  {tag}
                  <button onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-main">Cancel</button>
          <button 
            disabled={!name.trim() || isSaving} 
            onClick={handleCreate} 
            className="rounded bg-primary px-4 py-2 text-sm text-panel hover:bg-primary/90 disabled:opacity-40"
            style={{ opacity: isSaving ? 0.6 : (!name.trim() ? 0.4 : 1), cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? "Creating..." : "Create Prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SkeletonCard = () => (
  <div style={{
    background: 'var(--surface, #1a1916)',
    border: '1px solid var(--border, #252320)',
    borderRadius: '8px',
    padding: '20px',
    animation: 'pulse 1.5s ease-in-out infinite'
  }}>
    <div style={{ height: 16, width: '60%', background: '#2a2926', borderRadius: 4, marginBottom: 12 }} />
    <div style={{ height: 12, width: '40%', background: '#2a2926', borderRadius: 4, marginBottom: 8 }} />
    <div style={{ height: 12, width: '80%', background: '#2a2926', borderRadius: 4 }} />
  </div>
);

const SkeletonLoader = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
    {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
  </div>
);
