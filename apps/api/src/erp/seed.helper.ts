// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';
import { modulesForBlueprint, distributorSizeLabels } from '../platform/catalog';
import { DEFAULT_PLANS, DEMO_PLAN_CODE, intersectModules, planSeedByCode } from '../platform/plans.util';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

async function ensurePlatformPlans(prisma: PrismaClient) {
  for (const p of DEFAULT_PLANS) {
    await prisma.platformPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        monthlyAmount: p.monthlyAmount,
        workspaceQuota: p.workspaceQuota,
        trialDays: p.trialDays,
        modulesJson: JSON.stringify(p.modules),
        sortOrder: p.sortOrder,
        isActive: true,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyAmount: p.monthlyAmount,
        workspaceQuota: p.workspaceQuota,
        trialDays: p.trialDays,
        modulesJson: JSON.stringify(p.modules),
        sortOrder: p.sortOrder,
        isActive: true,
      },
    });
  }
  return prisma.platformPlan.findUniqueOrThrow({ where: { code: DEMO_PLAN_CODE } });
}

const DEFAULT_SIZES = distributorSizeLabels();

async function upsertUser(
  prisma: PrismaClient,
  data: { email: string; name: string; role: string; tenantId: string; passwordHash: string; isPlatformAdmin?: boolean },
) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      role: data.role,
      tenantId: data.tenantId,
      passwordHash: data.passwordHash,
      isPlatformAdmin: data.isPlatformAdmin ?? false,
    },
    create: {
      email: data.email,
      name: data.name,
      role: data.role,
      tenantId: data.tenantId,
      passwordHash: data.passwordHash,
      isPlatformAdmin: data.isPlatformAdmin ?? false,
    },
  });
}

async function ensureMembership(prisma: PrismaClient, userId: string, tenantId: string, role: string) {
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { userId, workspaceId: tenantId } },
    update: { role },
    create: { userId, workspaceId: tenantId, role },
  });
}

