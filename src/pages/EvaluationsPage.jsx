import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function EvaluationsPage() {
  return (
    <div className="p-8 h-full overflow-y-auto animate-in fade-in duration-300 flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0 bg-background pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Evaluations</h2>
          <p className="text-text-muted">Compare outputs and metrics side-by-side.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-panel border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary">
            <option>Dataset: Medical Q&A</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        <EvalPanel version="v2" score={88} model="claude-3-opus" />
        <EvalPanel version="v3" score={92} model="gpt-4-turbo" isWinner />
      </div>
    </div>
  );
}

function EvalPanel({ version, score, model, isWinner }) {
  return (
    <div className={cn(
      "glass-panel rounded-lg flex flex-col overflow-hidden",
      isWinner ? "border-primary/40 ring-1 ring-primary/20" : ""
    )}>
      <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className={cn(
            "font-mono text-xs px-2 py-0.5 rounded border",
            isWinner
              ? "bg-primary/20 text-primary border-primary/50"
              : "bg-panel text-text-muted border-border"
          )}>{version}</span>
          <span className="text-sm font-medium">{model}</span>
        </div>
        {isWinner && <div className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle2 size={14} /> WINNER</div>}
      </div>

      <div className="p-4 space-y-4">
        {/* Output */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase text-text-muted">Output</label>
          <div className="bg-background border border-border rounded p-3 text-sm font-sans whitespace-pre-wrap text-text-main h-40 overflow-y-auto">
            {"{\n  \"diagnosis\": \"Common Cold\",\n  \"confidence\": 0.85,\n  \"recommended_action\": \"Rest and hydration\"\n}"}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3 pt-2">
          <ScoreBar label="Relevance" score={score + 3} />
          <ScoreBar label="Correctness" score={score} />
          <ScoreBar label="Toxicity" score={3} isReversed bg="bg-amber-500" />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, bg = "bg-primary", isReversed = false }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono">{score}%</span>
      </div>
      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
        <div className={cn("h-full transition-all duration-1000", bg)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
