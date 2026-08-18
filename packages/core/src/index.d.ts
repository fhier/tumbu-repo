export interface OutboxItem {
    id: string;
    aggregate: string;
    version: number;
    payload?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface SyncPushRequest {
    items: OutboxItem[];
}
export interface SyncPushResponseItem {
    id: string;
    status: 'SUCCESS' | 'FAILED_NEEDS_REVIEW' | string;
    error?: string;
    [key: string]: unknown;
}
export interface SyncPushResponse {
    success: boolean;
    processed?: number;
    processedCount: number;
    timestamp: string;
    results: SyncPushResponseItem[];
}
export interface SyncPullRequest {
    cursor?: string;
    [key: string]: unknown;
}
export interface SyncPullResponse {
    [key: string]: unknown;
}
