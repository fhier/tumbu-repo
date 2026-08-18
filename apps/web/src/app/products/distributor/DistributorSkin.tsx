'use client';

import React from 'react';
import { Bot, Sparkles, ChevronRight, AlertCircle, Zap, PackagePlus } from 'lucide-react';
import plansData from '../../../config/plans.json';

interface DistributorSkinProps {
  workspaceName?: string;
  workspaceModuleTab: string;
  setWorkspaceModuleTab: (tab: string) => void;
  dashboardAiPrompt: string;
  setDashboardAiPrompt: (val: string) => void;
  productsCount: number;
  planId?: string;
  onOpenAddProductModal?: () => void;
  onNotify?: (msg: string) => void;
  children?: React.ReactNode;
}

export function DistributorSkin({
  workspaceName = 'Distributor Benih',
  workspaceModuleTab,
  setWorkspaceModuleTab,
  dashboardAiPrompt,
  setDashboardAiPrompt,
  productsCount,
  planId = 'paket_b_juragan',
  onOpenAddProductModal,
  onNotify,
  children,
}: DistributorSkinProps) {
  const plansMap: Record<string, any> = plansData.plans;
  const activePlan = plansMap[planId] || plansMap.paket_b_juragan;

  const canAddSKU = productsCount < activePlan.max_sku;
  const hasAiAssistant = activePlan.ai_assistant;

  return (
    <div className="space-y-6">
      {/* MINIMALIST AI BANNER - DISTRIBUTOR PERSONA (Only on Dashboard Tab, Max Height 80px, Rata Tengah, 1 CTA) */}
      {workspaceModuleTab === 'dashboard' && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white h-16 sm:h-20 flex items-center justify-center p-4 shadow-md border border-sky-500/20">
          <div className="absolute inset-0 bg-sky-500/5 blur-xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between w-full max-w-4xl gap-4">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-sky-400 animate-pulse shrink-0" />
              <div className="text-left">
                <span className="text-[11px] sm:text-xs font-bold text-white block">TUMBU AI OS</span>
                <span className="text-[10px] sm:text-xs text-slate-300 line-clamp-1">
                  Asisten otomatis rekap transaksi, piutang, dan stok benih grosir Anda.
                </span>
              </div>
            </div>
            <button
              onClick={() => setWorkspaceModuleTab('ai_tumbu')}
              className="h-8 sm:h-9 px-3.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] sm:text-xs transition cursor-pointer shrink-0 flex items-center gap-1 shadow-sm whitespace-nowrap"
            >
              <span>Mulai Chat AI</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* PLAN & SKU LIMIT GUARD BANNER FOR INVENTORY TAB */}
      {(workspaceModuleTab === 'inventory' || workspaceModuleTab === 'stok') && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <span>Kuota SKU Aktif: {productsCount} / {activePlan.max_sku >= 999 ? 'Tanpa Batas' : `${activePlan.max_sku} SKU`}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  {activePlan.name}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {canAddSKU
                  ? `Anda masih dapat menambah ${activePlan.max_sku - productsCount} SKU produk lagi pada paket ${activePlan.name}.`
                  : `Batas kuota SKU telah tercapai (${activePlan.max_sku} SKU). Upgrade paket untuk menambah jenis benih / pakan.`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (canAddSKU && onOpenAddProductModal) {
                onOpenAddProductModal();
              } else if (onNotify) {
                onNotify(`Batas kuota SKU untuk ${activePlan.name} tercapai (${activePlan.max_sku} SKU). Silakan upgrade ke Paket Juragan atau Sultan.`);
              }
            }}
            disabled={!canAddSKU && !onNotify}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              canAddSKU
                ? 'bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white cursor-pointer shadow-sm'
                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer'
            }`}
          >
            {canAddSKU ? (
              <>+ Tambah SKU Baru</>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Upgrade ke Juragan / Sultan
              </>
            )}
          </button>
        </div>
      )}

      {/* AI SULTAN UPGRADE CARD FOR AI TAB (IF NOT IN SULTAN PLAN) */}
      {workspaceModuleTab === 'ai_tumbu' && !hasAiAssistant && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Mode AI Dasar ({activePlan.name}): </span>
              Upgrade ke <span className="font-bold underline">Paket Sultan</span> untuk mengaktifkan AI Asisten pencatatan otomatis transaksi grosir & rekap piutang 24/7.
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

      {/* RENDER MAIN CHILDREN (DISTRIBUTOR MODULE CONTENT) */}
      {children}
    </div>
  );
}
