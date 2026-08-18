// apps/web/src/app/dev/page.tsx
import React from 'react';
import { getDomainContract } from '@tumbu/contracts';
import { EvidenceCollector, RuleEvaluator, DomainInspector } from '@tumbu/devkit';
import { ArchitectureMatrix } from '@/components/dev/ArchitectureMatrix';

export const dynamic = 'force-dynamic';

export default function DevConsolePage() {
  // Collect actual repository evidence in read-only manner
  const collector = new EvidenceCollector();
  const evidence = collector.collectEvidence();

  // Evaluate canonical FeedEntryContract
  const contract = getDomainContract('FeedEntry');
  if (!contract) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 font-mono">
        <h1 className="text-xl font-bold text-rose-400">Error: FeedEntry Contract Not Found</h1>
      </div>
    );
  }

  const evaluator = new RuleEvaluator();
  const report = evaluator.evaluateDomain(contract, evidence);

  const inspector = new DomainInspector();
  const domainTree = inspector.inspect(contract, evidence);

  const serializedEvidence = {
    workspaceRoot: evidence.workspaceRoot,
    prismaModelCount: evidence.prismaModels.size,
    indexedDbStores: evidence.indexedDbStores,
    hasOutboxStore: evidence.hasOutboxStore,
    hasSyncIdempotencyModel: evidence.hasSyncIdempotencyModel,
    hasDirectFirestoreUsageInFeatures: evidence.hasDirectFirestoreUsageInFeatures,
    collectedAt: evidence.collectedAt,
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Dev Navigation & Environment Guard Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-lg tracking-wider text-emerald-400 font-mono">TUMBU</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              /dev console
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Internal Architecture Guardian (Read-Only)
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              ← Back to App
            </a>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Runtime Healthy
            </span>
          </div>
        </div>
      </header>

      {/* Main Console Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <ArchitectureMatrix
          results={report.results}
          summary={report.summary}
          domainTree={domainTree}
          evidence={serializedEvidence}
        />
      </div>
    </main>
  );
}
