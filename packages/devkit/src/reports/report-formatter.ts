// packages/devkit/src/reports/report-formatter.ts
import { DomainAuditReport } from '../evaluators/rule-evaluator';
import { DomainInspectionTree } from '../inspectors/domain-inspector';

export class ReportFormatter {
  public static formatAuditReport(report: DomainAuditReport): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('================================================================================');
    lines.push(` TUMBU ARCHITECTURE CHECK: ${report.domainName} (${report.cluster})`);
    lines.push('================================================================================');
    lines.push('');

    for (const r of report.results) {
      const statusIcon = r.status === 'PASS' ? '✓ PASS' : r.status === 'FAIL' ? '✗ FAIL' : '? UNKNOWN';
      const statusColor = r.status === 'PASS' ? '\x1b[32m' : r.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
      const reset = '\x1b[0m';

      lines.push(`${statusColor}[${statusIcon}]${reset} ${r.ruleId} — ${r.title}`);
      lines.push(`  Expected : ${r.expected}`);
      lines.push(`  Evidence : ${r.evidence}`);
      lines.push(`  Reason   : ${r.reason}`);
      lines.push('');
    }

    lines.push('--------------------------------------------------------------------------------');
    lines.push(
      ` Summary: Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Unknown/Not Verified: ${report.summary.unknown}`
    );
    const overallStatus = report.summary.failed > 0 ? 'FAIL' : report.summary.unknown > 0 ? 'PASS WITH WARNINGS' : 'PASS';
    lines.push(` Architecture Audit Result: ${overallStatus}`);
    lines.push('================================================================================');
    lines.push('');

    return lines.join('\n');
  }

  public static formatInspectionTree(tree: DomainInspectionTree): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('================================================================================');
    lines.push(` TUMBU DOMAIN INSPECTION: ${tree.name} (v${tree.version})`);
    lines.push('================================================================================');
    lines.push(`Cluster: ${tree.cluster}`);
    lines.push(`Target Business Types: [${tree.applicableBusinessTypes.join(', ')}]`);
    lines.push('');

    lines.push(`${tree.name}`);
    lines.push('├── Entity');
    lines.push(`│   ├── Backend Model: ${tree.entity.backendPrismaModel} (${tree.evidenceSummary.prismaModelFound ? 'Found in Prisma' : 'Not Found'})`);
    lines.push('│   └── Fields:');
    for (let i = 0; i < tree.entity.fields.length; i++) {
      const f = tree.entity.fields[i];
      const isLast = i === tree.entity.fields.length - 1;
      const prefix = isLast ? '│       └──' : '│       ├──';
      lines.push(`${prefix} ${f.name} (${f.type}${f.required ? ', required' : ''}${f.unit ? `, ${f.unit}` : ''})`);
    }

    lines.push('├── Commands');
    for (let i = 0; i < tree.commands.length; i++) {
      const c = tree.commands[i];
      const isLast = i === tree.commands.length - 1;
      const prefix = isLast ? '│   └──' : '│   ├──';
      lines.push(`${prefix} ${c.name} -> emits: ${c.emitsEvent} (idempotent: ${c.idempotent})`);
    }

    lines.push('├── Events');
    for (let i = 0; i < tree.events.length; i++) {
      const e = tree.events[i];
      const isLast = i === tree.events.length - 1;
      const prefix = isLast ? '│   └──' : '│   ├──';
      lines.push(`${prefix} ${e.name} (immutable: ${e.isImmutable})`);
    }

    lines.push('├── Projections');
    for (let i = 0; i < tree.projections.length; i++) {
      const p = tree.projections[i];
      const isLast = i === tree.projections.length - 1;
      const prefix = isLast ? '│   └──' : '│   ├──';
      lines.push(`${prefix} ${p.name} [${p.frequency}] -> ${p.target}`);
    }

    lines.push('├── Sync Contract');
    lines.push(`│   ├── Endpoint: ${tree.sync.syncEndpoint}`);
    lines.push(`│   ├── Outbox Supported: ${tree.sync.outboxSupported}`);
    lines.push(`│   ├── Idempotency Key: ${tree.sync.idempotencyKeyField}`);
    lines.push(`│   └── Conflict Strategy: ${tree.sync.conflictStrategy}`);

    lines.push('├── Offline Contract');
    lines.push(`│   ├── Storage Target: ${tree.offline.storageTarget} (${tree.evidenceSummary.indexedDbStoreFound ? 'Found in IndexedDB' : 'Not Found / Pending Migration'})`);
    lines.push(`│   └── Fallback Strategy: ${tree.offline.fallbackStrategy}`);

    lines.push('└── Repository Evidence');
    lines.push(`    ├── Prisma Model: ${tree.evidenceSummary.prismaModelFound ? '✓ FOUND' : '✗ NOT FOUND'}`);
    lines.push(`    ├── IndexedDB Store: ${tree.evidenceSummary.indexedDbStoreFound ? '✓ FOUND' : '? UNKNOWN / NOT REGISTERED'}`);
    lines.push(`    ├── Outbox Queue: ${tree.evidenceSummary.outboxFound ? '✓ FOUND' : '✗ NOT FOUND'}`);
    lines.push(`    └── Sync Idempotency: ${tree.evidenceSummary.syncIdempotencyFound ? '✓ FOUND' : '✗ NOT FOUND'}`);

    lines.push('================================================================================');
    lines.push('');

    return lines.join('\n');
  }
}
