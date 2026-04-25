import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import PromptStudio from './pages/PromptStudio';
import ExperimentsPage from './pages/ExperimentsPage';
import ModelsPage from './pages/ModelsPage';
import EvaluationsPage from './pages/EvaluationsPage';
import DatasetsPage from './pages/DatasetsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('prompt-studio');

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-sm">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'prompt-studio' && <PromptStudio />}
          {activeTab === 'experiments' && <ExperimentsPage />}
          {activeTab === 'models' && <ModelsPage />}
          {activeTab === 'evaluations' && <EvaluationsPage />}
          {activeTab === 'datasets' && <DatasetsPage />}
        </main>
      </div>
    </div>
  );
}
