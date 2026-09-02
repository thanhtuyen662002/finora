import React from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function IncomeSourcesLoading() {
  return (
    <AppShell>
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted/70 rounded-md" />
            <div className="h-4 w-72 bg-muted/50 rounded-md" />
          </div>
          <div className="h-9 w-36 bg-muted/60 rounded-md" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-xl border border-muted" />
          ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="h-10 w-48 bg-muted/50 rounded-lg" />

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted/30 rounded-xl border border-muted/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-muted/60 rounded" />
                <div className="h-5 w-16 bg-muted/50 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted/40 rounded" />
                <div className="h-4 w-2/3 bg-muted/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
