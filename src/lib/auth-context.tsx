'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AuthSession,
  ensureDefaultAdminUser,
  loginUser,
  logoutUser,
  readAuthSession,
  readEditorEntered,
  registerUser,
  writeEditorEntered,
} from '@/lib/auth-storage';

interface AuthContextValue {
  session: AuthSession | null;
  isReady: boolean;
  inEditor: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  enterEditor: () => void;
  leaveEditor: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [inEditor, setInEditor] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      await ensureDefaultAdminUser();
      if (cancelled) return;
      setSession(readAuthSession());
      setInEditor(readEditorEntered());
      setIsReady(true);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const next = await loginUser(username, password);
    setSession(next);
    setInEditor(false);
    writeEditorEntered(false);
  }, []);

  const register = useCallback(
    async (input: { username: string; email: string; password: string }) => {
      const next = await registerUser(input);
      setSession(next);
      setInEditor(false);
      writeEditorEntered(false);
    },
    []
  );

  const logout = useCallback(() => {
    logoutUser();
    setSession(null);
    setInEditor(false);
  }, []);

  const enterEditor = useCallback(() => {
    setInEditor(true);
    writeEditorEntered(true);
  }, []);

  const leaveEditor = useCallback(() => {
    setInEditor(false);
    writeEditorEntered(false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isReady,
      inEditor,
      login,
      register,
      logout,
      enterEditor,
      leaveEditor,
    }),
    [session, isReady, inEditor, login, register, logout, enterEditor, leaveEditor]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
