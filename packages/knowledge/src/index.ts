import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export class KnowledgeLoader {
  constructor(private readonly directory: string) {}
  load(): Record<string, unknown> {
    if (!existsSync(this.directory)) return {};
    return Object.fromEntries(readdirSync(this.directory).map((file) => {
      const path = join(this.directory, file);
      try { return [file, JSON.parse(readFileSync(path, 'utf8'))]; }
      catch { return [file, readFileSync(path, 'utf8')]; }
    }));
  }
}

export class KnowledgeEngine {
  constructor(private readonly registry: Record<string, unknown>) {}
  getDomains(): string[] { return Object.keys(this.registry); }
}
