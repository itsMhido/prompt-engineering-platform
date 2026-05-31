import { useEffect, useState, useRef } from 'react';
import {
  Plus, Copy, CheckCircle2, Trash2, Edit2, Eye, EyeOff
} from 'lucide-react';
import { cn } from '../utils/helpers';
import { PROVIDER_DEFAULTS } from '../utils/constants';
import {
  createModel,
  listModels,
  removeModel,
  updateModel
} from '../utils/api';

const EMPTY_FORM = {
  name: '',
  provider: 'OpenAI',
  modelId: PROVIDER_DEFAULTS.OpenAI.modelId,
  endpoint: PROVIDER_DEFAULTS.OpenAI.endpoint,
  apiKey: '',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  stopSequences: [],
  status: 'active'
};

export default function ModelsPage({ onModelsChanged }) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [models, setModels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const mouseDownTarget = useRef(null);

  useEffect(() => {
    const load = async () => {
      setIsInitialLoading(true);
      try {
        const loaded = await listModels();
        setModels(loaded);
        const activeModel = loaded.find((model) => model.status === 'active');
        onModelsChanged?.(activeModel?.name || '');
      } catch (err) {
        setError(err.message || 'Failed to load models.');
      } finally {
        setIsInitialLoading(false);
      }
    };

    load();
  }, [onModelsChanged]);

  const refreshModels = async () => {
    const loaded = await listModels();
    setModels(loaded);
    const activeModel = loaded.find((model) => model.status === 'active');
    onModelsChanged?.(activeModel?.name || '');
  };

  const handleProviderChange = (provider) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setFormData((prev) => ({
      ...prev,
      provider,
      modelId: defaults.modelId,
      endpoint: defaults.endpoint
    }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingModel(null);
    setFormData(EMPTY_FORM);
    setShowApiKey(false);
    setError('');
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError('');

    const payload = {
      name: formData.name.trim(),
      provider: formData.provider,
      modelId: formData.modelId.trim(),
      endpoint: formData.endpoint.trim(),
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
      topP: formData.topP,
      stopSequences: formData.stopSequences,
      status: formData.status
    };

    if (!payload.name || !payload.modelId || !payload.endpoint) {
      setError('Name, model id, and endpoint are required.');
      setIsSaving(false);
      return;
    }

    if (!editingModel || showApiKey) {
      payload.apiKey = formData.apiKey.trim();
    }

    try {
      if (editingModel) {
        await updateModel(editingModel.id, payload);
      } else {
        if (!payload.apiKey) {
          setError('API key is required for a new model.');
          setIsSaving(false);
          return;
        }

        await createModel(payload);
      }

      await refreshModels();
      closeModal();
    } catch (err) {
      setError(err.message || 'Failed to save model.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (model) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      apiKey: '',
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      topP: model.topP,
      stopSequences: model.stopSequences || [],
      status: model.status
    });
    setShowApiKey(false);
    setError('');
    setIsModalOpen(true);
  };

  const handleDuplicate = (model) => {
    setEditingModel(null);
    setFormData({
      name: `${model.name} Copy`,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      apiKey: '',
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      topP: model.topP,
      stopSequences: model.stopSequences || [],
      status: model.status
    });
    setShowApiKey(true);
    setError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (!confirm('Are you sure you want to remove this model?')) {
      return;
    }

    setDeletingId(id);
    try {
      await removeModel(id);
      await refreshModels();
    } catch (err) {
      setError(err.message || 'Failed to delete model.');
    } finally {
      setDeletingId(null);
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
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Model Management</h2>
          <p className="text-text-muted">Configure and manage AI models for prompt execution.</p>
        </div>
        <button
          onClick={() => {
            setEditingModel(null);
            setFormData(EMPTY_FORM);
            setShowApiKey(true);
            setError('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-panel transition-colors hover:bg-primary/90"
        >
          <Plus size={16} /> Add Model
        </button>
      </div>

      {error && !isModalOpen && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isInitialLoading ? (
        <SkeletonLoader />
      ) : models.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <h2 className="mb-1 text-xl font-bold">No models yet</h2>
          <p className="text-text-muted">Add a model to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <div key={model.id} className="glass-panel group rounded-lg p-5 transition-colors hover:border-primary/50">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white ${getProviderColor(model.provider)}`}>
                  {model.provider[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">{model.name}</h3>
                  <p className="text-sm text-text-muted">{model.provider}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={cn('rounded-full border px-2 py-0.5 font-mono text-xs', model.status === 'active' ? 'border-green-500/50 bg-green-500/20 text-green-400' : 'border-red-500/50 bg-red-500/20 text-red-400')}>
                  {model.status}
                </div>
                <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => handleEdit(model)} className="rounded p-1.5 text-text-muted transition-colors hover:bg-blue-400/10 hover:text-blue-400"><Edit2 size={14} /></button>
                  <button onClick={() => handleDuplicate(model)} className="rounded p-1.5 text-text-muted transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"><Copy size={14} /></button>
                  <button 
                    onClick={() => handleDelete(model.id)} 
                    disabled={deletingId === model.id}
                    className="rounded p-1.5 text-text-muted transition-colors hover:bg-red-400/10 hover:text-red-400"
                    style={{ opacity: deletingId === model.id ? 0.6 : 1, cursor: deletingId === model.id ? 'not-allowed' : 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-text-muted"><strong>Model:</strong> {model.modelId}</div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-text-muted">T: {model.temperature}</div>
                <div className="rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-text-muted">Max: {model.maxTokens}</div>
                <div className="rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-text-muted">P: {model.topP}</div>
              </div>
              {model.apiKey && (
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 size={12} /> Key configured
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
          onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
          onMouseUp={(e) => {
            if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
              closeModal();
            }
            mouseDownTarget.current = null;
          }}
        >
          <div 
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-panel p-6" 
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-xl font-bold">{editingModel ? 'Edit Model' : 'Add New Model'}</h3>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Model Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50" placeholder="e.g. GPT-4 Turbo" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Provider</label>
                  <select value={formData.provider} onChange={(e) => handleProviderChange(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50">
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
                  <label className="mb-1 block text-sm font-medium">Model ID / Version</label>
                  <input type="text" value={formData.modelId} onChange={(e) => setFormData({ ...formData, modelId: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50" placeholder="e.g. gpt-4-turbo" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Base URL / Endpoint</label>
                  <input type="text" value={formData.endpoint} onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">API Key</label>
                <div className="relative">
                  {editingModel && !showApiKey ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value="••••••••••••" readOnly className="flex-1 rounded border border-border bg-background px-3 py-2 outline-none" />
                      <button type="button" onClick={() => setShowApiKey(true)} className="rounded bg-primary px-3 py-2 text-sm text-panel hover:bg-primary/90">Edit</button>
                    </div>
                  ) : (
                    <>
                      <input type={showApiKey ? 'text' : 'password'} value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 pr-10 outline-none focus:border-primary/50" placeholder={editingModel ? 'Enter a new API key to replace the saved one' : 'Enter API key'} />
                      <button type="button" onClick={() => setShowApiKey((prev) => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Temperature: {formData.temperature}</label>
                  <input type="range" min="0" max="2" step="0.1" value={formData.temperature} onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })} className="w-full" style={{ '--range-progress': `${(formData.temperature / 2) * 100}%` }} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Tokens</label>
                  <input type="number" value={formData.maxTokens} onChange={(e) => setFormData({ ...formData, maxTokens: Number(e.target.value) || 0 })} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50" />
                  <div className="mt-1 flex gap-1">
                    {[256, 512, 1024, 4096].map((preset) => (
                      <button key={preset} type="button" onClick={() => setFormData({ ...formData, maxTokens: preset })} className="rounded border border-border bg-background px-2 py-1 text-xs hover:border-primary/50">{preset}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Top P: {formData.topP}</label>
                  <input type="range" min="0" max="1" step="0.1" value={formData.topP} onChange={(e) => setFormData({ ...formData, topP: parseFloat(e.target.value) })} className="w-full" style={{ '--range-progress': `${(formData.topP / 1) * 100}%` }} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Stop Sequences</label>
                <input type="text" value={formData.stopSequences.join(', ')} onChange={(e) => setFormData({ ...formData, stopSequences: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="w-full rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary/50" placeholder="Comma-separated stop sequences" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="radio" name="status" value="active" checked={formData.status === 'active'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} /> Active</label>
                  <label className="flex items-center gap-2"><input type="radio" name="status" value="inactive" checked={formData.status === 'inactive'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} /> Inactive</label>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-text-muted transition-colors hover:text-text-main">Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="rounded bg-primary px-4 py-2 text-panel transition-colors hover:bg-primary/90"
                style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? "Saving..." : "Save Model"}
              </button>
            </div>
          </div>
        </div>
      )}
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
