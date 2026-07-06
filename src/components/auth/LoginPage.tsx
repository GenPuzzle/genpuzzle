'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  Eye,
  EyeOff,
  FileDown,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_ADMIN_USERNAME } from '@/lib/auth-storage';
import { cn } from '@/lib/utils';
import './login-page.css';

function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  icon: Icon,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="auth-page__field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-page__input-wrap">
        <Icon className="auth-page__input-icon" aria-hidden />
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-page__toggle-pw gp-theme-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: LayoutGrid, text: 'Design puzzle books with live page preview' },
  { icon: BookOpen, text: 'Organize multi-page books with drag-and-drop tabs' },
  { icon: FileDown, text: 'Export print-ready PDF and PowerPoint for KDP' },
] as const;

export function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginUsername, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (registerPassword !== registerConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: registerUsername,
        email: registerEmail,
        password: registerPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (next: 'login' | 'register') => {
    setTab(next);
    setError(null);
  };

  return (
    <div className="auth-page">
      <div className="auth-page__blob auth-page__blob--a" aria-hidden />
      <div className="auth-page__blob auth-page__blob--b" aria-hidden />

      <div className="auth-page__shell">
        <aside className="auth-page__brand">
          <div className="auth-page__brand-top">
            <div className="auth-page__logo-wrap">
              <Image
                src="/genpuzzle-icon-white.svg"
                alt="GenPuzzle"
                width={36}
                height={36}
                className="h-9 w-9"
                unoptimized
                priority
              />
            </div>
            <div>
              <h1>GenPuzzle</h1>
              <p className="auth-page__brand-tagline">
                Create professional puzzle books — layout pages, preview your design, and export for
                Amazon KDP.
              </p>
            </div>
          </div>

          <ul className="auth-page__features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="auth-page__feature">
                <span className="auth-page__feature-icon">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="auth-page__panel">
          <div className="auth-page__panel-header">
            <div>
              <h2 className="auth-page__panel-title">
                {tab === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="auth-page__panel-subtitle">
                {tab === 'login'
                  ? 'Sign in to continue to your projects'
                  : 'Register to start building puzzle books'}
              </p>
            </div>
            <ThemeToggle variant="marketing" />
          </div>

          <div className="auth-page__tabs" role="tablist" aria-label="Authentication">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={cn('auth-page__tab', tab === 'login' && 'auth-page__tab--active')}
              onClick={() => switchTab('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={cn('auth-page__tab', tab === 'register' && 'auth-page__tab--active')}
              onClick={() => switchTab('register')}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="auth-page__error" role="alert">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="auth-page__form">
              <AuthField
                id="login-username"
                label="Username"
                value={loginUsername}
                onChange={setLoginUsername}
                placeholder={DEFAULT_ADMIN_USERNAME}
                autoComplete="username"
                icon={User}
                required
              />
              <AuthField
                id="login-password"
                label="Password"
                type="password"
                value={loginPassword}
                onChange={setLoginPassword}
                autoComplete="current-password"
                icon={Lock}
                required
              />
              <button type="submit" className="auth-page__submit" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-page__form">
              <AuthField
                id="register-username"
                label="Username"
                value={registerUsername}
                onChange={setRegisterUsername}
                autoComplete="username"
                icon={User}
                required
              />
              <AuthField
                id="register-email"
                label="Email"
                type="email"
                value={registerEmail}
                onChange={setRegisterEmail}
                autoComplete="email"
                icon={Mail}
                required
              />
              <AuthField
                id="register-password"
                label="Password"
                type="password"
                value={registerPassword}
                onChange={setRegisterPassword}
                autoComplete="new-password"
                icon={Lock}
                required
              />
              <AuthField
                id="register-confirm"
                label="Confirm password"
                type="password"
                value={registerConfirm}
                onChange={setRegisterConfirm}
                autoComplete="new-password"
                icon={Lock}
                required
              />
              <button type="submit" className="auth-page__submit" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  'Create account'
                )}
              </button>
            </form>
          )}

          <p className="auth-page__footer">
            © {new Date().getFullYear()} GenPuzzle. All rights reserved.
          </p>
        </main>
      </div>
    </div>
  );
}
