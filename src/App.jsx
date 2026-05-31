import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import PromptStudio from './pages/PromptStudio';
import ExperimentsPage from './pages/ExperimentsPage';
import ModelsPage from './pages/ModelsPage';
import EvaluationsPage from './pages/EvaluationsPage';
import DatasetsPage from './pages/DatasetsPage';
import PromptsPage from './pages/PromptsPage';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage';
import { bootstrapApp, clearSession, getSessionSnapshot, listModels, subscribeToSession } from './utils/api';
import { isAuthenticated } from './utils/auth';

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [currentView, setCurrentView] = useState({ page: 'prompts' });
  const [session, setSession] = useState(getSessionSnapshot());
  const [activeModelName, setActiveModelName] = useState('');
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (authed && (currentPath === '/login' || currentPath === '/register')) {
      window.history.replaceState({}, '', '/app');
      setCurrentPath('/app');
    }
  }, [authed, currentPath]);

  useEffect(() => {
    const unsubscribe = subscribeToSession((nextSession) => {
      setSession(nextSession);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authed) {
      return;
    }

    let isMounted = true;
    setStatus({ loading: true, error: '' });

    (async () => {
      try {
        await bootstrapApp();
        const models = await listModels();
        const activeModel = models.find((model) => model.status === 'active');

        if (!isMounted) {
          return;
        }

        setActiveModelName(activeModel?.name || '');
        setStatus({ loading: false, error: '' });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus({
          loading: false,
          error: error.message || 'Failed to connect to the backend.'
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authed]);

  const handleLogout = () => {
    clearSession();
    setSession(getSessionSnapshot());
    setAuthed(false);
    setCurrentView({ page: 'prompts' });
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  };

  const handleAuthSuccess = () => {
    setSession(getSessionSnapshot());
    setAuthed(true);
    window.history.pushState({}, '', '/app');
    setCurrentPath('/app');
  };

  if (!authed) {
    if (currentPath === '/login') {
      return <AuthPage onAuthSuccess={handleAuthSuccess} initialTab="login" />;
    }
    if (currentPath === '/register') {
      return <AuthPage onAuthSuccess={handleAuthSuccess} initialTab="register" />;
    }
    return <LandingPage authed={authed} />;
  }

  if (authed && currentPath === '/') {
    return <LandingPage authed={authed} />;
  }

  if (status.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="glass-panel rounded-xl px-6 py-5 text-center">
          <div className="mx-auto mb-3 h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-text-main">Connecting to your workspace...</p>
        </div>
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="glass-panel max-w-md rounded-xl p-6 text-center">
          <h1 className="mb-2 text-lg font-bold">Backend connection failed</h1>
          <p className="text-sm text-text-muted">{status.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-sm">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          session={session}
          activeModelName={activeModelName}
          onOpenWorkspaceSettings={() => setCurrentView({ page: 'workspace-settings' })}
          onLogout={handleLogout}
        />

        <main className="relative flex-1 overflow-hidden">
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
          {currentView.page === 'models' && <ModelsPage onModelsChanged={setActiveModelName} />}
          {currentView.page === 'evaluations' && <EvaluationsPage />}
          {currentView.page === 'datasets' && <DatasetsPage />}
          {currentView.page === 'workspace-settings' && (
            <WorkspaceSettingsPage session={session} onLogout={handleLogout} />
          )}
        </main>
      </div>
    </div>
  );
}
