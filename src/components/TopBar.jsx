import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings2 } from 'lucide-react';
import { getUser, getWorkspace } from '../utils/auth';

export default function TopBar({ session, activeModelName, onOpenWorkspaceSettings, onLogout }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const user = session?.user || getUser();
  const workspace = session?.workspace || getWorkspace();
  const workspaceName = workspace?.name || 'My Workspace';
  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  const role = user?.role || 'Member';
  const initials = user?.name?.charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!isProfileOpen) return;

    const handlePointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5">
          <span className="text-text-muted">Workspace:</span>
          <span className="font-medium">{workspaceName}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-xs text-primary">
            {activeModelName ? `Active: ${activeModelName}` : 'API Connected'}
          </span>
        </div>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsProfileOpen((prev) => !prev)}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{userName}</span>
            <span className="text-xs capitalize text-text-muted">{role}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-primary text-sm font-bold text-panel">
            {initials}
          </div>
          <ChevronDown size={14} className="text-text-muted" />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-panel p-2 shadow-2xl">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-bold">{userName}</div>
              <div className="truncate text-xs text-text-muted">{userEmail}</div>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onOpenWorkspaceSettings();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-white/5 hover:text-text-main"
            >
              <Settings2 size={15} />
              Workspace Settings
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
