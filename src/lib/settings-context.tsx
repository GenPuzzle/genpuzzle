'use client';

/**
 * Settings access layer — all UI settings live in AppProvider (global context).
 * Values persist to localStorage and survive tab switches + page refresh.
 */
export {
  AppProvider,
  AppProvider as SettingsProvider,
  useApp,
  useApp as useSettings,
} from './app-context';

export type { AppContextType as SettingsContextType } from './app-context';
