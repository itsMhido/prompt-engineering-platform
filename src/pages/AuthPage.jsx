import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import * as api from '../utils/api';
import { cn } from '../utils/helpers';

const EMPTY_FIELD_ERRORS = {
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
};

export default function AuthPage({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setShowPassword(false);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      await api.login({
        email: loginForm.email.trim(),
        password: loginForm.password
      });
      onAuthSuccess();
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const validateRegister = () => {
    const nextErrors = { ...EMPTY_FIELD_ERRORS };
    const name = registerForm.name.trim();
    const email = registerForm.email.trim();

    if (!name) nextErrors.name = 'Full name is required';
    if (!email) nextErrors.email = 'Email is required';
    if (!registerForm.password) {
      nextErrors.password = 'Password is required';
    } else if (registerForm.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    if (!registerForm.confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password';
    } else if (registerForm.password !== registerForm.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords must match';
    }

    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    if (!validateRegister()) return;

    setIsLoading(true);
    setError('');

    try {
      await api.register({
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password
      });
      onAuthSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-text-main">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-primary/50 bg-primary/20 font-bold text-primary">
            PE
          </div>
          <span className="font-mono text-xl font-bold tracking-tight">Prompt_Env</span>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-md border border-border bg-background p-1">
          {['login', 'register'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className={cn(
                'rounded px-3 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'bg-primary text-panel'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:border-primary/50 focus:outline-none"
                autoComplete="email"
              />
            </Field>

            <Field label="Password">
              <PasswordInput
                value={loginForm.password}
                onChange={(value) => setLoginForm((prev) => ({ ...prev, password: value }))}
                showPassword={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
                autoComplete="current-password"
              />
            </Field>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-panel transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => switchTab('register')}
              className="w-full text-center text-sm text-text-muted transition-colors hover:text-primary"
            >
              Don&apos;t have an account? Register
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Full Name" error={fieldErrors.name}>
              <input
                type="text"
                value={registerForm.name}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
                className={fieldClass(fieldErrors.name)}
                autoComplete="name"
              />
            </Field>

            <Field label="Email" error={fieldErrors.email}>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                className={fieldClass(fieldErrors.email)}
                autoComplete="email"
              />
            </Field>

            <Field label="Password" error={fieldErrors.password}>
              <PasswordInput
                value={registerForm.password}
                onChange={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
                showPassword={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
                hasError={Boolean(fieldErrors.password)}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm Password" error={fieldErrors.confirmPassword}>
              <input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                className={fieldClass(fieldErrors.confirmPassword)}
                autoComplete="new-password"
              />
            </Field>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-panel transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => switchTab('login')}
              className="w-full text-center text-sm text-text-muted transition-colors hover:text-primary"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function PasswordInput({ value, onChange, showPassword, onToggle, hasError = false, autoComplete }) {
  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass(hasError), 'pr-10')}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-main"
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
      <span className="flex-1">{error}</span>
      <button type="button" onClick={onDismiss} className="mt-0.5 text-red-300 hover:text-red-200">
        <X size={14} />
      </button>
    </div>
  );
}

function fieldClass(error) {
  return cn(
    'w-full rounded border bg-background px-3 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none',
    error ? 'border-red-500/60 focus:border-red-500' : 'border-border focus:border-primary/50'
  );
}
