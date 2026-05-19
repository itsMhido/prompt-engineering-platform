import { useEffect, useMemo, useState } from 'react';
import { Database, Upload, Plus, Search } from 'lucide-react';
import { cn, timeAgo } from '../utils/helpers';
import {
  createDataset,
  getDataset,
  importDataset,
  listDatasets,
  removeDataset,
  updateDataset
} from '../utils/api';

const CATEGORIES = ['All', 'QA', 'Summarization', 'Classification', 'RAG', 'Custom'];

const CATEGORY_COLORS = {
  QA: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Summarization: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Classification: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  RAG: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Custom: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [deletingId, setDeletingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [error, setError] = useState('');

  const refreshDatasets = async () => {
    const nextDatasets = await listDatasets();
    setDatasets(nextDatasets);
  };

  useEffect(() => {
    refreshDatasets().catch((err) => setError(err.message || 'Failed to load datasets.'));
  }, []);

  const filtered = useMemo(() => {
    return datasets.filter((dataset) => {
      const matchCat = activeCategory === 'All' || dataset.category === activeCategory;
      const matchSearch = dataset.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [datasets, search, activeCategory]);

  const handleOpenDataset = async (datasetId) => {
    try {
      const dataset = await getDataset(datasetId);
      setSelectedDataset(dataset);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dataset details.');
    }
  };

  const handleDuplicate = async (datasetId) => {
    try {
      const source = await getDataset(datasetId);
      const copy = await createDataset({
        name: `${source.name} Copy`,
        category: source.category,
        version: 'v1',
        columns: source.columns,
        rows: source.rows
      });

      await refreshDatasets();
      setSelectedDataset(copy);
    } catch (err) {
      setError(err.message || 'Failed to duplicate dataset.');
    }
  };

  const handleDelete = async (id) => {
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }

    try {
      await removeDataset(id);
      setDeletingId(null);
      if (selectedDataset?.id === id) {
        setSelectedDataset(null);
      }
      await refreshDatasets();
    } catch (err) {
      setError(err.message || 'Failed to delete dataset.');
    }
  };

  const handleCreate = async (payload) => {
    try {
      const created = await createDataset(payload);
      await refreshDatasets();
      setShowCreateModal(false);
      setSelectedDataset(created);
    } catch (err) {
      setError(err.message || 'Failed to create dataset.');
    }
  };

  const handleImport = async (payload) => {
    try {
      const created = await importDataset(payload);
      await refreshDatasets();
      setShowUploadModal(false);
      setSelectedDataset(created);
    } catch (err) {
      setError(err.message || 'Failed to import dataset.');
    }
  };

  const handleUpdateDataset = async (updated) => {
    const saved = await updateDataset(updated.id, {
      name: updated.name,
      category: updated.category,
      version: updated.version,
      columns: updated.columns,
      rows: updated.rows
    });

    setSelectedDataset(saved);
    setDatasets((prev) => prev.map((dataset) => (
      dataset.id === saved.id
        ? { ...dataset, ...saved, rowCount: saved.rowCount, updatedAt: saved.updatedAt }
        : dataset
    )));
  };

  const isEmpty = datasets.length === 0;

  if (selectedDataset) {
    return (
      <DatasetDetail
        key={selectedDataset.id}
        dataset={selectedDataset}
        onBack={() => setSelectedDataset(null)}
        onUpdate={handleUpdateDataset}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Datasets</h2>
          <p className="text-text-muted">Manage evaluation datasets for prompt testing at scale.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:border-primary/40 hover:text-text-main">
            <Upload size={15} /> Upload File
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-panel transition-colors hover:bg-primary/90">
            <Plus size={15} /> New Dataset
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!isEmpty && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="relative w-72">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-panel py-2 pl-9 pr-3 text-sm text-text-main placeholder:text-text-muted focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeCategory === category
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border text-text-muted hover:border-border/80 hover:text-text-main'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Database size={28} className="text-primary" />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-semibold">No datasets yet</h3>
            <p className="max-w-sm text-sm text-text-muted">
              Upload a CSV or JSON file, or create a dataset manually to start testing your prompts at scale.
            </p>
          </div>
          <div className="mt-2 flex gap-3">
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:border-primary/40 hover:text-text-main">
              <Upload size={14} /> Upload File
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-panel transition-colors hover:bg-primary/90">
              <Plus size={14} /> Create Manually
            </button>
          </div>
        </div>
      )}

      {!isEmpty && filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-text-muted">No datasets match your search.</p>
      )}

      {!isEmpty && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              ds={dataset}
              isDeleting={deletingId === dataset.id}
              onView={() => handleOpenDataset(dataset.id)}
              onDuplicate={() => handleDuplicate(dataset.id)}
              onDelete={() => handleDelete(dataset.id)}
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
          onImport={handleImport}
        />
      )}
    </div>
  );
}

