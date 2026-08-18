#!/usr/bin/env node
// tooling/cli/src/index.ts
// TUMBU CLI — Architecture Checker & Domain Inspector (READ-ONLY)

import {
  getAllDomainContracts,
  getDomainContract,
  TUMBU_ARCHITECTURE_RULES,
} from '../../../packages/contracts/src';
import {
  EvidenceCollector,
  RuleEvaluator,
  DomainInspector,
  ReportFormatter,
  ASTParser,
  ArtifactPlanner,
  ArchitecturePreChecker,
  GeneratorPlanBuilder,
  DiffRenderer,
} from '../../../packages/devkit/src';

function printHelp() {
  console.log(`
================================================================================
 TUMBU CLI — Architecture Guardian & Domain Inspector (READ-ONLY)
================================================================================

Usage:
  tumbu check [domain]    Run architecture compliance check against repository evidence
  tumbu inspect <domain>  Inspect domain contract structure, commands, events, and sync
  tumbu generate --contract <contract> --dry-run
                          Dry-run generate files and check architecture compliance
  tumbu rules             Display all TUMBU Architecture Rule IDs (TUMBU-ARCH-001..007)
  tumbu doctor            Diagnose workspace environment and collected evidence
  tumbu help              Show this help message

Examples:
  tumbu check
  tumbu check FeedEntry
  tumbu inspect FeedEntry
  tumbu generate --contract FeedEntry --dry-run
  tumbu rules
  tumbu doctor
================================================================================
`);
}

export function runCheck(domainArg?: string) {
  const collector = new EvidenceCollector();
  const evidence = collector.collectEvidence();
  const evaluator = new RuleEvaluator();

  const contracts = domainArg
    ? [getDomainContract(domainArg)].filter(Boolean)
    : getAllDomainContracts();

  if (contracts.length === 0) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Domain '${domainArg}' not found in registered contracts.`);
    console.log(`Available domains: ${getAllDomainContracts().map((d) => d.name).join(', ')}`);
    process.exit(1);
  }

  for (const contract of contracts) {
    if (!contract) continue;
    const report = evaluator.evaluateDomain(contract, evidence);
    console.log(ReportFormatter.formatAuditReport(report));
  }
}

export function runInspect(domainArg?: string) {
  if (!domainArg) {
    console.error('\x1b[31m[ERROR]\x1b[0m Please specify a domain to inspect. e.g. `tumbu inspect FeedEntry`');
    process.exit(1);
  }

  const contract = getDomainContract(domainArg);
  if (!contract) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Domain '${domainArg}' not found.`);
    console.log(`Available domains: ${getAllDomainContracts().map((d) => d.name).join(', ')}`);
    process.exit(1);
  }

  const collector = new EvidenceCollector();
  const evidence = collector.collectEvidence();
  const inspector = new DomainInspector();

  const tree = inspector.inspect(contract, evidence);
  console.log(ReportFormatter.formatInspectionTree(tree));
}

export function runGenerate(args: string[]) {
  let contractArg: string | undefined = undefined;
  let dryRunArg = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--contract' && i + 1 < args.length) {
      contractArg = args[i + 1];
      i++;
    } else if (arg.startsWith('--contract=')) {
      contractArg = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      dryRunArg = true;
    }
  }

  if (!contractArg) {
    console.error('\x1b[31m[ERROR]\x1b[0m Please specify a contract using `--contract <contract>`');
    process.exit(1);
  }

  if (!dryRunArg) {
    console.error('\x1b[31m[ERROR]\x1b[0m This tool only supports read-only and dry-run execution. Please specify `--dry-run` to run.');
    process.exit(1);
  }

  const contract = getDomainContract(contractArg);
  if (!contract) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Contract '${contractArg}' not found in registered contracts.`);
    console.log(`Available contracts: ${getAllDomainContracts().map((d) => d.name).join(', ')}`);
    process.exit(1);
  }

  let plan;
  try {
    // 1. AST Parsing
    const ast = ASTParser.parse(contract);

    // 2. Artifact Planning
    const artifacts = ArtifactPlanner.plan(ast);

    // 3. Pre-generation Architecture Check
    const checks = ArchitecturePreChecker.check(ast, artifacts);

    // 4. Final Deterministic Generator Plan Builder
    plan = GeneratorPlanBuilder.build(ast, artifacts, checks);

    // 5. Render Diffs (dry-run only)
    const diffs = DiffRenderer.render(plan);
    const printedOutput = DiffRenderer.renderToString(diffs, plan.hash);

    // Print out the beautiful dry-run rendering
    console.log(printedOutput);

    // Print rule statuses
    console.log('\n--- ARCHITECTURE RULES CHECK STATUS ---');
    for (const rule of plan.checks.rulesChecked) {
      const statusColor = rule.status === 'PASS' ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
      console.log(`${statusColor} ${rule.ruleId}: ${rule.message}`);
    }

    if (plan.checks.warnings.length > 0) {
      console.log('\n\x1b[33m[WARNINGS]\x1b[0m');
      for (const warning of plan.checks.warnings) {
        console.log(`  - ${warning}`);
      }
    }
  } catch (err: any) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Generation failed: ${err.message}`);
    process.exit(1);
  }

  if (!plan.checks.valid) {
    console.error('\n\x1b[31m[ERROR]\x1b[0m Architecture compliance checks failed!');
    process.exit(1);
  } else {
    console.log('\n\x1b[32m[SUCCESS]\x1b[0m All architecture compliance checks passed!');
    process.exit(0);
  }
}

export function runRules() {
  console.log(`
================================================================================
  TUMBU ARCHITECTURE RULES & INVARIANTS
================================================================================
`);
  for (const rule of Object.values(TUMBU_ARCHITECTURE_RULES)) {
    console.log(`[${rule.id}] ${rule.title}`);
    console.log(`  Severity : ${rule.severity}`);
    console.log(`  Rule     : ${rule.description}`);
    console.log(`  Rationale: ${rule.rationale}`);
    console.log('--------------------------------------------------------------------------------');
  }
}

export function runDoctor() {
  console.log(`
================================================================================
 TUMBU WORKSPACE DIAGNOSTICS (DOCTOR)
================================================================================
`);
  const collector = new EvidenceCollector();
  const evidence = collector.collectEvidence();

  console.log(`Workspace Root     : ${evidence.workspaceRoot}`);
  console.log(`Prisma Models      : ${evidence.prismaModels.size} models found in schema.prisma`);
  console.log(`IndexedDB Stores   : [${evidence.indexedDbStores.join(', ')}]`);
  console.log(`Outbox Queue Store : ${evidence.hasOutboxStore ? '✓ Present' : '✗ Missing'}`);
  console.log(`Sync Idempotency   : ${evidence.hasSyncIdempotencyModel ? '✓ Present' : '✗ Missing'}`);
  console.log(`Forbidden Bypasses : ${evidence.hasDirectFirestoreUsageInFeatures ? '✗ Detected' : '✓ None (Clean)'}`);
  console.log(`Timestamp          : ${evidence.collectedAt}`);
  console.log('================================================================================\n');
}

// CLI router
export function runCLI(cliArgs: string[]) {
  const command = cliArgs[0] || 'help';

  switch (command) {
    case 'check':
      runCheck(cliArgs[1]);
      break;
    case 'inspect':
      runInspect(cliArgs[1]);
      break;
    case 'generate':
      runGenerate(cliArgs);
      break;
    case 'rules':
      runRules();
      break;
    case 'doctor':
      runDoctor();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

if (require.main === module) {
  runCLI(process.argv.slice(2));
}
