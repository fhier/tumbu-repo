'use client';

import React from 'react';
import { Bot, Sparkles, ChevronRight, AlertCircle } from 'lucide-react';
import plansData from '../../../config/plans.json';

interface PembudidayaSkinProps {
  workspaceName?: string;
  workspaceModuleTab: string;
  setWorkspaceModuleTab: (tab: string) => void;
  dashboardAiPrompt: string;
  setDashboardAiPrompt: (val: string) => void;
  planId?: string;
  onNotify?: (msg: string) => void;
  children?: React.ReactNode;
}

export function PembudidayaSkin({
  workspaceName = 'Budidaya Perikanan',
  workspaceModuleTab,
  setWorkspaceModuleTab,
  dashboardAiPrompt,
  setDashboardAiPrompt,
  planId = 'paket_b_juragan',
  onNotify,
  children,
}: PembudidayaSkinProps) {
  const plansMap: Record<string, any> = plansData.plans;
  const activePlan = plansMap[planId] || plansMap.paket_b_juragan;
  const hasAiAssistant = activePlan.ai_assistant;

  return (
    <div className="space-y-6">
      {/* MINIMALIST AI BANNER - PEMBUDIDAYA PERSONA (Only on Dashboard Tab, Max Height 80px, Rata Tengah, 1 CTA) */}
      {workspaceModuleTab === 'dashboard' && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white h-16 sm:h-20 flex items-center justify-center p-4 shadow-md border border-emerald-500/20">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between w-full max-w-4xl gap-4">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
              <div className="text-left">
                <span className="text-[11px] sm:text-xs font-bold text-white block">TUMBU AI OS</span>
                <span className="text-[10px] sm:text-xs text-slate-300 line-clamp-1">
                  Tanya takaran pakan, penanganan air, dan catat pengeluaran kolam harian.
                </span>
              </div>
            </div>
            <button
              onClick={() => setWorkspaceModuleTab('ai_tumbu')}
              className="h-8 sm:h-9 px-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] sm:text-xs transition cursor-pointer shrink-0 flex items-center gap-1 shadow-sm whitespace-nowrap"
            >
              <span>Mulai Chat AI</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* AI SULTAN UPGRADE CARD FOR AI TAB (IF NOT IN SULTAN PLAN) */}
      {workspaceModuleTab === 'ai_tumbu' && !hasAiAssistant && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Mode AI Dasar ({activePlan.name}): </span>
              Upgrade ke <span className="font-bold underline">Paket Sultan</span> untuk mengaktifkan AI Asisten pencatatan otomatis aktivitas kolam & kas harian 24/7.
            </div>
          </div>
          <button
            onClick={() => onNotify && onNotify('Silakan pilih Paket Sultan di menu Tagihan & Lisensi untuk mengaktifkan AI Otomatis!')}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shrink-0"
          >
            Upgrade ke Sultan (Rp 299rb/bln)
          </button>
        </div>
      )}

      {/* RENDER MAIN CHILDREN (PEMBUDIDAYA MODULE CONTENT) */}
      {children}
    </div>
  );
}
