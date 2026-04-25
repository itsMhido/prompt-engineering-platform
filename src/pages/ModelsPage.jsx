import React, { useState, useEffect } from 'react';
import {
  Plus, Copy, CheckCircle2, Trash2, Edit2, Eye, EyeOff
} from 'lucide-react';
import { cn } from '../utils/helpers';
import { PROVIDER_DEFAULTS } from '../utils/constants';
import { loadModels, saveModel, deleteModel } from '../utils/mockApi';

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState({
    name: '', provider: 'OpenAI', modelId: '', endpoint: '', apiKey: '',
    temperature: 0.7, maxTokens: 4096, topP: 1.0, stopSequences: [], status: 'active'
  });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => { loadModels().then(setModels); }, []);

  const handleProviderChange = (provider) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setFormData(prev => ({ ...prev, provider, modelId: defaults.modelId, endpoint: defaults.endpoint }));
  };

  const handleSave = async () => {
    const modelToSave = editingModel ? { ...editingModel, ...formData } : { ...formData, id: `m${Date.now()}` };
    const saved = await saveModel(modelToSave);
    setModels(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      if (idx > -1) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
    setIsModalOpen(false);
    setEditingModel(null);
    setFormData({ name: '', provider: 'OpenAI', modelId: '', endpoint: '', apiKey: '', temperature: 0.7, maxTokens: 4096, topP: 1.0, stopSequences: [], status: 'active' });
    setShowApiKey(false);
  };

  const handleEdit = (model) => {
    setEditingModel(model);
    setFormData({ name: model.name, provider: model.provider, modelId: model.modelId, endpoint: model.endpoint, apiKey: model.apiKey, temperature: model.temperature, maxTokens: model.maxTokens, topP: model.topP, stopSequences: model.stopSequences || [], status: model.status });
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleDuplicate = (model) => {
    setEditingModel(null);
    setFormData({ name: `${model.name} Copy`, provider: model.provider, modelId: model.modelId, endpoint: model.endpoint, apiKey: '', temperature: model.temperature, maxTokens: model.maxTokens, topP: model.topP, stopSequences: model.stopSequences || [], status: model.status });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to remove this model?")) {
      await deleteModel(id);
      setModels(prev => prev.filter(m => m.id !== id));
    }
  };

  const getProviderColor = (provider) => {
    const colors = { OpenAI: 'bg-blue-500', Anthropic: 'bg-orange-500', Google: 'bg-green-500', Mistral: 'bg-purple-500', Groq: 'bg-yellow-600', Custom: 'bg-gray-500' };
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
                <div className={cn("font-mono text-xs px-2 py-0.5 rounded-full border", model.status === 'active' ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-red-500/20 text-red-400 border-red-500/50")}>
                  {model.status}
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(model)} className="p-1.5 rounded text-text-muted hover:text-blue-400 hover:bg-blue-400/10 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDuplicate(model)} className="p-1.5 rounded text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"><Copy size={14} /></button>
                  <button onClick={() => handleDelete(model.id)} className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-text-muted"><strong>Model:</strong> {model.modelId}</div>
              <div className="flex gap-2 flex-wrap">
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">T: {model.temperature}</div>
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">Max: {model.maxTokens}</div>
                <div className="bg-background rounded border border-border px-2.5 py-1 text-xs font-mono text-text-muted">P: {model.topP}</div>
              </div>
              {model.apiKey && (<div className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12} /> Key configured</div>)}
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
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" placeholder="e.g. GPT-4 Turbo" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <select value={formData.provider} onChange={e => handleProviderChange(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none">
                    <option>OpenAI</option><option>Anthropic</option><option>Google</option><option>Mistral</option><option>Groq</option><option>Custom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Model ID / Version</label>
                  <input type="text" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" placeholder="e.g. gpt-4-turbo" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base URL / Endpoint</label>
                  <input type="text" value={formData.endpoint} onChange={e => setFormData({...formData, endpoint: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <div className="relative">
                  {editingModel && !showApiKey ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value="••••••••••••" readOnly className="flex-1 bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" />
                      <button type="button" onClick={() => setShowApiKey(true)} className="px-3 py-2 bg-primary text-panel rounded text-sm hover:bg-primary/90">Edit</button>
                    </div>
                  ) : (
                    <>
                      <input type={showApiKey ? 'text' : 'password'} value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 pr-10 focus:border-primary/50 outline-none" placeholder="Enter API key" />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </>
                  )}
                </div>
                {editingModel && formData.apiKey && showApiKey && (<p className="text-xs text-text-muted mt-1">Editing will replace the saved key</p>)}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature: {formData.temperature}</label>
                  <input type="range" min="0" max="2" step="0.1" value={formData.temperature} onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input type="number" value={formData.maxTokens} onChange={e => setFormData({...formData, maxTokens: parseInt(e.target.value)})} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" />
                  <div className="flex gap-1 mt-1">
                    {[256, 512, 1024, 4096].map(preset => (
                      <button key={preset} type="button" onClick={() => setFormData({...formData, maxTokens: preset})} className="text-xs bg-background border border-border rounded px-2 py-1 hover:border-primary/50">{preset}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Top P: {formData.topP}</label>
                  <input type="range" min="0" max="1" step="0.1" value={formData.topP} onChange={e => setFormData({...formData, topP: parseFloat(e.target.value)})} className="w-full" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stop Sequences</label>
                <input type="text" value={formData.stopSequences.join(', ')} onChange={e => setFormData({...formData, stopSequences: e.target.value.split(',').map(s => s.trim()).filter(s => s)})} className="w-full bg-background border border-border rounded px-3 py-2 focus:border-primary/50 outline-none" placeholder="Comma-separated stop sequences" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="radio" name="status" value="active" checked={formData.status === 'active'} onChange={e => setFormData({...formData, status: e.target.value})} /> Active</label>
                  <label className="flex items-center gap-2"><input type="radio" name="status" value="inactive" checked={formData.status === 'inactive'} onChange={e => setFormData({...formData, status: e.target.value})} /> Inactive</label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-text-muted hover:text-text-main transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-panel rounded hover:bg-primary/90 transition-colors">Save Model</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
