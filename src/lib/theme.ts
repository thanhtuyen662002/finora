"use client";

export type ThemeOption = 'light' | 'dark' | 'system';

export const FINORA_THEME_KEY = 'finora_theme';

export function getStoredTheme(): ThemeOption {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = localStorage.getItem(FINORA_THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
  } catch (e) {
    console.debug('Failed to read theme from localStorage', e);
  }
  return 'system';
}

export function applyTheme(theme: ThemeOption): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FINORA_THEME_KEY, theme);
  } catch (e) {
    console.debug('Failed to write theme to localStorage', e);
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
