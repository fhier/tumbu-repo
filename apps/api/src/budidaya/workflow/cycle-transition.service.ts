// @ts-nocheck
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertCycleTransition,
  type CycleTransitionTrigger,
} from './cycle-transition';
import type { CycleState } from '../domain/enums';

/**
 * Satu-satunya jalur penulisan `AquaCultureCycle.state`.
 * Service/controller lain memanggil ini — bukan `prisma.update({ state })` langsung.
 */
@Injectable()
export class CycleTransitionService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(input: {
    cycleId: string;
    tenantId: string;
    to: CycleState;
    trigger: CycleTransitionTrigger;
    extra?: { startedAt?: Date; closedAt?: Date | null };
  }) {
    const cycle = await this.prisma.aquaCultureCycle.findFirst({
      where: { id: input.cycleId, tenantId: input.tenantId },
    });
    if (!cycle) {
      throw new NotFoundException('Siklus tidak ditemukan.');
    }
    assertCycleTransition(cycle.state, input.to, input.trigger);

    const data: {
      state: CycleState;
      startedAt?: Date;
      closedAt?: Date | null;
    } = { state: input.to };

    if (input.extra?.startedAt !== undefined) data.startedAt = input.extra.startedAt;
    if (input.extra?.closedAt !== undefined) data.closedAt = input.extra.closedAt;
    if (input.to === 'CLOSED' && data.closedAt === undefined) {
      data.closedAt = new Date();
    }
    if (input.to === 'ACTIVE' && !cycle.startedAt && data.startedAt === undefined) {
      data.startedAt = new Date();
    }

    return this.prisma.aquaCultureCycle.update({
      where: { id: cycle.id },
      data,
    });
  }
}

