"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface BalanceVisibilityContextValue {
  maskBalance: boolean;
  setMaskBalance: Dispatch<SetStateAction<boolean>>;
}

export const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

export function useBalanceVisibility(): BalanceVisibilityContextValue {
  const context = useContext(BalanceVisibilityContext);
  if (!context) {
    throw new Error('useBalanceVisibility must be used inside AppShell');
  }
  return context;
}

export function maskFinancialValue(value: string, maskBalance: boolean): string {
  return maskBalance ? '••••••' : value;
}
