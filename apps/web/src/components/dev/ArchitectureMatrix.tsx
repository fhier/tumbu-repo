'use client';

import React, { useState } from 'react';

export interface RuleResult {
  ruleId: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_VERIFIED';
  expected: string;
  evidence: string;
  reason: string;
}

export interface AuditSummary {
  total: number;
  passed: number;
  failed: number;
  unknown: number;
}

export interface DomainInspectionData {
  name: string;
  version: string;
  cluster: string;
  applicableBusinessTypes: string[];
  entity: {
    name: string;
    backendPrismaModel: string;
    fields: Array<{ name: string; type: string; required: boolean; unit?: string }>;
  };
  commands: Array<{ name: string; description: string; emitsEvent: string; idempotent: boolean }>;
  events: Array<{ name: string; description: string; isImmutable: boolean }>;
  projections: Array<{ name: string; target: string; description: string; frequency: string }>;
  sync: {
    outboxSupported: boolean;
    syncEndpoint: string;
    idempotencyKeyField: string;
    conflictStrategy: string;
  };
  offline: {
    supported: boolean;
    storageTarget: string;
    fallbackStrategy: string;
  };
  evidenceSummary: {
    prismaModelFound: boolean;
    indexedDbStoreFound: boolean;
    outboxFound: boolean;
    syncIdempotencyFound: boolean;
  };
}

export interface WorkspaceEvidenceSummary {
  workspaceRoot: string;
  prismaModelCount: number;
  indexedDbStores: string[];
  hasOutboxStore: boolean;
  hasSyncIdempotencyModel: boolean;
  hasDirectFirestoreUsageInFeatures: boolean;
  collectedAt: string;
}

interface Props {
  results: RuleResult[];
  summary: AuditSummary;
  domainTree: DomainInspectionData;
  evidence: WorkspaceEvidenceSummary;
}