function DatasetCard({ ds, isDeleting, onView, onDuplicate, onDelete, onCancelDelete }) {
  const catColor = CATEGORY_COLORS[ds.category] || CATEGORY_COLORS.Custom;
  const colPreview = (ds.columns || []).slice(0, 4);
  const rowCount = ds.rowCount || 0;

  return (
    <div className="glass-panel group flex cursor-pointer flex-col gap-3 rounded-lg p-5 transition-all duration-200 hover:border-primary/40" onClick={onView}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-base font-semibold leading-tight">{ds.name}</h3>
        <span className={cn('shrink-0 rounded border px-2 py-0.5 font-mono text-xs', catColor)}>
          {ds.category}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
          {ds.version}
        </span>
        <span className="font-mono text-xs text-text-muted">
          {rowCount} {rowCount === 1 ? 'row' : 'rows'}
        </span>
        <span className="ml-auto text-xs text-text-muted">{timeAgo(ds.updatedAt)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {colPreview.map((column) => (
          <span key={column} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-text-muted">
            {column}
          </span>
        ))}
        {(ds.columns || []).length > 4 && (
          <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-text-muted">
            +{ds.columns.length - 4}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        {isDeleting ? (
          <div className="flex w-full items-center gap-3">
            <span className="flex-1 text-xs text-text-muted">Delete this dataset?</span>
            <button onClick={onDelete} className="text-xs font-medium text-red-400 transition-colors hover:text-red-300">
              Confirm
            </button>
            <button onClick={onCancelDelete} className="text-xs text-text-muted transition-colors hover:text-text-main">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button onClick={onView} className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
              View
            </button>
            <button onClick={onDuplicate} className="text-xs text-text-muted transition-colors hover:text-text-main">
              Duplicate
            </button>
            <button onClick={onDelete} className="ml-auto text-xs text-text-muted transition-colors hover:text-red-400">
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

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const addColumn = () => setColumns((prev) => [...prev, '']);

  const updateColumn = (index, value) => {
    setColumns((prev) => prev.map((column, columnIndex) => (columnIndex === index ? value : column)));
  };

  const removeColumn = (index) => {
    setColumns((prev) => prev.length > 1 ? prev.filter((_, columnIndex) => columnIndex !== index) : prev);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Name is required');
      return;
    }

    const validColumns = columns.map((column) => column.trim()).filter(Boolean);
    if (validColumns.length === 0) {
      return;
    }

    onCreate({
      name: trimmedName,
      category,
      version: 'v1',
      columns: validColumns,
      rows: []
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-border bg-panel p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Create Dataset</h3>
          <button onClick={onClose} className="text-xl leading-none text-text-muted transition-colors hover:text-text-main">×</button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Dataset Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError('');
            }}
            placeholder="e.g. Medical QA v2"
            className={cn(
              'w-full rounded border bg-background px-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none',
              nameError ? 'border-red-500/60 focus:border-red-500' : 'border-border focus:border-primary/50'
            )}
            autoFocus
          />
          {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
            {['QA', 'Summarization', 'Classification', 'RAG', 'Custom'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Columns</label>
            <button onClick={addColumn} className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
              <Plus size={12} /> Add Column
            </button>
          </div>
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
            {columns.map((column, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-text-muted">{index + 1}.</span>
                <input
                  type="text"
                  value={column}
                  onChange={(e) => updateColumn(index, e.target.value)}
                  placeholder={`column_${index + 1}`}
                  className="flex-1 rounded border border-border bg-background px-3 py-1.5 font-mono text-sm text-text-main placeholder:text-text-muted focus:border-primary/50 focus:outline-none"
                />
                <button onClick={() => removeColumn(index)} disabled={columns.length === 1} className="text-lg leading-none text-text-muted transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-main">Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim() || columns.filter((column) => column.trim()).length === 0} className="rounded bg-primary px-4 py-2 text-sm font-medium text-panel transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
            Create Dataset
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadDatasetModal({ onClose, onImport }) {
  const [parsedData, setParsedData] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('QA');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 1) {
      return null;
    }

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const character = line[i];
        if (character === '"') {
          inQuotes = !inQuotes;
        } else if (character === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += character;
        }
      }
      result.push(current.trim());
      return result;
    };

    const columns = parseLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseLine(line);
      const row = {};
      columns.forEach((column, index) => {
        row[column] = values[index] || '';
      });
      return row;
    });

    return { columns, rows };
  };

  const parseJSON = (text) => {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { columns: [], rows: [] };
      }
      return { columns: Object.keys(data[0]), rows: data };
    }

    if (data.columns && data.rows) {
      return data;
    }

    throw new Error('Invalid JSON format. Expected an array of objects or {columns, rows}.');
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');

    if (!isJson && !isCsv) {
      setError('Please upload a .csv or .json file.');
      return;
    }

    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const data = isJson ? parseJSON(content) : parseCSV(content);
        if (!data || !data.columns || data.columns.length === 0) {
          throw new Error('File appears to be empty or missing headers.');
        }

        setParsedData(data);
        setName(file.name.replace(/\.[^/.]+$/, ''));
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to parse file.');
      }
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedData || !name.trim()) {
      return;
    }

    onImport({
      name: name.trim(),
      category,
      version: 'v1',
      columns: parsedData.columns,
      rows: parsedData.rows
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-panel p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Upload Dataset</h3>
          <button onClick={onClose} className="text-xl leading-none text-text-muted transition-colors hover:text-text-main">×</button>
        </div>

        {!parsedData ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                handleFile(file);
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <p className="font-medium text-text-main">Click to upload or drag and drop</p>
              <p className="mt-1 text-sm text-text-muted">CSV or JSON (max 10MB)</p>
            </div>
            <input type="file" accept=".csv,.json" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} className="hidden" id="dataset-upload" />
            <label htmlFor="dataset-upload" className="cursor-pointer rounded-md border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
              Select File
            </label>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-main">Dataset Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-main">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary/50 focus:outline-none">
                  {['QA', 'Summarization', 'Classification', 'RAG', 'Custom'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-text-main">Data Preview (First 5 rows)</label>
                <span className="font-mono text-xs text-text-muted">{parsedData.rows.length} total rows</span>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-border bg-background">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-panel">
                      {parsedData.columns.map((column) => (
                        <th key={column} className="border-r border-border px-3 py-2 font-mono uppercase tracking-wider text-text-muted last:border-0">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        {parsedData.columns.map((column) => (
                          <td key={column} className="max-w-[150px] truncate border-r border-border px-3 py-2 text-text-main last:border-0">{String(row[column] || '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <button onClick={() => setParsedData(null)} className="text-sm text-text-muted transition-colors hover:text-text-main">Choose different file</button>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-main">Cancel</button>
                <button onClick={handleImport} className="rounded-md bg-primary px-6 py-2 text-sm font-bold text-panel transition-colors hover:bg-primary/90">Import Dataset</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DatasetDetail({ dataset, onBack, onUpdate }) {
  const [localDataset, setLocalDataset] = useState({
    ...dataset,
    columns: Array.isArray(dataset.columns) ? dataset.columns : [],
    rows: Array.isArray(dataset.rows) ? dataset.rows : []
  });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingHeader, setEditingHeader] = useState(null);

  useEffect(() => {
    setLocalDataset({
      ...dataset,
      columns: Array.isArray(dataset.columns) ? dataset.columns : [],
      rows: Array.isArray(dataset.rows) ? dataset.rows : []
    });
    setSelectedRows(new Set());
    setEditingCell(null);
    setEditingHeader(null);
    setSaveStatus('Saved');
  }, [dataset]);

  useEffect(() => {
    const unchanged = (
      localDataset.name === dataset.name
      && localDataset.category === dataset.category
      && localDataset.version === dataset.version
      && JSON.stringify(localDataset.columns) === JSON.stringify(dataset.columns)
      && JSON.stringify(localDataset.rows) === JSON.stringify(dataset.rows)
    );

    if (unchanged) {
      return;
    }

    setSaveStatus('Saving...');
    const timer = setTimeout(async () => {
      try {
        await onUpdate(localDataset);
        setSaveStatus('Saved');
      } catch {
        setSaveStatus('Error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [localDataset, dataset, onUpdate]);

  const addRow = () => {
    const newRow = {};
    localDataset.columns.forEach((column) => {
      newRow[column] = '';
    });

    setLocalDataset((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow]
    }));
  };

  const deleteRow = (index) => {
    setLocalDataset((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index)
    }));

    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const deleteSelectedRows = () => {
    setLocalDataset((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, index) => !selectedRows.has(index))
    }));
    setSelectedRows(new Set());
  };

  const addColumn = () => {
    const columnName = `column_${localDataset.columns.length + 1}`;
    const nextRows = localDataset.rows.map((row) => ({ ...row, [columnName]: '' }));
    setLocalDataset((prev) => ({
      ...prev,
      columns: [...prev.columns, columnName],
      rows: nextRows
    }));
  };

  const deleteColumn = (columnName) => {
    if (localDataset.columns.length <= 1) {
      return;
    }

    const nextColumns = localDataset.columns.filter((column) => column !== columnName);
    const nextRows = localDataset.rows.map((row) => (
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== columnName))
    ));

    setLocalDataset((prev) => ({
      ...prev,
      columns: nextColumns,
      rows: nextRows
    }));
  };

  const updateCell = (rowIndex, columnName, value) => {
    const nextRows = [...localDataset.rows];
    nextRows[rowIndex] = { ...nextRows[rowIndex], [columnName]: value };
    setLocalDataset((prev) => ({ ...prev, rows: nextRows }));
  };

  const updateHeader = (index, newName) => {
    const oldName = localDataset.columns[index];
    if (!newName || newName === oldName) {
      setEditingHeader(null);
      return;
    }

    const nextColumns = [...localDataset.columns];
    nextColumns[index] = newName;
    const nextRows = localDataset.rows.map((row) => {
      const { [oldName]: value, ...rest } = row;
      return { ...rest, [newName]: value };
    });

    setLocalDataset((prev) => ({
      ...prev,
      columns: nextColumns,
      rows: nextRows
    }));
    setEditingHeader(null);
  };

  const exportCSV = () => {
    const headers = localDataset.columns.join(',');
    const rows = localDataset.rows.map((row) => (
      localDataset.columns.map((column) => `"${String(row[column] || '').replace(/"/g, '""')}"`).join(',')
    )).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${localDataset.name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(localDataset.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${localDataset.name}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full overflow-hidden animate-in fade-in duration-300">
      <div className="flex flex-1 min-w-0 flex-col bg-background">
        <div className="flex flex-col gap-4 border-b border-border bg-panel p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-1 text-text-muted transition-colors hover:text-text-main">
                <span className="text-xl">←</span>
                <span className="text-sm font-medium">Back to Datasets</span>
              </button>
              <div className="mx-2 h-4 w-[1px] bg-border" />
              <div className="flex items-center gap-3">
                <input type="text" value={localDataset.name} onChange={(e) => setLocalDataset({ ...localDataset, name: e.target.value })} className="rounded bg-transparent px-2 text-lg font-bold text-text-main hover:bg-white/5 focus:outline-none focus:ring-0" />
                <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{localDataset.version}</span>
                <span className="text-xs text-text-muted">{localDataset.rows.length} rows</span>
                <span className={cn('text-xs transition-opacity duration-300', saveStatus === 'Saving...' ? 'text-primary opacity-100' : saveStatus === 'Error' ? 'text-red-400 opacity-100' : 'text-text-muted opacity-60')}>
                  {saveStatus}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-main">Export CSV</button>
              <button onClick={exportJSON} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-main">Export JSON</button>
              <button onClick={addRow} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-panel transition-colors hover:bg-primary/90">
                <Plus size={14} /> Add Row
              </button>
              <button onClick={() => setShowVersionHistory((prev) => !prev)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-main">History</button>
            </div>
          </div>
        </div>

        {selectedRows.size > 0 && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3 animate-in slide-in-from-top duration-200">
            <span className="text-sm font-medium text-primary">{selectedRows.size} rows selected</span>
            <div className="flex gap-4">
              <button onClick={deleteSelectedRows} className="text-xs font-bold uppercase tracking-wider text-red-400 transition-colors hover:text-red-300">Delete selected</button>
              <button onClick={() => setSelectedRows(new Set())} className="text-xs font-bold uppercase tracking-wider text-text-muted transition-colors hover:text-text-main">Clear selection</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-hidden rounded-lg border border-border bg-panel">
            <table className="w-full table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="sticky top-0 w-12 border-r border-border bg-background/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size > 0 && selectedRows.size === localDataset.rows.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(localDataset.rows.map((_, index) => index)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="sticky top-0 w-12 border-r border-border bg-background/50 px-2 py-3 text-center font-mono text-[10px] text-text-muted">#</th>
                  {localDataset.columns.map((column, index) => (
                    <th key={`${column}-${index}`} className="group relative sticky top-0 min-w-[180px] border-r border-border bg-background/50 px-4 py-3">
                      {editingHeader === index ? (
                        <input autoFocus defaultValue={column} onBlur={(e) => updateHeader(index, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateHeader(index, e.target.value)} className="w-full rounded border border-primary/50 bg-background px-1 font-mono text-xs text-text-main focus:outline-none" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="cursor-text truncate font-mono text-[10px] uppercase tracking-widest text-text-muted" onClick={() => setEditingHeader(index)}>{column}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteColumn(column); }} className="ml-2 text-xs leading-none text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:text-red-400" title="Delete Column">
                            ×
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="sticky top-0 w-12 bg-background/50">
                    <button onClick={addColumn} className="flex h-full w-full items-center justify-center text-text-muted transition-colors hover:text-primary">
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
                        <button onClick={addRow} className="text-sm font-medium text-primary hover:underline">Add first row</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  localDataset.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="group border-b border-border transition-colors hover:bg-white/[0.02]">
                      <td className="border-r border-border px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(rowIndex)}
                          onChange={() => {
                            const next = new Set(selectedRows);
                            if (next.has(rowIndex)) {
                              next.delete(rowIndex);
                            } else {
                              next.add(rowIndex);
                            }
                            setSelectedRows(next);
                          }}
                        />
                      </td>
                      <td className="border-r border-border px-2 py-2 text-center font-mono text-[10px] text-text-muted">{rowIndex + 1}</td>
                      {localDataset.columns.map((column, columnIndex) => (
                        <td key={`${column}-${columnIndex}`} className="group/cell relative max-w-md truncate border-r border-border px-4 py-2" onClick={() => setEditingCell({ rowIndex, colName: column })}>
                          {editingCell?.rowIndex === rowIndex && editingCell?.colName === column ? (
                            <textarea
                              autoFocus
                              defaultValue={row[column]}
                              onBlur={(e) => {
                                updateCell(rowIndex, column, e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  updateCell(rowIndex, column, e.target.value);
                                  setEditingCell(null);
                                }
                              }}
                              className="absolute inset-0 z-10 h-full w-full resize-none overflow-hidden border border-primary/50 bg-background px-4 py-2 text-text-main focus:outline-none"
                            />
                          ) : (
                            <span className="block min-h-[1.25rem]">{row[column] || <span className="italic text-text-muted/30">empty</span>}</span>
                          )}
                        </td>
                      ))}
                      <td className="relative w-12 text-center">
                        <button onClick={() => deleteRow(rowIndex)} className="p-1 text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:text-red-400">
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

      {showVersionHistory && (
        <div className="flex w-80 flex-col border-l border-border bg-panel animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-bold">Version History</h3>
            <button onClick={() => setShowVersionHistory(false)} className="text-text-muted hover:text-text-main">×</button>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-1 flex items-start justify-between">
                <span className="text-sm font-bold text-primary">Current</span>
                <span className="font-mono text-[10px] text-text-muted">{new Date(dataset.updatedAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-text-muted">{localDataset.rows.length} rows</p>
            </div>
            <p className="py-10 text-center font-mono text-xs uppercase tracking-widest text-text-muted opacity-40">Dataset revisions are server-backed through the current version only</p>
          </div>
        </div>
      )}
    </div>
  );
}
