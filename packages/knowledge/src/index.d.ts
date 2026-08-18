export declare class KnowledgeLoader {
    private readonly directory;
    constructor(directory: string);
    load(): Record<string, unknown>;
}
export declare class KnowledgeEngine {
    private readonly registry;
    constructor(registry: Record<string, unknown>);
    getDomains(): string[];
}
