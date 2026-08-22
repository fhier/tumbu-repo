// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function maskSensitive(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);
  const copy = { ...obj };
  for (const [k, v] of Object.entries(copy)) {
    if (typeof v === 'string' && /token|secret|password|key|hmac|signature/i.test(k)) {
      copy[k] = '***';
    } else if (v && typeof v === 'object') {
      copy[k] = maskSensitive(v);
    }
  }
  return copy;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    action: string;
    userId?: string | null;
    tenantId?: string | null;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          userId: input.userId || null,
          tenantId: input.tenantId ?? null,
          entity: input.entity || null,
          entityId: input.entityId || null,
          metaJson: JSON.stringify(maskSensitive(input.meta || {})),
        },
      });
    } catch {
      /* never break business flow for audit */
    }
  }

  async list(limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      tenantId: r.tenantId,
      entity: r.entity,
      entityId: r.entityId,
      meta: (() => { try { return JSON.parse(r.metaJson || '{}'); } catch { return {}; } })(),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

