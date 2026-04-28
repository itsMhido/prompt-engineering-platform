import React from 'react';
import {
  Box, Database, FileText, FlaskConical, Target, Settings2
} from 'lucide-react';
import { cn } from '../utils/helpers';

export default function Sidebar({ currentView, setCurrentView }) {
  const navItems = [
    { id: 'models', label: 'Models', icon: Box },
    { id: 'datasets', label: 'Datasets', icon: Database },
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'evaluations', label: 'Evaluations', icon: Target },
  ];

  return (
    <div className="w-64 glass-panel border-y-0 border-l-0 flex flex-col z-10">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-bold">
          PE
        </div>
        <span className="font-mono text-text-main font-bold tracking-tight">Prompt_Env</span>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView.page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView({ page: item.id })}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group text-left",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-muted hover:bg-white/5 hover:text-text-main"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-text-main")} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 text-text-muted hover:text-text-main cursor-pointer transition-colors">
          <Settings2 size={18} />
          <span>Workspace Settings</span>
        </div>
      </div>
    </div>
  );
}