async function seedServiceWorkspace(
  prisma: PrismaClient,
  opts: {
    code: string; name: string; blueprintId: string; phone: string; address: string;
    services: Array<{ name: string; category: string; unit: string; price: number }>;
    withAssets?: boolean;
  },
  demoHash: string,
  adminUserId: string,
) {
  const businessPlan = await prisma.platformPlan.findUnique({ where: { code: DEMO_PLAN_CODE } });
  const planMods = planSeedByCode(DEMO_PLAN_CODE)!.modules;
  const modules = intersectModules(modulesForBlueprint(opts.blueprintId), planMods);
  const tenant = await prisma.workspace.upsert({
    where: { code: opts.code },
    update: {
      name: opts.name,
      blueprintId: opts.blueprintId,
      blueprint: opts.name,
      phone: opts.phone,
      address: opts.address,
      modulesJson: JSON.stringify(modules),
      status: 'ACTIVE',
      isActive: true,
      planId: businessPlan?.id,
      commercialStatus: 'SUBSCRIBED',
      trialEndsAt: null,
    },
    create: {
      code: opts.code,
      name: opts.name,
      blueprintId: opts.blueprintId,
      blueprint: opts.name,
      phone: opts.phone,
      address: opts.address,
      modulesJson: JSON.stringify(modules),
      status: 'ACTIVE',
      isActive: true,
      planId: businessPlan?.id,
      commercialStatus: 'SUBSCRIBED',
      trialEndsAt: null,
    },
  });

  await ensureMembership(prisma, adminUserId, tenant.id, 'OWNER');

  if ((await prisma.serviceItem.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.serviceItem.createMany({
      data: opts.services.map((s) => ({ tenantId: tenant.id, ...s, active: true })),
    });
  }

  if ((await prisma.partner.count({ where: { tenantId: tenant.id, type: 'CUSTOMER' } })) === 0) {
    await prisma.partner.createMany({
      data: [
        { tenantId: tenant.id, name: 'Ibu Sari Wijaya', phone: '0812-1111-1001', address: 'Jl. Melati 12', type: 'CUSTOMER', notes: 'Langganan' },
        { tenantId: tenant.id, name: 'Bapak Andi Pratama', phone: '0812-1111-1002', address: 'Komplek Anggrek Blok B', type: 'CUSTOMER' },
        { tenantId: tenant.id, name: 'Kantor Mitra Sejahtera', phone: '021-555-0101', address: 'Gedung Mitra Lt. 3', type: 'CUSTOMER' },
      ],
    });
  }

  const customers = await prisma.partner.findMany({ where: { tenantId: tenant.id, type: 'CUSTOMER' } });
  const services = await prisma.serviceItem.findMany({ where: { tenantId: tenant.id } });

  if (opts.withAssets && (await prisma.assetUnit.count({ where: { tenantId: tenant.id } })) === 0 && customers[0]) {
    await prisma.assetUnit.createMany({
      data: [
        { tenantId: tenant.id, partnerId: customers[0].id, locationLabel: 'Ruang Tamu', brand: 'Daikin', acType: 'Split', capacity: '1 PK', nextServiceAt: new Date(Date.now() + 30 * 86400000) },
        { tenantId: tenant.id, partnerId: customers[1]?.id, locationLabel: 'Kamar Utama', brand: 'Panasonic', acType: 'Split', capacity: '0.5 PK' },
      ],
    });
  }

  if ((await prisma.workOrder.count({ where: { tenantId: tenant.id } })) === 0 && services[0] && customers[0]) {
    const mk = async (i: number, status: string, pay: string, assigned: string) => {
      const svc = services[i % services.length];
      const cust = customers[i % customers.length];
      const qty = 1;
      const price = Number(svc.price);
      const number = `WO-SEED-${opts.code.toUpperCase()}-${i + 1}`;
      await prisma.workOrder.create({
        data: {
          tenantId: tenant.id, number,
          partnerId: cust.id, customerName: cust.name, customerPhone: cust.phone,
          serviceAddress: cust.address, scheduleAt: new Date(Date.now() + i * 86400000),
          assignedTo: assigned, status, paymentStatus: pay,
          subtotal: price, discount: 0, extraCost: i === 1 ? 25000 : 0, total: price + (i === 1 ? 25000 : 0),
          notes: 'Demo seed order',
          lines: { create: [{ description: svc.name, itemType: svc.category, quantity: qty, unit: svc.unit, unitPrice: price, amount: price }] },
        },
      });
    };
    await mk(0, 'COMPLETED', 'PAID', 'Teknisi Demo');
    await mk(1, 'SCHEDULED', 'UNPAID', 'Teknisi Demo');
    await mk(2, 'IN_PROGRESS', 'PARTIAL', 'Teknisi Demo');
    await mk(3, 'NEW', 'UNPAID', '');
  }

  if ((await prisma.cashEntry.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.cashEntry.createMany({
      data: [
        { tenantId: tenant.id, category: 'Modal', description: 'Saldo awal', amount: 5000000, direction: 'IN', account: 'CASH' },
        { tenantId: tenant.id, category: 'Operasional', description: 'Bahan pembersih', amount: 350000, direction: 'OUT', account: 'CASH' },
        { tenantId: tenant.id, category: 'Penjualan Jasa', description: 'Pembayaran order seed', amount: 250000, direction: 'IN', account: 'CASH' },
      ],
    });
  }

  return tenant;
}

async function seedAquacultureWorkspace(
  prisma: PrismaClient,
  adminUserId: string,
) {
  const businessPlan = await prisma.platformPlan.findUnique({ where: { code: DEMO_PLAN_CODE } });
  const planMods = planSeedByCode(DEMO_PLAN_CODE)!.modules;
  const modules = intersectModules(modulesForBlueprint('operational_aquaculture_freshwater'), planMods);
  const tenant = await prisma.workspace.upsert({
    where: { code: 'demo-aqua' },
    update: {
      name: 'Tambak Lele Makmur',
      blueprintId: 'operational_aquaculture_freshwater',
      blueprint: 'Budidaya Air Tawar',
      phone: '0812-4000-1001',
      address: 'Desa Muara Jaya, Sukabumi',
      modulesJson: JSON.stringify(modules),
      status: 'ACTIVE',
      isActive: true,
      planId: businessPlan?.id,
      commercialStatus: 'SUBSCRIBED',
      trialEndsAt: null,
    },
    create: {
      code: 'demo-aqua',
      name: 'Tambak Lele Makmur',
      blueprintId: 'operational_aquaculture_freshwater',
      blueprint: 'Budidaya Air Tawar',
      phone: '0812-4000-1001',
      address: 'Desa Muara Jaya, Sukabumi',
      modulesJson: JSON.stringify(modules),
      status: 'ACTIVE',
      isActive: true,
      planId: businessPlan?.id,
      commercialStatus: 'SUBSCRIBED',
      trialEndsAt: null,
    },
  });

  await ensureMembership(prisma, adminUserId, tenant.id, 'OWNER');

  if ((await prisma.aquaPond.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.aquaPond.createMany({
      data: [
        { tenantId: tenant.id, code: 'K-01', name: 'Kolam Utama', areaM2: 500, volumeM3: 750, systemType: 'TANAH', status: 'ACTIVE', location: 'Blok A' },
        { tenantId: tenant.id, code: 'K-02', name: 'Kolam Pembesaran', areaM2: 320, volumeM3: 480, systemType: 'TERPAL', status: 'ACTIVE', location: 'Blok B' },
      ],
    });
  }

  if ((await prisma.aquaSpeciesProfile.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.aquaSpeciesProfile.createMany({
      data: [
        { tenantId: tenant.id, code: 'LELE', name: 'Lele (Clarias sp.)', defaultDensity: 80, densityUnit: 'ekor/m²', typicalDays: 90, typicalFcr: 1.2, typicalSrPct: 85, targetWeightGram: 120, defaultPriceHint: 28000, isActive: true },
        { tenantId: tenant.id, code: 'NILA', name: 'Nila (Oreochromis sp.)', defaultDensity: 60, densityUnit: 'ekor/m²', typicalDays: 120, typicalFcr: 1.5, typicalSrPct: 80, targetWeightGram: 250, defaultPriceHint: 32000, isActive: true },
      ],
    });
  }

  if ((await prisma.aquaFeedType.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.aquaFeedType.createMany({
      data: [
        { tenantId: tenant.id, name: 'Pakan Starter', brand: 'TumbuFeed', proteinPct: 32, unit: 'kg', defaultPrice: 14500, isActive: true },
        { tenantId: tenant.id, name: 'Pakan Grower', brand: 'TumbuFeed', proteinPct: 28, unit: 'kg', defaultPrice: 13200, isActive: true },
      ],
    });
  }

  if ((await prisma.cashEntry.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.cashEntry.create({
      data: { tenantId: tenant.id, category: 'Modal', description: 'Saldo awal operasional tambak', amount: 15000000, direction: 'IN', account: 'CASH' },
    });
  }

  return tenant;
}

export async function seedDatabase(prisma: PrismaClient): Promise<string> {
  const adminPass = hashPassword(process.env.ADMIN_PASSWORD || 'tumbu123');
  const demoPass = hashPassword(process.env.DEMO_USER_PASSWORD || 'TumbuDemo123!');

  const businessPlan = await ensurePlatformPlans(prisma);

  // Control Plane tetap non-enterable (idempotent).
  await prisma.workspace.updateMany({
    where: { code: '_tumbu_accounts' },
    data: { status: 'SUSPENDED', isActive: false },
  });

  // Trial & Plan backfill: demo / existing workspaces → Business + SUBSCRIBED
  await prisma.workspace.updateMany({
    where: { code: { not: '_tumbu_accounts' }, planId: null },
    data: {
      planId: businessPlan.id,
      commercialStatus: 'SUBSCRIBED',
      trialEndsAt: null,
    },
  });

  // Deactivate/Suspend dummy workspaces
  await prisma.workspace.updateMany({
    where: { code: { in: ['demo-farm', 'demo-aqua', 'kilap-km', 'freshseat', 'sejukcare', '_tumbu_accounts'] } },
    data: { status: 'SUSPENDED', isActive: false },
  });

  // Remove dummy users if present
  await prisma.user.deleteMany({
    where: {
      email: { in: ['owner.aqua@tumbu.local', 'admin.aqua@tumbu.local', 'multi@tumbu.local'] },
    },
  });

  // Ensure system admin exists for platform operations
  const admin = await upsertUser(prisma, {
    email: 'admin@tumbu.local',
    name: 'Admin TUMBU',
    role: 'OWNER',
    tenantId: '',
    passwordHash: adminPass,
    isPlatformAdmin: true,
  });

  return 'system-clean';
}

