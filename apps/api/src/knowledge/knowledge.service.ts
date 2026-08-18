import { Injectable } from '@nestjs/common';
import {
  KnowledgeLoader,
  KnowledgeEngine,
} from '@tumbu/knowledge';
import path from 'node:path';

@Injectable()
export class KnowledgeService {
  private readonly engine: KnowledgeEngine;

  constructor() {
    const loader = new KnowledgeLoader(
      path.resolve(process.cwd(), 'knowledge'),
    );

    const registry = loader.load();

    this.engine = new KnowledgeEngine(registry);
  }

  getSummary() {
    return {
      domains: this.engine.getDomains(),
      totalDomains: this.engine.getDomains().length,
    };
  }
}