'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { WorkspaceSwitch } from './workspace-switch';
import { BrandLogo } from './brand';
import { Ti, PAGE_ICONS } from './icons';
import { TUMBU_CONTACT, TUMBU_MAILTO } from './contact';

export type NavItem = { key: string; label: string };
export type NavGroup = { group: string; items: NavItem[] };

type AppShellProps = {
  shell: 'platform' | 'workspace';
  page: string;
  title: string;
  userName: string;
  userRole?: string;
  
  // Workspace specific
  workspaceName?: string;
  blueprintName?: string;
  workspaceLogoUrl?: string;
  workspaceTagline?: string;
  workspaces?: Array<{ id: string; name: string }>;
  activeWsId?: string | null;
  onWorkspaceChange?: (id: string) => void;
  
  // Navigation
  platformNav?: NavItem[];
  filteredErpNav?: NavGroup[];
  goPage: (key: string) => void;
  
  // Platform specific badges
  leadNewCount?: number;
  pendingWorkspaceCount?: number;
  
  // Actions
  onLogout: () => void;
  onRefresh?: () => void;
  onBackToPlatform?: () => void;
  onOpenPwa?: () => void;
  
  children: ReactNode;
};

export function AppShell({
  shell,
  page,
  title,
  userName,
  userRole,
  workspaceName,
  blueprintName,
  workspaceLogoUrl,
  workspaceTagline,
  workspaces = [],
  activeWsId,
  onWorkspaceChange,
  platformNav = [],
  filteredErpNav = [],
  goPage,
  leadNewCount = 0,
  pendingWorkspaceCount = 0,
  onLogout,
  onRefresh,
  onBackToPlatform,
  onOpenPwa,
  children,
}: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navQuery, setNavQuery] = useState('');

  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem('tumbuSidebarCollapsed') === '1'); } catch { /* ignore */ }
  }, []);

  const toggleSidebarCollapsed = (next: boolean) => {
    setSidebarCollapsed(next);
    try { localStorage.setItem('tumbuSidebarCollapsed', next ? '1' : '0'); } catch { /* ignore */ }
  };

  const labelRole = (role?: string) => {
    const r = String(role || '').toUpperCase();
    if (r === 'PLATFORM_ADMIN') return 'Administrator Platform';
    if (r === 'OWNER') return 'Pemilik';
    if (r === 'ADMIN') return 'Admin';
    if (r === 'STAFF') return 'Staf';
    if (r === 'TECHNICIAN') return 'Teknisi';
    return 'Anggota';
  };

  return (
    <main className={`app-shell${navOpen ? ' nav-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}${shell === 'platform' ? ' is-platform' : ''}`}>
      {navOpen && <button type="button" className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setNavOpen(false)} />}
      <aside className="app-sidebar sticky top-0 h-screen overflow-y-auto">
        <div className="brand">
          {shell === 'workspace' && workspaceName ? (
            <div className="ws-brand" title={workspaceName}>
              {workspaceLogoUrl ? (
                <img className="ws-brand-mark" src={workspaceLogoUrl} alt="" />
              ) : (
                <img className="ws-brand-mark" src="/tumbu-logo-shell.svg" alt="TUMBU" />
              )}
              {!sidebarCollapsed ? (
                <div className="ws-brand-copy">
                  <strong>{workspaceName}</strong>
                  <span>{blueprintName || 'Usaha'}</span>
                  {workspaceTagline ? (
                    <em className="ws-brand-tag">{workspaceTagline}</em>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <BrandLogo variant="dark" size="sm" showWordmark={!sidebarCollapsed} />
          )}
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            onClick={() => { toggleSidebarCollapsed(!sidebarCollapsed); setNavOpen(false); }}
          >
            {sidebarCollapsed ? (
              <>
                <span className="chev chev-w" aria-hidden="true">❯</span>
                <span className="chev chev-g" aria-hidden="true">❯</span>
              </>
            ) : (
              <>
                <span className="chev chev-w" aria-hidden="true">❮</span>
                <span className="chev chev-g" aria-hidden="true">❮</span>
              </>
            )}
          </button>
        </div>
        
        {/* Banner AI Tumbu Minimalis */}
        <div className="ai-banner-minimalist" style={{ padding: '12px 8px', textAlign: 'center', background: 'rgba(14, 165, 233, 0.05)', margin: '12px 8px', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0EA5E9', letterSpacing: '0.05em' }}>AI TUMBU</span>
            </div>
        </div>
        
        <button type="button" className="sidebar-close" onClick={() => setNavOpen(false)}>Tutup menu</button>
        
        {shell === 'workspace' && (
          <div className="shell-pack shell-pack-ro" aria-label="Jenis usaha">
            <div className="shell-pack-label">Jenis Usaha</div>
            <div className="shell-pack-pill" title={blueprintName}>
              {blueprintName ?? 'TUMBU Workspace'}
            </div>
            {workspaces.length > 1 && onWorkspaceChange && (
              <WorkspaceSwitch
                workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
                value={activeWsId || workspaces[0]?.id || ''}
                onChange={(id) => { onWorkspaceChange(id); }}
              />
            )}
          </div>
        )}
        
        <nav className="side-nav" aria-label="Navigasi aplikasi">
          {shell === 'platform' ? (
            <div className="nav-group">
              <div className="nav-group-label">Platform</div>
              {platformNav.map((item) => (
                <button type="button" className={page === item.key ? 'active' : ''} onClick={() => { goPage(item.key); setNavOpen(false); }} key={item.key} title={item.label}>
                  <Ti name={PAGE_ICONS[item.key] || 'platform'} />
                  <span className="nav-label">{item.label}</span>
                  {item.key === 'leads' && leadNewCount > 0 ? (
                    <span className="nav-badge" aria-label={`${leadNewCount} minat baru`}>{leadNewCount > 99 ? '99+' : leadNewCount}</span>
                  ) : null}
                  {item.key === 'workspaces' && pendingWorkspaceCount > 0 ? (
                    <span className="nav-badge" aria-label={`${pendingWorkspaceCount} menunggu persetujuan`}>
                      {pendingWorkspaceCount > 99 ? '99+' : pendingWorkspaceCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            filteredErpNav.map((g) => {
              const items = navQuery 
                ? g.items.filter(i => i.label.toLowerCase().includes(navQuery.toLowerCase()))
                : g.items;
              if (items.length === 0) return null;
              
              return (
                <div key={g.group} className="nav-group">
                  <div className="nav-group-label">{g.group}</div>
                  {items.map((item) => (
                    <button type="button" className={page === item.key ? 'active' : ''} onClick={() => { goPage(item.key); setNavOpen(false); }} key={item.key} title={item.label}>
                      <Ti name={PAGE_ICONS[item.key] || 'dashboard'} /><span className="nav-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </nav>
        
        {shell === 'workspace' && (
          <div className="pwa-cta-container" style={{ padding: '0 16px', marginBottom: 12 }}>
            <a
              href="?pwa=true"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                color: '#F59E0B',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <span>📱</span>
              {!sidebarCollapsed ? <span>Buka TUMBU Mobile</span> : null}
            </a>
          </div>
        )}
        
        <div className="account">
          <strong>{userName || 'Pengguna'}</strong>
          <span>{labelRole(userRole || (shell === 'platform' ? 'PLATFORM_ADMIN' : 'MEMBER'))}</span>
          {shell === 'workspace' ? <small className="ws-platform-credit">Didukung TUMBU Business OS</small> : null}
          <p className="account-help">
            Butuh bantuan?<br />
            <a href={TUMBU_MAILTO}>{TUMBU_CONTACT?.email || 'halo@tumbu.web.id'}</a>
          </p>
          <button type="button" className="logout-btn" onClick={onLogout}>Keluar</button>
        </div>
      </aside>
      
      <section className="content">
        <header className={`content-top${shell === 'platform' ? ' content-top--platform' : ''}`}>
          <div className="content-top-title" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <button type="button" className="menu-toggle" aria-label="Buka menu" onClick={() => setNavOpen(true)}>☰</button>
            <div style={{ minWidth: 0 }}>
              <span className="eyebrow">{shell === 'platform' ? 'TUMBU • Panel Platform' : workspaceName || 'Usaha saya'}</span>
              <h1>{title}</h1>
            </div>
            {shell === 'workspace' && (
              <label className="shell-nav-search">
                <span className="sr-only">Cari menu</span>
                <input
                  type="search"
                  placeholder="Cari menu..."
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
          </div>
          <div className="content-top-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="account-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(15, 30, 58, 0.05)', borderRadius: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0F1E3A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F1E3A' }}>{userName}</span>
              </div>
            </div>
            {onRefresh && (
              <button type="button" className="refresh" onClick={onRefresh}>
                <span aria-hidden="true">↻</span> <span className="refresh-label">Muat ulang</span>
              </button>
            )}
          </div>
        </header>
        
        {children}
      </section>
    </main>
  );
}