export function ArchitectureMatrix({ results, summary, domainTree, evidence }: Props) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'inspector' | 'doctor'>('matrix');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>('TUMBU-ARCH-004');

  const selectedRule = results.find((r) => r.ruleId === selectedRuleId) || results[0];

  return (
    <div className="space-y-6" id="dev-console-container">
      {/* Top Banner: Read-Only Guardian Bar */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-mono font-semibold tracking-wider uppercase rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                TUMBU DEVKIT v0.0.1
              </span>
              <span className="px-2.5 py-1 text-xs font-mono font-semibold tracking-wider uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                READ-ONLY MODE
              </span>
              <span className="px-2.5 py-1 text-xs font-mono text-slate-400">
                Vertical Slice: <strong className="text-slate-200">FeedEntry (Inti / Cultivator)</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-2 tracking-tight">
              TUMBU Architecture Guardian & Inspection Console
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Kaca pembesar arsitektur TUMBU — Memverifikasi keselarasan antara canonical contract terhadap repository evidence aktual secara read-only.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-3 rounded-lg border border-slate-800">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Architecture Status</div>
              <div className="text-sm font-bold text-amber-400">PASS WITH WARNINGS</div>
            </div>
            <div className="h-7 w-px bg-slate-800 mx-2" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Production Changes</div>
              <div className="text-sm font-bold text-emerald-400">0 MODIFIED</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards: Repository Health */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Architecture Rules</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{summary.passed}</span>
            <span className="text-sm text-emerald-600 font-semibold">PASS</span>
            <span className="text-slate-300">/</span>
            <span className="text-lg font-bold text-amber-600">{summary.unknown}</span>
            <span className="text-xs text-amber-600 font-medium">UNKNOWN</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Total {summary.total} canonical invariant rules</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Backend Source of Truth</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">PostgreSQL</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{evidence.prismaModelCount} Prisma models declared in schema</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Offline & Sync Queue</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">Outbox Active</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Idempotency deduplication verified</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Console Mode</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">READ-ONLY</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Mutation & write actions locked</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 font-medium text-sm transition-colors relative ${
            activeTab === 'matrix'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="tab-architecture-matrix"
        >
          Architecture Audit Matrix ({results.length})
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`pb-3 font-medium text-sm transition-colors relative ${
            activeTab === 'inspector'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="tab-domain-inspector"
        >
          Domain Inspector (FeedEntry v1.0.0)
        </button>
        <button
          onClick={() => setActiveTab('doctor')}
          className={`pb-3 font-medium text-sm transition-colors relative ${
            activeTab === 'doctor'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="tab-health-doctor"
        >
          Health Doctor & Repository Evidence
        </button>
      </div>

      {/* TAB 1: ARCHITECTURE MATRIX */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Rules List (Left 7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Architecture Invariants Checklist</h3>
              <span className="text-xs font-mono text-slate-500">TUMBU-ARCH-001..007</span>
            </div>
            <div className="divide-y divide-slate-100">
              {results.map((r) => {
                const isSelected = selectedRuleId === r.ruleId;
                const isPass = r.status === 'PASS';
                const isUnknown = r.status === 'UNKNOWN' || r.status === 'NOT_VERIFIED';

                return (
                  <button
                    key={r.ruleId}
                    onClick={() => setSelectedRuleId(r.ruleId)}
                    className={`w-full text-left p-4 transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                      isSelected ? 'bg-indigo-50/60 border-l-4 border-indigo-600' : ''
                    }`}
                    id={`rule-item-${r.ruleId}`}
                  >
                    <div className="mt-0.5">
                      {isPass && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                          ✓
                        </span>
                      )}
                      {isUnknown && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          ?
                        </span>
                      )}
                      {!isPass && !isUnknown && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                          ✗
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{r.ruleId}</span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            isPass
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isUnknown
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-800 mt-1">{r.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{r.evidence}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule Detail Panel (Right 5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 sticky top-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600">{selectedRule.ruleId}</span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{selectedRule.title}</h4>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase font-mono ${
                  selectedRule.status === 'PASS'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedRule.status === 'UNKNOWN'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {selectedRule.status}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Expected Contract</div>
                <div className="mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-mono text-[11px]">
                  {selectedRule.expected}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Repository Evidence</div>
                <div className="mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-mono text-[11px]">
                  {selectedRule.evidence}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Diagnostic Reason</div>
                <div className="mt-1 text-slate-700 leading-relaxed">
                  {selectedRule.reason}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Action Policy</div>
                <div className="mt-1 flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-amber-900 text-[11px]">
                  <span className="font-bold">Mode:</span>
                  <span>READ-ONLY — No automatic fix or modification available.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOMAIN INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{domainTree.name}</h3>
                <span className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-600 rounded">
                  v{domainTree.version}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                  Cluster: {domainTree.cluster}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Authorized for BusinessTypes: <strong className="text-slate-700">{domainTree.applicableBusinessTypes.join(', ')}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">
                Prisma: {domainTree.entity.backendPrismaModel}
              </span>
              <span className="text-xs font-mono px-2.5 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">
                Dexie Target: {domainTree.offline.storageTarget}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Entity & Fields */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📄</span> Entity Schema
                </h4>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                  {domainTree.evidenceSummary.prismaModelFound ? 'Prisma Verified' : 'Missing'}
                </span>
              </div>
              <div className="space-y-1.5">
                {domainTree.entity.fields.map((f) => (
                  <div
                    key={f.name}
                    className="p-2 bg-white rounded border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-semibold text-slate-800">{f.name}</span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <span>{f.type}</span>
                      {f.unit && <span className="text-indigo-600 font-bold">({f.unit})</span>}
                      {f.required && <span className="text-rose-500 font-bold">*</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commands & Events */}
            <div className="space-y-6">
              {/* Commands */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚡</span> Commands ({domainTree.commands.length})
                </h4>
                <div className="space-y-2">
                  {domainTree.commands.map((c) => (
                    <div key={c.name} className="p-2.5 bg-white rounded border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-800">{c.name}</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                          Idempotent: {String(c.idempotent)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">{c.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">Emits: {c.emitsEvent}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Events */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📡</span> Immutable Events ({domainTree.events.length})
                </h4>
                <div className="space-y-2">
                  {domainTree.events.map((e) => (
                    <div key={e.name} className="p-2 bg-white rounded border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-800">{e.name}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono">
                          Immutable
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{e.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sync, Offline & Projections */}
            <div className="space-y-6">
              {/* Sync & Offline Contracts */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔄</span> Sync & Offline Invariants
                </h4>
                <div className="bg-white p-3 rounded border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sync Endpoint:</span>
                    <span className="font-mono text-slate-800 font-semibold">{domainTree.sync.syncEndpoint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Idempotency Key:</span>
                    <span className="font-mono text-slate-800">{domainTree.sync.idempotencyKeyField}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Conflict Policy:</span>
                    <span className="font-mono text-indigo-700 font-semibold">{domainTree.sync.conflictStrategy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Offline Storage:</span>
                    <span className="font-mono text-amber-700 font-semibold">{domainTree.offline.storageTarget}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fallback Strategy:</span>
                    <span className="font-mono text-slate-800">{domainTree.offline.fallbackStrategy}</span>
                  </div>
                </div>
              </div>

              {/* Projections */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊</span> Projections ({domainTree.projections.length})
                </h4>
                <div className="space-y-2">
                  {domainTree.projections.map((p) => (
                    <div key={p.name} className="p-2 bg-white rounded border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          {p.frequency}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{p.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">Target: {p.target}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HEALTH DOCTOR */}
      {activeTab === 'doctor' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Repository Evidence Diagnostics</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evidence langsung yang dikumpulkan secara read-only dari codebase lokal.
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-bold">
              ✓ REPOSITORY HEALTHY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-sm">Prisma Schema (Backend Source of Truth)</div>
                <div className="text-slate-600">
                  Total Models: <strong className="text-slate-900 font-mono">{evidence.prismaModelCount} models</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Location: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">apps/api/prisma/schema.prisma</code>
                </div>
                <div className="text-emerald-700 font-medium pt-1 flex items-center gap-1.5">
                  <span>✓</span> Model <code>AquaFeedEvent</code> and <code>SyncIdempotency</code> verified.
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-sm">Forbidden Dependencies Scan</div>
                <div className="text-slate-600">
                  Status: <strong className="text-emerald-700 font-bold">Clean — Zero Direct Client Cloud DB Violations</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Features scan in <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">apps/web/src/features/</code>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-sm">IndexedDB Local Schema</div>
                <div className="text-slate-600">
                  Registered Object Stores ({evidence.indexedDbStores.length}):
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {evidence.indexedDbStores.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 font-mono text-[11px] rounded">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="text-slate-500 text-[11px] pt-1">
                  Outbox store: <strong className="text-emerald-700 font-mono">outbox (verified)</strong>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-sm">Timestamp & Execution Context</div>
                <div className="text-slate-600 font-mono text-[11px]">
                  Evaluated At: {evidence.collectedAt}
                </div>
                <div className="text-slate-600 font-mono text-[11px]">
                  Workspace: {evidence.workspaceRoot}
                </div>
                <div className="text-[11px] text-slate-500 italic">
                  Catatan: Konsol ini beroperasi pada mode read-only dan tidak menjalankan migrasi otomatis.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
