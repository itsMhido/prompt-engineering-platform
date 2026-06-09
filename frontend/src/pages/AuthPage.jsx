import { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import * as api from '../utils/api';
import { cn } from '../utils/helpers';

const EMPTY_FIELD_ERRORS = {
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
};

export default function AuthPage({ onAuthSuccess, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
      if (err.message?.includes('429') || err.message?.toLowerCase().includes('too many')) {
        setError('Too many login attempts. Please wait a minute and try again.');
      } else {
        setError(err.message || 'Invalid email or password');
      }
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
    <div className="flex min-h-screen text-gray-200" style={{ backgroundColor: '#0d0d0b' }}>
      {/* Left panel - Branding */}
      <div className="hidden md:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden" style={{ backgroundColor: '#0d0d0b' }}>
        {/* Faint dot pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ 
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
            backgroundSize: '24px 24px' 
          }} 
        />
        
        <div className="relative z-10 m-auto w-full max-w-md">
          <h1 className="font-mono text-4xl font-bold tracking-tight mb-3" style={{ color: '#88d273' }}>
            Prompt_Env
          </h1>
          <p className="mb-10 text-sm" style={{ color: '#888' }}>
            Design, version, and evaluate prompts at scale
          </p>
          <ul className="space-y-4 text-sm" style={{ color: '#aaa' }}>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#88d273' }}></span>
              Multi-provider inference
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#88d273' }}></span>
              Dataset-driven evaluation
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#88d273' }}></span>
              Version-controlled prompts
            </li>
          </ul>
        </div>
        
        <div className="relative z-10 text-xs font-medium" style={{ color: '#555' }}>
          Prompt Engineering Platform
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex w-full min-h-screen items-center justify-center p-6 md:w-1/2" style={{ backgroundColor: '#161613' }}>
        <div className="w-full max-w-[400px] p-8 rounded-xl" style={{ backgroundColor: '#1e1e1b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          <div className="mb-8 flex gap-6 border-b border-[#2a2a27]">
            {['login', 'register'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className="pb-3 text-sm font-medium capitalize relative transition-colors"
                style={{ color: activeTab === tab ? '#fff' : '#888' }}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] rounded-t" style={{ backgroundColor: '#88d273' }}></span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field label="Email">
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  className={fieldClass()}
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

              <div className="pt-2 space-y-5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full font-medium transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 text-[#0d0d0b]"
                  style={{ backgroundColor: '#88d273', borderRadius: '6px', height: '44px' }}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="text-center text-sm" style={{ color: '#888' }}>
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => switchTab('register')} className="font-medium hover:underline" style={{ color: '#88d273' }}>
                    Register
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
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

              <div className="pt-2 space-y-5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full font-medium transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 text-[#0d0d0b]"
                  style={{ backgroundColor: '#88d273', borderRadius: '6px', height: '44px' }}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>

                <div className="text-center text-sm" style={{ color: '#888' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchTab('login')} className="font-medium hover:underline" style={{ color: '#88d273' }}>
                    Sign in
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-300"
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
    'w-full rounded-md border bg-[#0f0f0d] px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors',
    error ? 'border-red-500/60 focus:border-red-500' : 'border-[#2a2a27] focus:border-[#88d273]'
  );
}
