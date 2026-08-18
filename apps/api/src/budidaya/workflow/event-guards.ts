/**
 * Workflow guards for production events (WORKFLOW.md §5).
 * Access (who) remains in Roles/guards — this file is "when" only.
 */

import { BadRequestException } from '@nestjs/common';
import type { CycleState } from '../domain/enums';
import { isTerminalCycleState } from './cycle-transition';

/** Event kinds that may be recorded against a cycle (append-only). */
export type V1EventKind =
  | 'STOCKING'
  | 'FEED'
  | 'MORTALITY'
  | 'SAMPLING'
  | 'MEDICINE'
  | 'EXPENSE'
  | 'HARVEST'
  | 'CLOSE';

const STATE_LABEL: Record<string, string> = {
  PLANNED: 'Perencanaan',
  READY: 'Siap tebar',
  ACTIVE: 'Berjalan',
  HARVESTING: 'Panen',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function stateLabel(state: string): string {
  return STATE_LABEL[state] || state;
}

function assertActiveOrHarvesting(label: string, state: string): void {
  if (state !== 'ACTIVE' && state !== 'HARVESTING') {
    throw new BadRequestException(
      `${label} hanya bisa dicatat saat siklus berjalan atau panen (status sekarang: ${stateLabel(state)}).`,
    );
  }
}

export function assertEventAllowedOnState(kind: V1EventKind, state: string): void {
  if (isTerminalCycleState(state as CycleState)) {
    throw new BadRequestException(
      `Siklus sudah ${stateLabel(state)} — tidak bisa menambah catatan operasional baru.`,
    );
  }
  switch (kind) {
    case 'STOCKING':
      if (state !== 'READY') {
        throw new BadRequestException(
          `Tebar benih hanya bisa dicatat saat siklus siap tebar (status sekarang: ${stateLabel(state)}).`,
        );
      }
      return;
    case 'FEED':
      assertActiveOrHarvesting('Catatan pakan', state);
      return;
    case 'MORTALITY':
      assertActiveOrHarvesting('Catatan kematian', state);
      return;
    case 'SAMPLING':
      assertActiveOrHarvesting('Catatan sampling', state);
      return;
    case 'MEDICINE':
      assertActiveOrHarvesting('Catatan obat', state);
      return;
    case 'EXPENSE':
      assertActiveOrHarvesting('Catatan biaya', state);
      return;
    case 'HARVEST':
      assertActiveOrHarvesting('Catatan panen', state);
      return;
    case 'CLOSE':
      assertActiveOrHarvesting('Penutupan siklus', state);
      return;
    default:
      throw new BadRequestException('Jenis catatan tidak dikenal.');
  }
}
