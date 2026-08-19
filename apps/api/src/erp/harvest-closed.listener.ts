import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Listener for the `harvest.closed` event emitted by the BudidayaEventService.
 * Currently logs the cycleId; additional post‑harvest actions can be placed here.
 */
@Injectable()
export class HarvestClosedListener {
  private readonly logger = new Logger(HarvestClosedListener.name);

  @OnEvent('harvest.closed')
  handleHarvestClosed(payload: { cycleId: string }) {
    this.logger.log(`Harvest closed for cycle ${payload.cycleId}`);
    // TODO: implement any ERP side‑effects needed after a harvest is closed.
  }
}
