'use client';

import React, { useState } from 'react';

interface WorkspaceShellProps {
  workspaceType: 'CULTIVATOR' | 'DISTRIBUTOR';
  workspaceName: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export function WorkspaceShell({
  workspaceType,
  workspaceName,
  activeTab,
  onTabChange,
  children,
}: WorkspaceShellProps) {
  const cultivatorTabs = [
    { id: 'overview', label: 'Ringkasan Siklus', icon: '📊' },
    { id: 'ponds', label: 'Manajemen Kolam', icon: '🌊' },
    { id: 'cycles', label: 'Siklus Tebar & FCR', icon: '🐟' },
    { id: 'daily-logs', label: 'Pakan & Kualitas Air', icon: '📝' },
    { id: 'harvest', label: 'Panen & Finansial', icon: '💰' },
  ];

  const distributorTabs = [
    { id: 'overview', label: 'Ringkasan Rantai Pasok', icon: '📈' },
    { id: 'inventory', label: 'Katalog & Stok Batch', icon: '📦' },
    { id: 'transactions', label: 'Penjualan & Pembelian', icon: '🧾' },
    { id: 'delivery', label: 'Surat Jalan (DO)', icon: '🚚' },
    { id: 'partners', label: 'Pelanggan & Supplier', icon: '🤝' },
  ];

  const tabs = workspaceType === 'CULTIVATOR' ? cultivatorTabs : distributorTabs;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigasi Desktop-First */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
            <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
              T
            </div>
            <div>
              <div className="font-bold tracking-tight text-sm text-emerald-400">TUMBU OS</div>
              <div className="text-xs text-slate-400 truncate max-w-[140px]">{workspaceName}</div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {workspaceType === 'CULTIVATOR' ? 'Cultivator Control' : 'Supply Chain Hub'}
            </div>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Tenant Info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>v2.0 • 2026</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            {workspaceType}
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950">
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-900/50 sticky top-0 backdrop-blur z-10">
          <div className="font-semibold text-sm text-slate-200">
            {tabs.find((t) => t.id === activeTab)?.label}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              ● Sistem Terhubung
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}