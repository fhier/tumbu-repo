import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  async create(@Body() body: {
    name?: string; businessName?: string; usaha?: string; phone?: string; wa?: string; email?: string; notes?: string;
  } = {}) {
    const name = String(body.name || '').trim();
    const businessName = String(body.businessName || body.usaha || '').trim();
    const phone = String(body.phone || body.wa || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name || !businessName || !phone || !email) {
      throw new BadRequestException('Nama, usaha, telepon, dan email wajib diisi.');
    }
    const lead = await this.prisma.interestLead.create({
      data: {
        name,
        businessName,
        phone,
        email,
        notes: body.notes?.trim() || null,
      },
    });
    await this.audit.log({
      action: 'lead.create',
      tenantId: null,
      entity: 'InterestLead',
      entityId: lead.id,
      meta: { email, businessName },
    });
    return { ok: true, id: lead.id, message: 'Minat berhasil dicatat.' };
  }
}
