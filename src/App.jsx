import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import PromptStudio from './pages/PromptStudio';
import ExperimentsPage from './pages/ExperimentsPage';
import ModelsPage from './pages/ModelsPage';
import EvaluationsPage from './pages/EvaluationsPage';
import DatasetsPage from './pages/DatasetsPage';
import PromptsPage from './pages/PromptsPage';
import { migrateIfNeeded, seedPromptsIfEmpty } from './utils/promptStore';

export default function App() {
  migrateIfNeeded();
  seedPromptsIfEmpty();

  const [currentView, setCurrentView] = useState({ page: 'prompts' });

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-sm">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />

        <main className="flex-1 overflow-hidden relative">
          {currentView.page === 'prompts' && (
            <PromptsPage onOpenPrompt={(promptId) => setCurrentView({ page: 'studio', promptId })} />
          )}
          {currentView.page === 'studio' && currentView.promptId && (
            <PromptStudio
              promptId={currentView.promptId}
              onGoPrompts={() => setCurrentView({ page: 'prompts' })}
            />
          )}
          {currentView.page === 'studio' && !currentView.promptId && (
            <PromptsPage onOpenPrompt={(promptId) => setCurrentView({ page: 'studio', promptId })} />
          )}
          {currentView.page === 'experiments' && <ExperimentsPage />}
          {currentView.page === 'models' && <ModelsPage />}
          {currentView.page === 'evaluations' && <EvaluationsPage />}
          {currentView.page === 'datasets' && <DatasetsPage />}
        </main>
      </div>
    </div>
  );
}
