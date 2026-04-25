import React from 'react';

export default function TopBar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-md z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="bg-panel border border-border px-3 py-1.5 rounded-md flex items-center gap-2">
          <span className="text-text-muted">Workspace:</span>
          <span className="font-medium">Acme Corp</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-mono text-xs text-primary">Active: gpt-4-turbo</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="font-medium text-sm">Alex Developer</span>
          <span className="text-xs text-text-muted">Admin</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-panel border-2 border-border overflow-hidden">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}
