import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { updateCurrentUser, updateWorkspace } from '../utils/api';
import { getUser, getWorkspace } from '../utils/auth';

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
