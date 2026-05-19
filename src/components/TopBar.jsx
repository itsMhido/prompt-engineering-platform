export default function TopBar({ session, activeModelName }) {
  const workspaceName = session?.workspace?.name || 'Workspace';
  const userName = session?.user?.name || 'User';
  const role = session?.user?.role || 'member';

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

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium">{userName}</span>
          <span className="text-xs capitalize text-text-muted">{role}</span>
        </div>
        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-border bg-panel">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
