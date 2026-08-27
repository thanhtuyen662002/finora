import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ShieldCheck, Layers, Terminal } from "lucide-react";

export default function HomePage() {
  return (
    <main
      id="finora-foundation-container"
      className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full"
    >
      <div className="w-full space-y-8">
        {/* Header Branding */}
        <div id="finora-header-section" className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Finora
            </span>
            <Badge
              id="foundation-status-badge"
              variant="success"
              className="gap-1 px-2.5 py-0.5 text-xs font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Phase 0: Foundation Ready
            </Badge>
          </div>
          <p className="text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Private-first, lightweight personal finance application built with
            Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.
          </p>
        </div>

        {/* Foundation Validation Card */}
        <Card id="foundation-status-card" className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-slate-700" />
                Architectural Baseline
              </CardTitle>
              <span className="text-xs text-slate-500 font-mono">v0.1.0</span>
            </div>
            <CardDescription className="text-sm text-slate-500">
              Core application infrastructure initialized and validated for subsequent phases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div
                id="arch-item-runtime"
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Next.js App Router & React 19
                  </div>
                  <div className="text-xs text-slate-500">
                    Strict TypeScript compilation, SSR & Route handlers
                  </div>
                </div>
              </div>

              <div
                id="arch-item-design"
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Tailwind CSS & shadcn/ui
                  </div>
                  <div className="text-xs text-slate-500">
                    Responsive design tokens and accessible component primitives
                  </div>
                </div>
              </div>

              <div
                id="arch-item-supabase"
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Supabase SSR Client Layer
                  </div>
                  <div className="text-xs text-slate-500">
                    Browser & server clients with strict credential isolation
                  </div>
                </div>
              </div>

              <div
                id="arch-item-environment"
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <Terminal className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Environment Separation
                  </div>
                  <div className="text-xs text-slate-500">
                    Zero-leakage public vs server-secret separation
                  </div>
                </div>
              </div>
            </div>

            <div
              id="foundation-info-box"
              className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <span className="font-semibold text-slate-800">Next Phase:</span> Phase 1 — UI Foundation (Responsive mock screens).
              </div>
              <div className="font-mono text-slate-500 text-[11px]">
                Port 3000 • Production Ready
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
