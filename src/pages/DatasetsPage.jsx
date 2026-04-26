import React, { useState, useEffect } from 'react';
import { Database, Upload, Plus, Search } from 'lucide-react';
import { cn } from '../utils/helpers';
import { timeAgo } from '../utils/helpers';
import { readLocalStorageJSON, writeLocalStorageJSON } from '../utils/helpers';

const DATASETS_KEY = 'pe_datasets';

const CATEGORIES = ['All', 'QA', 'Summarization', 'Classification', 'RAG', 'Custom'];

const CATEGORY_COLORS = {
  QA:             'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Summarization:  'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Classification: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  RAG:            'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Custom:         'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

const SEED_DATASETS = [
  {
    id: 'ds_seed_1',
    name: 'Medical QA',
    category: 'QA',
    version: 'v1',
    columns: ['symptom_1', 'symptom_2', 'age', 'expected_output'],
    rows: [
      { symptom_1: 'chest pain', symptom_2: 'shortness of breath', age: '54', expected_output: 'Possible cardiac event' },
      { symptom_1: 'headache', symptom_2: 'fever', age: '32', expected_output: 'Possible viral infection' },
      { symptom_1: 'joint pain', symptom_2: 'fatigue', age: '45', expected_output: 'Possible rheumatoid arthritis' },
    ],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ds_seed_2',
    name: 'Finance Eval',
    category: 'Classification',
    version: 'v1',
    columns: ['company', 'metric', 'period', 'expected_output'],
    rows: [
      { company: 'Acme Corp', metric: 'revenue_growth', period: 'Q3 2024', expected_output: 'Positive' },
      { company: 'Beta LLC', metric: 'profit_margin', period: 'Q2 2024', expected_output: 'Negative' },
      { company: 'Gamma Inc', metric: 'cash_flow', period: 'Q4 2024', expected_output: 'Neutral' },
    ],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ds_seed_3',
    name: 'Summarization Test',
    category: 'Summarization',
    version: 'v1',
    columns: ['article_text', 'expected_summary', 'max_words'],
    rows: [
      { article_text: 'Central banks worldwide raised interest rates...', expected_summary: 'Global rate hike cycle continues', max_words: '20' },
      { article_text: 'Scientists discovered a new exoplanet in the habitable zone...', expected_summary: 'New Earth-like planet found', max_words: '15' },
      { article_text: 'The electric vehicle market saw record adoption in 2024...', expected_summary: 'EV sales reach all-time high', max_words: '10' },
    ],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

function seedIfEmpty() {
  const existing = readLocalStorageJSON(DATASETS_KEY, null);
  if (!existing || !Array.isArray(existing) || existing.length === 0) {
    writeLocalStorageJSON(DATASETS_KEY, SEED_DATASETS);
    return SEED_DATASETS;
  }
  return existing;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [deletingId, setDeletingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  useEffect(() => {
    setDatasets(seedIfEmpty());
  }, []);

  const filtered = datasets.filter(ds => {
    const matchCat = activeCategory === 'All' || ds.category === activeCategory;
    const matchSearch = ds.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDuplicate = (ds) => {
    const copy = {
      ...ds,
      id: `ds_${Date.now()}`,
      name: `${ds.name} Copy`,
      version: 'v1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...datasets, copy];
    setDatasets(next);
    writeLocalStorageJSON(DATASETS_KEY, next);
  };

  const handleDelete = (id) => {
    if (deletingId === id) {
      const next = datasets.filter(d => d.id !== id);
      setDatasets(next);
      writeLocalStorageJSON(DATASETS_KEY, next);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  const handleCreate = (newDataset) => {
    const next = [...datasets, newDataset];
    setDatasets(next);
    writeLocalStorageJSON(DATASETS_KEY, next);
    setShowCreateModal(false);
    setSelectedDatasetId(newDataset.id);
  };

  const handleUpdateDataset = (updated) => {
    const next = datasets.map(d => d.id === updated.id ? updated : d);
    setDatasets(next);
    writeLocalStorageJSON(DATASETS_KEY, next);
  };

  const isEmpty = datasets.length === 0;

  if (selectedDatasetId && selectedDataset) {
    return (
      <DatasetDetail
        key={selectedDatasetId}
        dataset={selectedDataset}
        onBack={() => setSelectedDatasetId(null)}
        onUpdate={handleUpdateDataset}
      />
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300">

      {/* Top Bar */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Datasets</h2>
          <p className="text-text-muted">Manage evaluation datasets for prompt testing at scale.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-text-muted hover:text-text-main hover:border-primary/40 transition-colors text-sm">
            <Upload size={15} /> Upload File
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-panel font-medium hover:bg-primary/90 transition-colors text-sm">
            <Plus size={15} /> New Dataset
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      {!isEmpty && (
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-panel border border-border rounded-md text-sm focus:outline-none focus:border-primary/50 text-text-main placeholder:text-text-muted"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === cat
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'border-border text-text-muted hover:text-text-main hover:border-border/80'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database size={28} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">No datasets yet</h3>
            <p className="text-text-muted text-sm max-w-sm">
              Upload a CSV or JSON file, or create a dataset manually to start testing your prompts at scale.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-text-muted hover:text-text-main hover:border-primary/40 transition-colors text-sm">
              <Upload size={14} /> Upload File
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-panel font-medium hover:bg-primary/90 transition-colors text-sm">
              <Plus size={14} /> Create Manually
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {!isEmpty && filtered.length === 0 && (
        <p className="text-text-muted text-sm mt-8 text-center">No datasets match your search.</p>
      )}

      {!isEmpty && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(ds => (
            <DatasetCard
              key={ds.id}
              ds={ds}
              isDeleting={deletingId === ds.id}
              onView={() => setSelectedDatasetId(ds.id)}
              onDuplicate={() => handleDuplicate(ds)}
              onDelete={() => handleDelete(ds.id)}
              onCancelDelete={() => setDeletingId(null)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateDatasetModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {showUploadModal && (
        <UploadDatasetModal
          onClose={() => setShowUploadModal(false)}
          onImport={(ds) => {
            const next = [...datasets, ds];
            setDatasets(next);
            writeLocalStorageJSON(DATASETS_KEY, next);
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}

function DatasetCard({ ds, isDeleting, onView, onDuplicate, onDelete, onCancelDelete }) {
  const catColor = CATEGORY_COLORS[ds.category] || CATEGORY_COLORS.Custom;
  const colPreview = (ds.columns || []).slice(0, 4);
  const rowCount = (ds.rows || []).length;

  return (
    <div
      className="glass-panel rounded-lg p-5 group hover:border-primary/40 transition-all duration-200 cursor-pointer flex flex-col gap-3"
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-base leading-tight truncate">{ds.name}</h3>
        <span className={cn('text-xs font-mono px-2 py-0.5 rounded border shrink-0', catColor)}>
          {ds.category}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">
          {ds.version}
        </span>
        <span className="text-xs text-text-muted font-mono">
          {rowCount} {rowCount === 1 ? 'row' : 'rows'}
        </span>
        <span className="text-xs text-text-muted ml-auto">{timeAgo(ds.updatedAt)}</span>
      </div>

      {/* Column preview */}
      <div className="flex flex-wrap gap-1.5">
        {colPreview.map(col => (
          <span key={col} className="font-mono text-xs px-1.5 py-0.5 rounded bg-background border border-border text-text-muted">
            {col}
          </span>
        ))}
        {(ds.columns || []).length > 4 && (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-background border border-border text-text-muted">
            +{ds.columns.length - 4}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div
        className="flex items-center gap-3 pt-1 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        onClick={e => e.stopPropagation()}
      >
        {isDeleting ? (
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs text-text-muted flex-1">Delete this dataset?</span>
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={onCancelDelete}
              className="text-xs text-text-muted hover:text-text-main transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onView}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View
            </button>
            <button
              onClick={onDuplicate}
              className="text-xs text-text-muted hover:text-text-main transition-colors"
            >
              Duplicate
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-text-muted hover:text-red-400 transition-colors ml-auto"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateDatasetModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('QA');
  const [columns, setColumns] = useState(['']);
  const [nameError, setNameError] = useState('');

  const addColumn = () => setColumns(prev => [...prev, '']);

  const updateColumn = (i, val) =>
    setColumns(prev => prev.map((c, idx) => (idx === i ? val : c)));

  const removeColumn = (i) =>
    setColumns(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setNameError('Name is required'); return; }
    const validCols = columns.map(c => c.trim()).filter(Boolean);
    if (validCols.length === 0) { return; }
    const dataset = {
      id: `ds_${Date.now()}`,
      name: trimmedName,
      category,
      version: 'v1',
      columns: validCols,
      rows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onCreate(dataset);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border rounded-xl w-full max-w-lg p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Create Dataset</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Dataset Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError(''); }}
            placeholder="e.g. Medical QA v2"
            className={cn(
              'w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none text-text-main placeholder:text-text-muted',
              nameError ? 'border-red-500/60 focus:border-red-500' : 'border-border focus:border-primary/50'
            )}
            autoFocus
          />
          {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main"
          >
            {['QA', 'Summarization', 'Classification', 'RAG', 'Custom'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Column Builder */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Columns</label>
            <button
              onClick={addColumn}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Plus size={12} /> Add Column
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-muted w-6 shrink-0 text-right">{i + 1}.</span>
                <input
                  type="text"
                  value={col}
                  onChange={e => updateColumn(i, e.target.value)}
                  placeholder={`column_${i + 1}`}
                  className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/50 text-text-main placeholder:text-text-muted"
                />
                <button
                  onClick={() => removeColumn(i)}
                  disabled={columns.length === 1}
                  className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {columns.filter(c => c.trim()).length === 0 && (
            <p className="text-xs text-text-muted mt-1.5">At least one column name is required.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-1 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || columns.filter(c => c.trim()).length === 0}
            className="px-4 py-2 text-sm bg-primary text-panel font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Dataset
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadDatasetModal({ onClose, onImport }) {
  const [parsedData, setParsedData] = useState(null); // { columns, rows }
  const [name, setName] = useState('');
  const [category, setCategory] = useState('QA');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 1) return null;
    
    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const columns = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line);
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i] || '';
      });
      return row;
    });

    return { columns, rows };
  };

  const parseJSON = (text) => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        if (data.length === 0) return { columns: [], rows: [] };
        const columns = Object.keys(data[0]);
        return { columns, rows: data };
      } else if (data.columns && data.rows) {
        return data;
      }
      throw new Error('Invalid JSON format. Expected array of objects or {columns, rows}');
    } catch (e) {
      throw new Error('Failed to parse JSON: ' + e.message);
    }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');

    if (!isJson && !isCsv) {
      setError('Please upload a .csv or .json file.');
      return;
    }

    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let data;
        if (isJson) data = parseJSON(content);
        else data = parseCSV(content);

        if (!data || !data.columns || data.columns.length === 0) {
          throw new Error('File appears to be empty or missing headers.');
        }

        setParsedData(data);
        setName(file.name.replace(/\.[^/.]+$/, ""));
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to parse file.');
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    if (!parsedData || !name.trim()) return;
    const dataset = {
      id: `ds_${Date.now()}`,
      name: name.trim(),
      category,
      version: 'v1',
      columns: parsedData.columns,
      rows: parsedData.rows,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onImport(dataset);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-panel border border-border rounded-xl w-full max-w-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Upload Dataset</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors text-xl leading-none">×</button>
        </div>

        {!parsedData ? (
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <p className="font-medium text-text-main">Click to upload or drag and drop</p>
              <p className="text-sm text-text-muted mt-1">CSV or JSON (max 10MB)</p>
            </div>
            <input type="file" accept=".csv,.json" onChange={onFileChange} className="hidden" id="dataset-upload" />
            <label htmlFor="dataset-upload" className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-md text-sm font-medium hover:bg-primary/20 cursor-pointer transition-colors">
              Select File
            </label>
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-text-main">Dataset Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-text-main">Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-text-main"
                >
                  {['QA', 'Summarization', 'Classification', 'RAG', 'Custom'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-main">Data Preview (First 5 rows)</label>
                <span className="text-xs text-text-muted font-mono">{parsedData.rows.length} total rows</span>
              </div>
              <div className="border border-border rounded-lg overflow-hidden bg-background max-h-64 overflow-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-panel border-b border-border">
                      {parsedData.columns.map(col => (
                        <th key={col} className="px-3 py-2 font-mono text-text-muted uppercase tracking-wider border-r border-border last:border-0">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {parsedData.columns.map(col => (
                          <td key={col} className="px-3 py-2 border-r border-border last:border-0 truncate max-w-[150px] text-text-main">{String(row[col] || '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <button onClick={() => setParsedData(null)} className="text-sm text-text-muted hover:text-text-main transition-colors">Choose different file</button>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors">Cancel</button>
                <button onClick={handleImport} className="px-6 py-2 text-sm bg-primary text-panel font-bold rounded-md hover:bg-primary/90 transition-colors">Import Dataset</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DatasetDetail({ dataset, onBack, onUpdate }) {
  // Ensure columns is always an array and rows is always an array
  const initialDataset = {
    ...dataset,
    columns: Array.isArray(dataset.columns) ? dataset.columns : (dataset.rows?.[0] ? Object.keys(dataset.rows[0]) : []),
    rows: Array.isArray(dataset.rows) ? dataset.rows : []
  };
  const [localDataset, setLocalDataset] = useState(initialDataset);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved', 'Saving...', 'Error'
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName }
  const [editingHeader, setEditingHeader] = useState(null); // colIndex

  // Sync with prop if it changes (e.g. switching datasets)
  useEffect(() => {
    setLocalDataset(dataset);
    setSelectedRows(new Set());
    setEditingCell(null);
    setEditingHeader(null);
  }, [dataset.id]);

  // Autosave with debounce
  useEffect(() => {
    // Basic structural check for equality
    if (localDataset.name === dataset.name && 
        localDataset.rows.length === dataset.rows.length &&
        JSON.stringify(localDataset.columns) === JSON.stringify(dataset.columns)) {
      // Deep check only if structure is same
      if (JSON.stringify(localDataset.rows) === JSON.stringify(dataset.rows)) return;
    }
    
    setSaveStatus('Saving...');
    const timer = setTimeout(() => {
      onUpdate(localDataset);
      setSaveStatus('Saved');
    }, 800);
    
    return () => clearTimeout(timer);
  }, [localDataset, onUpdate, dataset]);

  const addRow = () => {
    const newRow = {};
    localDataset.columns.forEach(col => newRow[col] = '');
    setLocalDataset({
      ...localDataset,
      rows: [...localDataset.rows, newRow],
      updatedAt: new Date().toISOString()
    });
  };

  const deleteRow = (index) => {
    const newRows = localDataset.rows.filter((_, i) => i !== index);
    setLocalDataset({
      ...localDataset,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
    const newSelected = new Set(selectedRows);
    newSelected.delete(index);
    setSelectedRows(newSelected);
  };

  const deleteSelectedRows = () => {
    const newRows = localDataset.rows.filter((_, i) => !selectedRows.has(i));
    setLocalDataset({
      ...localDataset,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
    setSelectedRows(new Set());
  };

  const addColumn = () => {
    const colName = `column_${localDataset.columns.length + 1}`;
    const newRows = localDataset.rows.map(row => ({ ...row, [colName]: '' }));
    setLocalDataset({
      ...localDataset,
      columns: [...localDataset.columns, colName],
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteColumn = (colName) => {
    if (localDataset.columns.length <= 1) return;
    const newColumns = localDataset.columns.filter(c => c !== colName);
    const newRows = localDataset.rows.map(row => {
      const { [colName]: _, ...rest } = row;
      return rest;
    });
    setLocalDataset({
      ...localDataset,
      columns: newColumns,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
  };

  const updateCell = (rowIndex, colName, value) => {
    const newRows = [...localDataset.rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colName]: value };
    setLocalDataset({
      ...localDataset,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
  };

  const updateHeader = (index, newName) => {
    const oldName = localDataset.columns[index];
    if (!newName || newName === oldName) { setEditingHeader(null); return; }
    
    const newColumns = [...localDataset.columns];
    newColumns[index] = newName;
    
    const newRows = localDataset.rows.map(row => {
      const { [oldName]: val, ...rest } = row;
      return { ...rest, [newName]: val };
    });
    
    setLocalDataset({
      ...localDataset,
      columns: newColumns,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
    setEditingHeader(null);
  };

  const exportCSV = () => {
    const headers = localDataset.columns.join(',');
    const rows = localDataset.rows.map(row => 
      localDataset.columns.map(col => `"${String(row[col] || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${localDataset.name}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(localDataset.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${localDataset.name}.json`;
    a.click();
  };

  return (
    <div className="flex h-full overflow-hidden animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <div className="p-4 border-b border-border bg-panel flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="text-text-muted hover:text-text-main flex items-center gap-1 transition-colors">
                <span className="text-xl">←</span>
                <span className="text-sm font-medium">Back to Datasets</span>
              </button>
              <div className="h-4 w-[1px] bg-border mx-2"></div>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={localDataset.name} 
                  onChange={e => setLocalDataset({...localDataset, name: e.target.value})}
                  className="bg-transparent text-lg font-bold border-none focus:outline-none focus:ring-0 text-text-main hover:bg-white/5 rounded px-2"
                />
                <span className="text-xs font-mono px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">{localDataset.version}</span>
                <span className="text-xs text-text-muted">{localDataset.rows.length} rows</span>
                <span className={cn("text-xs transition-opacity duration-300", saveStatus === 'Saving...' ? "text-primary opacity-100" : "text-text-muted opacity-60")}>
                  {saveStatus}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-text-muted hover:text-text-main transition-colors">Export CSV</button>
              <button onClick={exportJSON} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-text-muted hover:text-text-main transition-colors">Export JSON</button>
              <button onClick={addRow} className="px-3 py-1.5 rounded-md bg-primary text-panel text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1">
                <Plus size={14} /> Add Row
              </button>
              <button onClick={() => setShowVersionHistory(!showVersionHistory)} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-text-muted hover:text-text-main transition-colors">History</button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRows.size > 0 && (
          <div className="mx-6 mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between animate-in slide-in-from-top duration-200">
            <span className="text-sm text-primary font-medium">{selectedRows.size} rows selected</span>
            <div className="flex gap-4">
              <button onClick={deleteSelectedRows} className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider">Delete selected</button>
              <button onClick={() => setSelectedRows(new Set())} className="text-xs font-bold text-text-muted hover:text-text-main transition-colors uppercase tracking-wider">Clear selection</button>
            </div>
          </div>
        )}

        {/* Spreadsheet Table */}
        <div className="flex-1 overflow-auto p-6 scrollbar-thin">
          <div className="border border-border rounded-lg bg-panel overflow-hidden">
            <table className="w-full text-left text-sm border-collapse table-auto">
              <thead>
                <tr className="bg-background/50 border-b border-border">
                  <th className="w-12 px-4 py-3 sticky top-0 bg-background/50 border-r border-border">
                    <input 
                      type="checkbox" 
                      checked={selectedRows.size > 0 && selectedRows.size === localDataset.rows.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRows(new Set(localDataset.rows.map((_, i) => i)));
                        else setSelectedRows(new Set());
                      }}
                    />
                  </th>
                  <th className="w-12 px-2 py-3 sticky top-0 bg-background/50 border-r border-border text-[10px] text-text-muted font-mono text-center">#</th>
                  {localDataset.columns.map((col, i) => (
                    <th key={`${col}-${i}`} className="px-4 py-3 sticky top-0 bg-background/50 border-r border-border min-w-[180px] group relative">
                      {editingHeader === i ? (
                        <input 
                          autoFocus
                          defaultValue={col}
                          onBlur={e => updateHeader(i, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') updateHeader(i, e.target.value); }}
                          className="w-full bg-background border border-primary/50 rounded px-1 text-text-main focus:outline-none font-mono text-xs"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest truncate cursor-text" onClick={() => setEditingHeader(i)}>
                            {col}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteColumn(col); }}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all text-xs leading-none ml-2"
                            title="Delete Column"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="w-12 sticky top-0 bg-background/50">
                    <button onClick={addColumn} className="w-full h-full flex items-center justify-center text-text-muted hover:text-primary transition-colors">
                      <Plus size={16} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {localDataset.rows.length === 0 ? (
                  <tr>
                    <td colSpan={localDataset.columns.length + 3} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Database size={40} className="text-text-muted opacity-20" />
                        <p className="text-text-muted">No rows yet</p>
                        <button onClick={addRow} className="text-primary hover:underline text-sm font-medium">Add first row</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  localDataset.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border hover:bg-white/[0.02] group transition-colors">
                      <td className="px-4 py-2 border-r border-border">
                        <input 
                          type="checkbox" 
                          checked={selectedRows.has(rowIndex)}
                          onChange={() => {
                            const next = new Set(selectedRows);
                            if (next.has(rowIndex)) next.delete(rowIndex);
                            else next.add(rowIndex);
                            setSelectedRows(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 border-r border-border text-[10px] text-text-muted font-mono text-center">{rowIndex + 1}</td>
                      {localDataset.columns.map((col, i) => (
                        <td 
                          key={`${col}-${i}`} 
                          className="px-4 py-2 border-r border-border truncate max-w-md relative group/cell"
                          onClick={() => setEditingCell({ rowIndex, colName: col })}
                        >
                          {editingCell?.rowIndex === rowIndex && editingCell?.colName === col ? (
                            <textarea 
                              autoFocus
                              defaultValue={row[col]}
                              onBlur={e => { updateCell(rowIndex, col, e.target.value); setEditingCell(null); }}
                              onKeyDown={e => { 
                                if (e.key === 'Enter' && !e.shiftKey) { updateCell(rowIndex, col, e.target.value); setEditingCell(null); }
                                if (e.key === 'Tab') {
                                  e.preventDefault();
                                  updateCell(rowIndex, col, e.target.value);
                                  const colIdx = localDataset.columns.indexOf(col);
                                  if (colIdx < localDataset.columns.length - 1) {
                                    setEditingCell({ rowIndex, colName: localDataset.columns[colIdx + 1] });
                                  } else if (rowIndex < localDataset.rows.length - 1) {
                                    setEditingCell({ rowIndex: rowIndex + 1, colName: localDataset.columns[0] });
                                  } else {
                                    setEditingCell(null);
                                  }
                                }
                              }}
                              className="absolute inset-0 w-full h-full bg-background border border-primary/50 z-10 px-4 py-2 focus:outline-none text-text-main resize-none overflow-hidden"
                            />
                          ) : (
                            <span className="block min-h-[1.25rem]">{row[col] || <span className="text-text-muted/30 italic">empty</span>}</span>
                          )}
                        </td>
                      ))}
                      <td className="w-12 text-center relative">
                        <button 
                          onClick={() => deleteRow(rowIndex)}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-1"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Version History Sidebar */}
      {showVersionHistory && (
        <div className="w-80 bg-panel border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold">Version History</h3>
            <button onClick={() => setShowVersionHistory(false)} className="text-text-muted hover:text-text-main">×</button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold text-primary">v1 (Current)</span>
                <span className="text-[10px] text-text-muted font-mono">{new Date(localDataset.updatedAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-text-muted">{localDataset.rows.length} rows</p>
            </div>
            <p className="text-center py-10 text-xs text-text-muted font-mono uppercase tracking-widest opacity-40">No other versions</p>
          </div>
          <div className="p-4 border-t border-border">
            <button className="w-full py-2 bg-white/5 border border-border rounded-md text-xs font-bold hover:bg-white/10 transition-colors uppercase tracking-wider">Save new version</button>
          </div>
        </div>
      )}
    </div>
  );
}
