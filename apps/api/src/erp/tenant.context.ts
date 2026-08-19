import { Injectable, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaService } from '../prisma/prisma.service';
import { seedDatabase } from './seed.helper';

type Store = { tenantId: string; userId?: string; workspaceId?: string };

@Injectable()
export class TenantContext implements OnModuleInit {
  private readonly als = new AsyncLocalStorage<Store>();
  /** Seed/bootstrap only — never used as live request tenant when ALS is set. */
  private bootstrapId = '';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // this.bootstrapId = await seedDatabase(this.prisma);
    this.bootstrapId = 'no-seed';
  }

  get tenantId(): string {
    const id = this.als.getStore()?.tenantId;
    if (!id) {
      throw new Error('Tenant context missing — authenticated request must run inside ALS tenant scope.');
    }
    return id;
  }

  tryTenantId(): string {
    return this.als.getStore()?.tenantId || this.bootstrapId;
  }

  get userId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  get workspaceId(): string | undefined {
    return this.als.getStore()?.workspaceId;
  }

  run<T>(tenantId: string, fn: () => T, userId?: string, workspaceId?: string): T {
    return this.als.run({ tenantId, userId, workspaceId }, fn);
  }

  /** Prefer session tenant; do not flip global isActive. */
  async resolveBootstrap() {
    if (this.bootstrapId) return this.bootstrapId;
    const any = await this.prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } });
    this.bootstrapId = any?.id || '';
    return this.bootstrapId;
  }

  /** @deprecated No-op for isolation — kept for call-site compatibility. Session holds tenant. */
  async activate(id: string) {
    return id;
  }

  async refresh() {
    return this.tryTenantId() || this.resolveBootstrap();
  }
}
