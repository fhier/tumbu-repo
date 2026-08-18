import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../erp/tenant.context';
import {
  ACTIVE_CYCLE_STATES,
  PLAN_UPGRADE_MESSAGES,
  resolvePlanLimits,
  type PlanFeatureLimits,
} from './plan-limits';

@Injectable()
export class PlanQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  async getLimits(): Promise<PlanFeatureLimits> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: this.tid() },
      include: { plan: { select: { code: true } } },
    });
    return resolvePlanLimits(t?.plan?.code);
  }

  async assertCanCreatePond(): Promise<void> {
    const limits = await this.getLimits();
    if (limits.maxPonds == null) return;
    const count = await this.prisma.aquaPond.count({
      where: { tenantId: this.tid(), NOT: { status: 'RETIRED' } },
    });
    if (count >= limits.maxPonds) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGES.pondQuota);
    }
  }

  async assertCanCreateCycle(): Promise<void> {
    const limits = await this.getLimits();
    if (limits.maxActiveCycles == null) return;
    const count = await this.prisma.aquaCultureCycle.count({
      where: {
        tenantId: this.tid(),
        state: { in: [...ACTIVE_CYCLE_STATES] },
      },
    });
    if (count >= limits.maxActiveCycles) {
      throw new ForbiddenException(PLAN_UPGRADE_MESSAGES.cycleQuota);
    }
  }

  async assertFeature(
    feature: 'profitAdvisor' | 'financeReports' | 'exportReports' | 'multiWorkspace',
  ): Promise<void> {
    const limits = await this.getLimits();
    const ok =
      feature === 'profitAdvisor'
        ? limits.profitAdvisor
        : feature === 'financeReports'
          ? limits.financeReports
          : feature === 'exportReports'
            ? limits.exportReports
            : limits.multiWorkspace;
    if (!ok) {
      throw new ForbiddenException(
        feature === 'multiWorkspace'
          ? PLAN_UPGRADE_MESSAGES.multiWorkspace
          : PLAN_UPGRADE_MESSAGES.genericPro,
      );
    }
  }
}
