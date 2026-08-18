import { REGISTERED_DOMAIN_CONTRACTS, defineDomainContract, BusinessType } from '../../../packages/contracts/src';
import { runCLI } from './index';

describe('TUMBU CLI generate --contract <contract> --dry-run', () => {
  let logs: string[] = [];
  let errors: string[] = [];
  let exitCode: number | undefined = undefined;

  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;

  beforeAll(() => {
    // @ts-ignore
    process.exit = (code?: number) => {
      exitCode = code;
      throw new Error(`Process exited with code ${code}`);
    };
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  beforeEach(() => {
    logs = [];
    errors = [];
    exitCode = undefined;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };
    console.error = (...args) => {
      errors.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  it('should successfully run dry-run generation for FeedEntry contract', () => {
    try {
      runCLI(['generate', '--contract', 'FeedEntry', '--dry-run']);
    } catch (e: any) {
      if (!e.message.includes('Process exited')) {
        throw e;
      }
    }

    expect(exitCode).toBe(0);
    expect(errors.length).toBe(0);

    const mergedLogs = logs.join('\n');
    expect(mergedLogs).toContain('TUMBU GENERATOR DRY-RUN PREVIEW');
    expect(mergedLogs).toContain('apps/api/prisma/schema.prisma');
    expect(mergedLogs).toContain('apps/api/src/budidaya/api/FeedEntry.controller.ts');
    expect(mergedLogs).toContain('TUMBU-ARCH-001');
    expect(mergedLogs).toContain('TUMBU-ARCH-006');
    expect(mergedLogs).toContain('All architecture compliance checks passed!');
  });

  it('should compute deterministic hashes and outputs consistently', () => {
    let hash1: string | undefined = undefined;
    let hash2: string | undefined = undefined;

    try {
      runCLI(['generate', '--contract', 'FeedEntry', '--dry-run']);
    } catch (e) {}
    const run1Logs = logs.join('\n');
    const match1 = run1Logs.match(/Hash:\s*([a-f0-9]+)/i);
    if (match1) hash1 = match1[1];

    logs = [];
    try {
      runCLI(['generate', '--contract', 'FeedEntry', '--dry-run']);
    } catch (e) {}
    const run2Logs = logs.join('\n');
    const match2 = run2Logs.match(/Hash:\s*([a-f0-9]+)/i);
    if (match2) hash2 = match2[1];

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    expect(hash1).toBe(hash2);
    expect(run1Logs).toBe(run2Logs);
  });

  it('should exit with non-zero code on invalid/missing contracts', () => {
    try {
      runCLI(['generate', '--contract', 'NonExistent', '--dry-run']);
    } catch (e: any) {
      if (!e.message.includes('Process exited')) {
        throw e;
      }
    }

    expect(exitCode).toBe(1);
    expect(errors.join('\n')).toContain("Contract 'NonExistent' not found");
  });

  it('should exit with non-zero code if dry-run flag is missing', () => {
    try {
      runCLI(['generate', '--contract', 'FeedEntry']);
    } catch (e: any) {
      if (!e.message.includes('Process exited')) {
        throw e;
      }
    }

    expect(exitCode).toBe(1);
    expect(errors.join('\n')).toContain("This tool only supports read-only and dry-run execution");
  });

  it('should fail with exit code 1 and highlight architecture violations when rule checks fail', () => {
    // Dynamically register a violating contract to test rule failure handling
    const ViolatingContract = defineDomainContract({
      name: 'ViolatingDomain',
      version: '1.0.0',
      cluster: 'Inti',
      applicableBusinessTypes: [BusinessType.CULTIVATOR],
      entity: {
        name: 'ViolatingDomain',
        description: 'Violates id type',
        backendPrismaModel: 'ViolatingPrisma',
        fields: [
          {
            name: 'id',
            type: 'string', // Fail: must be uuid
            required: true,
            description: 'Wrong type ID',
          },
        ],
      },
      sync: {
        outboxSupported: false,
        syncEndpoint: '/api/sync/push',
        idempotencyKeyField: '',
        conflictStrategy: 'SERVER_WINS',
      },
      offline: {
        supported: false,
        storageTarget: '',
        fallbackStrategy: 'LOCAL_QUEUE',
      },
    });

    REGISTERED_DOMAIN_CONTRACTS['ViolatingDomain'] = ViolatingContract;

    try {
      runCLI(['generate', '--contract', 'ViolatingDomain', '--dry-run']);
    } catch (e: any) {
      if (!e.message.includes('Process exited')) {
        throw e;
      }
    }

    expect(exitCode).toBe(1);
    const mergedLogs = logs.join('\n');
    const mergedErrors = errors.join('\n');

    expect(mergedLogs).toContain('TUMBU-ARCH-006');
    expect(mergedErrors).toContain('Architecture compliance checks failed!');

    // Clean up registry
    delete REGISTERED_DOMAIN_CONTRACTS['ViolatingDomain'];
  });
});
