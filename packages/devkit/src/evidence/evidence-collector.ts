// packages/devkit/src/evidence/evidence-collector.ts
import * as fs from 'fs';
import * as path from 'path';

export interface PrismaModelEvidence {
  name: string;
  fields: { name: string; type: string; isOptional: boolean }[];
  rawBlock: string;
}

export interface IndexedDbStoreEvidence {
  storeNames: string[];
  filePath: string;
}

export interface RepositoryEvidence {
  workspaceRoot: string;
  prismaModels: Map<string, PrismaModelEvidence>;
  indexedDbStores: string[];
  hasOutboxStore: boolean;
  hasSyncIdempotencyModel: boolean;
  hasDirectFirestoreUsageInFeatures: boolean;
  forbiddenDependencyFindings: string[];
  collectedAt: string;
}

export class EvidenceCollector {
  private workspaceRoot: string;

  constructor(customWorkspaceRoot?: string) {
    this.workspaceRoot = customWorkspaceRoot || this.findWorkspaceRoot();
  }

  private findWorkspaceRoot(): string {
    let currentDir = process.cwd();
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8'));
          if (pkg.name === 'tumbu-runtime' || pkg.workspaces) {
            return currentDir;
          }
        } catch {
          // continue search
        }
      }
      currentDir = path.dirname(currentDir);
    }
    return process.cwd();
  }

  public collectEvidence(): RepositoryEvidence {
    const prismaModels = this.collectPrismaModels();
    const indexedDb = this.collectIndexedDbStores();
    const forbidden = this.scanForbiddenDependencies();

    const hasOutbox = indexedDb.storeNames.includes('outbox');
    const hasSyncIdempotency = prismaModels.has('SyncIdempotency');

    return {
      workspaceRoot: this.workspaceRoot,
      prismaModels,
      indexedDbStores: indexedDb.storeNames,
      hasOutboxStore: hasOutbox,
      hasSyncIdempotencyModel: hasSyncIdempotency,
      hasDirectFirestoreUsageInFeatures: forbidden.hasDirectFirestoreInFeatures,
      forbiddenDependencyFindings: forbidden.findings,
      collectedAt: new Date().toISOString(),
    };
  }

  private collectPrismaModels(): Map<string, PrismaModelEvidence> {
    const models = new Map<string, PrismaModelEvidence>();
    const prismaPath = path.join(this.workspaceRoot, 'apps', 'api', 'prisma', 'schema.prisma');

    if (!fs.existsSync(prismaPath)) {
      return models;
    }

    try {
      const content = fs.readFileSync(prismaPath, 'utf-8');
      const modelRegex = /model\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
      let match: RegExpExecArray | null;

      while ((match = modelRegex.exec(content)) !== null) {
        const modelName = match[1];
        const body = match[2];
        const fields: { name: string; type: string; isOptional: boolean }[] = [];

        const lines = body.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
            continue;
          }

          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const fieldName = parts[0];
            const rawType = parts[1];
            fields.push({
              name: fieldName,
              type: rawType.replace('?', ''),
              isOptional: rawType.includes('?'),
            });
          }
        }

        models.set(modelName, {
          name: modelName,
          fields,
          rawBlock: match[0],
        });
      }
    } catch {
      // read-only tolerance
    }

    return models;
  }

  private collectIndexedDbStores(): IndexedDbStoreEvidence {
    const stores: string[] = [];
    const idbPath = path.join(this.workspaceRoot, 'apps', 'web', 'src', 'lib', 'offline', 'indexeddb.ts');

    if (!fs.existsSync(idbPath)) {
      return { storeNames: stores, filePath: idbPath };
    }

    try {
      const content = fs.readFileSync(idbPath, 'utf-8');
      const createStoreRegex = /createObjectStore\(\s*['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;

      while ((match = createStoreRegex.exec(content)) !== null) {
        stores.push(match[1]);
      }
    } catch {
      // read-only tolerance
    }

    return { storeNames: stores, filePath: idbPath };
  }

  private scanForbiddenDependencies(): { hasDirectFirestoreInFeatures: boolean; findings: string[] } {
    const findings: string[] = [];
    let hasDirectFirestoreInFeatures = false;

    const featuresDir = path.join(this.workspaceRoot, 'apps', 'web', 'src', 'features');
    if (fs.existsSync(featuresDir)) {
      const scanDir = (dir: string) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scanDir(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
              const code = fs.readFileSync(fullPath, 'utf-8');
              if (code.includes('firebase/firestore') || code.includes('getFirestore(')) {
                hasDirectFirestoreInFeatures = true;
                findings.push(`Direct Firestore import detected in ${path.relative(this.workspaceRoot, fullPath)}`);
              }
            }
          }
        } catch {
          // ignore
        }
      };
      scanDir(featuresDir);
    }

    return { hasDirectFirestoreInFeatures, findings };
  }
}
