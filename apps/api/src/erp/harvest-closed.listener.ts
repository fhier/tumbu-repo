import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Listener for the `harvest.closed` event emitted by the BudidayaEventService.
 * Automatically records InventoryBatch and logs HPP/COGS when a cycle is closed.
 */
@Injectable()
export class HarvestClosedListener {
  private readonly logger = new Logger(HarvestClosedListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('harvest.closed')
  async handleHarvestClosed(payload: { cycleId: string }) {
    this.logger.log(`Harvest closed for cycle ${payload.cycleId}, processing ERP side-effects...`);
    
    try {
      const cycle = await this.prisma.aquaCycle.findUnique({
        where: { id: payload.cycleId },
        include: { harvestLogs: true, harvestSummary: true }
      });

      if (!cycle) {
        this.logger.warn(`Cycle ${payload.cycleId} not found.`);
        return;
      }

      if (!cycle.finalTotalHarvestKg || cycle.finalTotalHarvestKg <= 0) {
        this.logger.warn(`Cycle ${payload.cycleId} has no harvest weight. Skipping inventory batch.`);
        return;
      }

      // Calculate HPP (Cost of Goods Sold / Cost per Kg)
      const totalCost = Number(cycle.totalCostRp || 0);
      const totalKg = cycle.finalTotalHarvestKg;
      const hppPerKg = totalKg > 0 ? totalCost / totalKg : 0;

      // Update or Create HarvestSummary with HPP
      await this.prisma.harvestSummary.upsert({
        where: { cycleId: cycle.id },
        update: { hpp: hppPerKg },
        create: {
          cycleId: cycle.id,
          hpp: hppPerKg,
          fcr: cycle.finalFcr,
          srPct: cycle.finalSurvivalPct,
        }
      });

      // Find or Create Product Category for Harvest
      let category = await this.prisma.productCategory.findFirst({
        where: { workspaceId: cycle.workspaceId, name: 'Hasil Panen' }
      });
      
      if (!category) {
        category = await this.prisma.productCategory.create({
          data: {
            workspaceId: cycle.workspaceId,
            name: 'Hasil Panen',
          }
        });
      }

      // Find or Create Product
      const sku = `HVST-${cycle.species.toUpperCase()}`;
      let product = await this.prisma.product.findUnique({
        where: { workspaceId_sku: { workspaceId: cycle.workspaceId, sku } }
      });

      if (!product) {
        product = await this.prisma.product.create({
          data: {
            workspaceId: cycle.workspaceId,
            categoryId: category.id,
            sku,
            name: `Ikan Hidup - ${cycle.species}`,
            unit: 'kg',
            basePrice: hppPerKg,
            salePrice: hppPerKg * 1.2, // Default 20% margin
            currentStock: 0
          }
        });
      }

      // Record Inventory Batch
      const batchNumber = `BATCH-${cycle.cycleCode}`;
      
      // Check if batch already exists to prevent duplicate entries
      const existingBatch = await this.prisma.inventoryBatch.findFirst({
        where: { workspaceId: cycle.workspaceId, batchNumber }
      });

      if (!existingBatch) {
        await this.prisma.inventoryBatch.create({
          data: {
            workspaceId: cycle.workspaceId,
            productId: product.id,
            batchNumber,
            initialQty: totalKg,
            remainingQty: totalKg,
            buyPrice: hppPerKg,
            storageNote: `Otomatis dari Panen Siklus ${cycle.cycleCode}`
          }
        });

        // Update product current stock
        await this.prisma.product.update({
          where: { id: product.id },
          data: { currentStock: { increment: totalKg }, basePrice: hppPerKg }
        });
        
        this.logger.log(`Successfully created InventoryBatch ${batchNumber} for cycle ${cycle.id}`);
      } else {
        this.logger.log(`InventoryBatch ${batchNumber} already exists. Skipping creation.`);
      }

    } catch (error) {
      this.logger.error(`Failed to process ERP side-effects for harvest ${payload.cycleId}`, error);
    }
  }
}
