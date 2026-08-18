// packages/devkit/src/generator/ast-parser.spec.ts
import { FeedEntryContract } from '@tumbu/contracts/dist/domains/feed-entry.contract';
import { BusinessType, DomainContract } from '@tumbu/contracts';
import { ASTParser } from './ast-parser';

describe('ASTParser (TUMBU DEV-2B Stage 2)', () => {
  it('should parse a valid DomainContract into a GeneratorAST successfully', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    expect(ast).toBeDefined();
    expect(ast.contractName).toBe('FeedEntry');
  });

  it('should preserve FeedEntry information correctly', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    expect(ast.version).toBe('1.0.0');
    expect(ast.cluster).toBe('Inti');
    expect(ast.entity.backendPrismaModel).toBe('AquaFeedEvent');
  });

  it('should preserve the applicable BusinessType final constraints', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    expect(ast.applicableBusinessTypes).toContain(BusinessType.CULTIVATOR);
    expect(ast.applicableBusinessTypes.length).toBe(1);
  });

  it('should preserve required domain fields accurately', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const fields = ast.entity.fields;
    
    const idField = fields.find(f => f.name === 'id');
    expect(idField).toBeDefined();
    expect(idField?.type).toBe('uuid');
    expect(idField?.required).toBe(true);

    const quantityField = fields.find(f => f.name === 'quantityKg');
    expect(quantityField).toBeDefined();
    expect(quantityField?.type).toBe('number');
    expect(quantityField?.unit).toBe('kg');
  });

  it('should normalize nested/ordered inputs deterministically without depending on source order', () => {
    // Creating a mock contract where applicable business types are unordered
    const testContract: DomainContract = {
      name: 'UnorderedContract',
      version: '1.0.0',
      cluster: 'Hulu',
      applicableBusinessTypes: [BusinessType.FEED_DISTRIBUTOR, BusinessType.CULTIVATOR],
      entity: {
        name: 'test',
        description: 'test description',
        backendPrismaModel: 'TestModel',
        fields: [
          { name: 'b', type: 'string', required: true, description: 'Field B' },
          { name: 'a', type: 'string', required: true, description: 'Field A' },
        ],
      },
      commands: [
        {
          name: 'CommandB',
          description: '',
          parameters: [],
          emitsEvent: 'EventB',
          idempotent: true,
        },
        {
          name: 'CommandA',
          description: '',
          parameters: [],
          emitsEvent: 'EventA',
          idempotent: true,
        },
      ],
      events: [],
      projections: [],
      sync: {
        outboxSupported: true,
        syncEndpoint: '/api/sync',
        idempotencyKeyField: 'id',
        conflictStrategy: 'SERVER_WINS',
      },
      offline: {
        supported: true,
        storageTarget: 'offline_table',
        fallbackStrategy: 'LOCAL_QUEUE',
      },
      architectureInvariants: [],
    };

    const ast1 = ASTParser.parse(testContract);

    // BusinessTypes should be sorted alphabetically: CULTIVATOR first, then FEED_DISTRIBUTOR
    expect(ast1.applicableBusinessTypes[0]).toBe(BusinessType.CULTIVATOR);
    expect(ast1.applicableBusinessTypes[1]).toBe(BusinessType.FEED_DISTRIBUTOR);

    // Commands should be sorted alphabetically by name
    expect(ast1.commands[0].name).toBe('CommandA');
    expect(ast1.commands[1].name).toBe('CommandB');
  });

  it('should ensure the input contract is not mutated in any way', () => {
    const originalContractJson = JSON.stringify(FeedEntryContract);
    
    ASTParser.parse(FeedEntryContract);

    const afterParseJson = JSON.stringify(FeedEntryContract);
    expect(afterParseJson).toBe(originalContractJson);
  });

  it('should fail explicitly with a clear error on invalid contracts', () => {
    const invalidContract = {
      name: '',
      version: '1.0.0',
    } as any;

    expect(() => ASTParser.parse(invalidContract)).toThrow('Contract name is missing or invalid');

    const invalidFieldsContract = {
      name: 'Test',
      version: '1.0.0',
      cluster: 'Inti',
      applicableBusinessTypes: [BusinessType.CULTIVATOR],
      entity: {
        name: 'Test',
        backendPrismaModel: 'Test',
        fields: [
          { name: '', type: 'string' }
        ]
      }
    } as any;

    expect(() => ASTParser.parse(invalidFieldsContract)).toThrow();
  });

  it('should perform no filesystem operations during parsing', () => {
    const fs = require('fs');
    const spyWriteFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const spyWriteFileAsync = jest.spyOn(fs, 'writeFile').mockImplementation(() => {});

    ASTParser.parse(FeedEntryContract);

    expect(spyWriteFile).not.toHaveBeenCalled();
    expect(spyWriteFileAsync).not.toHaveBeenCalled();

    spyWriteFile.mockRestore();
    spyWriteFileAsync.mockRestore();
  });
});
