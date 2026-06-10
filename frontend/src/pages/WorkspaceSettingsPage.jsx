import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { updateCurrentUser, updateWorkspace } from '../utils/api';
import * as api from '../utils/api';
import { getUser, getWorkspace } from '../utils/auth';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

export default function WorkspaceSettingsPage({ session, onLogout }) {
  const user = session?.user || getUser();
  const workspace = session?.workspace || getWorkspace();
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || 'My Workspace');
  const [displayName, setDisplayName] = useState(user?.name || 'User');
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    setWorkspaceName(workspace?.name || 'My Workspace');
    setDisplayName(user?.name || 'User');
  }, [workspace?.name, user?.name]);

  const [metrics, setMetrics] = useState([]);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [newMetric, setNewMetric] = useState({ name: '', description: '', isInverse: false, isDefault: true });
  const [metricToDelete, setMetricToDelete] = useState(null);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    api.getMetrics().then(r => setMetrics(r.metrics)).catch(console.error);
  }, []);

  const handleToggleDefault = async (metric) => {
    try {
      const updated = await api.updateMetric(metric.id, { isDefault: !metric.isDefault });
      setMetrics(prev => prev.map(m => m.id === metric.id ? updated.metric : m));
    } catch (err) {
      setAlertState({ isOpen: true, title: 'Error', message: 'Failed to update metric' });
    }
  };

  const handleDeleteMetric = async () => {
    if (!metricToDelete) return;
    try {
      await api.deleteMetric(metricToDelete.id);
      setMetrics(prev => prev.filter(m => m.id !== metricToDelete.id));
    } catch (err) {
      setAlertState({ isOpen: true, title: 'Error', message: err.message || 'Failed to delete metric' });
    } finally {
      setMetricToDelete(null);
    }
  };

  const handleAddMetric = async () => {
    if (!newMetric.name || !newMetric.description) {
      setAlertState({ isOpen: true, title: 'Error', message: 'Name and description are required' });
      return;
    }
    try {
      const created = await api.createMetric(newMetric);
      setMetrics(prev => [...prev, created.metric]);
      setIsAddingMetric(false);
      setNewMetric({ name: '', description: '', isInverse: false, isDefault: true });
    } catch (err) {
      setAlertState({ isOpen: true, title: 'Error', message: err.message || 'Failed to create metric' });
    }
  };

  const saveWorkspaceName = async () => {
    const name = workspaceName.trim();
    if (!name || !workspace?.id) {
      setWorkspaceError('Workspace name is required');
      return;
    }

    try {
      setWorkspaceError('');
      const saved = await updateWorkspace(workspace.id, { name });
      setWorkspaceName(saved.name);
      setWorkspaceSaved(true);
      setEditingWorkspace(false);
      setTimeout(() => setWorkspaceSaved(false), 1800);
    } catch (err) {
      setWorkspaceError(err.message || 'Failed to update workspace');
    }
  };

  const saveDisplayName = async () => {
    const name = displayName.trim();
    if (!name) {
      setNameError('Display name is required');
      return;
    }

    try {
      setNameError('');
      const saved = await updateCurrentUser({ name });
      setDisplayName(saved.name);
      setNameSaved(true);
      setEditingName(false);
      setTimeout(() => setNameSaved(false), 1800);
    } catch (err) {
      setNameError(err.message || 'Failed to update display name');
    }
  };

  const handleEditKeyDown = (event, onSave, onCancel) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }

    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Workspace Settings</h2>
        <p className="text-text-muted">Manage your workspace and account profile.</p>
      </div>

      <div className="max-w-3xl space-y-8">
        <section className="border-b border-border pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Workspace</h3>
            {workspaceSaved && <SavedIndicator />}
          </div>
          <SettingRow label="Workspace name">
            {editingWorkspace ? (
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                onKeyDown={(event) => handleEditKeyDown(
                  event,
                  saveWorkspaceName,
                  () => {
                    setWorkspaceName(workspace?.name || 'My Workspace');
                    setEditingWorkspace(false);
                    setWorkspaceError('');
                  }
                )}
                className="w-full rounded border border-primary/50 bg-background px-3 py-2 text-sm text-text-main focus:outline-none"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingWorkspace(true)}
                className="w-full rounded border border-border bg-panel px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
              >
                {workspaceName}
              </button>
            )}
            {workspaceError && <p className="mt-1 text-xs text-red-400">{workspaceError}</p>}
          </SettingRow>
        </section>

        <section className="border-b border-border pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Account</h3>
            {nameSaved && <SavedIndicator />}
          </div>
          <div className="space-y-4">
            <SettingRow label="Display name">
              {editingName ? (
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onKeyDown={(event) => handleEditKeyDown(
                    event,
                    saveDisplayName,
                    () => {
                      setDisplayName(user?.name || 'User');
                      setEditingName(false);
                      setNameError('');
                    }
                  )}
                  className="w-full rounded border border-primary/50 bg-background px-3 py-2 text-sm text-text-main focus:outline-none"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="w-full rounded border border-border bg-panel px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                >
                  {displayName}
                </button>
              )}
              {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
            </SettingRow>

            <SettingRow label="Email">
              <div className="rounded border border-border bg-background px-3 py-2 text-sm text-text-muted">
                {user?.email || 'No email available'}
              </div>
            </SettingRow>

            <SettingRow label="Role">
              <span className="inline-flex rounded border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">
                {formatRole(user?.role)}
              </span>
            </SettingRow>
          </div>
        </section>

        <section className="border-b border-border pb-8">
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Evaluation Metrics</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Define the metrics used when scoring AI outputs. These appear in the scoring modal.
                </div>
              </div>
              <button
                onClick={() => setIsAddingMetric(true)}
                style={{ padding: '6px 14px', border: '1px solid #88d273', borderRadius: 6,
                        background: 'transparent', color: '#88d273', cursor: 'pointer', fontSize: 13 }}
              >
                + Add Metric
              </button>
            </div>

            {/* Metric list */}
            {metrics.map(metric => (
              <div key={metric.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px', marginBottom: 8,
                background: '#0f0f0d', border: '1px solid #252320', borderRadius: 6
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{metric.name}</span>
                    {metric.isInverse && (
                      <span style={{ fontSize: 10, padding: '2px 6px', border: '1px solid #e8a847',
                                    borderRadius: 3, color: '#e8a847' }}>
                        lower is better
                      </span>
                    )}
                    {metric.isDefault && (
                      <span style={{ fontSize: 10, padding: '2px 6px', border: '1px solid #252320',
                                    borderRadius: 3, color: 'var(--muted)' }}>
                        default
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{metric.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleToggleDefault(metric)}
                    title={metric.isDefault ? 'Remove from defaults' : 'Add to defaults'}
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #252320',
                            borderRadius: 4, background: 'transparent',
                            color: metric.isDefault ? '#88d273' : 'var(--muted)', cursor: 'pointer' }}
                  >
                    {metric.isDefault ? '★ Default' : '☆ Default'}
                  </button>
                  <button
                    onClick={() => setMetricToDelete(metric)}
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #3a2020',
                            borderRadius: 4, background: 'transparent',
                            color: '#e05555', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Add metric form */}
            {isAddingMetric && (
              <div style={{ padding: 16, background: '#161613',
                            border: '1px solid #88d273', borderRadius: 6, marginTop: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    METRIC NAME *
                  </label>
                  <input
                    value={newMetric.name}
                    onChange={e => setNewMetric(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Tone, Conciseness, JSON Validity"
                    maxLength={50}
                    style={{ width: '100%', background: '#0f0f0d', border: '1px solid #252320',
                            borderRadius: 4, padding: '8px 12px', color: '#f0ece4', fontSize: 13 }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    RUBRIC / DESCRIPTION * (max 500 chars)
                  </label>
                  <textarea
                    value={newMetric.description}
                    onChange={e => setNewMetric(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe what this metric evaluates and how to score it..."
                    maxLength={500}
                    rows={3}
                    style={{ width: '100%', background: '#0f0f0d', border: '1px solid #252320',
                            borderRadius: 4, padding: '8px 12px', color: '#f0ece4',
                            fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                    {newMetric.description.length}/500
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newMetric.isInverse}
                      onChange={e => setNewMetric(p => ({ ...p, isInverse: e.target.checked }))}
                    />
                    Lower is better (like Toxicity)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newMetric.isDefault}
                      onChange={e => setNewMetric(p => ({ ...p, isDefault: e.target.checked }))}
                    />
                    Selected by default in scoring modal
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12,
                              padding: '6px 10px', background: '#0f0f0d',
                              borderRadius: 4, border: '1px solid #252320' }}>
                  ⚠ Descriptions are used directly in the AI scoring prompt.
                  Keep them objective and rubric-focused.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setIsAddingMetric(false); setNewMetric({ name: '', description: '', isInverse: false, isDefault: true }); }}
                    style={{ padding: '6px 14px', border: '1px solid #252320', borderRadius: 6,
                            background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleAddMetric}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: 6,
                            background: '#88d273', color: '#0f0f0d', cursor: 'pointer',
                            fontWeight: 600 }}>
                    Add Metric
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <div style={{
          borderTop: '1px solid #252320',
          paddingTop: 24,
          marginTop: 32
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Sign out</div>
            <div style={{ fontSize: 13, color: '#a1a1aa' }}>
              You will be returned to the login screen.
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              border: '1px solid #3a2020',
              borderRadius: 6,
              background: 'transparent',
              color: '#e05555',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'background 150ms ease'
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(224, 85, 85, 0.08)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            Sign out
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!metricToDelete}
        title="Delete Metric"
        message={`Are you sure you want to delete the metric "${metricToDelete?.name}"?`}
        confirmText="Delete"
        onConfirm={handleDeleteMetric}
        onCancel={() => setMetricToDelete(null)}
      />

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ isOpen: false, title: '', message: '' })}
      />
    </div>
  );
}

function SettingRow({ label, children }) {
  return (
    <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-start">
      <div className="pt-2 text-sm font-medium text-text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SavedIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
      <CheckCircle2 size={14} />
      Saved
    </span>
  );
}

function formatRole(role) {
  if (!role) return 'Member';
  return role.charAt(0).toUpperCase() + role.slice(1);
}
